# modules/ace_flash.py
from __future__ import annotations

import os
import re
import time
from typing import List, Dict, Any

import torch
from transformers import T5ForConditionalGeneration, T5Tokenizer, pipeline

# Import core that the FastAPI app wires on sys.path
import ace_core as ace

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
# Prefer using the in-memory index via ace.search(). If empty, we can optionally
# look at PDFs in SYLLABUS_DIR (same env var your app.py uses).
SYLLABUS_DIR = os.getenv("SYLLABUS_DIR", "")

# A light model is fine for short Q/A generation
_T5_NAME = os.getenv("FLASH_T5_MODEL", "google/flan-t5-small")
_device = 0 if torch.cuda.is_available() else -1

_tok = T5Tokenizer.from_pretrained(_T5_NAME)
_t5 = T5ForConditionalGeneration.from_pretrained(_T5_NAME)
_pipe = pipeline(
    "text2text-generation",
    model=_t5,
    tokenizer=_tok,
    device=_device,
)

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
_PDF_HEADER_RE = re.compile(r'^[-\s]*[\w\s\-()]+\.pdf:\s*', re.IGNORECASE)

def _strip_junk(s: str) -> str:
    s2 = _PDF_HEADER_RE.sub("", s)
    s2 = re.sub(r'^\s*\d{1,3}\s+', '', s2)   # leading slide/page numbers
    s2 = re.sub(r'\s+', ' ', s2).strip()
    return s2

def _clean_context(ctx: str, max_chars: int = 400) -> str:
    ctx = _strip_junk(ctx)
    sents = re.split(r'(?<=[.!?])\s+', ctx)
    keep: List[str] = []
    for s in sents:
        s0 = s.strip()
        if not s0:
            continue
        if re.search(r'\b(slide|page)\s*\d+\b', s0, flags=re.I):
            continue
        if sum(ch.isdigit() for ch in s0) >= 5:  # very numeric → likely noise
            continue
        if len(s0.split()) < 5:
            continue
        keep.append(s0)
    ctx2 = " ".join(keep)[:max_chars]
    return ctx2 if ctx2 else ctx[:max_chars]

_FC_RE = re.compile(r"Q:\s*(?P<q>.+?)\s*A:\s*(?P<a>.+)", flags=re.S | re.I)

def _make_flashcard_from_context(context: str) -> Dict[str, str]:
    ctx = _clean_context(context)
    prompt = (
        "Create ONE study flashcard from the note.\n\n"
        f'Note:\n""" {ctx} """\n\n'
        "Write exactly:\n\n"
        "Q: <short question or term>\n"
        "A: <short answer in 1–2 simple sentences>\n\n"
        "No bullets, no extra lines—just those two."
    )
    out = _pipe(
        prompt,
        max_new_tokens=80,
        do_sample=False,
        num_beams=4,
        early_stopping=True,
    )[0]["generated_text"].strip()

    m = _FC_RE.search(out)
    if not m:
        first = ctx.split(".")[0].strip() or "Key idea"
        return {"Q": "What is the main idea?", "A": _strip_junk(first)[:180]}

    q = _strip_junk(m.group("q"))[:120].strip()
    a = _strip_junk(m.group("a"))
    a_first = re.split(r'(?<=[.!?])\s+', a)[0].strip()[:180]
    return {"Q": q, "A": a_first}

def _concept_keywords(concept_id: str) -> List[str]:
    low = (concept_id or "").lower()
    if "microservices" in low or "monolith" in low:
        return ["monolith", "microservices"]
    if "devops" in low and "lifecycle" in low:
        return ["devops", "lifecycle"]
    if "devops" in low and "ci" in low:
        return ["continuous integration", "ci"]
    if "devops" in low and "cd" in low:
        return ["continuous delivery", "deployment", "cd"]
    # fallback: last segment
    return [low.split(".")[-1]] if low else ["topic"]

def _contexts_from_index(concept_id: str, max_chunks: int) -> List[Dict[str, Any]]:
    """
    Use ace.search over the built index. If index is empty, return [].
    """
    kws = _concept_keywords(concept_id)
    found: List[Dict[str, Any]] = []
    for kw in kws:
        hits = ace.search(kw, top_k=max_chunks)
        for h in hits:
            found.append({"text": h["text"], "cite": h.get("cite", "index")})
            if len(found) >= max_chunks:
                return found
    return found

def _contexts_from_pdfs(concept_id: str, max_chunks: int) -> List[Dict[str, Any]]:
    """
    Optional fallback: read PDFs under SYLLABUS_DIR if present.
    """
    results: List[Dict[str, Any]] = []
    if not (SYLLABUS_DIR and os.path.isdir(SYLLABUS_DIR)):
        return results

    kws = _concept_keywords(concept_id)
    try:
        from pypdf import PdfReader
    except Exception:
        return results

    for fname in os.listdir(SYLLABUS_DIR):
        if not fname.lower().endswith(".pdf"):
            continue
        path = os.path.join(SYLLABUS_DIR, fname)
        try:
            reader = PdfReader(path)
        except Exception:
            continue
        for p_idx, page in enumerate(reader.pages):
            text = (page.extract_text() or "").strip()
            if not text:
                continue
            if not any(kw in text.lower() for kw in [k.lower() for k in kws]):
                continue
            results.append({"text": re.sub(r"\s+", " ", text), "cite": f"{fname} p.{p_idx+1}"})
            if len(results) >= max_chunks:
                return results
    return results

# -----------------------------------------------------------------------------
# Public API used by FastAPI app
# -----------------------------------------------------------------------------
def flashcards_for_concept(concept_id: str, n: int = 3) -> List[Dict[str, Any]]:
    """
    Build up to n flashcards for a concept using contexts from the index/PDFs.
    """
    # prefer the index
    ctxs = _contexts_from_index(concept_id, max_chunks=n * 2)

    # optional fallback to PDFs
    if not ctxs:
        ctxs = _contexts_from_pdfs(concept_id, max_chunks=n * 2)

    cards: List[Dict[str, Any]] = []
    seen_norm: set[str] = set()

    for ctx in ctxs:
        card = _make_flashcard_from_context(ctx["text"])
        norm = re.sub(r"\W+", " ", card["A"]).lower().strip()
        if norm in seen_norm:
            continue
        seen_norm.add(norm)
        cards.append(
            {
                "question": card["Q"],
                "answer": card["A"],
                "concept_id": concept_id,
                "source": ctx.get("cite", "N/A"),
            }
        )
        if len(cards) >= n:
            break

    if not cards:
        # absolute fallback
        tail = (concept_id or "the topic").split(".")[-1]
        cards.append(
            {
                "question": f"What is {tail}?",
                "answer": f"{tail.capitalize()}—key ideas and purpose in brief.",
                "concept_id": concept_id,
                "source": "N/A",
            }
        )
    return cards


def flashcard_feedback(user_id: str, concept_id: str, knew_it: bool, confidence: str = "med") -> Dict[str, Any]:
    """
    Record a flashcard self-assessment as an 'attempt' and report mastery.
    Your current ace_core.record_attempt returns a dict entry, so we
    read the updated MasteryState from ace.MASTERIES afterwards.
    """
    # record the attempt (updates mastery + next review internally)
    ace.record_attempt(
        user_id=user_id,
        concept_id=concept_id,
        correct=bool(knew_it),
        confidence=(confidence or "med").lower(),
    )

    # read current mastery state
    st = ace.MASTERIES.get((user_id, concept_id))
    now = time.time()
    next_days = 0.0
    difficulty = "med"
    mastery = 0.0
    if st is not None:
        mastery = float(getattr(st, "mastery", 0.0))
        difficulty = getattr(st, "difficulty", "med")
        ts = getattr(st, "next_review_ts", 0.0) or 0.0
        next_days = max(0.0, (ts - now) / 86400.0)

    return {
        "concept_id": concept_id,
        "knew_it": bool(knew_it),
        "confidence": (confidence or "med").lower(),
        "new_mastery": round(mastery, 2),
        "next_in_days": round(next_days, 2),
        "difficulty": difficulty,
        "success": True,
    }
