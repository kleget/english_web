"use client";

import { useEffect, useMemo, useState } from "react";

import { getCookie } from "../../lib/client-cookies";
import { useUiLang } from "../../ui-lang-context";
import AdminNav from "../admin-nav";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const STATUS_TONE = {
  open: "warn",
  in_progress: "warn",
  answered: "ok",
  closed: "danger"
};
const CATEGORY_KEYS = ["account", "billing", "technical", "bug", "feature", "other"];

const TEXT = {
  ru: {
    title: "\u041e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f \u0432 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0443",
    tagline: "\u0412\u0445\u043e\u0434\u044f\u0449\u0438\u0435 \u0437\u0430\u043f\u0440\u043e\u0441\u044b \u043e\u0442 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439.",
    loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
    error: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f.",
    forbidden: "\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430.",
    refresh: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c",
    empty: "\u041e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.",
    status: {
      open: "\u041d\u043e\u0432\u043e\u0435",
      in_progress: "\u0412 \u0440\u0430\u0431\u043e\u0442\u0435",
      answered: "\u041e\u0442\u0432\u0435\u0447\u0435\u043d\u043e",
      closed: "\u0417\u0430\u043a\u0440\u044b\u0442\u043e"
    },
    fields: {
      status: "\u0421\u0442\u0430\u0442\u0443\u0441",
      reply: "\u041e\u0442\u0432\u0435\u0442 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0438",
      save: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c",
      saving: "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...",
      reporter: "\u041e\u0442 \u043a\u043e\u0433\u043e",
      category: "\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f",
      message: "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435",
      created: "\u0414\u0430\u0442\u0430"
    },
    categories: {
      account: "\u0410\u043a\u043a\u0430\u0443\u043d\u0442",
      billing: "\u041e\u043f\u043b\u0430\u0442\u0430",
      technical: "\u0422\u0435\u0445\u043d\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0430",
      bug: "\u041e\u0448\u0438\u0431\u043a\u0430",
      feature: "\u041f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435",
      other: "\u0414\u0440\u0443\u0433\u043e\u0435"
    }
  },
  en: {
    title: "Support requests",
    tagline: "Incoming requests from users.",
    loading: "Loading...",
    error: "Failed to load tickets.",
    forbidden: "Access denied.",
    refresh: "Refresh",
    empty: "No requests yet.",
    status: {
      open: "Open",
      in_progress: "In progress",
      answered: "Answered",
      closed: "Closed"
    },
    fields: {
      status: "Status",
      reply: "Support reply",
      save: "Save",
      saving: "Saving...",
      reporter: "Reporter",
      category: "Category",
      message: "Message",
      created: "Date"
    },
    categories: {
      account: "Account",
      billing: "Billing",
      technical: "Technical issue",
      bug: "Bug",
      feature: "Feature request",
      other: "Other"
    }
  }
};

async function getJson(path, token) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, { headers });
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      throw new Error(data.detail || "Request failed");
    }
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  return response.json();
}

async function patchJson(path, payload, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      throw new Error(data.detail || "Request failed");
    }
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  return response.json();
}

function formatDateTime(value, locale) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function AdminSupportPage() {
  const { lang } = useUiLang();
  const uiLang = lang === "en" ? "en" : "ru";
  const t = TEXT[uiLang] || TEXT.ru;
  const locale = uiLang === "en" ? "en-US" : "ru-RU";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tickets, setTickets] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [replyMap, setReplyMap] = useState({});
  const [savingId, setSavingId] = useState(null);

  const loadTickets = async (token) => {
    const data = await getJson("/support/admin?limit=50", token);
    setTickets(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    loadTickets(token)
      .catch((err) => {
        const message = err.message || t.error;
        if (message.includes("Forbidden")) {
          setError(t.forbidden);
          return;
        }
        if (message.includes("token") || message.includes("User not found")) {
          window.location.href = "/auth";
          return;
        }
        setError(message);
      })
      .finally(() => setLoading(false));
  }, []);

  const statusOptions = useMemo(
    () =>
      Object.entries(t.status).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      )),
    [t]
  );

  const statusLabel = (value) => t.status?.[value] || value;
  const statusTone = (value) => STATUS_TONE[value] || "warn";

  const refresh = async () => {
    setError("");
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    try {
      await loadTickets(token);
    } catch (err) {
      setError(err.message || t.error);
    }
  };

  const saveTicket = async (ticket) => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    const nextStatus = statusMap[ticket.id] || ticket.status;
    const nextReply = replyMap[ticket.id];
    setSavingId(ticket.id);
    try {
      const payload = {
        status: nextStatus,
        admin_reply: nextReply === undefined ? ticket.admin_reply : nextReply
      };
      const data = await patchJson(`/support/admin/${ticket.id}`, payload, token);
      setTickets((prev) => prev.map((item) => (item.id === ticket.id ? data : item)));
    } catch (err) {
      setError(err.message || t.error);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="button-secondary" onClick={refresh}>
            {t.refresh}
          </button>
        </div>
      </div>
      <AdminNav />

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <div className="panel">
          {tickets.length === 0 ? <p className="muted">{t.empty}</p> : null}
          {tickets.length ? (
            <div className="social-list">
              {tickets.map((item) => (
                <div key={item.id} className="social-item">
                  <div>
                    <strong>{item.subject}</strong>
                    <div className="social-meta">
                      {t.fields.reporter}: {item.reporter_email}
                    </div>
                    {item.category ? (
                      <div className="social-meta">
                        {t.fields.category}: {t.categories?.[item.category] || item.category}
                      </div>
                    ) : null}
                    <div className="social-meta">
                      {t.fields.message}: {item.message}
                    </div>
                    <div className="social-meta">
                      {t.fields.created}: {formatDateTime(item.created_at, locale)}
                    </div>
                    <div className="community-inline">
                      <label>{t.fields.status}</label>
                      <select
                        value={statusMap[item.id] || item.status}
                        onChange={(event) =>
                          setStatusMap((prev) => ({ ...prev, [item.id]: event.target.value }))
                        }
                      >
                        {statusOptions}
                      </select>
                    </div>
                    <div className="community-inline">
                      <label>{t.fields.reply}</label>
                      <input
                        value={replyMap[item.id] ?? item.admin_reply ?? ""}
                        onChange={(event) =>
                          setReplyMap((prev) => ({ ...prev, [item.id]: event.target.value }))
                        }
                      />
                    </div>
                    <div className="community-inline">
                      <button type="button" onClick={() => saveTicket(item)} disabled={savingId === item.id}>
                        {savingId === item.id ? t.fields.saving : t.fields.save}
                      </button>
                    </div>
                  </div>
                  <span className={`status-pill ${statusTone(item.status)}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
