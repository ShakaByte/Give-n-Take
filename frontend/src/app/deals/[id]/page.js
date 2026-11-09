"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../lib/api";

const STATUS = {
    pending_deposit: "Waiting for deposit",
    in_progress: "Deposit received, work in progress",
    awaiting_final: "Waiting for final payment",
    paid: "Paid in full",
};

export default function DealPage() {
    const { id } = useParams();
    const [deal, setDeal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [qrKey, setQrKey] = useState(0);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");
    const [uploading, setUploading] = useState("");

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

    const createDeposit = async () => {
        setError("");
        setBusy(true);
        try {
            await api(`/deals/${id}/checkout?kind=deposit`, { method: "POST" });
            await load();
            setQrKey(Date.now());
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const upload = async (kind, e) => {
        const file = e.target.files[0];
        if (!file) return;
        setError("");
        setUploading(kind);
        try {
            const form = new FormData();
            form.append("file", file);
            await api(`/deals/${id}/${kind}`, { method: "POST", body: form });
            await load();
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading("");
            e.target.value = "";
        }
    };

      const submitWork = async () => {
          setError("");
          setBusy(true);
          try {
              await api(`/deals/${id}/submit`, { method: "POST" });
              await load();
          } catch (err) {
              setError(err.message);
          } finally {
              setBusy(false);
          }
      };

    const copyLink = async () => {
        await navigator.clipboard.writeText(deal.deposit_approve_url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) return <p>Loading deal (the backend may be waking up)...</p>;
    if (!deal)
        return <p className="msg-error">Error: {error || "Deal not found"}</p>;

    const depositPaid = deal.status !== "pending_deposit";
    const qrUrl = `${process.env.NEXT_PUBLIC_API_URL}/deals/${id}/qr?kind=deposit&t=${qrKey}`;

    return (
        <div className="narrow">
            <h1 className="page-title">{deal.job_title}</h1>
            <p className="meta">
                {deal.client_name
                    ? `Client: ${deal.client_name}`
                    : "No client name"}
                {deal.deadline ? ` | Deadline: ${deal.deadline}` : ""}
            </p>

            <div className="card stack">
                <div className="row">
                    <span className="badge">
                        {STATUS[deal.status] || deal.status}
                    </span>
                </div>
                <div className="split-row">
                    <span>Total: ${deal.amount}</span>
                    <span>Deposit: ${deal.deposit_amount}</span>
                    <span>Final: ${deal.final_amount}</span>
                </div>
            </div>

            <div className="card stack">
                <h2 className="section-title">Step 1: Deposit</h2>
                {depositPaid ? (
                    <div className="notice">
                        Deposit of ${deal.deposit_amount} received. You can
                        start the work.
                    </div>
                ) : deal.deposit_approve_url ? (
                    <>
                        <p>
                            Share this QR code or link with your client. This
                            page updates by itself once they pay.
                        </p>
                        <img
                            className="qr-img"
                            src={qrUrl}
                            alt="Deposit QR code"
                        />
                        <div className="link-box">
                            {deal.deposit_approve_url}
                        </div>
                        <div className="row">
                            <button className="btn" onClick={copyLink}>
                                {copied ? "Copied" : "Copy link"}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <p>
                            Create the payment link for the $
                            {deal.deposit_amount} deposit.
                        </p>
                        <button
                            className="btn"
                            onClick={createDeposit}
                            disabled={busy}
                        >
                            {busy ? "Creating..." : "Create deposit link"}
                        </button>
                    </>
                )}
                {error && <p className="msg-error">Error: {error}</p>}
            </div>
            {deal.status === "in_progress" && (
                <div className="card stack">
                    <h2 className="section-title">Step 2: Upload your work</h2>
                    <div>
                        <label className="label">
                            Final file (stays locked until the client pays in
                            full)
                        </label>
                        <input
                            type="file"
                            onChange={(e) => upload("upload", e)}
                            disabled={uploading !== ""}
                        />
                        <p className="hint">
                            {uploading === "upload"
                                ? "Uploading..."
                                : deal.file_path
                                  ? `Uploaded: ${deal.file_path.split("/").pop()}`
                                  : "Not uploaded yet"}
                        </p>
                    </div>
                    <div>
                        <label className="label">
                            Preview (the client sees this before paying the
                            rest)
                        </label>
                        <input
                            type="file"
                            onChange={(e) => upload("preview", e)}
                            disabled={uploading !== ""}
                        />
                        <p className="hint">
                            {uploading === "preview"
                                ? "Uploading..."
                                : deal.preview_path
                                  ? `Uploaded: ${deal.preview_path.split("/").pop()}`
                                  : "Not uploaded yet"}
                        </p>
                    </div>
                    <button
                        className="btn"
                        onClick={submitWork}
                        disabled={
                            busy ||
                            uploading !== "" ||
                            !deal.file_path ||
                            !deal.preview_path
                        }
                    >
                        {busy ? "Submitting..." : "Submit work to client"}
                    </button>
                </div>
            )}

            {deal.status === "awaiting_final" && (
                <div className="card stack">
                    <h2 className="section-title">Step 2: Work submitted</h2>
                    <div className="notice">
                        Your work is submitted. The final file stays locked
                        until the client pays the remaining ${deal.final_amount}
                        .
                    </div>
                </div>
            )}
        </div>
    );
}
