import json

from agents.llm import ask

SYSTEM = """You are an expert technical project analyst. Your sole job is to dissect unstructured, messy client project briefs or chat messages and extract the exact scope of work.

Output a strict JSON object with these keys:
- "core_deliverables": list of strings, the exact assets or items the client expects.
- "technical_stack": list of strings, any requested languages, tools or platforms. Empty list if none.
- "hidden_requirements": list of strings, likely unstated tasks the freelancer will have to handle (e.g. website -> hosting deployment).
- "client_timeline": the deadline if mentioned, otherwise "Not specified".
- "client_budget_usd": the client's budget as a single number in USD (use the upper end if it is a range), or null if no budget is mentioned..

Never invent details the client did not give. Output only the raw JSON object, with no extra text."""


def extract_scope(brief: str):
    text, provider = ask(SYSTEM, brief, json_mode=True)
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(text), provider