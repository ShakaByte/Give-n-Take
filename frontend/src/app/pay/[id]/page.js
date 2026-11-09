"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../lib/api";

export default function ClientPage() {
    const { id } = useParams();
    const [deal, setDeal] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        try {
            setDeal(await api(`/deals/${id}`));
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
        const t = setInterval(load, 10000);
        return () => clearInterval(t);
    }, [load]);

    const status = deal?.status;
    const hasPreview = !!deal?.preview_path;

    useEffect(() => {
        if (!hasPreview || previewUrl) return;
        api(`/deals/${id}/preview`)
            .then((r) => setPreviewUrl(r.preview_url))
            .catch(() => {});
    }, [hasPreview, previewUrl, id]);

    const pay = async (kind) => {
        setError("");
        setBusy(true);
        try {
            const order = await api(`/deals/${id}/checkout?kind=${kind}`, {
                method: "POST",
            });
            window.location.href = order.approve_url;
        } catch (e) {
            setError(e.message);
            setBusy(false);
        }
    };

    const download = async () => {
        setError("");
        setBusy(true);
        try {
            const r = await api(`/deals/${id}/download`);
            window.open(r.download_url, "_blank");
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <p>Loading (this may take a moment)...</p>;
    if (!deal)
        return <p className="msg-error">Error: {error || "Deal not found"}</p>;

    const isImage = /\.(png|jpe?g|gif|webp)/i.test(previewUrl.split("?")[0]);

    return (
        <div className="client-wrap">
            <h1 className="page-title">{deal.job_title}</h1>
            <p className="meta">
                {deal.client_name ? `Prepared for ${deal.client_name}` : ""}
                {deal.deadline ? ` | Deadline: ${deal.deadline}` : ""}
            </p>

            <div className="card stack">
                <div className="split-row">
                    <span>Total: ${deal.amount}</span>
                    <span>Deposit: ${deal.deposit_amount}</span>
                    <span>Final: ${deal.final_amount}</span>
                </div>
                <p className="hint">
                    Pay a 50% deposit to start. When the work is ready you
                    review a preview, and pay the remaining 50% to unlock the
                    final file.
                </p>
            </div>

            {status === "pending_deposit" && (
                <div className="card stack">
                    <h2 className="section-title">Step 1: Pay the deposit</h2>
                    <p>
                        The freelancer starts work once the $
                        {deal.deposit_amount} deposit is paid.
                    </p>
                    <button
                        className="btn"
                        onClick={() => pay("deposit")}
                        disabled={busy}
                    >
                        {busy
                            ? "Opening PayPal..."
                            : `Pay deposit $${deal.deposit_amount} with PayPal`}
                    </button>
                </div>
            )}

            {status === "in_progress" && (
                <div className="card stack">
                    <h2 className="section-title">Deposit received</h2>
                    <div className="notice">
                        Thank you! The freelancer is working on your project.
                        This page updates by itself when the preview is ready.
                    </div>
                </div>
            )}

            {status === "awaiting_final" && (
                <div className="card stack">
                    <h2 className="section-title">
                        Step 2: Review and pay the rest
                    </h2>
                    <p>
                        The work is ready. Here is a preview. The final file
                        unlocks after you pay.
                    </p>
                    {previewUrl ? (
                        isImage ? (
                            <img
                                className="preview-img"
                                src={previewUrl}
                                alt="Preview of the work"
                            />
                        ) : (
                            <a
                                href={previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-link"
                            >
                                Open the preview
                            </a>
                        )
                    ) : (
                        <p className="hint">Loading preview...</p>
                    )}
                    <button
                        className="btn"
                        onClick={() => pay("final")}
                        disabled={busy}
                    >
                        {busy
                            ? "Opening PayPal..."
                            : `Pay remaining $${deal.final_amount} with PayPal`}
                    </button>
                </div>
            )}

            {status === "paid" && (
                <div className="card stack">
                    <h2 className="section-title">Paid in full</h2>
                    <div className="notice">
                        Payment complete. Your final file is unlocked.
                    </div>
                    <button className="btn" onClick={download} disabled={busy}>
                        {busy ? "Preparing..." : "Download final file"}
                    </button>
                </div>
            )}

            {error && <p className="msg-error">Error: {error}</p>}
        </div>
    );
}
