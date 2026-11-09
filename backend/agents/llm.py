import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
from groq import Groq

load_dotenv()

gemini = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY"),
    http_options=types.HttpOptions(timeout=20000),  # milliseconds
)
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"), timeout=20.0, max_retries=0)

GEMINI_MODELS = [m.strip() for m in os.getenv("GEMINI_MODELS", "gemini-3.6-flash").split(",") if m.strip()]
GROQ_MODELS = [m.strip() for m in os.getenv("GROQ_MODELS", "openai/gpt-oss-120b").split(",") if m.strip()]


def _gemini(model, system, user, json_mode):
    cfg = types.GenerateContentConfig(
        system_instruction=system,
        response_mime_type="application/json" if json_mode else "text/plain",
    )
    r = gemini.models.generate_content(model=model, contents=user, config=cfg)
    return r.text


def _groq(model, system, user, json_mode):
    kwargs = {"response_format": {"type": "json_object"}} if json_mode else {}
    r = groq_client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        **kwargs,
    )
    return r.choices[0].message.content


def ask(system: str, user: str, json_mode: bool = False):
    """Alternate Gemini and Groq models. Returns (text, 'provider/model')."""
    attempts = []
    for i in range(max(len(GEMINI_MODELS), len(GROQ_MODELS))):
        if i < len(GEMINI_MODELS):
            attempts.append(("gemini", GEMINI_MODELS[i], _gemini))
        if i < len(GROQ_MODELS):
            attempts.append(("groq", GROQ_MODELS[i], _groq))

    for provider, model, fn in attempts:
        try:
            text = fn(model, system, user, json_mode)
            if text:
                return text, f"{provider}/{model}"
        except Exception as e:
            print(f"{provider} {model} failed:", e)

    raise RuntimeError("All AI models failed")