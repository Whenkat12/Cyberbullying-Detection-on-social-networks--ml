# Cyberbullying Detection on Social Networks

A full-stack web application that uses machine learning to detect cyberbullying in text messages from social platforms, classify it by category and severity, and provide moderators with the tools to review and respond to harmful content.

**Status:** Active &nbsp; · &nbsp; **Stack:** MERN &nbsp; · &nbsp; **ML:** Naive Bayes + TF-IDF &nbsp; · &nbsp; **License:** MIT


## Table of Contents

1. [About the Project](#about-the-project)
2. [Key Features](#key-features)
3. [Tech Stack](#tech-stack)
4. [System Architecture](#system-architecture)
5. [Machine Learning Approach](#machine-learning-approach)
6. [Dataset](#dataset)
7. [Project Structure](#project-structure)
8. [Getting Started](#getting-started)
9. [Configuration](#configuration)
10. [API Endpoints](#api-endpoints)
11. [Usage](#usage)
12. [Evaluation & Results](#evaluation--results)
13. [Security](#security)
14. [Limitations](#limitations)
15. [Future Work](#future-work)
16. [Team](#team)
17. [License](#license)

## About the Project

Cyberbullying affects approximately 1 in 3 students globally, with documented links to anxiety, depression, and self-harm. Existing social platforms rely on either slow human moderation or proprietary, opaque AI systems that users cannot inspect.

**This project is an open, transparent, user-facing cyberbullying detection platform.** It analyses text input, returns a clear verdict with confidence scores, exposes exactly which words triggered the flag, and gives users a personal history of incidents that can serve as evidence for reporting.

### Objectives

- Detect cyberbullying in English text from social platforms (WhatsApp, Instagram, Twitter, Facebook).
- Classify each flagged message by **category** (Threatening, Hate Speech, Sexual Harassment, Toxic Profanity) and **severity** (Low / Medium / High / Critical).
- Provide a transparent breakdown of why each message was flagged, including the specific words and ML signals that contributed.
- Support three user roles — regular users, moderators, and admins — each with appropriate access.
- Allow batch detection, real-time chat monitoring, detection history, and analytics.

## Key Features

### Detection Engine
- **Hybrid ML + Rule-based classifier** — combines Multinomial Naive Bayes with hand-crafted keyword dictionaries and contextual signals.
- **5-category classification** — Threatening, Hate Speech, Sexual Harassment, Toxic Profanity, Non-Bullying.
- **4-level severity grading** — Low, Medium, High, Critical, with automatic action policies per level.
- **Context-aware scoring** — handles target pronouns (`you`, `your`), negations (`not stupid`), intensifiers (`very`), CAPS shouting, exclamation patterns, and leet-speak normalisation (`k1ll` → `kill`).
- **Sub-100ms detection latency** on standard hardware.

### Web Application
- **Real-time text analysis** with line-by-line breakdown.
- **Batch detection** — up to 100 items per request, suitable for analysing chat exports.
- **Chat monitoring simulator** with per-platform context (WhatsApp / Instagram / Twitter / Facebook), a strike-based auto-block system, and configurable severity thresholds.
- **Analytics dashboard** showing accuracy, precision, recall, F1, specificity, confusion matrix, and per-category breakdowns.
- **Detection history** with user feedback channel (mark detections correct / incorrect to improve the model).
- **Trending words** view — surface which bullying terms are appearing more frequently over time.

### User & Access Management
- **Role-based access control** — User, Moderator, Admin.
- **JWT authentication** with separate access (7d) and refresh (30d) tokens.
- **Account lockout** after repeated failed login attempts.
- **Password hashing** with bcrypt (12 rounds).
- **CSV export** of personal detection history.

### Admin Tools
- Platform-wide analytics and user management.
- **Live model retraining** endpoint to update the classifier with new data.
- Feedback queue for reviewing contested detections.

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 + TypeScript | Component-based UI with static typing |
| Vite | Fast dev server and bundler |
| Tailwind CSS + shadcn/ui | Utility-first styling and accessible components |
| Recharts | Analytics charts (pie, radar, time-series) |
| React Router DOM | Client-side routing |
| Lucide React | Icon set |

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js (≥18) + Express | REST API server |
| MongoDB + Mongoose | NoSQL database with schema validation |
| `natural` + `ml-matrix` | NLP tokenisation and ML utilities |
| `jsonwebtoken` + `bcryptjs` | Authentication and password hashing |
| `helmet`, `express-rate-limit`, `express-mongo-sanitize`, `xss` | Security middleware |
| `winston` | Structured logging |
| `socket.io` | Real-time communication (chat features) |

## System Architecture

The system follows a standard three-tier architecture:

**Tier 1 — Client (Browser):** A React + TypeScript single-page application. Anonymous users can also run the ML detector entirely in their browser without contacting the server.

**Tier 2 — Application Server (Node.js + Express):** Exposes a REST API for authentication, detection, chat monitoring, analytics, and administration. The ML core lives inside this tier as a service module and is invoked by the detection routes.

**Tier 3 — Database (MongoDB):** Stores users, detection results, chats, and messages.

### Component Overview

| Component | Layer | Responsibility |
|-----------|-------|----------------|
| React SPA | Client | UI, routing, in-browser anonymous detection |
| Auth & RBAC | Server | JWT verification, role-based access control |
| API Routes | Server | REST endpoints for every feature |
| Detection Service | Server | ML core (Naive Bayes + TF-IDF + heuristics) |
| Analytics Engine | Server | Aggregates detections into metrics and trends |
| MongoDB | Database | Persists Users, Detections, Chats, Messages |

### Detection Flow

When a user submits text for analysis, the system follows these steps:

1. **Normalisation** — Convert leet-speak (`k1ll` → `kill`), substitute symbols (`$` → `s`, `@` → `a`), and collapse repeated characters.
2. **Tokenisation** — Lowercase, strip non-alphanumerics, split on whitespace, remove stopwords.
3. **Parallel analysis** — The text is passed to two analysers simultaneously:
   - **ML Analysis** — Multinomial Naive Bayes scored against the trained TF-IDF vocabulary.
   - **Heuristic Analysis** — Keyword and phrase lookup, with contextual signals (negations, target pronouns, CAPS, exclamations).
4. **Weighted ensemble** — The two scores are combined using dynamic weights that depend on the strength of the heuristic signal.
5. **Verdict assembly** — The combined score determines the bullying label, severity, category, confidence, and flagged words.
6. **Persistence & response** — The result is stored in MongoDB (if authenticated) and returned to the client.

## Machine Learning Approach

### Algorithm
**Multinomial Naive Bayes** classifier with **TF-IDF** feature weighting, combined with a **rule-based heuristic layer** in a weighted ensemble.

### Why this approach
- **Speed** — detection completes in under 100 ms per message; no GPU required.
- **Interpretability** — every flagged word and its contribution is exposed in the response, allowing the user to see exactly why a message was flagged.
- **Robustness** — the heuristic layer catches explicit slurs and phrases even when the ML model is uncertain, while the ML layer generalises to patterns the rules cannot enumerate.
- **Appropriate for dataset size** — Naive Bayes is a strong baseline at the 10k–20k sample range and remains competitive with much larger models on text classification.

### Ensemble Weighting (dynamic)
| Heuristic Score | ML Weight | Heuristic Weight |
|-----------------|-----------|------------------|
| < 0.08 (weak)   | 0.90      | 0.10             |
| 0.08 – 0.25     | 0.60      | 0.40             |
| ≥ 0.25 (strong) | 0.45      | 0.55             |

When the heuristic layer finds explicit, unambiguous bullying signals (slurs, threat phrases), it dominates the verdict. When signals are weak or ambiguous, the ML layer's statistical evidence dominates.

### Preprocessing
1. **Character-level normalisation** — leet-speak digits (`1→i, 0→o, 3→e, 4→a, 5→s`), symbol substitutions (`$→s, @→a`), collapsed repeated characters.
2. **Tokenisation** — lowercase, strip non-alphanumerics, split on whitespace, drop single-char tokens.
3. **Stopword removal** — ~95 English stopwords filtered out.

### Feature Engineering
- **TF-IDF weighting** — log(N / df) per word, computed during training.
- **Laplace (add-1) smoothing** — applied to all word probabilities to handle out-of-vocabulary terms.
- **Log-probabilities** with log-sum-exp normalisation for numerical stability.

### Severity Thresholds
| Severity | Combined Score |
|----------|---------------|
| Non-Bullying | < 0.40 |
| Low | 0.40 – 0.55 |
| Medium | 0.55 – 0.70 |
| High | 0.70 – 0.80 |
| Critical | ≥ 0.80 |


## Dataset

| Attribute | Value |
|-----------|-------|
| Source | Curated from public cyberbullying corpora (Kaggle, Wikipedia Talk, Twitter) |
| Total samples | 18,149 rows (~17,446 cleanly parseable) |
| Columns | `headline`, `label` (-1 / 0), `detailed_category` |
| Bullying samples | 11,339 (~65%) |
| Non-Bullying samples | 6,107 (~35%) |
| Categories | Neutral, Sexual_Harassment, Toxic_Profanity, General_Bullying, Personal_Insult, Threatening, Hate_Speech |
| Location | `backend/data/classified_dataset.csv` |

### Class Distribution

| Class | Count | Percentage |
|-------|-------|------------|
| Bullying (label = -1) | 11,339 | 65% |
| Non-Bullying (label = 0) | 6,107 | 35% |

### Category Distribution

| Category | Count | Percentage |
|----------|-------|------------|
| Neutral | 6,487 | 37.2% |
| Sexual_Harassment | 3,497 | 20.0% |
| Toxic_Profanity | 2,815 | 16.1% |
| General_Bullying | 2,803 | 16.1% |
| Personal_Insult | 1,098 | 6.3% |
| Threatening | 756 | 4.3% |
| Hate_Speech | 692 | 4.0% |


## Project Structure

The project is organised into a frontend (`src/`) and backend (`backend/`) at the root level. Key directories and their roles:

### Backend (`backend/`)

- **`config/database.js`** — MongoDB connection logic.
- **`data/`** — Contains `classified_dataset.csv` (training data) and `model.json` (serialised trained model).
- **`middleware/`** — `auth.js` for JWT and role-based access control, `errorHandler.js` for centralised errors, `logger.js` for Winston request logging.
- **`models/`** — Mongoose schemas: `User.js`, `Detection.js`, `Chat.js`, `Message.js`.
- **`routes/`** — Express route handlers grouped by feature: `auth.js`, `users.js`, `detections.js`, `publicDetection.js`, `chats.js`, `messages.js`, `ml.js`, `analytics.js`, `admin.js`.
- **`services/CyberbullyingDetector.js`** — The ML core (~700 lines): preprocessing, Naive Bayes, TF-IDF, heuristic engine, and ensemble logic.
- **`scripts/createAdmin.js`** — CLI utility to create an admin user.
- **`server.js`** — Main entry point. `simple-server.js` is a lightweight alternative used for development.

### Frontend (`src/`)

- **`components/`** — Shared UI components (`Navbar.tsx`, `AuthForm.tsx`, `NavLink.tsx`, `SocialIcons.tsx`) and the shadcn/ui component library under `components/ui/`.
- **`contexts/AuthContext.tsx`** — Global authentication state via React Context.
- **`hooks/`** — Custom React hooks (`use-mobile.tsx`, `use-toast.ts`).
- **`lib/`** — Browser-side ML library that mirrors the backend detector: `detector.ts`, `ml-classifier.ts`, `dataset-loader.ts`, `model-evaluator.ts`, `utils.ts`.
- **`pages/`** — Page components mapped to routes: `Index.tsx`, `About.tsx`, `Login.tsx`, `Register.tsx`, `Dashboard.tsx`, `Detect.tsx`, `Chat.tsx`, `NotFound.tsx`.
- **`services/api.ts`** — HTTP wrapper for all backend API calls.
- **`App.tsx`** — Root component with router and layout.
- **`main.tsx`** — React entry point.

### Root-level files
- **`package.json`** — Frontend dependencies and scripts.
- **`vite.config.ts`** — Vite bundler configuration.
- **`tailwind.config.ts`** — Tailwind CSS configuration.
- **`tsconfig.json`** — TypeScript compiler settings.
- **`scripts/train-model.js`** — Standalone training script.
- **`public/data/model.json`** — Browser-side mirror of the trained model.


## Getting Started

### Prerequisites

- **Node.js** ≥ 18.0.0 ([Download](https://nodejs.org/))
- **MongoDB** ≥ 6.0 (local install or [MongoDB Atlas](https://www.mongodb.com/atlas))
- **npm** ≥ 9.0 (comes with Node.js)
- **Git** (optional, for cloning)

### Installation

```bash
# 1. Clone or extract the project
cd Cyberbullying-Detection-on-social-networks--ml-main

# 2. Install frontend dependencies
npm install

# 3. Install backend dependencies
cd backend
npm install
cd ..
```

### Set up environment variables

Create a `.env` file inside the `backend/` folder:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/cyberguard

# Authentication
JWT_SECRET=replace_with_a_long_random_string_min_32_chars
JWT_REFRESH_SECRET=replace_with_another_long_random_string
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Rate limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# CORS
FRONTEND_URL=http://localhost:5173
```

### Run the application

Open **two terminals**:

```bash
# Terminal 1 — start the backend (from /backend)
cd backend
npm run dev
# API running at http://localhost:5000
```

```bash
# Terminal 2 — start the frontend (from project root)
npm run dev
# Frontend running at http://localhost:5173
```

Open <http://localhost:5173> in your browser. The detection page works without an account; register to access history, chat monitoring, and analytics.

### Create an admin user (optional)

```bash
cd backend
node scripts/createAdmin.js
```

Follow the prompts. This creates an admin account that can access `/admin` routes.


## Configuration

### Adjusting detection sensitivity

Edit thresholds in `backend/services/CyberbullyingDetector.js`:

```javascript
// Severity boundaries (line ~381)
if (combinedScore >= 0.80)      severity = 'critical';
else if (combinedScore >= 0.55) severity = 'high';
else if (combinedScore >= 0.40) severity = 'medium';
// Bullying threshold (line ~376)
const isBullying = combinedScore >= 0.40;
```

Lower the bullying threshold to catch more borderline cases (more false positives); raise it to be stricter (more false negatives).

### Adding custom keywords

Add entries to the dictionaries in `CyberbullyingDetector.js`:

```javascript
const STRONG_KEYWORDS = {
  'kill': 0.95,        // Fires on its own
  'newslur': 0.85,     // Add new keywords here
};

const CONTEXTUAL_KEYWORDS = {
  'die': 0.7,          // Only fires with target pronoun present
};
```


## API Endpoints

### Public (no auth required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/public/detect` | Anonymous single-text detection |
| POST | `/api/public/batch-detect` | Anonymous batch detection |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create a new user account |
| POST | `/api/auth/login` | Log in, receive JWT + refresh token |
| POST | `/api/auth/refresh` | Exchange refresh token for new access token |
| POST | `/api/auth/logout` | Invalidate refresh token |

### Detection (auth required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/detections/detect` | Single-text detection with persistence |
| POST | `/api/detections/batch-detect` | Batch detection (up to 100 items) |
| GET | `/api/detections` | List user's detection history (paginated) |
| GET | `/api/detections/:id` | Get a specific detection |
| PATCH | `/api/detections/:id/feedback` | Mark detection correct / incorrect |
| DELETE | `/api/detections/:id` | Delete a detection |
| GET | `/api/detections/stats/trending` | Trending flagged words this week |
| GET | `/api/detections/export/csv` | Export user history as CSV |

### Chat Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET / POST | `/api/chats` | List or create monitored chats |
| GET / PATCH / DELETE | `/api/chats/:id` | Manage a chat |
| GET / POST | `/api/messages` | Messages within a chat |
| GET | `/api/messages/review/pending` | Moderator review queue |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/overview` | Counts by label, severity, category |
| GET | `/api/analytics/detailed` | Time-series + top words |
| GET | `/api/analytics/comparative` | User vs historical baseline |
| GET | `/api/analytics/predictive` | Risk trend assessment |

### ML & Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ml/info` | Current model statistics |
| POST | `/api/ml/retrain` | Retrain on latest dataset (admin) |
| POST | `/api/ml/update` | Add feedback samples to training queue |
| GET | `/api/admin/users` | List all users (admin) |
| GET | `/api/admin/analytics/platform` | Platform-wide metrics (admin) |


## Usage

### Single Detection

```bash
curl -X POST http://localhost:5000/api/public/detect \
  -H "Content-Type: application/json" \
  -d '{"text":"You are so stupid, I hate you."}'
```

**Sample response:**

```json
{
  "success": true,
  "result": {
    "label": "Bullying",
    "category": "Toxic_Profanity",
    "confidence": 0.87,
    "severity": "high",
    "flaggedWords": ["stupid", "hate"],
    "details": {
      "mlScore": 0.78,
      "heuristicScore": 0.82,
      "combinedScore": 0.81,
      "mlTopWords": [
        { "word": "stupid", "bullySignal": 2.34 },
        { "word": "hate",   "bullySignal": 1.87 }
      ],
      "context": {
        "hasTarget": true,
        "capsRatio": 0.0,
        "exclamationCount": 0
      }
    }
  }
}
```

### Batch Detection

```bash
curl -X POST http://localhost:5000/api/public/batch-detect \
  -H "Content-Type: application/json" \
  -d '{"texts":["Have a great day!","You are worthless.","I will hurt you."]}'
```


## Evaluation & Results

The model is evaluated live on the **Dashboard** page using a deterministic 20% test split (capped at 500 samples) with a seeded shuffle (`seed = 42`) for reproducibility.

### Reported Metrics

| Metric | Approx. Value | Definition |
|--------|--------------|------------|
| Accuracy | ~88% | (TP + TN) / Total |
| Precision | ~89% | TP / (TP + FP) |
| Recall | ~91% | TP / (TP + FN) |
| F1 Score | ~90% | Harmonic mean of precision & recall |
| Specificity | ~83% | TN / (TN + FP) |

> Exact values fluctuate slightly with each evaluation since the model retrains on full data on first server start. The dashboard always shows the current live numbers.

### Why Recall is prioritised
In cyberbullying detection, a **false negative** (missed bullying) means a victim suffers harm we could have prevented. A **false positive** (innocent message flagged) costs a moderator ~10 seconds of review. We deliberately tune the threshold to favour recall over precision.


## Security

| Layer | Mechanism |
|-------|-----------|
| Passwords | bcrypt with 12 rounds |
| Authentication | JWT (HS256), separate access & refresh secrets |
| Rate limiting | 100 req / 15 min per IP (general); 5 / 15 min (auth) |
| HTTP headers | `helmet` (CSP, HSTS, X-Frame-Options) |
| Injection prevention | `express-mongo-sanitize` strips `$` operators |
| XSS | `xss` library sanitises user-supplied strings |
| Input validation | `express-validator` on every endpoint |
| CORS | Restricted to known frontend origin |
| Account lockout | After repeated failed login attempts |


## Limitations

We are honest about what this system can and cannot do:

- **English-only.** Keyword dictionaries are English. Non-English content falls back to ML alone, with degraded accuracy.
- **No sarcasm/irony detection.** Messages like "oh wow, what a *brilliant* idea" are cutting in context but contain no negative tokens.
- **Static keyword lists.** New slang and coded language slip through until dictionaries are manually updated.
- **No image, audio, or video analysis.** Text-only system.
- **Not integrated with live social APIs.** Platform context is simulated; messages must be submitted manually or via the API.
- **Potential bias.** The model inherits biases from the training data. Mitigations: human moderator review for High/Critical findings, user feedback loop, no automated punitive action.
- **Same-corpus evaluation.** Training and test sets are drawn from the same source; real-world deployment on a different platform would likely show 5–15% lower accuracy.


## Future Work

- **Multilingual support** — Hindi, Hinglish, Spanish via per-language Naive Bayes models or multilingual embeddings.
- **Transformer-based classifier** — Fine-tune DistilBERT or RoBERTa for context-aware classification including sarcasm.
- **Browser extension** — Detect bullying as the user types on actual social platforms.
- **Image and meme detection** — OCR for screenshots and image classifiers for hate symbols.
- **Sarcasm-detection layer** — Trained separately and ensembled into the main classifier.
- **K-fold cross-validation** in the evaluator for statistically robust metrics.
- **Per-category metrics** — Confusion matrix for each detailed category, not just binary.
- **Real-time chat integration** — Socket.io-powered live monitoring with mid-air interception.
- **User reputation scoring** — Cross-chat tracking of repeat offenders.
- **Active learning loop** — Auto-queue low-confidence detections for human review.


## Team

This project was developed by a team of three students as a final-year project.

### Project Members

| Name | Primary Focus |
|------|---------------|
| **S. Jhushana Priya** | Machine Learning & Data Engineering — dataset curation, Naive Bayes implementation, evaluation pipeline, heuristic engineering |
| **D. Hansika** | Backend Development — REST API, authentication, MongoDB schema design, security middleware |
| **K. Venkat Sai** | Frontend Development — React UI, dashboard visualisations, user flows, chat simulator |

All members contributed across all layers of the project; the above represents primary ownership.

### Project Guide

**Ms. Rama Lakshmi** &mdash; for her guidance, feedback, and continuous support throughout the project lifecycle.


## License

This project is released under the **MIT License**. See `LICENSE` file (if present) for details. The dataset (`classified_dataset.csv`) is sourced from publicly available cyberbullying corpora and is used for academic purposes only.


## Acknowledgements

- Public cyberbullying datasets from Kaggle, the Wikipedia Talk attacks corpus, and Twitter research datasets.
- Open-source libraries: `natural`, `ml-matrix`, `express`, `mongoose`, `react`, `tailwindcss`, `shadcn/ui`, `recharts`.
- The cyberbullying research community for foundational work on detection methods.


> **Note for educational use:** This system is a research and education project, not a production moderation service. Real-world deployment for content moderation requires extensive testing, fairness auditing, GDPR compliance review, and human oversight at every stage.
