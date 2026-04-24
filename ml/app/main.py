from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="BankSathi ML Service", version="0.1.0")


class LeadScoreRequest(BaseModel):
    income: float
    credit_score: int
    monthly_obligations: float = 0
    complaint_count: int = 0


class ComplaintClassifyRequest(BaseModel):
    text: str
    language: str = "en"


class FraudCheckRequest(BaseModel):
    duplicate_phone_hits: int = 0
    suspicious_doc_mismatch: bool = False
    high_velocity_attempts: int = 0


@app.get("/health")
def health():
    return {"ok": True, "service": "ml"}


@app.post("/score-lead")
def score_lead(payload: LeadScoreRequest):
    base = (payload.credit_score - 300) / 6
    income_weight = min(payload.income / 100000, 1) * 25
    obligation_penalty = min(payload.monthly_obligations / 50000, 1) * 15
    complaint_penalty = min(payload.complaint_count * 3, 18)
    score = max(0, min(100, base + income_weight - obligation_penalty - complaint_penalty))
    return {"score": round(score, 2), "bucket": "high" if score >= 70 else "medium" if score >= 45 else "low"}


@app.post("/classify-complaint")
def classify_complaint(payload: ComplaintClassifyRequest):
    text = payload.text.lower()

    if "kyc" in text or "aadhaar" in text or "pan" in text:
        category = "KYC"
    elif "payment" in text or "deduct" in text or "refund" in text:
        category = "PAYMENT"
    elif "fraud" in text or "fake" in text or "scam" in text:
        category = "FRAUD"
    elif "loan" in text or "approve" in text or "disburse" in text:
        category = "LOAN"
    else:
        category = "OTHER"

    if any(word in text for word in ["angry", "worst", "fraud", "scam"]):
        sentiment = "negative"
        priority = "HIGH"
    elif any(word in text for word in ["not", "delay", "pending", "problem"]):
        sentiment = "neutral"
        priority = "MEDIUM"
    else:
        sentiment = "positive"
        priority = "LOW"

    team_map = {
        "LOAN": "loan-ops",
        "KYC": "kyc-team",
        "PAYMENT": "payments",
        "FRAUD": "risk"
    }
    return {
        "category": category,
        "priority": priority,
        "sentiment": sentiment,
        "assigned_team": team_map.get(category, "support"),
        "language": payload.language
    }


@app.post("/detect-fraud")
def detect_fraud(payload: FraudCheckRequest):
    score = payload.duplicate_phone_hits * 20 + payload.high_velocity_attempts * 15
    if payload.suspicious_doc_mismatch:
        score += 40

    risk = "high" if score >= 60 else "medium" if score >= 30 else "low"
    return {"fraud_score": min(score, 100), "risk": risk, "review_required": risk != "low"}
