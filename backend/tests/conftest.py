import os
from unittest.mock import MagicMock

# Dummy values so the app can be imported without real keys.
# This runs before main.py loads, so real keys in .env are never used in tests.
for key, value in {
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_SECRET_KEY": "test-key",
    "PAYPAL_CLIENT_ID": "test",
    "PAYPAL_CLIENT_SECRET": "test",
    "PAYPAL_WEBHOOK_ID": "test",
    "GEMINI_API_KEY": "test",
    "GROQ_API_KEY": "test",
}.items():
    os.environ.setdefault(key, value)

import supabase # noqa: E402

supabase.create_client = lambda *a, **k: MagicMock()