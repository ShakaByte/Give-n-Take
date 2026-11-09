"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import Link from "next/link";

const STEPS = [
    "Reading the client's brief and extracting the scope",
    "Estimating a fair market price",
    "Writing your pitch",
    "Preparing tips for you",
];

export default function DealMakerPage() {
    const [profile, setProfile] = useState(null);
    const [brief, setBrief] = useState("");
    const [budget, setBudget] = useState("");
    const [service, setService] = useState("");
    const [learning, setLearning] = useState(false);
    const [readingPdf, setReadingPdf] = useState(false);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0);
    const [result, setResult] = useState(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [clientName, setClientName] = useState("");
    const [deadline, setDeadline] = useState("");
    const [amount, setAmount] = useState("");
    const [saving, setSaving] = useState(false);
    const [savedDeal, setSavedDeal] = useState(null);

    useEffect(() => {
        api("/profile")
            .then((p) => {
                setProfile(p);
                if (p) {
                    setLearning(p.experience_level === "beginner");
                    if (p.services?.length) setService(p.services[0].service);
                }
            })
            .catch((e) => setError(e.message));
    }, []);

    useEffect(() => {
        if (!loading) return;
        const last = learning ? STEPS.length - 1 : STEPS.length - 2;
        const t = setInterval(
            () => setStep((s) => Math.min(s + 1, last)),
            4000,
        );
        return () => clearInterval(t);
    }, [loading, learning]);

    const attachPdf = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setError("");
        setReadingPdf(true);
        try {
            const form = new FormData();
            form.append("file", file);
            const res = await api("/pdf-to-text", {
                method: "POST",
                body: form,
            });
            setBrief((prev) => (prev ? prev + "\n\n" : "") + res.text);
        } catch (err) {
            setError(err.message);
        } finally {
            setReadingPdf(false);
            e.target.value = "";
        }
    };

    const generate = async () => {
        setError("");
        setResult(null);
        setStep(0);
        setLoading(true);
        try {
            const body = {
                brief,
                service: service || null,
                client_budget: budget ? Number(budget) : null,
                learning_mode: learning,
            };
            const res = await api("/agents/deal-maker", {
                method: "POST",
                body: JSON.stringify(body),
            });
                setResult(res);
                setSavedDeal(null);
                setAmount(res.pricing.recommended_price);
                setJobTitle(service ? `${service} project` : "New project");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveDeal = async () => {
        setError("");
        setSaving(true);
        try {
            const body = {
                job_title: jobTitle,
                amount: Number(amount),
                client_name: clientName || null,
                deadline: deadline || null,
                scope: result.scope,
                pitch: result.pitch,
            };
            const deal = await api("/deals", {
                method: "POST",
                body: JSON.stringify(body),
            });
            setSavedDeal(deal);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const copyPitch = async () => {
        await navigator.clipboard.writeText(result.pitch);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const services = profile?.services || [];
    const stepsShown = learning ? STEPS : STEPS.slice(0, 3);

    return (
        <div className="narrow">
            <h1 className="page-title">Deal Maker</h1>
            <p className="page-subtitle">
                Paste what the client sent you. The AI agents will read it and
                build a fair deal.
            </p>

            <div className="card stack">
                <div>
                    <label className="label">Client message or brief</label>
                    <textarea
                        className="input textarea"
                        value={brief}
                        onChange={(e) => setBrief(e.target.value)}
                        placeholder="Paste the client&apos;s message here..."
                    />
                    <p className="hint">
                        Only text PDFs are supported. Scanned PDFs can&apos;t be
                        read.
                    </p>
                </div>

                <div>
                    <label className="label">Attach a PDF (optional)</label>
                    <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={attachPdf}
                        disabled={readingPdf}
                    />
                    {readingPdf && <p className="hint">Reading PDF...</p>}
                </div>

                <div className="grid-2">
                    <div>
                        <label className="label">Service</label>
                        {services.length > 0 ? (
                            <select
                                className="input"
                                value={service}
                                onChange={(e) => setService(e.target.value)}
                            >
                                {services.map((s) => (
                                    <option key={s.service} value={s.service}>
                                        {s.service} (min ${s.min_rate})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <p className="hint">
                                Add services on your Profile page first.
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="label">
                            Client budget (USD, optional: read from the brief if
                            empty)
                        </label>
                        <input
                            type="number"
                            min="0"
                            className="input"
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                        />
                    </div>
                </div>

                <label className="checkbox-row">
                    <input
                        type="checkbox"
                        checked={learning}
                        onChange={(e) => setLearning(e.target.checked)}
                    />
                    Learning mode: tell me what to ask, what to avoid, and what
                    to watch out for
                </label>

                <button
                    className="btn"
                    onClick={generate}
                    disabled={loading || readingPdf || brief.trim().length < 10}
                >
                    {loading ? "Working..." : "Generate deal"}
                </button>

                {error && <p className="msg-error">Error: {error}</p>}
            </div>

            {loading && (
                <div className="card">
                    <h2 className="section-title">The agents are working</h2>
                    <ul className="progress-list">
                        {stepsShown.map((label, i) => (
                            <li
                                key={label}
                                className={
                                    i < step
                                        ? "done"
                                        : i === step
                                          ? "active"
                                          : ""
                                }
                            >
                                {i < step ? "✓ " : i === step ? "→ " : "• "}
                                {label}
                            </li>
                        ))}
                    </ul>
                    <p className="hint">
                        This usually takes 5 to 20 seconds. The first run may be
                        slower if the server was asleep.
                    </p>
                </div>
            )}

            {result && (
                <div className="stack">
                    <div className="card">
                        <h2 className="section-title">Suggested price</h2>
                        <div className="price-big">
                            ${result.pricing.recommended_price}
                        </div>
                        <div className="split-row">
                            <span>
                                Deposit: ${result.pricing.deposit_amount}
                            </span>
                            <span>
                                Final payment: ${result.pricing.final_amount}
                            </span>
                        </div>
                        <p className="hint">
                            Market range ${result.pricing.price_range?.low} to $
                            {result.pricing.price_range?.high}. Feasibility:{" "}
                            {result.pricing.feasibility}.
                        </p>
                        <p style={{ marginTop: 12 }}>
                            {result.pricing.pricing_justification}
                        </p>
                        <p className="hint">
                            {result.pricing.feasibility_note}
                        </p>
                        {!result.pricing.within_limits && (
                            <p className="notice" style={{ marginTop: 12 }}>
                                The client&apos;s budget is below your minimum rate
                                for this service, so no price can satisfy both
                                sides. Consider reducing the scope or declining.
                            </p>
                        )}
                    </div>

                    <div className="card">
                        <h2 className="section-title">What the client wants</h2>
                        <ul className="list">
                            {result.scope.core_deliverables?.map((d, i) => (
                                <li key={i}>{d}</li>
                            ))}
                        </ul>
                        {result.scope.hidden_requirements?.length > 0 && (
                            <>
                                <p className="label" style={{ marginTop: 12 }}>
                                    Likely hidden work
                                </p>
                                <ul className="list">
                                    {result.scope.hidden_requirements.map(
                                        (d, i) => (
                                            <li key={i}>{d}</li>
                                        ),
                                    )}
                                </ul>
                            </>
                        )}
                        <p className="hint">
                            Timeline: {result.scope.client_timeline}. Budget:{" "}
                            {result.scope.client_budget}.
                        </p>
                    </div>

                    <div className="card">
                        <h2 className="section-title">Your pitch</h2>
                        <div className="pitch-box">{result.pitch}</div>
                        <div style={{ marginTop: 12 }}>
                            <button className="btn" onClick={copyPitch}>
                                {copied ? "Copied" : "Copy pitch"}
                            </button>
                        </div>
                    </div>
                    <div className="card stack">
                        <h2 className="section-title">Accept this deal</h2>
                        {savedDeal ? (
                            <div className="notice">
                                <p>
                                    <b>Deal saved.</b> Total ${savedDeal.amount}
                                    : deposit ${savedDeal.deposit_amount}, final
                                    ${savedDeal.final_amount}.
                                </p>
                                <Link
                                    href={`/deals/${savedDeal.id}`}
                                    className="btn-link"
                                >
                                    Open deal page
                                </Link>
                            </div>
                        ) : (
                            <>
                                <div className="grid-2">
                                    <div>
                                        <label className="label">
                                            Job title
                                        </label>
                                        <input
                                            className="input"
                                            value={jobTitle}
                                            onChange={(e) =>
                                                setJobTitle(e.target.value)
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="label">
                                            Client name
                                        </label>
                                        <input
                                            className="input"
                                            value={clientName}
                                            onChange={(e) =>
                                                setClientName(e.target.value)
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="grid-2">
                                    <div>
                                        <label className="label">
                                            Agreed total price (USD)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            className="input"
                                            value={amount}
                                            onChange={(e) =>
                                                setAmount(e.target.value)
                                            }
                                        />
                                        <p className="hint">
                                            Once saved, the price is locked and
                                            split 50/50.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="label">
                                            Deadline (optional)
                                        </label>
                                        <input
                                            type="date"
                                            className="input"
                                            value={deadline}
                                            onChange={(e) =>
                                                setDeadline(e.target.value)
                                            }
                                        />
                                    </div>
                                </div>
                                <button
                                    className="btn"
                                    onClick={saveDeal}
                                    disabled={
                                        saving ||
                                        !jobTitle.trim() ||
                                        !(Number(amount) > 0)
                                    }
                                >
                                    {saving
                                        ? "Saving..."
                                        : "Accept and save deal"}
                                </button>
                            </>
                        )}
                    </div>

                    {result.coaching && (
                        <div className="card stack">
                            <h2 className="section-title">
                                Learning mode: tips for this deal
                            </h2>
                            <div>
                                <p className="label">
                                    Questions to ask the client
                                </p>
                                <ul className="list">
                                    {result.coaching.questions_to_ask?.map(
                                        (t, i) => (
                                            <li key={i}>{t}</li>
                                        ),
                                    )}
                                </ul>
                            </div>
                            {result.coaching.red_flags?.length > 0 && (
                                <div>
                                    <p className="label">Red flags</p>
                                    <ul className="list">
                                        {result.coaching.red_flags.map(
                                            (t, i) => (
                                                <li key={i}>{t}</li>
                                            ),
                                        )}
                                    </ul>
                                </div>
                            )}
                            <div>
                                <p className="label">What to avoid</p>
                                <ul className="list">
                                    {result.coaching.what_to_avoid?.map(
                                        (t, i) => (
                                            <li key={i}>{t}</li>
                                        ),
                                    )}
                                </ul>
                            </div>
                            <div>
                                <p className="label">Negotiation tips</p>
                                <ul className="list">
                                    {result.coaching.negotiation_tips?.map(
                                        (t, i) => (
                                            <li key={i}>{t}</li>
                                        ),
                                    )}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
