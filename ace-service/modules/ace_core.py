# ace_core.py
from __future__ import annotations

from transformers import AutoTokenizer, AutoModel, T5Tokenizer, T5ForConditionalGeneration
import torch
import time
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional
import uuid

# --------- Tiny, fast embedding model for indexing/search ----------
_EMB_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_tok_emb = AutoTokenizer.from_pretrained(_EMB_MODEL_NAME)
_emb = AutoModel.from_pretrained(_EMB_MODEL_NAME)
_device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
_emb.to(_device).eval()

# --------- (Optional) light T5 for paraphrase/distractors -----------
_T5_NAME = "google/flan-t5-small"
_tok_t5 = T5Tokenizer.from_pretrained(_T5_NAME)
_t5 = T5ForConditionalGeneration.from_pretrained(_T5_NAME).to(_device).eval()

# --------- In-memory index -----------------------------------------
_EMB_TEXTS: List[str] = []                 # raw chunks
_EMB_MATRIX: Optional[torch.Tensor] = None # [N, D] or None
_INDEX_READY = False

# Optional seed on first run (off by default)
USE_TINY_SEED = False
_TINY_SEED = [
    "A monolith is a single deployable unit, while microservices split functionality into independent services.",
    "CI/CD automates building, testing, and deploying to reduce lead time and increase reliability.",
]

def _mean_pool(last_hidden_state: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    # Ensure same sequence length for pooling
    if last_hidden_state.shape[1] != attention_mask.shape[1]:
        L = last_hidden_state.shape[1]
        if attention_mask.shape[1] < L:
            pad = torch.zeros((attention_mask.shape[0], L - attention_mask.shape[1]),
                              dtype=attention_mask.dtype, device=attention_mask.device)
            attention_mask = torch.cat([attention_mask, pad], dim=1)
        else:
            attention_mask = attention_mask[:, :L]
    masked = last_hidden_state * attention_mask.unsqueeze(-1)
    denom = attention_mask.sum(1, keepdim=True).clamp(min=1e-9)
    return masked.sum(1) / denom

@torch.no_grad()
def _encode(texts: List[str]) -> torch.Tensor:
    """
    Encode a list of strings → [N, D]. If texts is empty, return 0xD tensor.
    """
    if not isinstance(texts, list):
        raise TypeError("encode expects a list[str]")

    if len(texts) == 0:
        # infer D once
        dummy = _tok_emb("x", return_tensors="pt")
        out = _emb(**{k: v.to(_device) for k, v in dummy.items()})
        D = out.last_hidden_state.shape[-1]
        return torch.zeros((0, D), dtype=torch.float32, device=_device)

    inputs = _tok_emb(texts, padding=True, truncation=True, return_tensors="pt")
    inputs = {k: v.to(_device) for k, v in inputs.items()}
    out = _emb(**inputs)
    sent = _mean_pool(out.last_hidden_state, inputs["attention_mask"])  # [N, D]
    sent = torch.nn.functional.normalize(sent, p=2, dim=1)
    return sent

def build_index(items: List[dict]):
    """
    items: [{'id': '...', 'text': '...', 'cite': '...'}, ...]
    Safe on empty lists.
    """
    global _EMB_TEXTS, _EMB_MATRIX, _INDEX_READY
    texts = [it.get("text", "").strip() for it in items if it.get("text")]
    if not texts and USE_TINY_SEED:
        texts = list(_TINY_SEED)

    _EMB_TEXTS = texts
    _EMB_MATRIX = _encode(texts)   # [0, D] when empty
    _INDEX_READY = True

def index_size() -> int:
    return len(_EMB_TEXTS)

def ready() -> bool:
    return _INDEX_READY

# ------------------ Nearest-neighbor search -------------------------
@torch.no_grad()
def search(query: str, top_k: int = 4) -> List[Dict[str, Any]]:
    """
    Return top_k chunks: [{ 'text': ..., 'score': float, 'cite': ...}, ...]
    If index empty -> [].
    """
    if not _INDEX_READY or _EMB_MATRIX is None or _EMB_MATRIX.shape[0] == 0:
        return []
    q = _encode([query])                           # [1, D]
    sims = (q @ _EMB_MATRIX.T).squeeze(0)         # [N]
    k = min(top_k, sims.shape[0])
    if k <= 0:
        return []
    vals, idx = torch.topk(sims, k)
    out = []
    for s, i in zip(vals.tolist(), idx.tolist()):
        out.append({"text": _EMB_TEXTS[i], "score": float(s), "cite": f"chunk-{i+1}"})
    return out

# ------------------ Minimal MCQ scaffolding -------------------------
@dataclass
class MasteryState:
    mastery: float = 0.2          # 0..1
    difficulty: str = "med"       # low|med|high (cosmetic)
    next_review_ts: float = 0.0   # epoch seconds; 0 = now

    def update(self, correct: bool, confidence: str) -> None:
        step = {"low": 0.03, "med": 0.06, "high": 0.1}.get(confidence, 0.06)
        if correct:
            self.mastery = min(1.0, self.mastery + step)
        else:
            self.mastery = max(0.0, self.mastery - step * 0.8)
        base_hours = 6 if not correct else 24
        self.next_review_ts = time.time() + base_hours * 3600

# Per-user+concept memory
MASTERIES: Dict[Tuple[str, str], MasteryState] = {}

# Simple in-memory attempt log (acts like attempts.jsonl)
_ATTEMPTS: List[Dict[str, Any]] = []

def record_attempt(
    user_id: str,
    concept_id: str,
    correct: bool,
    confidence: str = "med",
    item_id: Optional[str] = None,
    pack_id: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> MasteryState:
    """
    Append an attempt to in-memory log and update mastery.
    IMPORTANT: returns the MasteryState (so ace_flash can do st.mastery).
    """
    ts = time.time()
    entry = {
        "ts": ts,
        "user_id": user_id,
        "concept_id": concept_id,
        "correct": bool(correct),
        "confidence": confidence,
        "item_id": item_id,
        "pack_id": pack_id,
    }
    if extra:
        entry.update(extra)
    _ATTEMPTS.append(entry)

    # Update mastery
    key = (user_id, concept_id)
    st = MASTERIES.setdefault(key, MasteryState())
    lr = {"low": 0.03, "med": 0.05, "high": 0.08}.get(confidence.lower(), 0.05)
    delta = lr * (1.0 if correct else -0.6)
    st.mastery = float(min(1.0, max(0.0, st.mastery + delta)))
    base_days = 0.2 if not correct else (1.0 + 6.0 * st.mastery)  # ~5h to ~7d
    st.next_review_ts = ts + base_days * 86400.0
    st.difficulty = "low" if st.mastery >= 0.7 else ("med" if st.mastery >= 0.35 else "high")
    return st

def read_attempts_raw() -> List[Dict[str, Any]]:
    """Expose attempts to /stats without ace_store.py."""
    return list(_ATTEMPTS)

def submit_answer(
    user_id: str,
    concept_id: str,
    mcq: dict,
    chosen_letter: str,
    confidence: str = "med",
) -> dict:
    """
    Evaluate an MCQ and update mastery. Returns summary for API.
    """
    chosen_letter = (chosen_letter or "").strip().upper()
    correct_letter = (mcq.get("answer_letter") or "").strip().upper()
    correct = chosen_letter == correct_letter

    st = record_attempt(
        user_id=user_id,
        concept_id=concept_id,
        correct=correct,
        confidence=confidence,
        item_id=mcq.get("item_id"),
        pack_id=mcq.get("pack_id"),
        extra={"type": "mcq"},
    )

    return {
        "correct": correct,
        "answer_letter": correct_letter,
        "confidence": confidence,
        "mastery": round(st.mastery, 2),
        "next_review_in_hours": max(0, int((st.next_review_ts - time.time()) // 3600)),
    }

def ensure_topup(user_id: str, concept_id: str, min_items: int = 1):
    """No-op placeholder (compat with app.py); seed mastery state."""
    MASTERIES.setdefault((user_id, concept_id), MasteryState())
    return

def _make_dummy_mcq(concept_id: str) -> dict:
    """Small synthetic MCQ used when the index has no content, so flows work."""
    item_id = f"itm-{uuid.uuid4().hex[:8]}"
    return {
        "item_id": item_id,
        "concept_id": concept_id,
        "mcq": {
            "item_id": item_id,
            "concept_id": concept_id,
            "question": "Which is true about microservices vs. monoliths?",
            "options": {
                "A": "Monolith = single deployable; microservices = many small services",
                "B": "Microservices must share one database schema",
                "C": "Monoliths cannot be tested",
                "D": "Microservices require no network communication",
            },
            "answer_letter": "A",
            "source": "builtin:dummy",
        },
    }

def get_due_today_pack(user_id: str, count: int = 3):
    """
    app.py asks for a 'pack shell'. If the semantic index is empty,
    we synthesize a small GENERIC pack so the end-to-end flow never breaks.
    Otherwise, return an empty item list (app.py will call your model-service
    and fill items using search() results).
    """
    pack_id = f"pack-{str(abs(hash((user_id, index_size(), int(time.time())//3600))))[:8]}"

    # If no content has been indexed yet, give a tiny fallback pack
    if not _INDEX_READY or _EMB_MATRIX is None or _EMB_MATRIX.shape[0] == 0:
        n = max(1, int(count))
        items = [_make_dummy_mcq("GENERIC") for _ in range(n)]
        # Attach pack_id for submit bookkeeping
        for it in items:
            it["mcq"]["pack_id"] = pack_id
        return pack_id, items

    # Normal path: app.py will generate items using its model-service
    return pack_id, []

def mcq_to_json(mcq, concept_id, item_id):
    # passthrough; app.py already produces correct shape
    return mcq
