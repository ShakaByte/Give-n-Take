const BASE = process.env.NEXT_PUBLIC_API_URL;

export async function api(path, options = {}) {
    const isForm = options.body instanceof FormData;
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: isForm ? {} : { "Content-Type": "application/json" },
    });
    if (!res.ok) {
        let detail = "Request failed";
        try {
            detail = (await res.json()).detail || detail;
        } catch {}
        throw new Error(detail);
    }
    return res.json();
}
