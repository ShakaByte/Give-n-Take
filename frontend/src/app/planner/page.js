"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const today = () => new Date().toISOString().slice(0, 10);

export default function PlannerPage() {
    const [deals, setDeals] = useState([]);
    const [dealId, setDealId] = useState("");
    const [deadline, setDeadline] = useState("");
    const [loadingDeals, setLoadingDeals] = useState(true);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api("/deals")
            .then((d) => {
                const active = d.filter((x) => x.status !== "paid");
                setDeals(active);
                if (active.length) {
                    setDealId(active[0].id);
                    setDeadline(active[0].deadline || "");
                }
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoadingDeals(false));
    }, []);

    const pickDeal = (id) => {
        setDealId(id);
        const d = deals.find((x) => x.id === id);
        setDeadline(d?.deadline || "");
        setResult(null);
    };

    const generate = async () => {
        const deal = deals.find((x) => x.id === dealId);
        setError("");
        setResult(null);
        setLoading(true);
        try {
            const scope = deal.scope || { core_deliverables: [deal.job_title] };
            const res = await api("/agents/plan", {
                method: "POST",
                body: JSON.stringify({ scope, deadline }),
            });
            setResult(res.plan);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="narrow">
            <h1 className="page-title">AI Planner</h1>
            <p className="page-subtitle">
                Pick a deal. The planner builds a dated plan that fits your
                deadline, your daily hours and your existing to-dos.
            </p>

            <div className="card stack">
                {loadingDeals ? (
                    <p>Loading deals...</p>
                ) : deals.length === 0 ? (
                    <p className="empty">
                        No active deals yet. Create one with the Deal Maker
                        first.
                    </p>
                ) : (
                    <>
                        <div className="grid-2">
                            <div>
                                <label className="label">Deal</label>
                                <select
                                    className="input"
                                    value={dealId}
                                    onChange={(e) => pickDeal(e.target.value)}
                                >
                                    {deals.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.job_title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label">Deadline</label>
                                <input
                                    type="date"
                                    min={today()}
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
                            onClick={generate}
                            disabled={loading || !deadline}
                        >
                            {loading ? "Planning..." : "Make my plan"}
                        </button>
                        {!deadline && (
                            <p className="hint">
                                This deal has no deadline saved. Pick one above.
                            </p>
                        )}
                    </>
                )}
                {error && <p className="msg-error">Error: {error}</p>}
            </div>

            {result && (
                <div className="stack">
                    <div className="card">
                        <h2 className="section-title">Deadline check</h2>
                        <span className="badge">
                            {result.deadline_feasibility}
                        </span>
                    </div>

                    <div className="card stack">
                        <h2 className="section-title">Your plan</h2>
                        {result.plan?.map((s, i) => (
                            <div key={i} className="plan-row">
                                <div className="plan-date">{s.date}</div>
                                <div className="plan-task">{s.task}</div>
                                <div className="plan-hours">{s.hours}h</div>
                            </div>
                        ))}
                    </div>

                    {result.alerts?.length > 0 && (
                        <div className="card">
                            <h2 className="section-title">Alerts</h2>
                            <ul className="list">
                                {result.alerts.map((a, i) => (
                                    <li key={i}>{a}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="card">
                        <h2 className="section-title">Suggestions</h2>
                        <ul className="list">
                            {result.suggestions?.map((s, i) => (
                                <li key={i}>{s}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
