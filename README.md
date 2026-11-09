# Give'n'Take

[![CI](https://github.com/ShakaByte/Give-n-Take/actions/workflows/ci.yml/badge.svg)](https://github.com/ShakaByte/Give-n-Take/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)

An AI agent for freelancers. It builds a fair deal for both sides, helps plan the work, and locks the final file until the client pays through PayPal. Built for the PayPal AI Hackathon.

**Live demo:** <https://give-n-take-one.vercel.app/>
**Demo video:** <your YouTube URL>

## The problem

Freelancers lose time negotiating and risk never getting paid. Clients risk paying for work they haven't seen. Give'n'Take protects both sides.

## Features

- **Deal Maker (3 AI agents + coach):** reads the client's message or text PDF, extracts the scope, sets a fair price within the client's budget and the freelancer's minimum rate, and writes the pitch. Learning mode explains what to ask, what to avoid and what to watch out for.
- **AI Planner:** turns a deadline and the freelancer's to-do list into a dated plan with alerts and tips.
- **Payment Lock:** 50% deposit by PayPal (link and QR code), then the client reviews a preview and pays the remaining 50%. A signature-verified PayPal webhook marks the payment, and the final file unlocks automatically.
- **Dashboard, deals list, to-dos and profile:** the freelancer's whole workflow in one place. The profile is fed to the AI agents on every run.

## How the payment lock works

1. The freelancer accepts the deal. The price is locked and split 50/50 on the server.
2. The client pays the deposit. PayPal's webhook (signature verified) sets the deal to `in_progress`.
3. The freelancer uploads the final file (private storage) and a preview, then submits.
4. The client sees the preview only. The download endpoint returns `403` until the deal is `paid`.
5. The client pays the rest. The webhook sets `paid`, and a 60-second signed download link becomes available.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js, Tailwind, hosted on Vercel |
| Backend | FastAPI (Python), hosted on Render |
| Database and private storage | Supabase |
| Payments | PayPal sandbox: Orders API and webhooks with signature verification |
| QR codes | Python `qrcode` |
| AI | Gemini (primary) with Groq (fallback) |
| CI | GitHub Actions: lint, tests, build |

## AI tools used

- **Gemini** (Google) and **Groq** (Llama and GPT-OSS models) run the Deal Maker agents, the coach and the planner. Requests alternate between providers with timeouts, so an overloaded model fails over automatically.
- **Claude** (Anthropic) was used as a coding assistant while building the project.

## Run it locally

**Requirements:** Python 3.12 or newer, Node.js 20 or newer, a Supabase project, a PayPal sandbox app, and Gemini and Groq API keys.

**Backend**

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Create `backend/.env`:

```
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_WEBHOOK_ID=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
GEMINI_MODELS=gemini-3.6-flash,gemini-3.8-flash,gemini-3.5-flash-lite
GROQ_MODELS=openai/gpt-oss-120b,openai/gpt-oss-20b,llama-3.1-8b-instant
FRONTEND_URL=http://localhost:3000
PAYMENT_RETURN_BASE=http://localhost:3000
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

**Database:** the SQL for the `deals`, `freelancer_profile` and `todos` tables, plus the private `deliverables` storage bucket, is in `docs/schema.sql`.

**Webhooks:** register `https://<your-backend>/webhook/paypal` in your PayPal sandbox app for the `PAYMENT.CAPTURE.COMPLETED` event. For local testing, expose the backend with ngrok.

## Test it (for judges)

Open the live demo and use these PayPal sandbox buyer credentials at checkout:

- Email: `<sandbox buyer email>`
- Password: `<sandbox buyer password>`

Suggested walkthrough:

1. Profile: check the saved profile.
2. Deal Maker: attach `test_samples/client_brief_vancov.pdf`, click Generate deal, then Accept and save.
3. Open the deal page, create the deposit link, and open the Client link in a private window.
4. Pay the deposit with the sandbox buyer. The deal moves to "work in progress".
5. Upload `test_samples/final_logo_vancov.png` as the final file and `test_samples/preview_logo_vancov.png` as the preview, then submit.
6. On the client page, review the preview, pay the remaining amount, and download the unlocked file.

The first request after a long idle period can take a few seconds while the backend wakes up.

## Automated tests

```bash
cd backend
pytest -v
```

The tests cover price limits (client budget and freelancer minimum), the 50/50 split, the file staying locked until the deal is paid, and webhook signature verification.

## Future scope

- Login with freelance platform accounts
- Extra AI reviewer agents that critique each other's answers
- Notifications, a fuller plan logger and a work manager
- Automatic watermarking of previews

## License

MIT, see [LICENSE](LICENSE).
