// Habit Tracker — backend server
//
// A tiny Express server that (1) serves the existing frontend files exactly
// where they already are, and (2) exposes a small JSON-file-backed REST API
// so habit/completion/focus data persists in data/store.json instead of
// living only in one browser's localStorage. No database engine, no native
// dependencies — this is deliberate, so `npm install` works out of the box
// on any machine someone clones this repo onto.
//
// Run with: npm start   (then open http://localhost:3000)

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

const DEFAULT_STATE = { habits: [], completions: {}, focusHistory: {} };

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
  }
}

function readState() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch (err) {
    console.error("Failed to read data/store.json, using empty state:", err.message);
    return { ...DEFAULT_STATE };
  }
}

function writeState(state) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

app.use(express.json());

// Serve only the specific frontend assets the app needs — not the whole
// project directory — so server.js, package.json and data/store.json (which
// holds real habit data) are never reachable over HTTP.
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ---------- API ----------
//
// One GET to load everything at startup, and one PUT per collection to
// persist it — mirrors the shape the frontend already used for
// localStorage, so the frontend-side change is a small one.

app.get("/api/state", (req, res) => {
  res.json(readState());
});

app.put("/api/habits", (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "Expected an array of habits" });
  const state = readState();
  state.habits = req.body;
  writeState(state);
  res.json({ ok: true });
});

app.put("/api/completions", (req, res) => {
  if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
    return res.status(400).json({ error: "Expected a completions object" });
  }
  const state = readState();
  state.completions = req.body;
  writeState(state);
  res.json({ ok: true });
});

app.put("/api/focus-history", (req, res) => {
  if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
    return res.status(400).json({ error: "Expected a focus-history object" });
  }
  const state = readState();
  state.focusHistory = req.body;
  writeState(state);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Habit Tracker running at http://localhost:${PORT}`);
});
