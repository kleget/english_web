"use client";

import { useEffect, useMemo, useState } from "react";

import { getCookie } from "../lib/client-cookies";
import { useUiLang } from "../ui-lang-context";

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
    title: "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430",
    tagline: "\u041d\u0430\u043f\u0438\u0448\u0438 \u043d\u0430\u043c, \u0435\u0441\u043b\u0438 \u043d\u0443\u0436\u043d\u0430 \u043f\u043e\u043c\u043e\u0449\u044c \u0438\u043b\u0438 \u0435\u0441\u0442\u044c \u0432\u043e\u043f\u0440\u043e\u0441.",
    loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
    error: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f.",
    formTitle: "\u041d\u043e\u0432\u043e\u0435 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435",
    subject: "\u0422\u0435\u043c\u0430",
    category: "\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f",
    message: "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435",
    messageHint: "\u041e\u043f\u0438\u0448\u0438 \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0443 \u0438\u043b\u0438 \u0432\u043e\u043f\u0440\u043e\u0441.",
    submit: "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c",
    sending: "\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430...",
    sent: "\u0421\u043f\u0430\u0441\u0438\u0431\u043e, \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435 \u043f\u0440\u0438\u043d\u044f\u0442\u043e.",
    emptySubject: "\u0423\u043a\u0430\u0436\u0438 \u0442\u0435\u043c\u0443.",
    emptyMessage: "\u041e\u043f\u0438\u0448\u0438 \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0443.",
    listTitle: "\u041c\u043e\u0438 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u044f",
    listEmpty: "\u041e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.",
    refresh: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c",
    adminReply: "\u041e\u0442\u0432\u0435\u0442 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0438",
    createdAt: "\u0414\u0430\u0442\u0430",
    categories: {
      account: "\u0410\u043a\u043a\u0430\u0443\u043d\u0442",
      billing: "\u041e\u043f\u043b\u0430\u0442\u0430",
      technical: "\u0422\u0435\u0445\u043d\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0430",
      bug: "\u041e\u0448\u0438\u0431\u043a\u0430",
      feature: "\u041f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435",
      other: "\u0414\u0440\u0443\u0433\u043e\u0435"
    },
    status: {
      open: "\u041d\u043e\u0432\u043e\u0435",
      in_progress: "\u0412 \u0440\u0430\u0431\u043e\u0442\u0435",
      answered: "\u041e\u0442\u0432\u0435\u0447\u0435\u043d\u043e",
      closed: "\u0417\u0430\u043a\u0440\u044b\u0442\u043e"
    }
  },
  en: {
    title: "Support",
    tagline: "Message us if you need help or have a question.",
    loading: "Loading...",
    error: "Failed to load tickets.",
    formTitle: "New request",
    subject: "Subject",
    category: "Category",
    message: "Message",
    messageHint: "Describe the issue or question.",
    submit: "Send",
    sending: "Sending...",
    sent: "Thanks! Request received.",
    emptySubject: "Provide a subject.",
    emptyMessage: "Provide a message.",
    listTitle: "My requests",
    listEmpty: "No requests yet.",
    refresh: "Refresh",
    adminReply: "Support reply",
    createdAt: "Date",
    categories: {
      account: "Account",
      billing: "Billing",
      technical: "Technical issue",
      bug: "Bug",
      feature: "Feature request",
      other: "Other"
    },
    status: {
      open: "Open",
      in_progress: "In progress",
      answered: "Answered",
      closed: "Closed"
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

async function postJson(path, payload, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
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

export default function SupportPage() {
  const { lang } = useUiLang();
  const uiLang = lang === "en" ? "en" : "ru";
  const t = TEXT[uiLang] || TEXT.ru;
  const locale = uiLang === "en" ? "en-US" : "ru-RU";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tickets, setTickets] = useState([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState({
    subject: "",
    category: "technical",
    message: ""
  });

  const loadTickets = async (token) => {
    const data = await getJson("/support?limit=20", token);
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
        if (message.includes("token") || message.includes("User not found")) {
          window.location.href = "/auth";
          return;
        }
        setError(message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setStatus("");
    setSaveError("");
  }, [form.subject, form.message, form.category]);

  const categoryOptions = useMemo(
    () =>
      CATEGORY_KEYS.map((key) => (
        <option key={key} value={key}>
          {t.categories?.[key] || key}
        </option>
      )),
    [t]
  );

  const submit = async () => {
    setStatus("");
    setSaveError("");
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    if (!form.subject.trim()) {
      setSaveError(t.emptySubject);
      return;
    }
    if (!form.message.trim()) {
      setSaveError(t.emptyMessage);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        subject: form.subject.trim(),
        message: form.message.trim(),
        category: form.category || "other"
      };
      const data = await postJson("/support", payload, token);
      setTickets((prev) => [data, ...prev]);
      setForm((prev) => ({ ...prev, subject: "", message: "" }));
      setStatus(t.sent);
    } catch (err) {
      setSaveError(err.message || t.error);
    } finally {
      setSaving(false);
    }
  };

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

  const statusLabel = (value) => t.status?.[value] || value;
  const statusTone = (value) => STATUS_TONE[value] || "warn";

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

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <div className="panel">
            <div className="panel-title">{t.formTitle}</div>
            <div className="profile-grid">
              <div className="profile-cell">
                <label>{t.subject}</label>
                <input
                  value={form.subject}
                  onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                />
              </div>
              <div className="profile-cell">
                <label>{t.category}</label>
                <select
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                >
                  {categoryOptions}
                </select>
              </div>
              <div className="profile-cell report-full">
                <label>{t.message}</label>
                <textarea
                  value={form.message}
                  onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                />
                <span className="muted">{t.messageHint}</span>
              </div>
              <div className="profile-actions">
                <button type="button" onClick={submit} disabled={saving}>
                  {saving ? t.sending : t.submit}
                </button>
                {status ? <span className="muted">{status}</span> : null}
                {saveError ? <span className="error">{saveError}</span> : null}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">{t.listTitle}</div>
            {tickets.length === 0 ? <p className="muted">{t.listEmpty}</p> : null}
            {tickets.length ? (
              <div className="social-list">
                {tickets.map((item) => (
                  <div key={item.id} className="social-item">
                    <div>
                      <strong>{item.subject}</strong>
                      {item.category ? (
                        <div className="social-meta">{t.categories?.[item.category] || item.category}</div>
                      ) : null}
                      <div className="social-meta">{item.message}</div>
                      {item.admin_reply ? (
                        <div className="social-meta">
                          {t.adminReply}: {item.admin_reply}
                        </div>
                      ) : null}
                      <div className="social-meta">
                        {t.createdAt}: {formatDateTime(item.created_at, locale)}
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
        </>
      ) : null}
    </main>
  );
}
