import json
from agents.llm import ask

SYSTEM = """You are a friendly mentor for new freelancers. Given a client's project brief, the extracted scope and the proposed pricing, teach the freelancer how to handle THIS deal well.

Output a strict JSON object with these keys:
- "questions_to_ask": 3 to 5 questions the freelancer should ask the client before starting, based on what is unclear or missing in the brief.
- "red_flags": 2 to 4 warning signs in this brief or deal (vague scope, unrealistic deadline or budget, scope creep risk). Empty list if none.
- "what_to_avoid": 2 to 4 common beginner mistakes for this type of job.
- "negotiation_tips": 2 to 3 short, practical tips for this deal.

Keep every item to one short sentence, in simple language. Output only the raw JSON object, with no extra text."""


def coach_tips(brief: str, scope: dict, pricing: dict, experience_level=None):
    payload = {
        "brief": brief,
        "scope": scope,
        "pricing": pricing,
        "experience_level": experience_level,
    }
    text, provider = ask(SYSTEM, json.dumps(payload), json_mode=True)
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(text), provider