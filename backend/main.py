import os
from fastapi import FastAPI, Request, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import httpx
from dotenv import load_dotenv
from pydantic import BaseModel
from supabase import create_client
import io
import qrcode
from pypdf import PdfReader
from fastapi.responses import Response
from agents.llm import ask
from agents.extractor import extract_scope
from agents.pricer import estimate_price
from agents.pitch import write_pitch
from agents.planner import make_plan
from agents.coach import coach_tips

load_dotenv()

PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET")
PAYPAL_BASE_URL = os.getenv("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")

PAYPAL_WEBHOOK_ID = os.getenv("PAYPAL_WEBHOOK_ID")

RETURN_BASE = os.getenv("PAYMENT_RETURN_BASE", "http://localhost:3000")

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SECRET_KEY"))

app = FastAPI()
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "Give'n'Take API is running"}
origins = [o for o in ["http://localhost:3000", os.getenv("FRONTEND_URL")] if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OrderRequest(BaseModel):
    amount: float
    description: str = "Freelance work"


async def get_paypal_token():
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{PAYPAL_BASE_URL}/v1/oauth2/token",
            auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET),
            data={"grant_type": "client_credentials"},
        )
        r.raise_for_status()
        return r.json()["access_token"]


@app.post("/orders")
async def create_order(req: OrderRequest):
    token = await get_paypal_token()
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "intent": "CAPTURE",
                "purchase_units": [{
                    "description": req.description,
                    "amount": {"currency_code": "USD", "value": f"{req.amount:.2f}"},
                }],
                "payment_source": {
                    "paypal": {
                        "experience_context": {
                            "return_url": f"{RETURN_BASE}/payment/success",
                            "cancel_url": f"{RETURN_BASE}/payment/cancel",
                            "user_action": "PAY_NOW",
                        }
                    }
                },
            },
        )
        r.raise_for_status()
        data = r.json()
        approve = next(l["href"] for l in data["links"] if l["rel"] in ("approve", "payer-action"))
    return {"order_id": data["id"], "approve_url": approve}

@app.post("/orders/{order_id}/capture")
async def capture_order(order_id: str):
    token = await get_paypal_token()
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
    return r.json()

@app.post("/webhook/paypal")
async def paypal_webhook(request: Request):
    event = await request.json()
    h = request.headers
    token = await get_paypal_token()
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "auth_algo": h.get("paypal-auth-algo"),
                "cert_url": h.get("paypal-cert-url"),
                "transmission_id": h.get("paypal-transmission-id"),
                "transmission_sig": h.get("paypal-transmission-sig"),
                "transmission_time": h.get("paypal-transmission-time"),
                "webhook_id": PAYPAL_WEBHOOK_ID,
                "webhook_event": event,
            },
        )
    if r.json().get("verification_status") != "SUCCESS":
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event.get("event_type") == "PAYMENT.CAPTURE.COMPLETED":
        order_id = event["resource"]["supplementary_data"]["related_ids"]["order_id"]
        dep = supabase.table("deals").update({"status": "in_progress"}) \
            .eq("deposit_order_id", order_id).eq("status", "pending_deposit").execute()
        if not dep.data:
            supabase.table("deals").update({"status": "paid"}) \
                .eq("final_order_id", order_id).execute()
        print("PAID order:", order_id)
    return {"received": True}

@app.api_route("/db-test", methods=["GET", "HEAD"])
def db_test():
    res = supabase.table("deals").select("*").limit(1).execute()
    return {"connected": True, "rows_found": len(res.data)}

class DealRequest(BaseModel):
    job_title: str
    amount: float
    client_name: str | None = None
    deadline: str | None = None  # YYYY-MM-DD
    scope: dict | None = None
    pitch: str | None = None


@app.post("/deals")
def create_deal(req: DealRequest):
    deposit = round(req.amount / 2, 2)
    final = round(req.amount - deposit, 2)
    res = supabase.table("deals").insert({
        "job_title": req.job_title,
        "amount": req.amount,
        "deposit_amount": deposit,
        "final_amount": final,
        "client_name": req.client_name,
        "deadline": req.deadline,
        "scope": req.scope,
        "pitch": req.pitch,
    }).execute()
    return res.data[0]

@app.post("/deals/{deal_id}/checkout")
async def deal_checkout(deal_id: str, kind: str):
    if kind not in ("deposit", "final"):
        raise HTTPException(status_code=400, detail="kind must be deposit or final")
    deal = supabase.table("deals").select("*").eq("id", deal_id).single().execute().data
    order = await create_order(OrderRequest(
        amount=float(deal[f"{kind}_amount"]),
        description=f"{deal['job_title']} - {kind}",
    ))
    supabase.table("deals").update({
        f"{kind}_order_id": order["order_id"],
        f"{kind}_approve_url": order["approve_url"],
    }).eq("id", deal_id).execute()
    return order

@app.post("/deals/{deal_id}/upload")
async def upload_file(deal_id: str, file: UploadFile = File(...)):
    content = await file.read()
    path = f"{deal_id}/{file.filename}"
    supabase.storage.from_("deliverables").upload(
        path, content, {"content-type": file.content_type, "upsert": "true"}
    )
    supabase.table("deals").update({"file_path": path}).eq("id", deal_id).execute()
    return {"file_path": path}

@app.get("/deals/{deal_id}/download")
def download_file(deal_id: str):
    deal = supabase.table("deals").select("*").eq("id", deal_id).single().execute().data
    if deal["status"] != "paid":
        raise HTTPException(status_code=403, detail="Payment required")
    if not deal["file_path"]:
        raise HTTPException(status_code=404, detail="No file uploaded")
    signed = supabase.storage.from_("deliverables").create_signed_url(deal["file_path"], 60)
    return {"download_url": signed["signedURL"]}

@app.get("/deals/{deal_id}/qr")
def deal_qr(deal_id: str, kind: str):
    if kind not in ("deposit", "final"):
        raise HTTPException(status_code=400, detail="kind must be deposit or final")
    deal = supabase.table("deals").select(f"{kind}_approve_url").eq("id", deal_id).single().execute().data
    url = deal[f"{kind}_approve_url"]
    if not url:
        raise HTTPException(status_code=404, detail="Create checkout first")
    img = qrcode.make(url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")

@app.post("/deals/{deal_id}/preview")
async def upload_preview(deal_id: str, file: UploadFile = File(...)):
    content = await file.read()
    path = f"{deal_id}/preview_{file.filename}"
    supabase.storage.from_("deliverables").upload(
        path, content, {"content-type": file.content_type, "upsert": "true"}
    )
    supabase.table("deals").update({"preview_path": path}).eq("id", deal_id).execute()
    return {"preview_path": path}

@app.get("/deals/{deal_id}/preview")
def get_preview(deal_id: str):
    deal = supabase.table("deals").select("preview_path").eq("id", deal_id).single().execute().data
    if not deal["preview_path"]:
        raise HTTPException(status_code=404, detail="No preview uploaded")
    signed = supabase.storage.from_("deliverables").create_signed_url(deal["preview_path"], 3600)
    return {"preview_url": signed["signedURL"]}

@app.get("/ai-test")
def ai_test():
    text, provider = ask("You are a helpful assistant.", "Say hello in one short sentence.")
    return {"provider": provider, "reply": text}

class BriefRequest(BaseModel):
    brief: str


@app.post("/agents/extract")
def agent_extract(req: BriefRequest):
    result, provider = extract_scope(req.brief)
    return {"provider": provider, "scope": result}

class PriceRequest(BaseModel):
    scope: dict
    client_budget: float | None = None
    freelancer_min: float | None = None


@app.post("/agents/price")
def agent_price(req: PriceRequest):
    result, provider = estimate_price(req.scope, req.client_budget, req.freelancer_min)
    return {"provider": provider, "pricing": result}

class PitchRequest(BaseModel):
    scope: dict
    pricing: dict
    freelancer_name: str | None = None


@app.post("/agents/pitch")
def agent_pitch(req: PitchRequest):
    pitch, provider = write_pitch(req.scope, req.pricing, req.freelancer_name)
    return {"provider": provider, "pitch": pitch}

class PlanRequest(BaseModel):
    scope: dict
    deadline: str  # YYYY-MM-DD
    hours_per_day: float | None = None


@app.post("/agents/plan")
def agent_plan(req: PlanRequest):
    hours = req.hours_per_day
    if hours is None:
        prof = supabase.table("freelancer_profile").select("hours_per_day").limit(1).execute().data
        hours = float(prof[0]["hours_per_day"]) if prof else None
    rows = supabase.table("todos").select("title,priority,due_date,est_hours") \
        .eq("done", False).execute().data
    plan, provider = make_plan(req.scope, req.deadline, hours, rows)
    return {"provider": provider, "plan": plan}

class DealMakerRequest(BaseModel):
    brief: str
    client_budget: float | None = None
    service: str | None = None
    freelancer_min: float | None = None
    freelancer_name: str | None = None
    learning_mode: bool | None = None  # None = on if profile is beginner


@app.post("/agents/deal-maker")
def deal_maker(req: DealMakerRequest):
    rows = supabase.table("freelancer_profile").select("*").limit(1).execute().data
    prof = rows[0] if rows else None

    name = req.freelancer_name or (prof["name"] if prof else None)
    fmin = req.freelancer_min
    if fmin is None and prof and req.service:
        for s in prof["services"]:
            if s["service"].strip().lower() == req.service.strip().lower():
                fmin = float(s["min_rate"])
                break

    scope, p1 = extract_scope(req.brief)
    budget = req.client_budget
    if budget is None:
        try:
            budget = float(scope.get("client_budget_usd"))
        except (TypeError, ValueError):
            budget = None
    pricing, p2 = estimate_price(scope, budget, fmin)
    pitch, p3 = write_pitch(scope, pricing, name)

    level = prof["experience_level"] if prof else None
    learn = req.learning_mode if req.learning_mode is not None else (level == "beginner")
    coaching, providers = None, [p1, p2, p3]
    if learn:
        coaching, p4 = coach_tips(req.brief, scope, pricing, level)
        providers.append(p4)

    return {
        "scope": scope,
        "pricing": pricing,
        "pitch": pitch,
        "coaching": coaching,
        "providers": providers,
        "used_profile": {"freelancer_name": name, "freelancer_min": fmin},
    }

class ServiceItem(BaseModel):
    service: str
    min_rate: float


class ProfileRequest(BaseModel):
    name: str
    profession: str | None = None
    services: list[ServiceItem] = []
    skills: list[str] = []
    experience_level: str = "beginner"
    hours_per_day: float = 4


@app.get("/profile")
def get_profile():
    res = supabase.table("freelancer_profile").select("*").limit(1).execute()
    return res.data[0] if res.data else None


@app.put("/profile")
def save_profile(req: ProfileRequest):
    data = req.model_dump()
    existing = supabase.table("freelancer_profile").select("id").limit(1).execute().data
    if existing:
        res = supabase.table("freelancer_profile").update(data).eq("id", existing[0]["id"]).execute()
    else:
        res = supabase.table("freelancer_profile").insert(data).execute()
    return res.data[0]

class TodoCreate(BaseModel):
    title: str
    priority: str = "medium"  # low, medium, high
    due_date: str | None = None  # YYYY-MM-DD
    est_hours: float | None = None


class TodoUpdate(BaseModel):
    title: str | None = None
    priority: str | None = None
    due_date: str | None = None
    est_hours: float | None = None
    done: bool | None = None


@app.post("/todos")
def add_todo(req: TodoCreate):
    if req.priority not in ("low", "medium", "high"):
        raise HTTPException(status_code=400, detail="priority must be low, medium or high")
    res = supabase.table("todos").insert(req.model_dump()).execute()
    return res.data[0]


@app.get("/todos")
def list_todos():
    res = supabase.table("todos").select("*").order("created_at").execute()
    return res.data


@app.patch("/todos/{todo_id}")
def update_todo(todo_id: str, req: TodoUpdate):
    data = req.model_dump(exclude_unset=True)
    if "priority" in data and data["priority"] not in ("low", "medium", "high"):
        raise HTTPException(status_code=400, detail="priority must be low, medium or high")
    if not data:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = supabase.table("todos").update(data).eq("id", todo_id).execute()
    return res.data[0]


@app.delete("/todos/{todo_id}")
def delete_todo(todo_id: str):
    supabase.table("todos").delete().eq("id", todo_id).execute()
    return {"deleted": True}

@app.get("/deals")
def list_deals():
    res = supabase.table("deals").select("*").order("created_at", desc=True).execute()
    return res.data


@app.get("/deals/{deal_id}")
def get_deal(deal_id: str):
    res = supabase.table("deals").select("*").eq("id", deal_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Deal not found")
    return res.data[0]

@app.post("/deals/{deal_id}/submit")
def submit_work(deal_id: str):
    res = supabase.table("deals").select("*").eq("id", deal_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Deal not found")
    deal = res.data[0]
    if deal["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Deposit must be paid first")
    if not deal["file_path"] or not deal["preview_path"]:
        raise HTTPException(status_code=400, detail="Upload both the final file and the preview first")
    updated = supabase.table("deals").update({"status": "awaiting_final"}).eq("id", deal_id).execute()
    return updated.data[0]

@app.post("/pdf-to-text")
async def pdf_to_text(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    data = await file.read()
    try:
        reader = PdfReader(io.BytesIO(data))
        text = "\n".join((p.extract_text() or "") for p in reader.pages).strip()
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this PDF")
    if not text:
        raise HTTPException(status_code=400, detail="No readable text found (scanned PDFs are not supported)")
    return {"text": text[:15000], "pages": len(reader.pages), "truncated": len(text) > 15000}

@app.post("/payments/complete/{order_id}")
async def complete_payment(order_id: str):
    token = await get_paypal_token()
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
    data = r.json()
    already = any(d.get("issue") == "ORDER_ALREADY_CAPTURED" for d in data.get("details", []))
    if data.get("status") != "COMPLETED" and not already:
        raise HTTPException(status_code=400, detail=data.get("message") or "Payment was not completed")

    rows = supabase.table("deals").select("id,deposit_order_id") \
        .or_(f"deposit_order_id.eq.{order_id},final_order_id.eq.{order_id}").execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="No deal found for this payment")
    deal = rows[0]
    return {"deal_id": deal["id"], "kind": "deposit" if deal["deposit_order_id"] == order_id else "final"}