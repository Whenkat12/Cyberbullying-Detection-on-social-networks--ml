// Naive Bayes + TF-IDF classifier using the loaded dataset model

import { type DatasetModel } from "./dataset-loader";

export interface MLClassificationResult {
  label: "Bullying" | "Non-Bullying";
  confidence: number;
  logProbBully: number;
  logProbNonBully: number;
  topBullyWords: Array<{ word: string; weight: number }>;
  method: string;
}

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
  "if", "while", "about", "up", "it", "its", "he", "she",
  "they", "them", "his", "her", "their", "this", "that", "these",
  "those", "am", "what", "which", "who", "whom", "my", "me", "we",
  "our", "your", "him", "i", "ii",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Multinomial Naive Bayes classification
 * P(class|words) ∝ P(class) × Π P(word|class)
 * Using log probabilities to avoid underflow
 */
export function classifyWithNaiveBayes(
  text: string,
  model: DatasetModel
): MLClassificationResult {
  const words = tokenize(text);

  if (words.length === 0) {
    return {
      label: "Non-Bullying",
      confidence: 0.55,
      logProbBully: 0,
      logProbNonBully: 0,
      topBullyWords: [],
      method: "Multinomial Naive Bayes + TF-IDF",
    };
  }

  // Log prior probabilities
  let logProbBully = Math.log(model.priorBully);
  let logProbNonBully = Math.log(model.priorNonBully);

  const wordWeights: Array<{ word: string; weight: number }> = [];

  for (const word of words) {
    const stats = model.vocabulary.get(word);

    if (stats) {
      // Log likelihood with TF-IDF weighting
      const idfWeight = Math.max(stats.idf, 0.1);
      logProbBully += Math.log(stats.bullyFreq) * idfWeight;
      logProbNonBully += Math.log(stats.nonBullyFreq) * idfWeight;

      // Track how much this word contributes to bully classification
      const bullySignal = Math.log(stats.bullyFreq) - Math.log(stats.nonBullyFreq);
      if (bullySignal > 0) {
        wordWeights.push({ word, weight: bullySignal * idfWeight });
      }
    } else {
      // Unknown word - use uniform probability (Laplace smoothing)
      const unknownProb = 1 / (model.vocabSize + 1);
      logProbBully += Math.log(unknownProb);
      logProbNonBully += Math.log(unknownProb);
    }
  }

  // Convert log probabilities to probability using log-sum-exp trick
  const maxLog = Math.max(logProbBully, logProbNonBully);
  const probBully = Math.exp(logProbBully - maxLog);
  const probNonBully = Math.exp(logProbNonBully - maxLog);
  const totalProb = probBully + probNonBully;

  const normalizedBully = probBully / totalProb;
  const isBullying = normalizedBully > 0.5;

  // Confidence: how far from 0.5 the prediction is
  const confidence = Math.max(normalizedBully, 1 - normalizedBully);
  const clampedConfidence = Math.min(Math.max(confidence, 0.51), 0.99);

  // Top contributing bully words
  const topBullyWords = wordWeights
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);

  return {
    label: isBullying ? "Bullying" : "Non-Bullying",
    confidence: clampedConfidence,
    logProbBully,
    logProbNonBully,
    topBullyWords,
    method: "Multinomial Naive Bayes + TF-IDF",
  };
}
