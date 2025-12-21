# ace-service/app.py
from __future__ import annotations

import os
import re
import sys
import time
import uuid
from io import BytesIO
from pathlib import Path
from typing import Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pypdf import PdfReader
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent.resolve()
MODULES_DIR = BASE_DIR / "modules"
sys.path.append(str(MODULES_DIR))

# Local modules
import ace_core as ace          # noqa: E402
import ace_flash as flash       # noqa: E402
try:
    import ace_store as store   # noqa: E402
except Exception:
    store = None

# ---------- ENV ----------
DEFAULT_USER = os.getenv("DEFAULT_USER_ID", "student-001")
SYLLABUS_DIR = Path(os.getenv("SYLLABUS_DIR", str(BASE_DIR.parent / "data" / "syllabus"))).resolve()

AZ_CONN = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "").strip()
AZ_CONT = os.getenv("AZURE_BLOB_CONTAINER", "").strip()
AZ_PREFIX = os.getenv("AZURE_BLOB_PREFIX", "").strip()  # optional, e.g. "syllabus/"

# ---------- Optional Azure client ----------
_blob_client = None
if AZ_CONN and AZ_CONT:
    try:
        from azure.storage.blob import BlobServiceClient  # type: ignore
        _blob_client = BlobServiceClient.from_connection_string(AZ_CONN).get_container_client(AZ_CONT)
        print("[ace-service] Azure blobs enabled:", AZ_CONT)
    except Exception as e:
        print("[ace-service] Azure init failed (will ignore):", e)
        _blob_client = None

# ---------- FastAPI app ----------
app = FastAPI(title="ACE Reinforcement API", version="0.7")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGIN", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Models ----------
class SubmitPayload(BaseModel):
    pack_id: str = Field(..., alias="packId")
    item_id: str = Field(..., alias="itemId")
    concept_id: str = Field(..., alias="conceptId")
    choice: str
    confidence: str = "med"  # low|med|high

    class Config:
        populate_by_name = True


class FlashSubmitPayload(BaseModel):
    user_id: str = Field(DEFAULT_USER, alias="userId")
    concept_id: str = Field(..., alias="conceptId")
    knew_it: bool = Field(..., alias="knewIt")
    confidence: str = "med"

    class Config:
        populate_by_name = True


# ---------- In-memory state ----------
PACKS: Dict[str, Dict[str, dict]] = {}
INDEX_READY = False


# ---------- Helpers ----------
def _chunk_text(txt: str, max_len: int = 750, stride: int = 650) -> List[str]:
    import re as _re
    txt = _re.sub(r"\s+", " ", (txt or "")).strip()
    if not txt:
        return []
    chunks, i = [], 0
    while i < len(txt):
        chunk = txt[i : i + max_len]
        j = chunk.rfind(". ")
        if j > 300:
            chunk = chunk[: j + 1]
        chunk = chunk.strip()
        if len(chunk) > 50:
            chunks.append(chunk)
        i += stride
    return chunks


def _items_from_local_dir() -> List[dict]:
    items: List[dict] = []
    if not SYLLABUS_DIR.is_dir():
        return items
    pdfs = [f for f in os.listdir(SYLLABUS_DIR) if f.lower().endswith(".pdf")]
    for fname in pdfs:
        fpath = SYLLABUS_DIR / fname
        try:
            reader = PdfReader(str(fpath))
            for p_idx, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                for c_idx, ch in enumerate(_chunk_text(text)):
                    items.append(
                        {"id": f"{fname}#p{p_idx+1}c{c_idx+1}", "text": ch, "cite": f"{fname} p.{p_idx+1}"}
                    )
        except Exception as e:
            print("[ace-service] Skip local PDF:", fname, e)
    return items


def _items_from_azure() -> List[dict]:
    items: List[dict] = []
    if _blob_client is None:
        return items
    try:
        blobs = _blob_client.list_blobs(name_starts_with=AZ_PREFIX or None)
        for b in blobs:
            name = b.name
            if not name.lower().endswith(".pdf"):
                continue
            try:
                # Download to memory (no temp files needed)
                data = _blob_client.download_blob(name).readall()
                reader = PdfReader(BytesIO(data))
                for p_idx, page in enumerate(reader.pages):
                    text = page.extract_text() or ""
                    for c_idx, ch in enumerate(_chunk_text(text)):
                        items.append(
                            {"id": f"{name}#p{p_idx+1}c{c_idx+1}", "text": ch, "cite": f"{name} p.{p_idx+1}"}
                        )
            except Exception as e:
                print("[ace-service] Skip azure PDF:", name, e)
    except Exception as e:
        print("[ace-service] Azure list error (will ignore):", e)
    return items


def build_index_if_needed(user_id: str = DEFAULT_USER):
    global INDEX_READY
    if INDEX_READY:
        return

    # 1) Gather chunks (Azure first, then local)
    items: List[dict] = []
    az_items = _items_from_azure()
    if az_items:
        items.extend(az_items)
    local_items = _items_from_local_dir()
    if local_items:
        items.extend(local_items)

    # 2) Build index (ace_core.encode handles empty safely)
    if not items:
        print("[ace-service] No PDFs found; building empty index.")
    ace.build_index(items)

    # 3) Seed concepts
    seed_concepts = [
        "EAD.Microservices.MonolithVsMicroservices",
        "EAD.DevOps.Lifecycle",
        "EAD.DevOps.CI",
        "EAD.DevOps.CD",
    ]
    for cid in seed_concepts:
        if (user_id, cid) not in ace.MASTERIES:
            ace.MASTERIES[(user_id, cid)] = ace.MasteryState()
            ace.ensure_topup(user_id, cid, min_items=1)

    INDEX_READY = True
    print(f"[ace-service] Index built with {len(items)} chunks")


def _safe_read_attempts(user_id: str) -> List[dict]:
    if store and hasattr(store, "read_attempts_raw"):
        try:
            return [a for a in store.read_attempts_raw() if a.get("user_id") == user_id]
        except Exception:
            return []
    return []


# ---------- Routes ----------
@app.get("/favicon.ico")
def favicon_void():
    return {}  # silence browser favicon 404s


@app.get("/health")
def health():
    build_index_if_needed(DEFAULT_USER)
    return {"ok": True, "time": int(time.time())}


@app.get("/pack")
def get_pack(count: int = 3, user_id: str = DEFAULT_USER):
    """
    Returns a due-today pack of MCQs. Guarantees non-empty items if there is at
    least one text chunk in the index OR returns an explicit reason if the index is empty.
    """
    build_index_if_needed(user_id)

    # 0) If the index is empty, be explicit instead of returning []
    if ace.index_size() == 0:
        return {
            "pack_id": f"pack-{uuid.uuid4().hex[:8]}",
            "items": [],
            "note": "Index is empty: no syllabus PDFs were found/read. Upload a PDF or put one in the Azure 'uploads' container and hit /health to reindex."
        }

    # 1) pick texts for question generation
    #    - try a light “due” pack from mastery
    pack_id, seed_items = ace.get_due_today_pack(user_id, count=max(1, int(count)))

    # If ace_core didn't supply items (expected in this scaffold), we choose some contexts:
    contexts = []
    if not seed_items:
        # Prefer search hits for a generic query; fallback to top-N raw texts
        hits = ace.search("review", top_k=count * 2)  # neutral query to pull any content
        if hits:
            contexts = [h["text"] for h in hits[:count]]
        else:
            contexts = ace.sample_texts(k=count)

    # 2) Call model-service for each context, build MCQs
    out_items = []
    for cidx, ctx in enumerate(contexts, start=1):
        try:
            qg = requests.post(
                os.getenv("QG_MODEL_URL", "http://localhost:8001/generate"),
                json={"context": ctx, "n": 1},
                timeout=30
            )
            qg.raise_for_status()
            q_list = qg.json().get("items", [])
        except Exception as e:
            q_list = []
            print("[/pack] QG error:", e)

        if q_list:
            q = q_list[0]
            item_id = f"itm-{uuid.uuid4().hex[:8]}"
            out_items.append({
                "item_id": item_id,
                "concept_id": q.get("concept_id", "GENERIC"),
                "question": q.get("question", "…?"),
                "options": q.get("options", {}),
                "answer_letter": None,
                "source": q.get("source", "azure/syllabus"),
                # keep original mcq for submit()
                "mcq": {
                    "question": q.get("question"),
                    "options": q.get("options", {}),
                    "answer_letter": q.get("answer_letter", "A"),
                    "source": q.get("source", "azure/syllabus")
                }
            })
        else:
            # 3) Last-resort fallback (ensures you see at least *something*)
            item_id = f"itm-{uuid.uuid4().hex[:8]}"
            out_items.append({
                "item_id": item_id,
                "concept_id": "GENERIC",
                "question": "Which option best summarizes the passage?",
                "options": {"A": "Summary A", "B": "Summary B", "C": "Summary C", "D": "Summary D"},
                "answer_letter": None,
                "source": "fallback",
                "mcq": {
                    "question": "Which option best summarizes the passage?",
                    "options": {"A": "Summary A", "B": "Summary B", "C": "Summary C", "D": "Summary D"},
                    "answer_letter": "A",
                    "source": "fallback"
                }
            })

    # 4) Cache for submit()
    PACKS[pack_id] = {i["item_id"]: i for i in out_items}
    return {"pack_id": pack_id, "items": out_items}


@app.post("/submit")
def submit(payload: SubmitPayload, user_id: str = DEFAULT_USER):
    build_index_if_needed(user_id)
    pack = PACKS.get(payload.pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="pack not found")

    entry = pack.get(payload.item_id)
    if not entry or entry["concept_id"] != payload.concept_id:
        raise HTTPException(status_code=404, detail="item not found in pack")

    res = ace.submit_answer(
        user_id=user_id,
        concept_id=payload.concept_id,
        mcq=entry["mcq"],
        chosen_letter=payload.choice,
        confidence=payload.confidence,
    )

    del PACKS[payload.pack_id][payload.item_id]
    return {"result": res, "remaining_in_pack": len(PACKS[payload.pack_id])}


@app.get("/flashcards")
def get_flashcards(concept_id: str, count: int = 3, user_id: str = DEFAULT_USER):
    build_index_if_needed(user_id)
    cards = flash.flashcards_for_concept(concept_id, n=max(1, int(count)))
    out_items = [
        {
            "card_id": f"card-{uuid.uuid4().hex[:8]}",
            "concept_id": c["concept_id"],
            "question": c["question"],
            "answer": c["answer"],
            "source": c["source"],
        }
        for c in cards
    ]
    return {"concept_id": concept_id, "items": out_items}


@app.post("/flash_submit")
def flash_submit(payload: FlashSubmitPayload):
    build_index_if_needed(payload.user_id)
    res = flash.flashcard_feedback(
        user_id=payload.user_id,
        concept_id=payload.concept_id,
        knew_it=payload.knew_it,
        confidence=payload.confidence,
    )
    return res


@app.get("/concepts")
def get_concepts(user_id: str = DEFAULT_USER):
    build_index_if_needed(user_id)
    out: List[dict] = []
    now = time.time()
    for (uid, cid), m in ace.MASTERIES.items():
        if uid != user_id:
            continue
        next_days = (m.next_review_ts - now) / 86400 if m.next_review_ts else 0.0
        out.append(
            {
                "concept_id": cid,
                "mastery": round(m.mastery, 2),
                "difficulty": m.difficulty,
                "next_review_in_days": round(next_days, 2),
            }
        )
    out.sort(key=lambda x: x["mastery"])
    return out


@app.get("/stats")
def stats(user_id: str = DEFAULT_USER):
    build_index_if_needed(user_id)
    attempts = _safe_read_attempts(user_id)

    by_concept: Dict[str, Dict[str, float]] = {}
    for a in attempts:
        cid = a.get("concept_id", "?")
        d = by_concept.setdefault(cid, {"attempts": 0, "correct": 0})
        d["attempts"] += 1
        if a.get("correct"):
            d["correct"] += 1

    per_concept = []
    for cid, d in by_concept.items():
        acc = d["correct"] / d["attempts"] if d["attempts"] else 0.0
        per_concept.append({"concept_id": cid, "attempts": d["attempts"], "accuracy": round(acc, 2)})
    per_concept.sort(key=lambda x: (x["accuracy"], -x["attempts"]))

    now = time.time()
    day = 86400
    daily = []
    for i in range(6, -1, -1):
        start = now - i * day
        end = start + day
        cnt = sum(1 for a in attempts if start <= a.get("ts", 0) < end)
        daily.append({"day_offset": -i, "attempts": cnt})

    due = []
    for (uid, cid), m in ace.MASTERIES.items():
        if uid != user_id:
            continue
        if m.next_review_ts and 0 <= (m.next_review_ts - now) <= 2 * day:
            due.append(cid)

    total_attempts = len(attempts)
    acc_overall = (sum(1 for a in attempts if a.get("correct")) / total_attempts) if total_attempts else 0.0

    return {
        "user_id": user_id,
        "total_attempts": total_attempts,
        "accuracy_overall": round(acc_overall, 2),
        "per_concept": per_concept,
        "daily_attempts_last_7": daily,
        "due_within_48h": sorted(set(due)),
    }
