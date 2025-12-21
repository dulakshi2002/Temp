# ace-service/modules/ace_store.py
import os, json, time

# Base folder for lightweight JSONL storage (adjust if you like)
BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "db")
PATH_ATTEMPTS   = os.path.abspath(os.path.join(BASE_DIR, "attempts.jsonl"))
PATH_MASTERIES  = os.path.abspath(os.path.join(BASE_DIR, "masteries.jsonl"))

os.makedirs(BASE_DIR, exist_ok=True)

def _read_jsonl(path):
    if not os.path.isfile(path):
        return []
    out = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except Exception:
                pass
    return out

def _append_jsonl(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")

# ------- PUBLIC API used by app.py -------

def read_attempts_raw():
    """Returns list[dict] with all attempts (MCQ + flashcards)"""
    return _read_jsonl(PATH_ATTEMPTS)

def read_masteries_raw():
    """Returns list[dict] snapshots of mastery (optional)"""
    return _read_jsonl(PATH_MASTERIES)

def append_attempt(obj: dict):
    """Append an attempt record (adds ts if missing)."""
    if "ts" not in obj:
        obj["ts"] = time.time()
    _append_jsonl(PATH_ATTEMPTS, obj)

def save_mastery_snapshot(snapshot: dict):
    """Append a mastery snapshot (used if you log mastery updates)."""
    if "ts" not in snapshot:
        snapshot["ts"] = time.time()
    _append_jsonl(PATH_MASTERIES, snapshot)
