"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

const STATUS = {
    pending_deposit: "Waiting for deposit",
    in_progress: "Work in progress",
    awaiting_final: "Waiting for final payment",
    paid: "Paid in full",
};

export default function DealsPage() {
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        api("/deals")
            .then(setDeals)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="narrow">
            <h1 className="page-title">Your deals</h1>
            <p className="page-subtitle">
                Open a deal to see its payment status, upload work, or share
                links.
            </p>

            <div className="stack" style={{ marginTop: 24 }}>
                {loading && (
                    <p>Loading deals (the backend may be waking up)...</p>
                )}
                {error && <p className="msg-error">Error: {error}</p>}
                {!loading && !error && deals.length === 0 && (
                    <p>
                        No deals yet.{" "}
                        <Link href="/deal-maker" className="btn-link">
                            Create one with the Deal Maker
                        </Link>
                    </p>
                )}
                {deals.map((d) => (
                    <Link
                        key={d.id}
                        href={`/deals/${d.id}`}
                        className="deal-row"
                    >
                        <div>
                            <div className="deal-row-title">{d.job_title}</div>
                            <div className="meta">
                                {d.client_name || "No client name"}
                                {d.deadline ? ` | Deadline: ${d.deadline}` : ""}
                            </div>
                        </div>
                        <div className="deal-row-right">
                            <div>${d.amount}</div>
                            <span className="badge">
                                {STATUS[d.status] || d.status}
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
