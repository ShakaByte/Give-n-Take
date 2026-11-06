import os
from fastapi import FastAPI, Request, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import httpx
from dotenv import load_dotenv
from pydantic import BaseModel
from supabase import create_client
import io
import qrcode
from fastapi.responses import Response

load_dotenv()

PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET")
PAYPAL_BASE_URL = os.getenv("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com")

PAYPAL_WEBHOOK_ID = os.getenv("PAYPAL_WEBHOOK_ID")

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
                            "return_url": "http://localhost:3000/payment/success",
                            "cancel_url": "http://localhost:3000/payment/cancel",
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


@app.post("/deals")
def create_deal(req: DealRequest):
    deposit = round(req.amount / 2, 2)
    final = round(req.amount - deposit, 2)
    res = supabase.table("deals").insert({
        "job_title": req.job_title,
        "amount": req.amount,
        "deposit_amount": deposit,
        "final_amount": final,
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
def deal_qr(deal_id: str):
    deal = supabase.table("deals").select("approve_url").eq("id", deal_id).single().execute().data
    if not deal["approve_url"]:
        raise HTTPException(status_code=404, detail="Create checkout first")
    img = qrcode.make(deal["approve_url"])
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")