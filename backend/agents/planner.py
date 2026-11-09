import json
from datetime import date

from agents.llm import ask

SYSTEM = """You are a practical project coach for freelancers. Build a realistic, dated work plan for ONE job that finishes before its deadline, while respecting the freelancer's existing to-do list.

You receive: the project scope, today's date, the deadline date, the freelancer's available hours per day, and their open to-dos (each with title, priority low/medium/high, optional due_date and est_hours).
Rules:
- Only use dates between today and the deadline (inclusive). Leave the last 1 to 2 days as buffer for review and revisions.
- Do not overload any day: the hours of this job's steps plus the est_hours of to-dos due that day must not exceed the available hours per day.
- Work around high-priority to-dos first. Mention any clash with them in "alerts".
- If hours_per_day is null, assume 4.

Output a strict JSON object with these keys:
- "plan": a list of steps, each {"date": "YYYY-MM-DD", "task": string, "hours": number}. 3 to 8 steps, in date order.
- "alerts": a list of strings flagging risks (tight deadline, clashes with existing to-dos, unusually large tasks). Empty list if none.
- "suggestions": a list of 2 to 4 short, concrete tips, including how to break down any task that feels too big.
- "deadline_feasibility": one of "comfortable", "tight", "unrealistic".

Output only the raw JSON object, with no extra text."""


def make_plan(scope: dict, deadline: str, hours_per_day=None, todos=None):
    payload = {
        "scope": scope,
        "today": date.today().isoformat(),
        "deadline": deadline,
        "hours_per_day": hours_per_day,
        "open_todos": todos or [],
    }
    text, provider = ask(SYSTEM, json.dumps(payload), json_mode=True)
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(text), provider