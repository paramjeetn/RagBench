// Keys stored in localStorage under these names
export const API_KEY_STORAGE = {
  gemini: "ragbench_gemini_api_key",
  openai: "ragbench_openai_api_key",
  anthropic: "ragbench_anthropic_api_key",
  qdrant: "ragbench_qdrant_api_key",
} as const;

export function getStoredApiKeys(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const keys: Record<string, string> = {};
  const gemini = localStorage.getItem(API_KEY_STORAGE.gemini);
  const openai = localStorage.getItem(API_KEY_STORAGE.openai);
  const anthropic = localStorage.getItem(API_KEY_STORAGE.anthropic);
  const qdrant = localStorage.getItem(API_KEY_STORAGE.qdrant);
  if (gemini) keys["X-Gemini-Api-Key"] = gemini;
  if (openai) keys["X-Openai-Api-Key"] = openai;
  if (anthropic) keys["X-Anthropic-Api-Key"] = anthropic;
  if (qdrant) keys["X-Qdrant-Api-Key"] = qdrant;
  return keys;
}

export function hasAnyApiKey(): boolean {
  if (typeof window === "undefined") return false;
  return Object.values(API_KEY_STORAGE).some((k) => !!localStorage.getItem(k));
}

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const apiKeyHeaders = getStoredApiKeys();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...apiKeyHeaders,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "POST", body: formData }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  del: (path: string) =>
    fetch(`${BASE}${path}`, {
      method: "DELETE",
      headers: getStoredApiKeys(),
    }),

  stream: (path: string, body: unknown) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getStoredApiKeys(),
      },
      body: JSON.stringify(body),
    }),
};
