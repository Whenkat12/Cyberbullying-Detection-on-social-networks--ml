// Evaluates the ML model against a test split of the dataset
import { loadDatasetModel, type DatasetEntry } from "./dataset-loader";
import { detectCyberbullying } from "./detector";

export interface ConfusionMatrix {
  tp: number; // True Positive (predicted bully, actual bully)
  tn: number; // True Negative (predicted safe, actual safe)
  fp: number; // False Positive (predicted bully, actual safe)
  fn: number; // False Negative (predicted safe, actual bully)
}

export interface EvaluationResult {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  specificity: number;
  confusionMatrix: ConfusionMatrix;
  totalSamples: number;
  testSamples: number;
  bullySamples: number;
  safeSamples: number;
  perSeverity: Record<string, number>;
  sampleResults: Array<{
    text: string;
    actual: string;
    predicted: string;
    correct: boolean;
    confidence: number;
  }>;
}

// Simple seeded shuffle for reproducibility
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

let cachedEvaluation: EvaluationResult | null = null;
let evaluationPromise: Promise<EvaluationResult> | null = null;

export async function evaluateModel(testRatio = 0.2, maxTestSamples = 500): Promise<EvaluationResult> {
  if (cachedEvaluation) return cachedEvaluation;
  if (evaluationPromise) return evaluationPromise;

  evaluationPromise = (async () => {
    // Load dataset
    const response = await fetch("/data/classified_dataset.csv");
    const csvText = await response.text();
    const lines = csvText.split("\n");
    const entries: DatasetEntry[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const lastComma = line.lastIndexOf(",");
      if (lastComma === -1) continue;

      const secondLastComma = line.lastIndexOf(",", lastComma - 1);
      const textEndIndex = secondLastComma === -1 ? lastComma : secondLastComma;
      const labelStartIndex = secondLastComma === -1 ? lastComma + 1 : secondLastComma + 1;
      const labelEndIndex = secondLastComma === -1 ? line.length : lastComma;

      const text = line.substring(0, textEndIndex).trim().replace(/^["﻿]+|"+$/g, "").trim();
      const label = parseInt(line.substring(labelStartIndex, labelEndIndex).trim(), 10);
      if ((label === -1 || label === 0) && text.length > 2) {
        entries.push({ text, label });
      }
    }

    // Ensure model is loaded first
    await loadDatasetModel();

    // Shuffle and take test split
    const shuffled = seededShuffle(entries, 42);
    const testSize = Math.min(Math.floor(entries.length * testRatio), maxTestSamples);
    const testSet = shuffled.slice(0, testSize);

    const cm: ConfusionMatrix = { tp: 0, tn: 0, fp: 0, fn: 0 };
    const perSeverity: Record<string, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    const sampleResults: EvaluationResult["sampleResults"] = [];

    for (const entry of testSet) {
      const result = detectCyberbullying(entry.text);
      const actualBully = entry.label === -1;
      const predictedBully = result.label === "Bullying";

      if (predictedBully && actualBully) cm.tp++;
      else if (!predictedBully && !actualBully) cm.tn++;
      else if (predictedBully && !actualBully) cm.fp++;
      else cm.fn++;

      if (predictedBully) perSeverity[result.severity]++;

      // Keep some samples for display (mix of correct and incorrect)
      if (sampleResults.length < 30 || (!predictedBully === actualBully && sampleResults.length < 50)) {
        sampleResults.push({
          text: entry.text.substring(0, 120),
          actual: actualBully ? "Bullying" : "Non-Bullying",
          predicted: result.label,
          correct: predictedBully === actualBully,
          confidence: result.confidence,
        });
      }
    }

    const accuracy = (cm.tp + cm.tn) / testSize;
    const precision = cm.tp / Math.max(cm.tp + cm.fp, 1);
    const recall = cm.tp / Math.max(cm.tp + cm.fn, 1);
    const f1Score = 2 * (precision * recall) / Math.max(precision + recall, 0.001);
    const specificity = cm.tn / Math.max(cm.tn + cm.fp, 1);

    cachedEvaluation = {
      accuracy,
      precision,
      recall,
      f1Score,
      specificity,
      confusionMatrix: cm,
      totalSamples: entries.length,
      testSamples: testSize,
      bullySamples: testSet.filter(e => e.label === -1).length,
      safeSamples: testSet.filter(e => e.label === 0).length,
      perSeverity,
      sampleResults,
    };

    console.log(`[Eval] Model evaluated on ${testSize} samples: accuracy=${(accuracy * 100).toFixed(1)}%`);
    return cachedEvaluation;
  })();

  return evaluationPromise;
}
