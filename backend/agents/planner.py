import json
from datetime import date
from agents.llm import ask

SYSTEM = """You are a practical project coach for freelancers. Build a realistic, dated work plan that finishes the job before the deadline.

You receive: the project scope, today's date, the deadline date, and optionally the freelancer's available hours per day.
Only use dates between today and the deadline (inclusive). Leave the last 1 to 2 days as buffer for review and revisions.

Output a strict JSON object with these keys:
- "plan": a list of steps, each {"date": "YYYY-MM-DD", "task": string, "hours": number}. 3 to 8 steps, in date order.
- "alerts": a list of strings flagging risks (tight deadline, unusually large tasks, unclear requirements). Empty list if none.
- "suggestions": a list of 2 to 4 short, concrete tips, including how to break down or tackle any task that feels too big or complex.
- "deadline_feasibility": one of "comfortable", "tight", "unrealistic".

Output only the raw JSON object, with no extra text."""


def make_plan(scope: dict, deadline: str, hours_per_day=None):
    payload = {
        "scope": scope,
        "today": date.today().isoformat(),
        "deadline": deadline,
        "hours_per_day": hours_per_day,
    }
    text, provider = ask(SYSTEM, json.dumps(payload), json_mode=True)
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(text), provider