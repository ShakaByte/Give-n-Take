"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const empty = {
    name: "",
    profession: "",
    experience_level: "beginner",
    hours_per_day: 4,
    skills: "",
    services: [{ service: "", min_rate: "" }],
};

export default function ProfilePage() {
    const [form, setForm] = useState(empty);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        api("/profile")
            .then((p) => {
                if (p) {
                    setForm({
                        name: p.name || "",
                        profession: p.profession || "",
                        experience_level: p.experience_level || "beginner",
                        hours_per_day: p.hours_per_day ?? 4,
                        skills: (p.skills || []).join(", "),
                        services: p.services?.length
                            ? p.services
                            : [{ service: "", min_rate: "" }],
                    });
                }
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    const set = (key, value) => setForm({ ...form, [key]: value });

    const setService = (i, key, value) => {
        const services = form.services.map((s, idx) =>
            idx === i ? { ...s, [key]: value } : s,
        );
        setForm({ ...form, services });
    };

    const addService = () =>
        setForm({
            ...form,
            services: [...form.services, { service: "", min_rate: "" }],
        });

    const removeService = (i) =>
        setForm({
            ...form,
            services: form.services.filter((_, idx) => idx !== i),
        });

    const save = async () => {
        setSaving(true);
        setMessage("");
        setError("");
        try {
            const body = {
                name: form.name,
                profession: form.profession,
                experience_level: form.experience_level,
                hours_per_day: Number(form.hours_per_day),
                skills: form.skills
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                services: form.services
                    .filter((s) => s.service.trim() && s.min_rate !== "")
                    .map((s) => ({
                        service: s.service.trim(),
                        min_rate: Number(s.min_rate),
                    })),
            };
            await api("/profile", {
                method: "PUT",
                body: JSON.stringify(body),
            });
            setMessage("Profile saved.");
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading)
        return <p>Loading profile (the backend may be waking up)...</p>;

    return (
        <div className="narrow">
            <h1 className="page-title">Your profile</h1>
            <p className="page-subtitle">
                The AI agents use this every time to set fair prices and plan
                your work.
            </p>

            <div className="card stack">
                <div>
                    <label className="label">Name</label>
                    <input
                        className="input"
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                    />
                </div>
                <div>
                    <label className="label">Profession</label>
                    <input
                        className="input"
                        value={form.profession}
                        onChange={(e) => set("profession", e.target.value)}
                    />
                </div>
                <div className="grid-2">
                    <div>
                        <label className="label">Experience level</label>
                        <select
                            className="input"
                            value={form.experience_level}
                            onChange={(e) =>
                                set("experience_level", e.target.value)
                            }
                        >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="expert">Expert</option>
                        </select>
                    </div>
                    <div>
                        <label className="label">Work hours per day</label>
                        <input
                            type="number"
                            min="1"
                            max="16"
                            className="input"
                            value={form.hours_per_day}
                            onChange={(e) =>
                                set("hours_per_day", e.target.value)
                            }
                        />
                    </div>
                </div>
                <div>
                    <label className="label">Skills (comma separated)</label>
                    <input
                        className="input"
                        value={form.skills}
                        onChange={(e) => set("skills", e.target.value)}
                        placeholder="Branding, Illustrator, Figma"
                    />
                </div>

                <div>
                    <label className="label">
                        Services and minimum rate (USD)
                    </label>
                    <div className="stack">
                        {form.services.map((s, i) => (
                            <div key={i} className="row">
                                <input
                                    className="input"
                                    placeholder="Service, e.g. Logo design"
                                    value={s.service}
                                    onChange={(e) =>
                                        setService(i, "service", e.target.value)
                                    }
                                />
                                <input
                                    type="number"
                                    min="0"
                                    className="input input-small"
                                    placeholder="Min $"
                                    value={s.min_rate}
                                    onChange={(e) =>
                                        setService(
                                            i,
                                            "min_rate",
                                            e.target.value,
                                        )
                                    }
                                />
                                <button
                                    type="button"
                                    className="btn-icon"
                                    onClick={() => removeService(i)}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="btn-link"
                        onClick={addService}
                    >
                        + Add service
                    </button>
                </div>

                <button
                    className="btn"
                    onClick={save}
                    disabled={saving || !form.name.trim()}
                >
                    {saving ? "Saving..." : "Save profile"}
                </button>
                {message && <p className="msg-success">{message}</p>}
                {error && <p className="msg-error">Error: {error}</p>}
            </div>
        </div>
    );
}
