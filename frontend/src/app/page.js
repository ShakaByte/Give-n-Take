"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Home() {
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api("/profile")
            .then(setProfile)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <main className="p-10">
            <h1 className="text-3xl font-bold">Give&apos;n&apos;Take</h1>
            {loading && (
                <p className="mt-4">
                    Loading (the backend may be waking up)...
                </p>
            )}
            {error && <p className="mt-4 text-red-600">Error: {error}</p>}
            {profile && (
                <p className="mt-4">
                    Hello, {profile.name} ({profile.profession})
                </p>
            )}
            {!loading && !error && !profile && (
                <p className="mt-4">No profile saved yet.</p>
            )}
        </main>
    );
}
