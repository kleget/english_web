"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { getCookie } from "../lib/client-cookies";
import { useUiLang } from "../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const STATUS_TONE = {
  open: "warn",
  in_progress: "warn",
  resolved: "ok",
  rejected: "danger"
};
const SOURCE_KEYS = ["learn", "review", "onboarding", "custom", "other"];

const TEXT = {
  ru: {
    title: "\u0421\u043e\u043e\u0431\u0449\u0438\u0442\u044c \u043e \u043e\u0448\u0438\u0431\u043a\u0435",
    tagline:
      "\u0415\u0441\u043b\u0438 \u0432 \u0441\u043b\u043e\u0432\u0435 \u0438\u043b\u0438 \u043f\u0435\u0440\u0435\u0432\u043e\u0434\u0435 \u0435\u0441\u0442\u044c \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442\u044b, \u043d\u0430\u043f\u0438\u0448\u0438 \u0442\u0443\u0442.",
    loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
    error: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435.",
    formTitle: "\u041d\u043e\u0432\u044b\u0439 \u0440\u0435\u043f\u043e\u0440\u0442",
    issueType: "\u0422\u0438\u043f \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u044b",
    word: "\u0421\u043b\u043e\u0432\u043e",
    translation: "\u041f\u0435\u0440\u0435\u0432\u043e\u0434",
    corpus: "\u0421\u0444\u0435\u0440\u0430 (\u043e\u043f\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e)",
    corpusAuto: "\u041e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u0441\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438",
    source: "\u0413\u0434\u0435 \u043d\u0430\u0448\u043b\u0438",
    message: "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439",
    messageHint: "\u041e\u043f\u0438\u0448\u0438 \u043e\u0448\u0438\u0431\u043a\u0443 \u0438\u043b\u0438 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0438 \u0438\u0441\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435.",
    submit: "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c",
    sending: "\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430...",
    sent: "\u0421\u043f\u0430\u0441\u0438\u0431\u043e, \u0440\u0435\u043f\u043e\u0440\u0442 \u043f\u0440\u0438\u043d\u044f\u0442.",
    emptyHint: "\u0423\u043a\u0430\u0436\u0438 \u0441\u043b\u043e\u0432\u043e \u0438\u043b\u0438 \u043f\u0435\u0440\u0435\u0432\u043e\u0434.",
    listTitle: "\u041c\u043e\u0438 \u0440\u0435\u043f\u043e\u0440\u0442\u044b",
    listEmpty: "\u0420\u0435\u043f\u043e\u0440\u0442\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.",
    refresh: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c",
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
    sourceTypes: {
      learn: "\u0423\u0447\u0438\u0442\u044c",
      review: "\u041f\u043e\u0432\u0442\u043e\u0440\u044f\u0442\u044c",
      onboarding: "Настройка обучения",
      custom: "\u041c\u043e\u0438 \u0441\u043b\u043e\u0432\u0430",
      other: "\u0414\u0440\u0443\u0433\u043e\u0435"
    },
    adminNote: "\u041e\u0442\u0432\u0435\u0442 \u0430\u0434\u043c\u0438\u043d\u0430",
    createdAt: "\u0414\u0430\u0442\u0430"
  },
  en: {
    title: "Report an issue",
    tagline: "If a word or translation looks wrong, let us know.",
    loading: "Loading...",
    error: "Failed to load data.",
    formTitle: "New report",
    issueType: "Issue type",
    word: "Word",
    translation: "Translation",
    corpus: "Corpus (optional)",
    corpusAuto: "Auto-detected",
    source: "Where did you see it?",
    message: "Comment",
    messageHint: "Describe the issue or suggest a fix.",
    submit: "Send",
    sending: "Sending...",
    sent: "Thanks! Report received.",
    emptyHint: "Provide a word or translation.",
    listTitle: "My reports",
    listEmpty: "No reports yet.",
    refresh: "Refresh",
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
    sourceTypes: {
      learn: "Learn",
      review: "Review",
      onboarding: "Learning setup",
      custom: "My words",
      other: "Other"
    },
    adminNote: "Admin note",
    createdAt: "Date"
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

export default function ReportsPage() {
  const { lang } = useUiLang();
  const uiLang = lang === "en" ? "en" : "ru";
  const t = TEXT[uiLang] || TEXT.ru;
  const locale = uiLang === "en" ? "en-US" : "ru-RU";
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reports, setReports] = useState([]);
  const [corpora, setCorpora] = useState([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState({
    issue_type: "wrong_translation",
    word_text: "",
    translation_text: "",
    message: "",
    corpus_id: "",
    source: "other",
    word_id: "",
    translation_id: ""
  });
  const [prefillDone, setPrefillDone] = useState(false);
  const autoCorpus = Boolean(form.word_id);

  const loadReports = async (token) => {
    const data = await getJson("/reports?limit=20", token);
    setReports(Array.isArray(data) ? data : []);
  };

  const loadCorpora = async () => {
    const data = await getJson("/corpora");
    setCorpora(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    Promise.all([loadReports(token), loadCorpora()])
      .catch((err) => {
        const message = err.message || t.error;
        if (message.includes("token") || message.includes("User not found")) {
          window.location.href = "/auth";
          return;
        }
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (prefillDone || !searchParams) {
      return;
    }
    const word = searchParams.get("word") || "";
    const translation = searchParams.get("translation") || "";
    const source = searchParams.get("source") || "";
    const wordId = searchParams.get("word_id") || "";
    const translationId = searchParams.get("translation_id") || "";
    const corpusId = searchParams.get("corpus_id") || "";
    if (word || translation || source || wordId) {
      setForm((prev) => ({
        ...prev,
        word_text: word || prev.word_text,
        translation_text: translation || prev.translation_text,
        source: SOURCE_KEYS.includes(source) ? source : prev.source,
        word_id: wordId || prev.word_id,
        translation_id: translationId || prev.translation_id,
        corpus_id: corpusId || prev.corpus_id
      }));
    }
    setPrefillDone(true);
  }, [searchParams, prefillDone]);

  useEffect(() => {
    setStatus("");
    setSaveError("");
  }, [
    form.issue_type,
    form.word_text,
    form.translation_text,
    form.message,
    form.corpus_id,
    form.source,
    form.word_id,
    form.translation_id
  ]);

  const issueOptions = useMemo(
    () =>
      Object.entries(t.issueTypes).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      )),
    [t]
  );

  const sourceOptions = useMemo(
    () =>
      Object.entries(t.sourceTypes).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
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
    if (!form.word_text.trim() && !form.translation_text.trim()) {
      setSaveError(t.emptyHint);
      return;
    }
    setSaving(true);
    try {
      const wordId = Number(form.word_id);
      const payload = {
        issue_type: form.issue_type,
        word_text: form.word_text.trim(),
        translation_text: form.translation_text.trim(),
        message: form.message.trim() || null,
        corpus_id: form.corpus_id ? Number(form.corpus_id) : null,
        source: form.source || "other",
        word_id: Number.isFinite(wordId) ? wordId : null,
        translation_id: Number.isFinite(Number(form.translation_id))
          ? Number(form.translation_id)
          : null
      };
      const data = await postJson("/reports", payload, token);
      setReports((prev) => [data, ...prev]);
      setForm((prev) => ({
        ...prev,
        word_text: "",
        translation_text: "",
        message: "",
        word_id: ""
      }));
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
      await loadReports(token);
    } catch (err) {
      setError(err.message || t.error);
    }
  };

  const statusLabel = (value) => t.status?.[value] || value;
  const statusTone = (value) => STATUS_TONE[value] || "warn";
  const issueLabel = (value) => t.issueTypes?.[value] || value;

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
                <label>{t.issueType}</label>
                <select
                  value={form.issue_type}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, issue_type: event.target.value }))
                  }
                >
                  {issueOptions}
                </select>
              </div>
              <div className="profile-cell">
                <label>{t.source}</label>
                <select
                  value={form.source}
                  onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))}
                >
                  {sourceOptions}
                </select>
              </div>
              <div className="profile-cell">
                <label>{t.word}</label>
                <input
                  value={form.word_text}
                  onChange={(event) => setForm((prev) => ({ ...prev, word_text: event.target.value }))}
                />
              </div>
              <div className="profile-cell">
                <label>{t.translation}</label>
                <input
                  value={form.translation_text}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, translation_text: event.target.value }))
                  }
                />
              </div>
              <div className="profile-cell">
                {!autoCorpus ? (
                  <>
                    <label>{t.corpus}</label>
                    <select
                      value={form.corpus_id}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, corpus_id: event.target.value }))
                      }
                    >
                      <option value="">-</option>
                      {corpora.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <label>{t.corpus}</label>
                    <div className="muted">{t.corpusAuto}</div>
                  </>
                )}
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
            {reports.length === 0 ? <p className="muted">{t.listEmpty}</p> : null}
            {reports.length ? (
              <div className="social-list">
                {reports.map((item) => (
                  <div key={item.id} className="social-item">
                    <div>
                      <strong>{issueLabel(item.issue_type)}</strong>
                      <div className="social-meta">
                        {item.word_text || "-"}{" "}
                        {item.translation_text ? `\u2192 ${item.translation_text}` : ""}
                      </div>
                      {item.corpus_name ? (
                        <div className="social-meta">{item.corpus_name}</div>
                      ) : null}
                      {item.message ? <div className="social-meta">{item.message}</div> : null}
                      {item.admin_note ? (
                        <div className="social-meta">
                          {t.adminNote}: {item.admin_note}
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
