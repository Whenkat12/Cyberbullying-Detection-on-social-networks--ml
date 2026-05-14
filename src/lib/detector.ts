// Enhanced ML-based cyberbullying detection using comprehensive keyword analysis + scoring
// Keywords are split into "strong" (unambiguous slurs/threats) and "contextual" (need targeting to count)

// Strong keywords: slurs, explicit insults, threats — always counted
const STRONG_KEYWORDS: Record<string, number> = {
  // === CRITICAL SEVERITY (0.85-1.0) === Explicit threats, extreme hate
  kill: 0.95, murder: 0.95, kll: 0.9, rape: 0.95,
  stab: 0.9, strangle: 0.9, torture: 0.85,

  // === Slurs (always offensive regardless of context) ===
  retard: 0.85, retarded: 0.85, cripple: 0.8, spastic: 0.8,
  whore: 0.85, slut: 0.85, hoe: 0.8, skank: 0.8, thot: 0.75,
  bitch: 0.8, bastard: 0.75, asshole: 0.8, cunt: 0.9, twat: 0.8,
  fuck: 0.7, fucking: 0.7, fucked: 0.7, fucker: 0.8, fck: 0.7,
  fuk: 0.7, stfu: 0.7, gtfo: 0.65,
  shit: 0.55, shitty: 0.55, bullshit: 0.5,
  nigger: 0.95, nigga: 0.8, negro: 0.8, chink: 0.9, gook: 0.9,
  spic: 0.9, wetback: 0.9, kike: 0.9, fag: 0.85, faggot: 0.9,
  dyke: 0.85, tranny: 0.85,

  // === Clear insults (unambiguous when used toward someone) ===
  idiot: 0.7, moron: 0.7, stupid: 0.65, dumb: 0.6,
  ugly: 0.7, worthless: 0.8, useless: 0.75, pathetic: 0.7,
  disgusting: 0.65, trash: 0.6, freak: 0.6,
  psycho: 0.65, sicko: 0.65, pervert: 0.7, creep: 0.6,
  loser: 0.65, scum: 0.7, scumbag: 0.75, filthy: 0.6,
  braindead: 0.65, brainless: 0.6, subhuman: 0.8, inhuman: 0.65,
  cockroach: 0.6, vermin: 0.65, parasite: 0.6,
  degenerate: 0.6, imbecile: 0.6,

  // === Harassment / threat phrases keywords ===
  kys: 0.95, kms: 0.7,
  bully: 0.75, harass: 0.8, abuse: 0.75, stalk: 0.75, stalking: 0.8,
  threat: 0.85, threaten: 0.85,

  // === Targeted insults ===
  dork: 0.4, dumbo: 0.5, dummy: 0.45, dimwit: 0.5,
  jerk: 0.55, prick: 0.65, dick: 0.55, cock: 0.6,
  weirdo: 0.45, bozo: 0.45, buffoon: 0.45, clown: 0.4,
  incel: 0.55,
};

// Contextual keywords: only count toward bullying when used with targeting ("you", "your", etc.)
// or when combined with other bullying signals. Alone, these are everyday words.
const CONTEXTUAL_KEYWORDS: Record<string, number> = {
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

// Common phrases that indicate bullying (checked as substrings)
const BULLY_PHRASES: Array<{ phrase: string; score: number }> = [
  { phrase: "kill yourself", score: 1.0 },
  { phrase: "kys", score: 0.95 },
  { phrase: "go die", score: 0.95 },
  { phrase: "end yourself", score: 0.95 },
  { phrase: "nobody likes you", score: 0.8 },
  { phrase: "everyone hates you", score: 0.85 },
  { phrase: "no one likes you", score: 0.8 },
  { phrase: "no one cares", score: 0.65 },
  { phrase: "nobody cares", score: 0.65 },
  { phrase: "shut up", score: 0.5 },
  { phrase: "shut the fuck", score: 0.75 },
  { phrase: "fuck you", score: 0.8 },
  { phrase: "fuck off", score: 0.75 },
  { phrase: "piss off", score: 0.6 },
  { phrase: "get lost", score: 0.45 },
  { phrase: "get out", score: 0.35 },
  { phrase: "go away", score: 0.35 },
  { phrase: "drop dead", score: 0.85 },
  { phrase: "waste of space", score: 0.8 },
  { phrase: "waste of oxygen", score: 0.85 },
  { phrase: "waste of life", score: 0.85 },
  { phrase: "piece of shit", score: 0.8 },
  { phrase: "piece of crap", score: 0.6 },
  { phrase: "son of a bitch", score: 0.75 },
  { phrase: "you suck", score: 0.55 },
  { phrase: "you stink", score: 0.45 },
  { phrase: "i hate you", score: 0.7 },
  { phrase: "you deserve to die", score: 0.95 },
  { phrase: "you deserve", score: 0.4 },
  { phrase: "should die", score: 0.9 },
  { phrase: "better off dead", score: 0.95 },
  { phrase: "do the world a favor", score: 0.7 },
  { phrase: "world would be better without", score: 0.85 },
  { phrase: "don't deserve to live", score: 0.95 },
  { phrase: "never be loved", score: 0.7 },
  { phrase: "will always be alone", score: 0.7 },
  { phrase: "no friends", score: 0.55 },
  { phrase: "fat ass", score: 0.75 },
  { phrase: "ugly ass", score: 0.75 },
  { phrase: "dumb ass", score: 0.7 },
  { phrase: "stupid ass", score: 0.7 },
  { phrase: "i will find you", score: 0.8 },
  { phrase: "watch your back", score: 0.7 },
  { phrase: "coming for you", score: 0.7 },
  { phrase: "you're dead", score: 0.85 },
  { phrase: "ur dead", score: 0.85 },
  { phrase: "gonna beat", score: 0.7 },
  { phrase: "gonna kill", score: 0.9 },
  { phrase: "wanna fight", score: 0.6 },
  { phrase: "catch you", score: 0.5 },
  { phrase: "not welcome", score: 0.5 },
  { phrase: "go back to", score: 0.55 },
  { phrase: "don't belong", score: 0.6 },
];

const INTENSIFIERS = [
  "very", "so", "really", "extremely", "totally", "absolutely",
  "completely", "utterly", "such", "fucking", "freaking", "damn",
  "bloody", "hella", "super", "mega", "ultra",
];

const NEGATIONS = [
  "not", "no", "never", "don't", "doesn't", "isn't", "aren't",
  "wasn't", "weren't", "won't", "wouldn't", "shouldn't", "couldn't",
  "can't", "cannot", "hardly", "barely", "neither", "nor",
];

// Words that, when near bully keywords, increase severity
const TARGET_PRONOUNS = ["you", "your", "you're", "ur", "u", "yours", "yourself"];

export type DetailedCategory =
  | "Threatening"
  | "Hate_Speech"
  | "Sexual_Harassment"
  | "Toxic_Profanity"
  | "Non_Bullying";

const THREATENING_TERMS = new Set([
  "kill", "kll", "murder", "stab", "strangle", "torture", "die", "death", "dead", "suicide",
  "shoot", "bomb", "hang", "choke", "poison", "burn", "drown", "knife", "gun",
  "hurt", "punch", "beat", "attack", "smash", "kick", "slap", "smack", "bash",
  "threat", "threaten", "revenge", "payback", "rope", "neck",
]);

const HATE_SPEECH_TERMS = new Set([
  "nigger", "nigga", "negro", "chink", "gook", "spic", "wetback", "kike",
  "fag", "faggot", "dyke", "tranny", "homo", "queer", "nazi", "terrorist",
]);

const SEXUAL_HARASSMENT_TERMS = new Set([
  "whore", "slut", "hoe", "skank", "thot", "bitch", "cunt", "twat",
  "dick", "cock", "pussy", "pervert", "creep", "rape",
]);

function inferDetailedCategory(
  label: DetectionResult["label"],
  lowerText: string,
  flaggedWords: string[]
): DetailedCategory {
  if (label === "Non-Bullying") return "Non_Bullying";

  const allTerms = new Set([
    ...flaggedWords.map((w) => w.toLowerCase()),
    ...lowerText.split(/\s+/).map((w) => w.replace(/[^a-z']/g, "")).filter(Boolean),
  ]);

  for (const term of allTerms) {
    if (THREATENING_TERMS.has(term)) return "Threatening";
  }
  for (const term of allTerms) {
    if (HATE_SPEECH_TERMS.has(term)) return "Hate_Speech";
  }
  for (const term of allTerms) {
    if (SEXUAL_HARASSMENT_TERMS.has(term)) return "Sexual_Harassment";
  }

  if (
    lowerText.includes("kill yourself") ||
    lowerText.includes("go die") ||
    lowerText.includes("drop dead") ||
    lowerText.includes("better off dead")
  ) {
    return "Threatening";
  }

  return "Toxic_Profanity";
}

export interface DetectionResult {
  label: "Bullying" | "Non-Bullying";
  detailedCategory: DetailedCategory;
  confidence: number;
  severity: "Low" | "Medium" | "High" | "Critical";
  flaggedWords: string[];
  details: {
    detailedCategory: DetailedCategory;
    keywordScore: number;
    phraseScore: number;
    intensifierBoost: number;
    capsRatio: number;
    exclamationCount: number;
    targetedAtPerson: boolean;
    mlScore: number;
    mlConfidence: number;
    mlMethod: string;
    mlTopWords: Array<{ word: string; weight: number }>;
    combinedScore: number;
  };
}

function normalizeText(text: string): string {
  return text
    // Only convert leetspeak digits when surrounded by letters (e.g., "st00pid" but not "100")
    .replace(/(?<=[a-zA-Z])1(?=[a-zA-Z])/g, "i")
    .replace(/(?<=[a-zA-Z])0(?=[a-zA-Z])/g, "o")
    .replace(/(?<=[a-zA-Z])3(?=[a-zA-Z])/g, "e")
    .replace(/(?<=[a-zA-Z])4(?=[a-zA-Z])/g, "a")
    .replace(/(?<=[a-zA-Z])5(?=[a-zA-Z])/g, "s")
    .replace(/\$/g, "s")
    .replace(/@/g, "a")
    .replace(/\+/g, "t")
    .replace(/(.)\1{2,}/g, "$1$1"); // reduce repeated chars: "stuuuupid" → "stuupid"
}

import { getModelSync } from "./dataset-loader";
import { classifyWithNaiveBayes, type MLClassificationResult } from "./ml-classifier";

export function detectCyberbullying(text: string): DetectionResult {
  const normalized = normalizeText(text);
  const lower = normalized.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);

  let phraseScore = 0;
  const flaggedWords: string[] = [];

  // === Check if message targets a person ===
  let hasTargetPronoun = false;
  for (const word of words) {
    const clean = word.replace(/[^a-z']/g, "");
    if (TARGET_PRONOUNS.includes(clean)) {
      hasTargetPronoun = true;
      break;
    }
  }

  // === PHRASE DETECTION (highest priority — very reliable signal) ===
  for (const { phrase, score } of BULLY_PHRASES) {
    if (lower.includes(phrase)) {
      phraseScore += score;
      const phraseWords = phrase.split(/\s+/);
      for (const pw of phraseWords) {
        if (pw.length > 2 && !["the", "you", "your", "and", "for", "are", "was", "will"].includes(pw)) {
          flaggedWords.push(pw);
        }
      }
    }
  }

  // === KEYWORD DETECTION ===
  let hasNegation = false;
  const strongScores: number[] = [];
  const contextualScores: number[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^a-z]/g, "");
    const wordWithApostrophe = words[i].replace(/[^a-z']/g, "");

    if (NEGATIONS.includes(word) || NEGATIONS.includes(wordWithApostrophe)) {
      hasNegation = true;
      continue;
    }

    const isStrong = STRONG_KEYWORDS[word] !== undefined;
    const isContextual = CONTEXTUAL_KEYWORDS[word] !== undefined;

    if (isStrong || isContextual) {
      const baseScore = isStrong ? STRONG_KEYWORDS[word] : CONTEXTUAL_KEYWORDS[word];
      let score: number;

      if (hasNegation && baseScore < 0.6) {
        score = baseScore * 0.15; // Mild words with negation almost ignored
      } else if (hasNegation) {
        score = baseScore * 0.4;
      } else {
        score = baseScore;
      }

      if (isStrong) {
        strongScores.push(score);
        if (!hasNegation || baseScore >= 0.6) flaggedWords.push(word);
      } else {
        // Contextual words only count as flagged/scored when targeted at a person
        // or when there's already other bullying signal
        contextualScores.push(score);
        if (hasTargetPronoun && (!hasNegation || baseScore >= 0.6)) {
          flaggedWords.push(word);
        }
      }
      hasNegation = false;
    } else {
      // Reset negation after one non-keyword word gap
      if (hasNegation && i > 0) {
        const prevWord = words[i - 1]?.replace(/[^a-z']/g, "");
        if (!NEGATIONS.includes(prevWord || "")) {
          hasNegation = false;
        }
      }
    }
  }

  // === COMPUTE KEYWORD SCORE ===
  // Strong keywords: use max + diminishing returns for additional matches
  // This prevents stacking many mild insults from producing an artificially high score
  strongScores.sort((a, b) => b - a);
  let strongKeywordScore = 0;
  for (let i = 0; i < strongScores.length; i++) {
    // First strong word counts fully, subsequent have diminishing weight
    strongKeywordScore += strongScores[i] * Math.pow(0.5, i);
  }

  // Contextual keywords: only count when targeting or when strong signal exists
  contextualScores.sort((a, b) => b - a);
  let contextualKeywordScore = 0;
  if (hasTargetPronoun || strongKeywordScore > 0.3 || phraseScore > 0) {
    for (let i = 0; i < contextualScores.length; i++) {
      contextualKeywordScore += contextualScores[i] * Math.pow(0.45, i);
    }
    // If no targeting, halve contextual contribution
    if (!hasTargetPronoun) {
      contextualKeywordScore *= 0.5;
    }
  }

  const keywordScore = strongKeywordScore + contextualKeywordScore * 0.6;

  // === INTENSIFIER BOOST (only when there's already bullying signal) ===
  const intensifierCount = words.filter((w) =>
    INTENSIFIERS.includes(w.replace(/[^a-z]/g, ""))
  ).length;
  const intensifierBoost = (keywordScore > 0.2 || phraseScore > 0) ? intensifierCount * 0.08 : 0;

  // === CAPS RATIO (shouting detection — only boost when there's other signal) ===
  const alphaChars = text.replace(/[^a-zA-Z]/g, "");
  const capsRatio =
    alphaChars.length > 0
      ? alphaChars.split("").filter((c) => c === c.toUpperCase()).length / alphaChars.length
      : 0;
  const capsBoost = capsRatio > 0.6 && alphaChars.length > 5 && (keywordScore > 0.1 || phraseScore > 0) ? 0.12 : 0;

  // === EXCLAMATION / AGGRESSIVE PUNCTUATION (only with other signal) ===
  const exclamationCount = (text.match(/!/g) || []).length;
  const questionExclamation = (text.match(/[?!]{2,}/g) || []).length;
  const exclamationBoost = (keywordScore > 0.1 || phraseScore > 0)
    ? Math.min(exclamationCount * 0.04 + questionExclamation * 0.05, 0.12)
    : 0;

  // === TARGETING BOOST ===
  const targetBoost = hasTargetPronoun && (keywordScore > 0.3 || phraseScore > 0) ? 0.1 : 0;

  // === ML CLASSIFICATION (Naive Bayes + TF-IDF from dataset) ===
  let mlResult: MLClassificationResult = {
    label: "Non-Bullying",
    confidence: 0.5,
    logProbBully: 0,
    logProbNonBully: 0,
    topBullyWords: [],
    method: "Not loaded",
  };

  const model = getModelSync();
  if (model) {
    mlResult = classifyWithNaiveBayes(text, model);
  }

  // ML score: 0 to 1 where 1 = definitely bullying
  const mlScore = mlResult.label === "Bullying" ? mlResult.confidence : 1 - mlResult.confidence;

  // === FINAL COMBINED SCORE ===
  // Heuristic score (keyword + phrase based)
  const heuristicRawScore = keywordScore + phraseScore + intensifierBoost + capsBoost + exclamationBoost + targetBoost;
  const heuristicScore = Math.min(heuristicRawScore, 1);

  // Combined: Use ensemble only when heuristic finds meaningful signal.
  // Key principle: ML alone cannot classify as bullying if no heuristic signal.
  // This prevents false positives on innocent messages.
  let combinedScore: number;
  if (!model) {
    combinedScore = heuristicScore;
  } else if (heuristicScore < 0.08) {
    // No meaningful heuristic signal: ML can contribute very little
    combinedScore = Math.min(mlScore * 0.1 + heuristicScore * 0.9, 1);
  } else if (heuristicScore < 0.25) {
    // Weak heuristic signal: ML has limited influence
    combinedScore = Math.min(mlScore * 0.25 + heuristicScore * 0.75, 1);
  } else {
    // Clear heuristic signal: ML can confirm/adjust
    combinedScore = Math.min(mlScore * 0.45 + heuristicScore * 0.55, 1);
  }

  // Threshold: 0.4 for bullying classification (raised from 0.35 to reduce false positives)
  const isBullying = combinedScore >= 0.4;

  // Confidence from combined approach
  const confidence = isBullying
    ? Math.max(0.6, Math.min(0.99, 0.5 + combinedScore * 0.5))
    : Math.max(0.55, Math.min(0.95, 0.5 + (1 - combinedScore) * 0.45));

  let severity: DetectionResult["severity"] = "Low";
  if (combinedScore >= 0.8) severity = "Critical";
  else if (combinedScore >= 0.55) severity = "High";
  else if (combinedScore >= 0.4) severity = "Medium";

  // Merge flagged words from ML and heuristic
  const mlFlaggedWords = mlResult.topBullyWords.map((w) => w.word);
  const allFlagged = [...new Set([...flaggedWords, ...mlFlaggedWords])];
  const label: DetectionResult["label"] = isBullying ? "Bullying" : "Non-Bullying";
  const detailedCategory = inferDetailedCategory(label, lower, allFlagged);

  return {
    label,
    detailedCategory,
    confidence,
    severity,
    flaggedWords: allFlagged,
    details: {
      detailedCategory,
      keywordScore: Math.min(keywordScore, 1),
      phraseScore: Math.min(phraseScore, 1),
      intensifierBoost,
      capsRatio,
      exclamationCount,
      targetedAtPerson: hasTargetPronoun,
      mlScore: Math.round(mlScore * 1000) / 1000,
      mlConfidence: Math.round(mlResult.confidence * 1000) / 1000,
      mlMethod: mlResult.method,
      mlTopWords: mlResult.topBullyWords.slice(0, 5),
      combinedScore: Math.round(combinedScore * 1000) / 1000,
    },
  };
}

// Sample messages for demo
export const SAMPLE_MESSAGES = [
  { text: "You're such a loser, nobody likes you!", expected: "Bullying" },
  { text: "Great work on the presentation today!", expected: "Non-Bullying" },
  { text: "I'm going to destroy you, you pathetic idiot", expected: "Bullying" },
  { text: "Can we meet for coffee tomorrow?", expected: "Non-Bullying" },
  { text: "You are so ugly and stupid, just die already", expected: "Bullying" },
  { text: "Happy birthday! Hope you have an amazing day!", expected: "Non-Bullying" },
  { text: "You're worthless trash and everyone hates you", expected: "Bullying" },
  { text: "Thanks for helping me with the homework", expected: "Non-Bullying" },
  { text: "SHUT UP YOU FREAK!!!", expected: "Bullying" },
  { text: "The weather is really nice today", expected: "Non-Bullying" },
  { text: "Go kill yourself you piece of shit", expected: "Bullying" },
  { text: "Let's work together on this project", expected: "Non-Bullying" },
  { text: "You're a waste of space, nobody would miss you", expected: "Bullying" },
  { text: "I really enjoyed the movie last night", expected: "Non-Bullying" },
  { text: "Fuck you bitch, I'll beat your ass", expected: "Bullying" },
  { text: "Congratulations on your promotion!", expected: "Non-Bullying" },
];
