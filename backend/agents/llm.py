import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
from groq import Groq

load_dotenv()

gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

GEMINI_MODELS = [m.strip() for m in os.getenv("GEMINI_MODELS", "gemini-3.8-flash").split(",") if m.strip()]
GROQ_MODELS = [m.strip() for m in os.getenv("GROQ_MODELS", "openai/gpt-oss-120b").split(",") if m.strip()]


def ask(system: str, user: str, json_mode: bool = False):
    """Try each Gemini model, then each Groq model. Returns (text, 'provider/model')."""
    for model in GEMINI_MODELS:
        try:
            cfg = types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json" if json_mode else "text/plain",
            )
            r = gemini.models.generate_content(model=model, contents=user, config=cfg)
            return r.text, f"gemini/{model}"
        except Exception as e:
            print(f"Gemini {model} failed:", e)

    kwargs = {"response_format": {"type": "json_object"}} if json_mode else {}
    for model in GROQ_MODELS:
        try:
            r = groq_client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                **kwargs,
            )
            return r.choices[0].message.content, f"groq/{model}"
        except Exception as e:
            print(f"Groq {model} failed:", e)

    raise RuntimeError("All AI models failed")