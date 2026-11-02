const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "hackops-backend-token-v1";
let tokenPromise: Promise<string> | null = null;

export function backendConfigured() {
  return API_BASE.length > 0;
}

export function backendBaseUrl() {
  return API_BASE;
}

async function createWorkspaceToken() {
  const response = await fetch(`${API_BASE}/api/v1/workspaces`, { method: "POST" });
  if (!response.ok) throw new Error("Could not create a private backend workspace.");
  const body = await response.json();
  localStorage.setItem(TOKEN_KEY, body.access_token);
  return body.access_token as string;
}

export async function getBackendToken() {
  if (!backendConfigured()) throw new Error("Backend is not configured.");
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored) return stored;
  if (!tokenPromise) tokenPromise = createWorkspaceToken().finally(() => (tokenPromise = null));
  return tokenPromise;
}

async function requestWithToken<T>(path: string, init: RequestInit, token?: string): Promise<T> {
  const workspaceToken = token || (await getBackendToken());
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${workspaceToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    let detail = `Backend request failed (${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* Keep the status-based message for non-JSON responses. */
    }
    throw new Error(detail);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function backendRequest<T>(path: string, init: RequestInit = {}) {
  return requestWithToken<T>(path, init);
}

export async function resetBackendWorkspace() {
  if (!backendConfigured()) return;
  const oldToken = localStorage.getItem(TOKEN_KEY);
  if (oldToken) {
    try {
      await requestWithToken("/workspaces/me", { method: "DELETE" }, oldToken);
    } finally {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
  await getBackendToken();
}

export async function uploadBackendEvidence(path: string, file: File, documentId: string) {
  const form = new FormData();
  form.set("file", file);
  form.set("document_id", documentId);
  return backendRequest<{ document: Record<string, unknown> }>(path, {
    method: "POST",
    body: form,
  });
}

export async function fetchBackendDocument(path: string) {
  const token = await getBackendToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Could not download backend evidence (${response.status}).`);
  return response.blob();
}

export async function downloadBackendFile(path: string, filename: string) {
  const token = await getBackendToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Could not export the backend draft (${response.status}).`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
