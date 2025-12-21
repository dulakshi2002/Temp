// api/controllers/ace.controller.js
import fs from "fs";
import path from "path";
import url from "url";
import multer from "multer";
import axios from "axios";
import dotenv from "dotenv";
import Concept from "../models/concept.model.js";

dotenv.config();

// ---------- ENV + helpers ----------
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const ACE_API_BASE = process.env.ACE_API_BASE || process.env.REINFORCE_URL || "http://127.0.0.1:8000";
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || "student-001";
const SYLLABUS_DIR =
  process.env.SYLLABUS_DIR ||
  path.resolve(__dirname, "../../../data/syllabus"); // repo_root/data/syllabus

function requireUrl(name, value) {
  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(`ENV ${name} is missing or invalid URL: "${value ?? ""}"`);
  }
}
const ACE_BASE = requireUrl("ACE_API_BASE", ACE_API_BASE);

// ensure folder exists for uploads
fs.mkdirSync(SYLLABUS_DIR, { recursive: true });

// one axios client for ACE
const ace = axios.create({
  baseURL: ACE_BASE,
  timeout: 15_000,
});

// map axios errors → clean messages
function toHttpError(e, fallback = "Upstream error") {
  if (e.response) {
    return {
      status: e.response.status,
      body: e.response.data ?? { message: `${fallback} (status ${e.response.status})` },
    };
  }
  if (e.code === "ECONNREFUSED" || e.code === "ETIMEDOUT") {
    return { status: 502, body: { message: "Model/ACE service is unreachable" } };
  }
  return { status: 500, body: { message: fallback } };
}

// ---------- Multer (PDF uploads) ----------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SYLLABUS_DIR),
  filename: (_req, file, cb) => {
    // allow letters, numbers, space, dot, dash, underscore, parentheses
    const clean = file.originalname.replace(/[^a-zA-Z0-9 ._\-()]+/g, "_");
    cb(null, clean);
  },
});
export const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");
    cb(ok ? null : new Error("Only PDF files are allowed"), ok);
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ---------- Controllers ----------
export const health = async (_req, res) => {
  try {
    const r = await ace.get("/health");
    res.json(r.data);
  } catch (e) {
    const err = toHttpError(e, "ACE /health failed");
    res.status(err.status).json(err.body);
  }
};

export const listConcepts = async (req, res) => {
  try {
    const user_id = req.query.user_id || DEFAULT_USER_ID;
    const r = await ace.get("/concepts", { params: { user_id } });
    res.json(r.data);
  } catch (e) {
    const err = toHttpError(e, "ACE /concepts failed");
    res.status(err.status).json(err.body);
  }
};

export const stats = async (req, res) => {
  try {
    const user_id = req.query.user_id || DEFAULT_USER_ID;
    const r = await ace.get("/stats", { params: { user_id } });
    res.json(r.data);
  } catch (e) {
    const err = toHttpError(e, "ACE /stats failed");
    res.status(err.status).json(err.body);
  }
};

// Start a “pack” (MCQ session)
// NOTE: ACE /pack currently does not filter by concept; we echo your conceptCode for FE continuity.
export const startSession = async (req, res) => {
  try {
    const {
      count = 3,
      userId = DEFAULT_USER_ID,
      conceptCode,        // optional, for your FE
      difficulty,         // optional, not used by ACE /pack
      numQuestions,       // optional, not used directly
      numFlashcards,      // optional, not used directly
    } = req.body || {};

    const r = await ace.get("/pack", { params: { count, user_id: userId } });

    res.json({
      success: true,
      message: "Pack created",
      ace: r.data,
      echo: { conceptCode, difficulty, numQuestions, numFlashcards },
    });
  } catch (e) {
    const err = toHttpError(e, "ACE /pack failed");
    res.status(err.status).json({ success: false, ...err.body });
  }
};

export const submitAnswer = async (req, res) => {
  try {
    const {
      packId,
      itemId,
      conceptId,
      choice,
      confidence = "med",
      userId = DEFAULT_USER_ID,
    } = req.body || {};

    if (!packId || !itemId || !conceptId || !choice) {
      return res.status(400).json({
        success: false,
        message: "packId, itemId, conceptId and choice are required.",
      });
    }

    const r = await ace.post(
      "/submit",
      {
        pack_id: packId,
        item_id: itemId,
        concept_id: conceptId,
        choice,
        confidence,
      },
      { params: { user_id: userId } }
    );

    res.json({ success: true, result: r.data });
  } catch (e) {
    const err = toHttpError(e, "ACE /submit failed");
    res.status(err.status).json({ success: false, ...err.body });
  }
};

export const getFlashcards = async (req, res) => {
  try {
    const concept_id =
      req.body?.conceptId || req.query?.concept_id || req.body?.concept_id;
    const count = Number(req.body?.count || req.query?.count || 3);
    const user_id = req.body?.userId || req.query?.user_id || DEFAULT_USER_ID;

    if (!concept_id) {
      return res
        .status(400)
        .json({ success: false, message: "conceptId/concept_id is required" });
    }

    const r = await ace.get("/flashcards", {
      params: { concept_id, count, user_id },
    });

    res.json({ success: true, items: r.data.items, concept_id });
  } catch (e) {
    const err = toHttpError(e, "ACE /flashcards failed");
    res.status(err.status).json({ success: false, ...err.body });
  }
};

export const submitFlashFeedback = async (req, res) => {
  try {
    const {
      conceptId,
      knewIt,
      confidence = "med",
      userId = DEFAULT_USER_ID,
    } = req.body || {};

    if (!conceptId || typeof knewIt !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "conceptId and knewIt(boolean) are required",
      });
    }

    const r = await ace.post("/flash_submit", {
      user_id: userId,
      concept_id: conceptId,
      knew_it: knewIt,
      confidence,
    });

    res.json({ success: true, result: r.data });
  } catch (e) {
    const err = toHttpError(e, "ACE /flash_submit failed");
    res.status(err.status).json({ success: false, ...err.body });
  }
};

// Upload PDF — saved to SYLLABUS_DIR so FastAPI can index them
export const uploadPdf = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "PDF file required" });
  }
  const fullPath = path.join(SYLLABUS_DIR, req.file.filename);
  return res.json({
    success: true,
    message: "Uploaded",
    filename: req.file.filename,
    storedAt: fullPath,
  });
};

// (Optional) debug: list PDFs ACE should see
export const listPdfs = async (_req, res) => {
  const files = (await fs.promises.readdir(SYLLABUS_DIR)).filter(f => f.toLowerCase().endsWith(".pdf"));
  res.json({ dir: SYLLABUS_DIR, files });
};

// (Optional) local concept collection for FE dropdowns
export const ensureConcept = async (req, res) => {
  try {
    const { code, title } = req.body || {};
    if (!code || !title) {
      return res.status(400).json({ success: false, message: "code and title required" });
    }
    const existing = await Concept.findOne({ code });
    if (existing) {
      return res.json({ success: true, concept: existing, note: "exists" });
    }
    const created = await Concept.create({ code, title });
    res.json({ success: true, concept: created });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || "DB error" });
  }
};
