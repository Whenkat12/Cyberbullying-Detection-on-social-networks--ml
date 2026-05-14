import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import natural from 'natural';
import { Matrix } from 'ml-matrix';
import csv from 'csv-parser';
import { createReadStream } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @typedef {Object} WordStats
 * @property {number} bullyCount
 * @property {number} nonBullyCount
 * @property {number} bullyFreq
 * @property {number} nonBullyFreq
 * @property {number} idf
 * @property {number} tfidfBully
 */

/**
 * @typedef {Object} DetectionResult
 * @property {string} label
 * @property {string} detailedCategory
 * @property {number} confidence
 * @property {'Low' | 'Medium' | 'High' | 'Critical'} severity
 * @property {string[]} flaggedWords
 * @property {Object} details
 * @property {string} details.detailedCategory
 * @property {number} details.combinedScore
 * @property {number} details.keywordScore
 * @property {number} details.phraseScore
 * @property {number} details.mlScore
 * @property {number} details.mlConfidence
 * @property {string} details.mlMethod
 * @property {Array<{word:string,weight:number}>} details.mlTopWords
 * @property {boolean} details.targetedAtPerson
 * @property {number} details.capsRatio
 * @property {number} details.exclamationCount
 * @property {number} details.intensifierBoost
 */

/**
 * @typedef {Object} MLModel
 * @property {Map<string, WordStats>} vocabulary
 * @property {number} totalBully
 * @property {number} totalNonBully
 * @property {number} totalDocs
 * @property {number} priorBully
 * @property {number} priorNonBully
 * @property {number} bullyWordCount
 * @property {number} nonBullyWordCount
 * @property {number} vocabSize
 * @property {string} version
 * @property {Date} lastUpdated
 * @property {number} accuracy
 * @property {number} precision
 * @property {number} recall
 * @property {number} f1Score
 */

class CyberbullyingDetector {
  constructor() {
    this.model = null;
    this.modelPath = null;
    this.datasetPath = null;
    this.isLoaded = false;

    // Strong keywords: slurs, explicit insults, threats — always counted
    this.STRONG_KEYWORDS = {
      kill: 0.95, murder: 0.95, kll: 0.9, rape: 0.95,
      stab: 0.9, strangle: 0.9, torture: 0.85,
      retard: 0.85, retarded: 0.85, cripple: 0.8, spastic: 0.8,
      whore: 0.85, slut: 0.85, hoe: 0.8, skank: 0.8, thot: 0.75,
      bitch: 0.8, bastard: 0.75, asshole: 0.8, cunt: 0.9, twat: 0.8,
      fuck: 0.7, fucking: 0.7, fucked: 0.7, fucker: 0.8, fck: 0.7,
      fuk: 0.7, stfu: 0.7, gtfo: 0.65,
      shit: 0.55, shitty: 0.55, bullshit: 0.5,
      nigger: 0.95, nigga: 0.8, negro: 0.8, chink: 0.9, gook: 0.9,
      spic: 0.9, wetback: 0.9, kike: 0.9, fag: 0.85, faggot: 0.9,
      dyke: 0.85, tranny: 0.85,
      idiot: 0.7, moron: 0.7, stupid: 0.65, dumb: 0.6,
      ugly: 0.7, worthless: 0.8, useless: 0.75, pathetic: 0.7,
      disgusting: 0.65, trash: 0.6, freak: 0.6,
      psycho: 0.65, sicko: 0.65, pervert: 0.7, creep: 0.6,
      loser: 0.65, scum: 0.7, scumbag: 0.75, filthy: 0.6,
      braindead: 0.65, brainless: 0.6, subhuman: 0.8, inhuman: 0.65,
      cockroach: 0.6, vermin: 0.65, parasite: 0.6,
      degenerate: 0.6, imbecile: 0.6,
      kys: 0.95, kms: 0.7,
      bully: 0.75, harass: 0.8, abuse: 0.75, stalk: 0.75, stalking: 0.8,
      threat: 0.85, threaten: 0.85,
      dork: 0.4, dumbo: 0.5, dummy: 0.45, dimwit: 0.5,
      jerk: 0.55, prick: 0.65, dick: 0.55, cock: 0.6,
      weirdo: 0.45, bozo: 0.45, buffoon: 0.45, clown: 0.4,
      incel: 0.55,
    };

    // Contextual keywords: only count when targeting a person or combined with other bullying signal
    this.CONTEXTUAL_KEYWORDS = {
      hate: 0.6, fat: 0.5,
      die: 0.7, dead: 0.6, death: 0.65, suicide: 0.7,
      shoot: 0.6, bomb: 0.5, hang: 0.5, choke: 0.5,
      poison: 0.5, burn: 0.4, drown: 0.5, knife: 0.4, gun: 0.4,
      hurt: 0.5, punch: 0.7, beat: 0.5, destroy: 0.45,
      attack: 0.5, smash: 0.4, crush: 0.35, slam: 0.3,
      hit: 0.35, kick: 0.45, slap: 0.55, smack: 0.5,
      bash: 0.5, wreck: 0.4, ruin: 0.35,
      humiliate: 0.6, shame: 0.45, mock: 0.45, ridicule: 0.5,
      taunt: 0.5, torment: 0.65,
      fool: 0.4, weak: 0.3, lame: 0.25, annoying: 0.25,
      terrible: 0.25, horrible: 0.3, awful: 0.3,
      suck: 0.35, sucks: 0.35, worst: 0.3,
      pig: 0.4, cow: 0.35, dog: 0.3, animal: 0.25, monkey: 0.45,
      failure: 0.45, reject: 0.4, rejected: 0.35,
      unwanted: 0.45, unloved: 0.5, nobody: 0.35, nothing: 0.25,
      invisible: 0.35, ignored: 0.3,
      hopeless: 0.45, helpless: 0.4, pitiful: 0.45, inferior: 0.45,
      nasty: 0.4, gross: 0.3, toxic: 0.4,
      leech: 0.45, mindless: 0.35, clueless: 0.3,
      homo: 0.65, queer: 0.45, terrorist: 0.5,
      revenge: 0.55, payback: 0.45,
      disappear: 0.4, vanish: 0.35, undeserving: 0.4,
      noob: 0.25, scrub: 0.3, troll: 0.3, simp: 0.3, virgin: 0.35,
      pussy: 0.55, ass: 0.35, wtf: 0.25,
      embarrassment: 0.4, embarrassing: 0.3,
      neck: 0.35, rope: 0.35,
      cancer: 0.4, disease: 0.35, plague: 0.35,
      expose: 0.3,
    };

    this.BULLY_PHRASES = [
      { phrase: 'kill yourself', score: 1.0 },
      { phrase: 'kys', score: 0.95 },
      { phrase: 'go die', score: 0.95 },
      { phrase: 'you deserve to die', score: 0.95 },
      { phrase: 'fuck you', score: 0.8 },
      { phrase: 'shut the fuck up', score: 0.85 },
      { phrase: 'stupid bitch', score: 0.8 },
      { phrase: 'dumb ass', score: 0.7 },
      { phrase: 'piece of shit', score: 0.75 }
    ];

    this.INTENSIFIERS = ['very', 'so', 'really', 'extremely', 'fucking', 'super', 'totally'];
    this.NEGATIONS = ['not', 'no', 'never', "don't", "doesn't", "isn't", "aren't", "won't"];
    this.TARGET_PRONOUNS = ['you', 'your', "you're", 'ur', 'u', 'yours', 'yourself'];

    this.THREATENING_TERMS = new Set([
      'kill', 'kll', 'murder', 'stab', 'strangle', 'torture', 'die', 'death', 'dead', 'suicide',
      'shoot', 'bomb', 'hang', 'choke', 'poison', 'burn', 'drown', 'knife', 'gun',
      'hurt', 'punch', 'beat', 'attack', 'smash', 'kick', 'slap', 'smack', 'bash',
      'threat', 'threaten', 'revenge', 'payback', 'rope', 'neck',
    ]);
    this.HATE_SPEECH_TERMS = new Set([
      'nigger', 'nigga', 'negro', 'chink', 'gook', 'spic', 'wetback', 'kike',
      'fag', 'faggot', 'dyke', 'tranny', 'homo', 'queer', 'nazi', 'terrorist',
    ]);
    this.SEXUAL_HARASSMENT_TERMS = new Set([
      'whore', 'slut', 'hoe', 'skank', 'thot', 'bitch', 'cunt', 'twat',
      'dick', 'cock', 'pussy', 'pervert', 'creep', 'rape',
    ]);
    
    this.modelPath = path.join(__dirname, '../data/model.json');
    this.datasetPath = path.join(__dirname, '../data/classified_dataset.csv');
  }

  async initialize() {
    try {
      await this.loadModel();
      console.log('✅ Cyberbullying detector initialized');
    } catch (error) {
      console.log('⚠️  Model not found, training from dataset...');
      await this.trainModel();
    }
  }

  async loadModel() {
    try {
      const modelData = await fs.readFile(this.modelPath, 'utf8');
      const parsed = JSON.parse(modelData);
      
      // Convert vocabulary object back to Map
      const vocabulary = new Map();
      if (parsed.vocabulary && typeof parsed.vocabulary === 'object') {
        for (const [word, stats] of Object.entries(parsed.vocabulary)) {
          vocabulary.set(word, stats);
        }
      }

      this.model = {
        ...parsed,
        vocabulary,
        lastUpdated: new Date(parsed.lastUpdated)
      };

      this.isLoaded = true;
      console.log(`✅ Model loaded: ${this.model.totalDocs} docs, ${this.model.vocabSize} vocabulary`);
      return this.model;
    } catch (error) {
      throw new Error(`Failed to load model: ${error.message}`);
    }
  }

  async saveModel() {
    if (!this.model) throw new Error('No model to save');

    try {
      // Convert Map to object for JSON serialization
      const vocabularyObj = {};
      for (const [word, stats] of this.model.vocabulary) {
        vocabularyObj[word] = stats;
      }

      const modelData = {
        ...this.model,
        vocabulary: vocabularyObj,
        lastUpdated: this.model.lastUpdated.toISOString()
      };

      await fs.writeFile(this.modelPath, JSON.stringify(modelData, null, 2));
      console.log('✅ Model saved successfully');
    } catch (error) {
      throw new Error(`Failed to save model: ${error.message}`);
    }
  }

  async trainModel() {
    console.log('🚀 Starting model training...');
    
    try {
      const entries = await this.loadDataset();
      const model = this.buildModel(entries);
      
      this.model = {
        ...model,
        version: `v${Date.now()}`,
        lastUpdated: new Date(),
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0
      };

      await this.saveModel();
      this.isLoaded = true;
      
      console.log(`✅ Model trained: ${model.totalDocs} entries, ${model.vocabSize} vocabulary`);
      return this.model;
    } catch (error) {
      throw new Error(`Failed to train model: ${error.message}`);
    }
  }

  async loadDataset() {
    return new Promise((resolve, reject) => {
      const entries = [];
      
      createReadStream(this.datasetPath)
        .pipe(csv())
        .on('data', (row) => {
          const sampleText = row.text || row.headline;
          if (sampleText && row.label !== undefined) {
            const label = parseInt(row.label);
            if ((label === -1 || label === 0) && sampleText.length > 2) {
              entries.push({ text: sampleText.trim(), label });
            }
          }
        })
        .on('end', () => {
          console.log(`📊 Loaded ${entries.length} dataset entries`);
          resolve(entries);
        })
        .on('error', reject);
    });
  }

  buildModel(entries) {
    const bullyEntries = entries.filter(e => e.label === -1);
    const nonBullyEntries = entries.filter(e => e.label === 0);

    const totalBully = bullyEntries.length;
    const totalNonBully = nonBullyEntries.length;
    const totalDocs = entries.length;

    // Count word frequencies
    const bullyWordCounts = new Map();
    const nonBullyWordCounts = new Map();
    const docFrequency = new Map();

    let totalBullyWords = 0;
    let totalNonBullyWords = 0;

    for (const entry of entries) {
      const words = this.tokenize(entry.text);
      const uniqueWords = new Set(words);

      // Document frequency
      for (const word of uniqueWords) {
        if (this.isStopWord(word)) continue;
        docFrequency.set(word, (docFrequency.get(word) || 0) + 1);
      }

      // Class word counts
      for (const word of words) {
        if (this.isStopWord(word)) continue;
        if (entry.label === -1) {
          bullyWordCounts.set(word, (bullyWordCounts.get(word) || 0) + 1);
          totalBullyWords++;
        } else {
          nonBullyWordCounts.set(word, (nonBullyWordCounts.get(word) || 0) + 1);
          totalNonBullyWords++;
        }
      }
    }

    // Build vocabulary with TF-IDF
    const vocabulary = new Map();
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
        tfidfBully
      });
    }

    return {
      vocabulary,
      totalBully,
      totalNonBully,
      totalDocs,
      priorBully: totalBully / totalDocs,
      priorNonBully: totalNonBully / totalDocs,
      bullyWordCount: totalBullyWords,
      nonBullyWordCount: totalNonBullyWords,
      vocabSize
    };
  }

  detect(text) {
    if (!this.isLoaded || !this.model) {
      throw new Error('Model not loaded');
    }

    const normalized = this.normalizeText(text);
    const heuristicResult = this.heuristicAnalysis(normalized);
    const mlResult = this.mlAnalysis(normalized);

    // Combine results with weighted ensemble
    let combinedScore;
    if (heuristicResult.score < 0.08) {
      combinedScore = mlResult.score * 0.1 + heuristicResult.score * 0.9;
    } else if (heuristicResult.score < 0.25) {
      combinedScore = mlResult.score * 0.25 + heuristicResult.score * 0.75;
    } else {
      combinedScore = mlResult.score * 0.45 + heuristicResult.score * 0.55;
    }

    const isBullying = combinedScore >= 0.4;
    const confidence = isBullying 
      ? Math.max(0.6, Math.min(0.99, 0.5 + combinedScore * 0.5))
      : Math.max(0.55, Math.min(0.95, 0.5 + (1 - combinedScore) * 0.45));

    let severity = 'Low';
    if (combinedScore >= 0.8) severity = 'Critical';
    else if (combinedScore >= 0.55) severity = 'High';
    else if (combinedScore >= 0.4) severity = 'Medium';

    const allFlaggedWords = [...new Set([...heuristicResult.flaggedWords, ...mlResult.flaggedWords])];
    const label = isBullying ? 'Bullying' : 'Non-Bullying';
    const detailedCategory = this.inferDetailedCategory(label, normalized.toLowerCase(), allFlaggedWords);

    return {
      label,
      detailedCategory,
      confidence,
      severity,
      flaggedWords: allFlaggedWords,
      details: {
        detailedCategory,
        combinedScore: Math.round(combinedScore * 1000) / 1000,
        keywordScore: Math.min(heuristicResult.keywordScore, 1),
        phraseScore: Math.min(heuristicResult.phraseScore, 1),
        mlScore: Math.round(mlResult.score * 1000) / 1000,
        mlConfidence: Math.round(mlResult.confidence * 1000) / 1000,
        mlMethod: mlResult.method,
        mlTopWords: mlResult.topWords.slice(0, 5),
        targetedAtPerson: heuristicResult.targetedAtPerson,
        capsRatio: heuristicResult.capsRatio,
        exclamationCount: heuristicResult.exclamationCount,
        intensifierBoost: heuristicResult.intensifierBoost
      }
    };
  }

  inferDetailedCategory(label, lowerText, flaggedWords) {
    if (label === 'Non-Bullying') return 'Non_Bullying';

    const allTerms = new Set([
      ...flaggedWords.map((w) => w.toLowerCase()),
      ...lowerText.split(/\s+/).map((w) => w.replace(/[^a-z']/g, '')).filter(Boolean),
    ]);

    for (const term of allTerms) {
      if (this.THREATENING_TERMS.has(term)) return 'Threatening';
    }
    for (const term of allTerms) {
      if (this.HATE_SPEECH_TERMS.has(term)) return 'Hate_Speech';
    }
    for (const term of allTerms) {
      if (this.SEXUAL_HARASSMENT_TERMS.has(term)) return 'Sexual_Harassment';
    }

    if (
      lowerText.includes('kill yourself') ||
      lowerText.includes('go die') ||
      lowerText.includes('drop dead') ||
      lowerText.includes('better off dead')
    ) {
      return 'Threatening';
    }

    return 'Toxic_Profanity';
  }

  heuristicAnalysis(text) {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);
    
    let phraseScore = 0;
    const flaggedWords = [];

    // Check for target pronouns first
    let hasTargetPronoun = false;
    for (const w of words) {
      const clean = w.replace(/[^a-z']/g, '');
      if (this.TARGET_PRONOUNS.includes(clean)) {
        hasTargetPronoun = true;
        break;
      }
    }

    // Check phrases first (most reliable signal)
    for (const { phrase, score } of this.BULLY_PHRASES) {
      if (lower.includes(phrase)) {
        phraseScore += score;
        const phraseWords = phrase.split(/\s+/);
        for (const pw of phraseWords) {
          if (pw.length > 2 && !['the', 'you', 'your', 'and', 'for', 'are', 'was', 'will'].includes(pw)) {
            flaggedWords.push(pw);
          }
        }
      }
    }

    let hasNegation = false;
    const strongScores = [];
    const contextualScores = [];

    // Process individual words
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^a-z]/g, '');
      const wordWithApostrophe = words[i].replace(/[^a-z']/g, '');
      
      if (this.NEGATIONS.includes(word) || this.NEGATIONS.includes(wordWithApostrophe)) {
        hasNegation = true;
        continue;
      }

      const isStrong = this.STRONG_KEYWORDS[word] !== undefined;
      const isContextual = this.CONTEXTUAL_KEYWORDS[word] !== undefined;

      if (isStrong || isContextual) {
        const baseScore = isStrong ? this.STRONG_KEYWORDS[word] : this.CONTEXTUAL_KEYWORDS[word];
        let score;
        if (hasNegation && baseScore < 0.6) score = baseScore * 0.15;
        else if (hasNegation) score = baseScore * 0.4;
        else score = baseScore;

        if (isStrong) {
          strongScores.push(score);
          if (!hasNegation || baseScore >= 0.6) flaggedWords.push(word);
        } else {
          contextualScores.push(score);
          if (hasTargetPronoun && (!hasNegation || baseScore >= 0.6)) {
            flaggedWords.push(word);
          }
        }
        hasNegation = false;
      } else {
        if (hasNegation && i > 0) {
          const prevWord = words[i - 1]?.replace(/[^a-z']/g, '');
          if (!this.NEGATIONS.includes(prevWord || '')) hasNegation = false;
        }
      }
    }

    // Score with diminishing returns to prevent stacking false positives
    strongScores.sort((a, b) => b - a);
    let strongKeywordScore = 0;
    for (let i = 0; i < strongScores.length; i++) {
      strongKeywordScore += strongScores[i] * Math.pow(0.5, i);
    }

    contextualScores.sort((a, b) => b - a);
    let contextualKeywordScore = 0;
    if (hasTargetPronoun || strongKeywordScore > 0.3 || phraseScore > 0) {
      for (let i = 0; i < contextualScores.length; i++) {
        contextualKeywordScore += contextualScores[i] * Math.pow(0.45, i);
      }
      if (!hasTargetPronoun) contextualKeywordScore *= 0.5;
    }

    const keywordScore = strongKeywordScore + contextualKeywordScore * 0.6;

    // Additional factors (only boost when there's already signal)
    const intensifierCount = words.filter(w => 
      this.INTENSIFIERS.includes(w.replace(/[^a-z]/g, ''))
    ).length;
    const intensifierBoost = (keywordScore > 0.2 || phraseScore > 0) ? intensifierCount * 0.08 : 0;

    const alphaChars = text.replace(/[^a-zA-Z]/g, '');
    const capsRatio = alphaChars.length > 0 
      ? alphaChars.split('').filter(c => c === c.toUpperCase()).length / alphaChars.length 
      : 0;
    const capsBoost = capsRatio > 0.6 && alphaChars.length > 5 && (keywordScore > 0.1 || phraseScore > 0) ? 0.12 : 0;

    const exclamationCount = (text.match(/!/g) || []).length;
    const questionExclamation = (text.match(/[?!]{2,}/g) || []).length;
    const exclamationBoost = (keywordScore > 0.1 || phraseScore > 0)
      ? Math.min(exclamationCount * 0.04 + questionExclamation * 0.05, 0.12)
      : 0;

    const targetBoost = hasTargetPronoun && (keywordScore > 0.3 || phraseScore > 0) ? 0.1 : 0;

    const rawScore = keywordScore + phraseScore + intensifierBoost + capsBoost + exclamationBoost + targetBoost;
    const finalScore = Math.min(rawScore, 1);

    return {
      score: finalScore,
      flaggedWords: [...new Set(flaggedWords)],
      keywordScore: Math.min(keywordScore, 1),
      phraseScore: Math.min(phraseScore, 1),
      targetedAtPerson: hasTargetPronoun,
      capsRatio,
      exclamationCount,
      intensifierBoost
    };
  }

  mlAnalysis(text) {
    if (!this.model) {
      return {
        score: 0,
        confidence: 0.5,
        topWords: [],
        flaggedWords: [],
        method: 'Model not loaded'
      };
    }

    const words = this.tokenize(text);
    if (words.length === 0) {
      return {
        score: 0,
        confidence: 0.55,
        topWords: [],
        flaggedWords: [],
        method: 'Multinomial Naive Bayes + TF-IDF'
      };
    }

    let logProbBully = Math.log(this.model.priorBully || 1e-9);
    let logProbNonBully = Math.log(this.model.priorNonBully || 1e-9);
    const wordWeights = [];

    for (const word of words) {
      const stats = this.model.vocabulary.get(word);
      if (stats) {
        const idfWeight = Math.max(stats.idf || 0.1, 0.1);
        logProbBully += Math.log(stats.bullyFreq || 1e-9) * idfWeight;
        logProbNonBully += Math.log(stats.nonBullyFreq || 1e-9) * idfWeight;
        
        const bullySignal = Math.log(stats.bullyFreq || 1e-9) - Math.log(stats.nonBullyFreq || 1e-9);
        if (bullySignal > 0) {
          wordWeights.push({ word, weight: bullySignal * idfWeight });
        }
      } else {
        const unknownProb = 1 / ((this.model.vocabSize || 1) + 1);
        logProbBully += Math.log(unknownProb);
        logProbNonBully += Math.log(unknownProb);
      }
    }

    const maxLog = Math.max(logProbBully, logProbNonBully);
    const probBully = Math.exp(logProbBully - maxLog);
    const probNonBully = Math.exp(logProbNonBully - maxLog);
    const total = probBully + probNonBully;
    const normalizedBully = probBully / total;

    const topWords = wordWeights.sort((a, b) => b.weight - a.weight).slice(0, 10);
    const flaggedWords = topWords.map(w => w.word);

    return {
      score: normalizedBully,
      confidence: Math.max(normalizedBully, 1 - normalizedBully),
      topWords,
      flaggedWords,
      method: 'Multinomial Naive Bayes + TF-IDF'
    };
  }

  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !this.isStopWord(w));
  }

  normalizeText(text) {
    return text
      .replace(/(?<=[a-zA-Z])1(?=[a-zA-Z])/g, 'i')
      .replace(/(?<=[a-zA-Z])0(?=[a-zA-Z])/g, 'o')
      .replace(/(?<=[a-zA-Z])3(?=[a-zA-Z])/g, 'e')
      .replace(/(?<=[a-zA-Z])4(?=[a-zA-Z])/g, 'a')
      .replace(/(?<=[a-zA-Z])5(?=[a-zA-Z])/g, 's')
      .replace(/\$/g, 's')
      .replace(/@/g, 'a')
      .replace(/\+/g, 't')
      .replace(/(.)\\1{2,}/g, '$1$1');
  }

  isStopWord(word) {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
      'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
      'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most',
      'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
      'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or',
      'if', 'while', 'about', 'up', 'it', 'its', 'he', 'she', 'they',
      'them', 'his', 'her', 'their', 'this', 'that', 'these', 'those',
      'am', 'what', 'which', 'who', 'whom', 'my', 'me', 'we', 'our',
      'your', 'him', 'i'
    ]);
    
    return stopWords.has(word.toLowerCase());
  }

  getModelInfo() {
    return this.model;
  }

  isModelLoaded() {
    return this.isLoaded;
  }

  async updateModel(newData) {
    console.log(`📈 Updating model with ${newData.length} new samples...`);
    
    try {
      // Load existing dataset
      const existingData = await this.loadDataset();
      const combinedData = [...existingData, ...newData];
      
      // Retrain model
      await this.trainModel();
      
      console.log('✅ Model updated successfully');
    } catch (error) {
      throw new Error(`Failed to update model: ${error.message}`);
    }
  }
}

// Create singleton instance
export const cyberbullyingDetector = new CyberbullyingDetector();

export default CyberbullyingDetector;