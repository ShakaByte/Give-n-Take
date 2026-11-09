import json
from agents.llm import ask

SYSTEM = """You are a freelance market pricing engine. Using structured project requirements, calculate a project price based on global freelance market rates for 2026 that is fair to BOTH the client and the freelancer.

You receive: the project scope, the client's budget (may be null), and the freelancer's minimum acceptable price (may be null).
If both limits are given, the price must fall between them when feasible.

Output a strict JSON object with these keys:
- "recommended_price": a single number in USD (no symbols, no text).
- "price_range": an object {"low": number, "high": number} in USD.
- "pricing_justification": exactly 2 sentences on why this price is fair to both sides.
- "feasibility": one of "feasible", "tight", "unrealistic", judging the scope against the client's timeline and budget.
- "feasibility_note": one sentence explaining the feasibility rating.

Do not include milestones or payment structure. Output only the raw JSON object, with no extra text."""


def estimate_price(scope: dict, client_budget=None, freelancer_min=None):
    payload = {
        "scope": scope,
        "client_budget_usd": client_budget,
        "freelancer_min_usd": freelancer_min,
    }
    text, provider = ask(SYSTEM, json.dumps(payload), json_mode=True)
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    result = json.loads(text)

    price = float(result["recommended_price"])
    conflict = (
        freelancer_min is not None
        and client_budget is not None
        and freelancer_min > client_budget
    )
    if not conflict:
        if freelancer_min is not None:
            price = max(price, freelancer_min)
        if client_budget is not None:
            price = min(price, client_budget)

    price = round(price, 2)
    deposit = round(price / 2, 2)
    result["recommended_price"] = price
    result["deposit_amount"] = deposit
    result["final_amount"] = round(price - deposit, 2)
    result["within_limits"] = not conflict
    return result, provider