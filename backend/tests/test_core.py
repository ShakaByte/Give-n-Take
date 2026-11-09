import json
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

import main
from agents import pricer

SCOPE = {"core_deliverables": ["Logo design"]}


def fake_ai(price):
    def _ask(system, user, json_mode=False):
        body = {
            "recommended_price": price,
            "price_range": {"low": 100, "high": 900},
            "pricing_justification": "test",
            "feasibility": "feasible",
            "feasibility_note": "test",
        }
        return json.dumps(body), "fake/model"
    return _ask


# ---------- price within both limits ----------

def test_price_capped_at_client_budget(monkeypatch):
    monkeypatch.setattr(pricer, "ask", fake_ai(900))
    result, _ = pricer.estimate_price(SCOPE, client_budget=400, freelancer_min=150)
    assert result["recommended_price"] == 400
    assert result["price_range"]["high"] <= 400
    assert result["within_limits"] is True


def test_price_raised_to_freelancer_minimum(monkeypatch):
    monkeypatch.setattr(pricer, "ask", fake_ai(50))
    result, _ = pricer.estimate_price(SCOPE, client_budget=400, freelancer_min=150)
    assert result["recommended_price"] == 150


def test_conflicting_limits_are_flagged(monkeypatch):
    monkeypatch.setattr(pricer, "ask", fake_ai(300))
    result, _ = pricer.estimate_price(SCOPE, client_budget=100, freelancer_min=500)
    assert result["within_limits"] is False


def test_deposit_and_final_add_up_exactly(monkeypatch):
    monkeypatch.setattr(pricer, "ask", fake_ai(333.33))
    result, _ = pricer.estimate_price(SCOPE, client_budget=400, freelancer_min=150)
    total = round(result["deposit_amount"] + result["final_amount"], 2)
    assert total == result["recommended_price"]


# ---------- file locked until paid ----------

def fake_db(deal):
    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = deal
    db.storage.from_.return_value.create_signed_url.return_value = {"signedURL": "https://example.com/file"}
    return db


@pytest.mark.parametrize("status", ["pending_deposit", "in_progress", "awaiting_final"])
def test_file_locked_until_fully_paid(monkeypatch, status):
    monkeypatch.setattr(main, "supabase", fake_db({"status": status, "file_path": "deal/final.png"}))
    response = TestClient(main.app).get("/deals/abc/download")
    assert response.status_code == 403


def test_file_unlocked_when_paid(monkeypatch):
    monkeypatch.setattr(main, "supabase", fake_db({"status": "paid", "file_path": "deal/final.png"}))
    response = TestClient(main.app).get("/deals/abc/download")
    assert response.status_code == 200
    assert "download_url" in response.json()


# ---------- webhook signature verification ----------

EVENT = {
    "event_type": "PAYMENT.CAPTURE.COMPLETED",
    "resource": {"id": "cap1", "supplementary_data": {"related_ids": {"order_id": "order1"}}},
}
HEADERS = {
    "paypal-auth-algo": "x",
    "paypal-cert-url": "x",
    "paypal-transmission-id": "x",
    "paypal-transmission-sig": "x",
    "paypal-transmission-time": "x",
}


def fake_paypal_client(verdict):
    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, *args, **kwargs):
            response = MagicMock()
            response.json.return_value = {"verification_status": verdict}
            return response

    return FakeClient


async def fake_token():
    return "token"


def test_webhook_rejects_invalid_signature(monkeypatch):
    db = fake_db({})
    monkeypatch.setattr(main, "supabase", db)
    monkeypatch.setattr(main, "get_paypal_token", fake_token)
    monkeypatch.setattr(main.httpx, "AsyncClient", fake_paypal_client("FAILURE"))
    response = TestClient(main.app).post("/webhook/paypal", json=EVENT, headers=HEADERS)
    assert response.status_code == 400
    db.table.assert_not_called()  # a fake event must never change a deal


def test_webhook_accepts_valid_signature(monkeypatch):
    db = fake_db({})
    monkeypatch.setattr(main, "supabase", db)
    monkeypatch.setattr(main, "get_paypal_token", fake_token)
    monkeypatch.setattr(main.httpx, "AsyncClient", fake_paypal_client("SUCCESS"))
    response = TestClient(main.app).post("/webhook/paypal", json=EVENT, headers=HEADERS)
    assert response.status_code == 200
    db.table.assert_called()  # a verified event updates the deal