// api/routes/ace.route.js
import { Router } from "express";
import {
  // health / status
  health,
  listConcepts,
  stats,

  // MCQ session
  startSession,
  submitAnswer,

  // Flashcards
  getFlashcards,
  submitFlashFeedback,

  // Uploads + concept catalog
  uploadPdf,
  ensureConcept,

  // Multer middleware from controller
  upload,
} from "../controllers/ace.controller.js";

const router = Router();

// ---------- Health / status ----------
router.get("/health", health);
router.get("/concepts", listConcepts);   // ?user_id=student-001
router.get("/stats", stats);             // ?user_id=student-001

// ---------- MCQ session ----------
router.post("/session", startSession);   // body: { count?, userId? }
router.post("/submit", submitAnswer);    // body: { packId, itemId, conceptId, choice, confidence?, userId? }

// ---------- Flashcards ----------
router.get("/flashcards", getFlashcards);              // ?concept_id=...&count=2&user_id=...
router.post("/flashcards/submit", submitFlashFeedback); // body: { conceptId, knewIt, confidence?, userId? }

// ---------- Upload PDFs ----------
router.post("/upload", upload.single("pdf"), uploadPdf); // form-data: pdf=<file.pdf>

// ---------- Optional concept catalog ----------
router.post("/concept", ensureConcept); // body: { code, title }

export default router;
