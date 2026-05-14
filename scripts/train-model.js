import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const DATA_CSV = path.join(__dirname, '..', 'public', 'data', 'classified_dataset.csv');
const OUT_JSON = path.join(__dirname, '..', 'public', 'data', 'model.json');

if (!fs.existsSync(DATA_CSV)) {
  console.error('Dataset CSV not found at', DATA_CSV);
  process.exit(1);
}

const STOP_WORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being",
  "have","has","had","do","does","did","will","would","could",
  "should","may","might","shall","can","to","of","in","for",
  "on","with","at","by","from","as","into","through","during",
  "before","after","above","below","between","out","off","over",
  "under","again","further","then","once","here","there","when",
  "where","why","how","all","both","each","few","more","most",
  "other","some","such","no","nor","not","only","own","same",
  "so","than","too","very","just","because","but","and","or",
  "if","while","about","up","it","its","it's","he","she",
  "they","them","his","her","their","this","that","these",
  "those","am","what","which","who","whom","my","me","we",
  "our","your","him","i","ii","don","don't","doesn","doesn't",
  "didn","didn't","won","won't","wouldn","wouldn't","isn","isn't",
  "aren","aren't","wasn","wasn't","weren","weren't",
]);

function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const lastComma = line.lastIndexOf(',');
    if (lastComma === -1) continue;
    const secondLastComma = line.lastIndexOf(',', lastComma - 1);
    const textEndIndex = secondLastComma === -1 ? lastComma : secondLastComma;
    const labelStartIndex = secondLastComma === -1 ? lastComma + 1 : secondLastComma + 1;
    const labelEndIndex = secondLastComma === -1 ? line.length : lastComma;

    const text = line.substring(0, textEndIndex).trim();
    const labelStr = line.substring(labelStartIndex, labelEndIndex).trim();
    const label = parseInt(labelStr, 10);
    if ((label === -1 || label === 0) && text.length > 0) {
      const cleanText = text.replace(/^"+|"+$/g, '').trim();
      if (cleanText.length > 2) entries.push({ text: cleanText, label });
    }
  }
  return entries;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function buildModel(entries) {
  const bullyEntries = entries.filter((e) => e.label === -1);
  const nonBullyEntries = entries.filter((e) => e.label === 0);

  const totalBully = bullyEntries.length;
  const totalNonBully = nonBullyEntries.length;
  const totalDocs = entries.length;

  const bullyWordCounts = new Map();
  const nonBullyWordCounts = new Map();
  const docFrequency = new Map();

  let totalBullyWords = 0;
  let totalNonBullyWords = 0;

  for (const entry of entries) {
    const words = tokenize(entry.text);
    const uniqueWords = new Set(words);
    for (const w of uniqueWords) {
      if (STOP_WORDS.has(w)) continue;
      docFrequency.set(w, (docFrequency.get(w) || 0) + 1);
    }
    for (const w of words) {
      if (STOP_WORDS.has(w)) continue;
      if (entry.label === -1) {
        bullyWordCounts.set(w, (bullyWordCounts.get(w) || 0) + 1);
        totalBullyWords++;
      } else {
        nonBullyWordCounts.set(w, (nonBullyWordCounts.get(w) || 0) + 1);
        totalNonBullyWords++;
      }
    }
  }

  const allWords = new Set([...bullyWordCounts.keys(), ...nonBullyWordCounts.keys()]);
  const vocabSize = allWords.size;
  const vocabulary = {};

  for (const word of allWords) {
    const bc = bullyWordCounts.get(word) || 0;
    const nbc = nonBullyWordCounts.get(word) || 0;
    const df = docFrequency.get(word) || 1;
    const bullyFreq = (bc + 1) / (totalBullyWords + vocabSize);
    const nonBullyFreq = (nbc + 1) / (totalNonBullyWords + vocabSize);
    const idf = Math.log(totalDocs / df);
    const tfidfBully = (bc / Math.max(totalBullyWords, 1)) * idf;
    vocabulary[word] = {
      bullyCount: bc,
      nonBullyCount: nbc,
      bullyFreq,
      nonBullyFreq,
      idf,
      tfidfBully,
    };
  }

  const sampleBully = bullyEntries.filter((e) => e.text.length > 15 && e.text.length < 150).slice(0, 20);
  const sampleNonBully = nonBullyEntries.filter((e) => e.text.length > 15 && e.text.length < 150).slice(0, 20);

  return {
    vocabulary,
    totalBully,
    totalNonBully,
    totalDocs,
    priorBully: totalBully / totalDocs,
    priorNonBully: totalNonBully / totalDocs,
    bullyWordCount: totalBullyWords,
    nonBullyWordCount: totalNonBullyWords,
    vocabSize,
    isLoaded: true,
    sampleBully,
    sampleNonBully,
  };
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function splitDataset(entries, trainRatio = 0.8) {
  const shuffled = [...entries];
  shuffleArray(shuffled);
  const trainSize = Math.floor(shuffled.length * trainRatio);
  const train = shuffled.slice(0, trainSize);
  const test = shuffled.slice(trainSize);
  return { train, test, trainSize, testSize: test.length };
}

function classifyText(model, text) {
  const words = tokenize(text);
  if (words.length === 0) return { label: 'Non-Bullying', confidence: 0.5 };

  const vocab = model.vocabulary || {};
  const vocabSize = model.vocabSize || 1;

  let logB = Math.log(model.priorBully || 1e-9);
  let logN = Math.log(model.priorNonBully || 1e-9);

  for (const word of words) {
    const stats = vocab[word];
    if (stats) {
      const idf = Math.max(stats.idf || 0.1, 0.1);
      logB += Math.log(stats.bullyFreq || 1e-9) * idf;
      logN += Math.log(stats.nonBullyFreq || 1e-9) * idf;
    } else {
      const unknown = 1 / (vocabSize + 1);
      logB += Math.log(unknown);
      logN += Math.log(unknown);
    }
  }

  const maxLog = Math.max(logB, logN);
  const pB = Math.exp(logB - maxLog);
  const pN = Math.exp(logN - maxLog);
  const normalized = pB / (pB + pN);
  const isBullying = normalized > 0.5;
  const confidence = Math.min(Math.max(normalized, 0.51), 0.99);

  return {
    label: isBullying ? 'Bullying' : 'Non-Bullying',
    confidence,
  };
}

function evaluateModel(model, testEntries) {
  const results = {
    total: testEntries.length,
    correct: 0,
    tp: 0,
    tn: 0,
    fp: 0,
    fn: 0,
  };

  for (const entry of testEntries) {
    const pred = classifyText(model, entry.text);
    const isBullying = pred.label === 'Bullying';
    const actualBullying = entry.label === -1;
    if (isBullying === actualBullying) {
      results.correct += 1;
      if (isBullying) results.tp += 1;
      else results.tn += 1;
    } else {
      if (isBullying) results.fp += 1;
      else results.fn += 1;
    }
  }

  const accuracy = results.total ? results.correct / results.total : 0;
  const precision = results.tp + results.fp ? results.tp / (results.tp + results.fp) : 0;
  const recall = results.tp + results.fn ? results.tp / (results.tp + results.fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    accuracy,
    precision,
    recall,
    f1,
    ...results,
  };
}

(async function main() {
  try {
    const csvText = fs.readFileSync(DATA_CSV, 'utf8');
    const entries = parseCSV(csvText);
    console.log('[train-model] Parsed entries:', entries.length);

    const { train, test, trainSize, testSize } = splitDataset(entries, 0.8);
    console.log(`[train-model] Split ${entries.length} entries into train=${trainSize} test=${testSize}`);

    const model = buildModel(train);
    const evaluation = evaluateModel(model, test);

    const output = {
      ...model,
      split: {
        trainRatio: 0.8,
        trainSize,
        testSize,
      },
      evaluation,
      generatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2));
    console.log('[train-model] Wrote model to', OUT_JSON, 'vocabSize=', model.vocabSize);
    console.log('[train-model] Evaluation:', evaluation);
  } catch (err) {
    console.error('[train-model] Error:', err);
    process.exit(1);
  }
})();
