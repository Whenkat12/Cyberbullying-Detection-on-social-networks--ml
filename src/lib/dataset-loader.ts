// Dataset loader: parses the cyberbullying CSV and builds word frequency maps

export interface DatasetEntry {
  text: string;
  label: number; // -1 = bullying, 0 = non-bullying
}

export interface WordStats {
  bullyCount: number;
  nonBullyCount: number;
  bullyFreq: number;    // P(word | bullying)
  nonBullyFreq: number; // P(word | non-bullying)
  idf: number;          // inverse document frequency
  tfidfBully: number;   // tf-idf weight for bully class
}

export interface DatasetModel {
  vocabulary: Map<string, WordStats>;
  totalBully: number;
  totalNonBully: number;
  totalDocs: number;
  priorBully: number;     // P(bullying)
  priorNonBully: number;  // P(non-bullying)
  bullyWordCount: number;
  nonBullyWordCount: number;
  vocabSize: number;
  isLoaded: boolean;
  sampleBully: DatasetEntry[];
  sampleNonBully: DatasetEntry[];
}

let cachedModel: DatasetModel | null = null;
let loadingPromise: Promise<DatasetModel> | null = null;

function parseCSV(csvText: string): DatasetEntry[] {
  const lines = csvText.split("\n");
  const entries: DatasetEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Support both CSV formats:
    // 1) headline,label
    // 2) headline,label,detailed_category
    const lastComma = line.lastIndexOf(",");
    if (lastComma === -1) continue;

    const secondLastComma = line.lastIndexOf(",", lastComma - 1);
    const textEndIndex = secondLastComma === -1 ? lastComma : secondLastComma;
    const labelStartIndex = secondLastComma === -1 ? lastComma + 1 : secondLastComma + 1;
    const labelEndIndex = secondLastComma === -1 ? line.length : lastComma;

    const text = line.substring(0, textEndIndex).trim();
    const labelStr = line.substring(labelStartIndex, labelEndIndex).trim();
    const label = parseInt(labelStr, 10);

    if ((label === -1 || label === 0) && text.length > 0) {
      // Remove surrounding quotes if present
      const cleanText = text.replace(/^["﻿]+|["]+$/g, "").trim();
      if (cleanText.length > 2) {
        entries.push({ text: cleanText, label });
      }
    }
  }

  return entries;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

// Stop words to ignore in TF-IDF
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "before", "after", "above", "below", "between", "out", "off", "over",
  "under", "again", "further", "then", "once", "here", "there", "when",
  "where", "why", "how", "all", "both", "each", "few", "more", "most",
  "other", "some", "such", "no", "nor", "not", "only", "own", "same",
  "so", "than", "too", "very", "just", "because", "but", "and", "or",
  "if", "while", "about", "up", "it", "its", "it's", "he", "she",
  "they", "them", "his", "her", "their", "this", "that", "these",
  "those", "am", "what", "which", "who", "whom", "my", "me", "we",
  "our", "your", "him", "i", "ii", "don", "don't", "doesn", "doesn't",
  "didn", "didn't", "won", "won't", "wouldn", "wouldn't", "isn", "isn't",
  "aren", "aren't", "wasn", "wasn't", "weren", "weren't",
]);

function buildModel(entries: DatasetEntry[]): DatasetModel {
  const bullyEntries = entries.filter((e) => e.label === -1);
  const nonBullyEntries = entries.filter((e) => e.label === 0);

  const totalBully = bullyEntries.length;
  const totalNonBully = nonBullyEntries.length;
  const totalDocs = entries.length;

  // Count word occurrences per class
  const bullyWordCounts = new Map<string, number>();
  const nonBullyWordCounts = new Map<string, number>();
  const docFrequency = new Map<string, number>(); // how many docs contain this word

  let totalBullyWords = 0;
  let totalNonBullyWords = 0;

  for (const entry of entries) {
    const words = tokenize(entry.text);
    const uniqueWords = new Set(words);

    // Document frequency
    for (const w of uniqueWords) {
      if (STOP_WORDS.has(w)) continue;
      docFrequency.set(w, (docFrequency.get(w) || 0) + 1);
    }

    // Class word counts
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

  // Build vocabulary with stats
  const vocabulary = new Map<string, WordStats>();
  const allWords = new Set([...bullyWordCounts.keys(), ...nonBullyWordCounts.keys()]);
  const vocabSize = allWords.size;

  for (const word of allWords) {
    const bc = bullyWordCounts.get(word) || 0;
    const nbc = nonBullyWordCounts.get(word) || 0;
    const df = docFrequency.get(word) || 1;

    // Laplace smoothing for Naive Bayes
    const bullyFreq = (bc + 1) / (totalBullyWords + vocabSize);
    const nonBullyFreq = (nbc + 1) / (totalNonBullyWords + vocabSize);

    const idf = Math.log(totalDocs / df);
    const tfidfBully = (bc / Math.max(totalBullyWords, 1)) * idf;

    vocabulary.set(word, {
      bullyCount: bc,
      nonBullyCount: nbc,
      bullyFreq,
      nonBullyFreq,
      idf,
      tfidfBully,
    });
  }

  // Random samples for UI
  const sampleBully = bullyEntries
    .filter((e) => e.text.length > 15 && e.text.length < 150)
    .slice(0, 20);
  const sampleNonBully = nonBullyEntries
    .filter((e) => e.text.length > 15 && e.text.length < 150)
    .slice(0, 20);

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

export async function loadDatasetModel(): Promise<DatasetModel> {
  if (cachedModel) return cachedModel;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      // Try to load a precomputed model from backend first, then static file.
      try {
        // prefer backend endpoint if available
        let modelResp = await fetch("/api/model");
        if (!modelResp.ok) {
          // fallback to static model.json in public
          modelResp = await fetch("/data/model.json");
        }
        if (modelResp.ok) {
          const modelJson = await modelResp.json();
          // Convert vocabulary object to Map<string, WordStats>
          const vocabMap = new Map<string, WordStats>();
          if (modelJson.vocabulary && typeof modelJson.vocabulary === 'object') {
            for (const [k, v] of Object.entries(modelJson.vocabulary)) {
              vocabMap.set(k, {
                bullyCount: (v as any).bullyCount || 0,
                nonBullyCount: (v as any).nonBullyCount || 0,
                bullyFreq: (v as any).bullyFreq || 0,
                nonBullyFreq: (v as any).nonBullyFreq || 0,
                idf: (v as any).idf || 0,
                tfidfBully: (v as any).tfidfBully || 0,
              });
            }
          }

          cachedModel = {
            vocabulary: vocabMap,
            totalBully: modelJson.totalBully || 0,
            totalNonBully: modelJson.totalNonBully || 0,
            totalDocs: modelJson.totalDocs || 0,
            priorBully: modelJson.priorBully || 0,
            priorNonBully: modelJson.priorNonBully || 0,
            bullyWordCount: modelJson.bullyWordCount || 0,
            nonBullyWordCount: modelJson.nonBullyWordCount || 0,
            vocabSize: modelJson.vocabSize || vocabMap.size,
            isLoaded: true,
            sampleBully: modelJson.sampleBully || [],
            sampleNonBully: modelJson.sampleNonBully || [],
          };
          console.log(`[ML] Loaded precomputed model: ${cachedModel.totalDocs} entries, ${cachedModel.vocabSize} vocabulary`);
          return cachedModel;
        }
      } catch (err) {
        // ignore and fallback to building from CSV
        console.warn('[ML] No precomputed model found, falling back to CSV build:', err);
      }

      // Fallback: build model from CSV in the browser
      const response = await fetch("/data/classified_dataset.csv");
      if (!response.ok) throw new Error("Failed to load dataset");
      const csvText = await response.text();
      const entries = parseCSV(csvText);
      cachedModel = buildModel(entries);
      console.log(
        `[ML] Dataset loaded: ${cachedModel.totalDocs} entries, ${cachedModel.vocabSize} vocabulary, ` +
        `${cachedModel.totalBully} bullying, ${cachedModel.totalNonBully} non-bullying`
      );
      return cachedModel;
    } catch (err) {
      console.error("[ML] Failed to load dataset:", err);
      loadingPromise = null;
      throw err;
    }
  })();

  return loadingPromise;
}

export function getModelSync(): DatasetModel | null {
  return cachedModel;
}
