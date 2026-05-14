import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── In-memory auth ────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'CyberGuard-secret-key';
const users = new Map();          // email -> user record
const usernameIndex = new Map();  // username -> email

function generateTokens(user) {
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
  const refreshToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  return { token, refreshToken };
}

function buildUserResponse(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    req.userId = decoded.id;
    req.userEmail = decoded.email;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email and password are required' });
    }
    if (users.has(email)) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    if (usernameIndex.has(username.toLowerCase())) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const user = {
      id,
      username,
      email,
      passwordHash,
      profile: { firstName: firstName || '', lastName: lastName || '', avatar: '', bio: '', dateOfBirth: '', country: '', language: 'en' },
      settings: {
        notifications: { email: true, push: true, sms: false },
        privacy: { profileVisibility: 'public', showDetectionHistory: true },
        detection: { sensitivity: 'medium', autoBlock: false, blockThreshold: 0.8 },
      },
      subscription: { plan: 'free', status: 'active', features: ['basic_detection'] },
      role: 'user',
      isActive: true,
      emailVerified: false,
      twoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
      lastLogin: now,
      stats: { totalDetections: 0, bullyingDetections: 0, blockedUsers: 0, reportsSubmitted: 0 },
    };

    users.set(email, user);
    usernameIndex.set(username.toLowerCase(), email);

    const tokens = generateTokens(user);
    res.status(201).json({ user: buildUserResponse(user), ...tokens });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) {
      return res.status(400).json({ message: 'Credentials are required' });
    }

    let userRecord;
    if (users.has(emailOrUsername)) {
      userRecord = users.get(emailOrUsername);
    } else {
      const email = usernameIndex.get(emailOrUsername.toLowerCase());
      if (email) userRecord = users.get(email);
    }

    if (!userRecord) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, userRecord.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    userRecord.lastLogin = new Date().toISOString();
    const tokens = generateTokens(userRecord);
    res.json({ user: buildUserResponse(userRecord), ...tokens });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Get current user
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const userRecord = users.get(req.userEmail);
  if (!userRecord) return res.status(404).json({ message: 'User not found' });
  res.json({ user: buildUserResponse(userRecord) });
});

// Refresh token
app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'Refresh token required' });
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    // Find user by id
    for (const u of users.values()) {
      if (u.id === decoded.id) {
        const tokens = generateTokens(u);
        return res.json(tokens);
      }
    }
    res.status(401).json({ message: 'User not found' });
  } catch {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

// Logout
app.post('/api/auth/logout', (_req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// User profile & settings (authenticated)
app.get('/api/users/profile', authMiddleware, (req, res) => {
  const u = users.get(req.userEmail);
  if (!u) return res.status(404).json({ message: 'User not found' });
  res.json({ user: buildUserResponse(u) });
});

app.patch('/api/users/profile', authMiddleware, (req, res) => {
  const u = users.get(req.userEmail);
  if (!u) return res.status(404).json({ message: 'User not found' });
  if (req.body.profile) Object.assign(u.profile, req.body.profile);
  u.updatedAt = new Date().toISOString();
  res.json({ user: buildUserResponse(u) });
});

app.patch('/api/users/settings', authMiddleware, (req, res) => {
  const u = users.get(req.userEmail);
  if (!u) return res.status(404).json({ message: 'User not found' });
  if (req.body.settings) {
    if (req.body.settings.notifications) Object.assign(u.settings.notifications, req.body.settings.notifications);
    if (req.body.settings.privacy) Object.assign(u.settings.privacy, req.body.settings.privacy);
    if (req.body.settings.detection) Object.assign(u.settings.detection, req.body.settings.detection);
  }
  u.updatedAt = new Date().toISOString();
  res.json({ user: buildUserResponse(u) });
});

app.get('/api/users/stats', authMiddleware, (req, res) => {
  const u = users.get(req.userEmail);
  if (!u) return res.status(404).json({ message: 'User not found' });
  res.json({ stats: u.stats });
});

const MODEL_PATH = path.join(process.cwd(), 'public', 'data', 'model.json');
const ALT_MODEL_PATH = path.join(process.cwd(), '..', 'public', 'data', 'model.json');
let model = null;
let vocabMap = new Map();

function loadModel() {
  let modelPath = MODEL_PATH;
  if (!fs.existsSync(modelPath)) {
    modelPath = ALT_MODEL_PATH;
  }
  if (!fs.existsSync(modelPath)) {
    console.warn(`Model not found at ${MODEL_PATH} or ${ALT_MODEL_PATH} — ML endpoint disabled`);
    return;
  }
  const raw = fs.readFileSync(modelPath, 'utf8');
  model = JSON.parse(raw);
  vocabMap = new Map();
  if (model.vocabulary && typeof model.vocabulary === 'object') {
    for (const [k, v] of Object.entries(model.vocabulary)) {
      vocabMap.set(k, v);
    }
  }
  console.log(`Loaded model: ${model.totalDocs} docs, vocabSize=${model.vocabSize}`);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function classify(text) {
  if (!model) throw new Error('Model not loaded');

  const words = tokenize(text);
  if (words.length === 0) {
    return {
      label: 'Non-Bullying',
      detailedCategory: 'Non_Bullying',
      confidence: 0.55,
      method: 'No words',
    };
  }

  let logB = Math.log(model.priorBully || 1e-9);
  let logN = Math.log(model.priorNonBully || 1e-9);

  for (const word of words) {
    const stats = vocabMap.get(word);
    if (stats) {
      const idf = Math.max(stats.idf || 0.1, 0.1);
      logB += Math.log(stats.bullyFreq || 1e-9) * idf;
      logN += Math.log(stats.nonBullyFreq || 1e-9) * idf;
    } else {
      const unknown = 1 / ((model.vocabSize || 1) + 1);
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
  const lower = text.toLowerCase();
  const detailedCategory = !isBullying
    ? 'Non_Bullying'
    : /(kill|die|murder|threat|stab|bomb|shoot|hang|kys)/.test(lower)
      ? 'Threatening'
      : /(nigger|nigga|chink|faggot|fag|dyke|tranny|kike|wetback|spic|queer|homo)/.test(lower)
        ? 'Hate_Speech'
        : /(whore|slut|hoe|skank|thot|cunt|bitch|rape|pervert|dick|cock|pussy)/.test(lower)
          ? 'Sexual_Harassment'
          : 'Toxic_Profanity';

  return {
    label: isBullying ? 'Bullying' : 'Non-Bullying',
    detailedCategory,
    confidence,
    method: 'Naive Bayes (server)',
  };
}

app.get('/health', (_req, res) => {
  const base = { ok: true, modelLoaded: !!model };
  if (model) {
    base.modelSummary = {
      totalDocs: model.totalDocs,
      vocabSize: model.vocabSize,
      trainSize: model.split?.trainSize,
      testSize: model.split?.testSize,
      evaluation: model.evaluation,
    };
  }
  res.json(base);
});

app.get('/api/model', (_req, res) => {
  if (!model) return res.status(500).json({ error: 'model not loaded' });
  // Return the raw model as stored on disk (including evaluation info)
  res.json(model);
});

app.post('/api/detect', (req, res) => {
  const text = (req.body.text || req.body.message || '').toString();
  if (!text.trim()) return res.status(400).json({ error: 'text required' });
  const result = classify(text);
  res.json({ result });
});

const port = process.env.PORT || 5001;
try {
  loadModel();
} catch (err) {
  console.error(err);
}

app.listen(port, () => {
  console.log(`Simple backend server running on http://localhost:${port}`);
});
