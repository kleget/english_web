"use client";

import { useEffect, useMemo, useState } from "react";

import { getCookie } from "../../lib/client-cookies";
import { useUiLang } from "../../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const STATUS_TONE = {
  open: "warn",
  in_progress: "warn",
  resolved: "ok",
  rejected: "danger"
};

const TEXT = {
  ru: {
    title: "\u0420\u0435\u043f\u043e\u0440\u0442\u044b \u043e\u0448\u0438\u0431\u043e\u043a",
    tagline: "\u0412\u0445\u043e\u0434\u044f\u0449\u0438\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f \u043e \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u0435 \u0441\u043b\u043e\u0432.",
    loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
    error: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0441\u043f\u0438\u0441\u043e\u043a.",
    forbidden: "\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430.",
    refresh: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c",
    empty: "\u0420\u0435\u043f\u043e\u0440\u0442\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.",
    issueTypes: {
      typo: "\u041e\u043f\u0435\u0447\u0430\u0442\u043a\u0430",
      wrong_translation: "\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u043f\u0435\u0440\u0435\u0432\u043e\u0434",
      artifact: "\u0410\u0440\u0442\u0435\u0444\u0430\u043a\u0442",
      duplicate: "\u0414\u0443\u0431\u043b\u044c",
      other: "\u0414\u0440\u0443\u0433\u043e\u0435"
    },
    status: {
      open: "\u041d\u043e\u0432\u044b\u0439",
      in_progress: "\u0412 \u0440\u0430\u0431\u043e\u0442\u0435",
      resolved: "\u0418\u0441\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e",
      rejected: "\u041e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u043e"
    },
    fields: {
      status: "\u0421\u0442\u0430\u0442\u0443\u0441",
      note: "\u0417\u0430\u043c\u0435\u0442\u043a\u0430 \u0430\u0434\u043c\u0438\u043d\u0430",
      save: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c",
      saving: "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...",
      reporter: "\u041e\u0442 \u043a\u043e\u0433\u043e",
      word: "\u0421\u043b\u043e\u0432\u043e",
      translation: "\u041f\u0435\u0440\u0435\u0432\u043e\u0434",
      corpus: "\u0421\u0444\u0435\u0440\u0430",
      message: "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439",
      created: "\u0414\u0430\u0442\u0430"
    }
  },
  en: {
    title: "Issue reports",
    tagline: "Incoming reports about word quality.",
    loading: "Loading...",
    error: "Failed to load reports.",
    forbidden: "Access denied.",
    refresh: "Refresh",
    empty: "No reports yet.",
    issueTypes: {
      typo: "Typo",
      wrong_translation: "Wrong translation",
      artifact: "Artifact",
      duplicate: "Duplicate",
      other: "Other"
    },
    status: {
      open: "Open",
      in_progress: "In progress",
      resolved: "Resolved",
      rejected: "Rejected"
    },
    fields: {
      status: "Status",
      note: "Admin note",
      save: "Save",
      saving: "Saving...",
      reporter: "Reporter",
      word: "Word",
      translation: "Translation",
      corpus: "Corpus",
      message: "Message",
      created: "Date"
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

export default function AdminReportsPage() {
  const { lang } = useUiLang();
  const uiLang = lang === "en" ? "en" : "ru";
  const t = TEXT[uiLang] || TEXT.ru;
  const locale = uiLang === "en" ? "en-US" : "ru-RU";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reports, setReports] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [noteMap, setNoteMap] = useState({});
  const [savingId, setSavingId] = useState(null);

  const loadReports = async (token) => {
    const data = await getJson("/reports/admin?limit=50", token);
    setReports(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    loadReports(token)
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

  const issueLabel = (value) => t.issueTypes?.[value] || value;
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
      await loadReports(token);
    } catch (err) {
      setError(err.message || t.error);
    }
  };

  const saveReport = async (report) => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    const nextStatus = statusMap[report.id] || report.status;
    const nextNote = noteMap[report.id];
    setSavingId(report.id);
    try {
      const payload = {
        status: nextStatus,
        admin_note: nextNote === undefined ? report.admin_note : nextNote
      };
      const data = await patchJson(`/reports/admin/${report.id}`, payload, token);
      setReports((prev) => prev.map((item) => (item.id === report.id ? data : item)));
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

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <div className="panel">
          {reports.length === 0 ? <p className="muted">{t.empty}</p> : null}
          {reports.length ? (
            <div className="social-list">
              {reports.map((item) => (
                <div key={item.id} className="social-item">
                  <div>
                    <strong>{issueLabel(item.issue_type)}</strong>
                    <div className="social-meta">
                      {t.fields.reporter}: {item.reporter_email}
                    </div>
                    <div className="social-meta">
                      {t.fields.word}: {item.word_text || "-"}{" "}
                      {item.translation_text ? `\u2192 ${item.translation_text}` : ""}
                    </div>
                    {item.corpus_name ? (
                      <div className="social-meta">
                        {t.fields.corpus}: {item.corpus_name}
                      </div>
                    ) : null}
                    {item.message ? (
                      <div className="social-meta">
                        {t.fields.message}: {item.message}
                      </div>
                    ) : null}
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
                      <label>{t.fields.note}</label>
                      <input
                        value={noteMap[item.id] ?? item.admin_note ?? ""}
                        onChange={(event) =>
                          setNoteMap((prev) => ({ ...prev, [item.id]: event.target.value }))
                        }
                      />
                    </div>
                    <div className="community-inline">
                      <button type="button" onClick={() => saveReport(item)} disabled={savingId === item.id}>
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
