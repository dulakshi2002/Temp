# model-service/app.py
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional, Dict
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch, os

class GenerateReq(BaseModel):
    concept_title: str
    concept_description: Optional[str] = ""
    difficulty: Optional[str] = "medium"
    num_questions: int = 3
    num_flashcards: int = 2

class Option(BaseModel):
    text: str
    isCorrect: bool

class Question(BaseModel):
    prompt: str
    answer: str
    options: Optional[List[Option]] = None
    sourceMeta: Optional[Dict] = None

class Flashcard(BaseModel):
    front: str
    back: str
    sourceMeta: Optional[Dict] = None

class GenerateResp(BaseModel):
    questions: List[Question]
    flashcards: List[Flashcard]

MODEL_DIR = os.getenv("MODEL_DIR", "models/ace_qg_model")

app = FastAPI(title="model-service")

print("[model-service] Loading model from:", MODEL_DIR)
tok = AutoTokenizer.from_pretrained(MODEL_DIR)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_DIR)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device).eval()
print("[model-service] Loaded on:", device)

def gen_text(prompt: str, max_new_tokens=128):
    inputs = tok(prompt, return_tensors="pt").to(device)
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=True, top_p=0.9, temperature=0.7)
    return tok.decode(out[0], skip_special_tokens=True)

@app.get("/health")
def health(): return {"ok": True}

@app.post("/generate", response_model=GenerateResp)
def generate(req: GenerateReq):
    qs, fcs = [], []
    for _ in range(req.num_questions):
        raw = gen_text(f"QUESTION about {req.concept_title} ({req.difficulty}). "
                       f"DESC: {req.concept_description}. Format: QUESTION: ... || ANSWER: ...")
        q, a = raw, ""
        if "QUESTION:" in raw and "ANSWER:" in raw:
            try:
                q = raw.split("QUESTION:",1)[1].split("ANSWER:",1)[0].strip()
                a = raw.split("ANSWER:",1)[1].strip()
            except: pass
        qs.append({"prompt": q, "answer": a or f"Answer about {req.concept_title}", "options": [], "sourceMeta":{"source":"model"}})

    for _ in range(req.num_flashcards):
        raw = gen_text(f"FLASHCARD for {req.concept_title}. DESC: {req.concept_description}. "
                       f"Format: FRONT: ... || BACK: ...")
        front, back = raw, ""
        if "FRONT:" in raw and "BACK:" in raw:
            try:
                front = raw.split("FRONT:",1)[1].split("BACK:",1)[0].strip()
                back  = raw.split("BACK:",1)[1].strip()
            except: pass
        fcs.append({"front": front, "back": back or f"Key points of {req.concept_title}", "sourceMeta":{"source":"model"}})

    return {"questions": qs, "flashcards": fcs}
