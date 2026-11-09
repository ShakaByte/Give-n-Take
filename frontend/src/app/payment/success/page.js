"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "../../../lib/api";

function Inner() {
    const params = useSearchParams();
    const orderId = params.get("token");
    const [state, setState] = useState({ status: "working" });
    const ran = useRef(false);

    useEffect(() => {
        if (!orderId || ran.current) return;
        ran.current = true;
        api(`/payments/complete/${orderId}`, { method: "POST" })
            .then((r) => setState({ status: "done", ...r }))
            .catch((e) => setState({ status: "error", message: e.message }));
    }, [orderId]);

    if (!orderId)
        return <p className="msg-error">Missing payment information.</p>;

    return (
        <div className="narrow">
            <h1 className="page-title">Payment</h1>
            <div className="card stack">
                {state.status === "working" && (
                    <p>Confirming your payment with PayPal...</p>
                )}
                {state.status === "error" && (
                    <p className="msg-error">Error: {state.message}</p>
                )}
                {state.status === "done" && (
                    <>
                        <p>
                            <b>Payment received.</b> Thank you!
                        </p>
                        <p className="hint">
                            It can take a minute for the confirmation to appear
                            on the deal page.
                        </p>
                        <Link
                            href={`/pay/${state.deal_id}`}
                            className="btn-link"
                        >
                            Back to your project
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}

export default function PaymentSuccess() {
    return (
        <Suspense fallback={<p>Loading...</p>}>
            <Inner />
        </Suspense>
    );
}
