"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

const ORDER = { high: 0, medium: 1, low: 2 };

export default function TodosPage() {
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState("");
    const [title, setTitle] = useState("");
    const [priority, setPriority] = useState("medium");
    const [dueDate, setDueDate] = useState("");
    const [hours, setHours] = useState("");

    const load = () =>
        api("/todos")
            .then(setTodos)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));

    useEffect(() => {
        load();
    }, []);

    const add = async () => {
        setError("");
        setAdding(true);
        try {
            await api("/todos", {
                method: "POST",
                body: JSON.stringify({
                    title: title.trim(),
                    priority,
                    due_date: dueDate || null,
                    est_hours: hours ? Number(hours) : null,
                }),
            });
            setTitle("");
            setDueDate("");
            setHours("");
            setPriority("medium");
            await load();
        } catch (e) {
            setError(e.message);
        } finally {
            setAdding(false);
        }
    };

    const toggle = async (t) => {
        setError("");
        try {
            await api(`/todos/${t.id}`, {
                method: "PATCH",
                body: JSON.stringify({ done: !t.done }),
            });
            await load();
        } catch (e) {
            setError(e.message);
        }
    };

    const remove = async (t) => {
        setError("");
        try {
            await api(`/todos/${t.id}`, { method: "DELETE" });
            await load();
        } catch (e) {
            setError(e.message);
        }
    };

    const open = todos
        .filter((t) => !t.done)
        .sort(
            (a, b) =>
                ORDER[a.priority] - ORDER[b.priority] ||
                (a.due_date || "9999").localeCompare(b.due_date || "9999"),
        );
    const done = todos.filter((t) => t.done);

    const Row = ({ t }) => (
        <div className={`todo-row ${t.done ? "is-done" : ""}`}>
            <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggle(t)}
            />
            <div className="todo-main">
                <div className="todo-title">{t.title}</div>
                <div className="meta">
                    {t.due_date ? `Due ${t.due_date}` : "No due date"}
                    {t.est_hours ? ` | ${t.est_hours}h` : ""}
                </div>
            </div>
            <span className={`badge badge-${t.priority}`}>{t.priority}</span>
            <button className="btn-icon" onClick={() => remove(t)}>
                ✕
            </button>
        </div>
    );

    return (
        <div className="narrow">
            <h1 className="page-title">To-dos</h1>
            <p className="page-subtitle">
                Your tasks, calls and follow-ups. The AI planner reads this list
                so it never overloads your days.
            </p>

            <div className="card stack">
                <div className="grid-4-form">
                    <div>
                        <label className="label">Task</label>
                        <input
                            className="input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Call client about brand colors"
                        />
                    </div>
                    <div>
                        <label className="label">Priority</label>
                        <select
                            className="input"
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                        >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                    <div>
                        <label className="label">Due date</label>
                        <input
                            type="date"
                            className="input"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="label">Hours</label>
                        <input
                            type="number"
                            min="0"
                            step="0.5"
                            className="input"
                            value={hours}
                            onChange={(e) => setHours(e.target.value)}
                        />
                    </div>
                </div>
                <button
                    className="btn"
                    onClick={add}
                    disabled={adding || !title.trim()}
                >
                    {adding ? "Adding..." : "Add to-do"}
                </button>
                {error && <p className="msg-error">Error: {error}</p>}
            </div>

            <div className="dash-section">
                <h2 className="section-title">Open</h2>
                {loading ? (
                    <p>Loading...</p>
                ) : open.length === 0 ? (
                    <p className="empty">Nothing open. Add a task above.</p>
                ) : (
                    <div className="stack">
                        {open.map((t) => (
                            <Row key={t.id} t={t} />
                        ))}
                    </div>
                )}
            </div>

            {done.length > 0 && (
                <div className="dash-section">
                    <h2 className="section-title">Done</h2>
                    <div className="stack">
                        {done.map((t) => (
                            <Row key={t.id} t={t} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
