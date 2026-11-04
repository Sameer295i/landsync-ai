const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getToken() {
  return localStorage.getItem("landsync_token");
}

async function request(path, { method = "GET", body, auth = true, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errBody = await res.json();
      detail = errBody.detail || detail;
    } catch {}
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // --- Auth ---
  async login(username, password) {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.detail || "Login failed");
    }
    const data = await res.json();
    localStorage.setItem("landsync_token", data.access_token);
    localStorage.setItem("landsync_user", JSON.stringify(data.user));
    return data.user;
  },

  register(payload) {
    return request("/auth/register", { method: "POST", body: payload, auth: false });
  },

  logout() {
    localStorage.removeItem("landsync_token");
    localStorage.removeItem("landsync_user");
  },

  getStoredUser() {
    const raw = localStorage.getItem("landsync_user");
    return raw ? JSON.parse(raw) : null;
  },

  // --- Proposals ---
  listProposals() {
    return request("/proposals");
  },
  getProposal(id) {
    return request(`/proposals/${id}`);
  },
  createProposal(payload) {
    return request("/proposals", { method: "POST", body: payload });
  },
  advanceStage(id, payload) {
    return request(`/proposals/${id}/advance`, { method: "POST", body: payload || {} });
  },
  getAuditLog(id) {
    return request(`/proposals/${id}/audit-log`);
  },

  // --- Compensation ---
  calculateCompensation(id, payload) {
    return request(`/proposals/${id}/compensation`, { method: "POST", body: payload });
  },
  getCompensation(id) {
    return request(`/proposals/${id}/compensation`);
  },
  disburse(id, amount) {
    return request(`/proposals/${id}/compensation/disburse`, { method: "POST", body: { amount } });
  },

  // --- Documents ---
  async uploadDocument(id, file) {
    const form = new FormData();
    form.append("file", file);
    return request(`/proposals/${id}/documents`, { method: "POST", body: form, isForm: true });
  },
  listDocuments(id) {
    return request(`/proposals/${id}/documents`);
  },

  // --- Dashboard ---
  getDashboardSummary() {
    return request("/dashboard/summary", { auth: false });
  },
};
