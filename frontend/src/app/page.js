"use client";
import { useEffect, useState } from "react";

export default function Home() {
    const [status, setStatus] = useState("checking...");

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`)
            .then((r) => r.json())
            .then((d) => setStatus(d.status))
            .catch(() => setStatus("backend unreachable"));
    }, []);

    return (
        <main className="p-10">
            <h1 className="text-3xl font-bold">Give&apos;n&apos;Take</h1>
            <p className="mt-4">Backend status: {status}</p>
        </main>
    );
}
