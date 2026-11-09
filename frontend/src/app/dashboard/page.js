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

const money = (n) => `$${Number(n).toFixed(2)}`;

function DealList({ deals, empty }) {
    if (deals.length === 0) return <p className="empty">{empty}</p>;
    return (
        <div className="stack">
            {deals.map((d) => (
                <Link key={d.id} href={`/deals/${d.id}`} className="deal-row">
                    <div>
                        <div className="deal-row-title">{d.job_title}</div>
                        <div className="meta">
                            {d.client_name || "No client name"}
                            {d.deadline ? ` | Deadline: ${d.deadline}` : ""}
                        </div>
                    </div>
                    <div className="deal-row-right">
                        <div>{money(d.amount)}</div>
                        <span className="badge">
                            {STATUS[d.status] || d.status}
                        </span>
                    </div>
                </Link>
            ))}
        </div>
    );
}

export default function DashboardPage() {
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const load = () =>
            api("/deals")
                .then((d) => {
                    setDeals(d);
                    setError("");
                })
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
        load();
        const t = setInterval(load, 15000);
        return () => clearInterval(t);
    }, []);

    if (loading) return <p>Loading dashboard...</p>;

    const by = (...statuses) =>
        deals.filter((d) => statuses.includes(d.status));
    const needsAction = by("in_progress");
    const waitingClient = by("pending_deposit", "awaiting_final");
    const completed = by("paid");

    const received = deals.reduce((sum, d) => {
        if (d.status === "paid") return sum + Number(d.amount);
        if (d.status === "in_progress" || d.status === "awaiting_final")
            return sum + Number(d.deposit_amount || 0);
        return sum;
    }, 0);
    const total = deals.reduce((sum, d) => sum + Number(d.amount), 0);
    const toCome = total - received;

    return (
        <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">
                Your deals and payments at a glance.
            </p>
            {error && <p className="msg-error">Error: {error}</p>}

            <div className="grid-4">
                <div className="stat">
                    <div className="stat-num">{deals.length}</div>
                    <div className="stat-label">Total deals</div>
                </div>
                <div className="stat">
                    <div className="stat-num">{needsAction.length}</div>
                    <div className="stat-label">Work in progress</div>
                </div>
                <div className="stat">
                    <div className="stat-num">{money(received)}</div>
                    <div className="stat-label">Money received</div>
                </div>
                <div className="stat">
                    <div className="stat-num">{money(toCome)}</div>
                    <div className="stat-label">Still to come</div>
                </div>
            </div>

            <div className="dash-section">
                <h2 className="section-title">Needs your action</h2>
                <DealList
                    deals={needsAction}
                    empty="Nothing to do right now. Deposit-paid deals that need work will appear here."
                />
            </div>

            <div className="dash-section">
                <h2 className="section-title">Waiting for the client</h2>
                <DealList
                    deals={waitingClient}
                    empty="No deals are waiting on a client payment."
                />
            </div>

            <div className="dash-section">
                <h2 className="section-title">Completed and paid</h2>
                <DealList deals={completed} empty="No completed deals yet." />
            </div>
        </div>
    );
}
