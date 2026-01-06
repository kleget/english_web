"use client";

import { useEffect, useMemo, useState } from "react";

import { getCookie } from "../lib/client-cookies";
import { useUiLang } from "../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const STATUS_TONE = {
  pending: "warn",
  processing: "warn",
  done: "ok",
  failed: "danger",
  sent: "ok"
};

const TEXT = {
  ru: {
    title: "\u0422\u0435\u0445-\u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438",
    tagline:
      "\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f, \u043e\u0447\u0435\u0440\u0435\u0434\u044c \u0438 \u0444\u043e\u043d\u043e\u0432\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438.",
    loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
    error: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435.",
    save: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c",
    saving: "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...",
    saved: "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e",
    saveError: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438",
    notifications: {
      title: "\u0423\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f",
      desc: "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u043a\u0430\u043d\u0430\u043b\u043e\u0432 \u0438 \u0432\u0440\u0435\u043c\u0435\u043d\u0438 \u043d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0439.",
      emailEnabled: "Email-\u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f",
      email: "\u0410\u0434\u0440\u0435\u0441 email",
      telegramEnabled: "Telegram-\u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f",
      telegram: "Telegram chat id",
      pushEnabled: "Push-\u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f",
      reminder: "\u0412\u0440\u0435\u043c\u044f \u043d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0439",
      reminderHint: "\u041f\u043e \u0432\u0430\u0448\u0435\u043c\u0443 \u0447\u0430\u0441\u043e\u0432\u043e\u043c\u0443 \u043f\u043e\u044f\u0441\u0443",
      lastNotified: "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0430",
      enable: "\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c"
    },
    outbox: {
      title: "\u041e\u0447\u0435\u0440\u0435\u0434\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439",
      desc: "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u044f \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438.",
      empty: "\u041e\u0447\u0435\u0440\u0435\u0434\u044c \u043f\u043e\u043a\u0430 \u043f\u0443\u0441\u0442\u0430.",
      scheduled: "\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u043e",
      sent: "\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e"
    },
    jobs: {
      title: "\u0424\u043e\u043d\u043e\u0432\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438",
      desc: "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u0444\u043e\u043d\u043e\u0432\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438.",
      empty: "\u0424\u043e\u043d\u043e\u0432\u044b\u0445 \u0437\u0430\u0434\u0430\u0447 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.",
      created: "\u0421\u043e\u0437\u0434\u0430\u043d\u043e",
      finished: "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u043e",
      payload: "\u041f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b",
      error: "\u041e\u0448\u0438\u0431\u043a\u0430"
    },
    actions: {
      refresh: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c",
      refreshing: "\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435..."
    },
    status: {
      pending: "\u041e\u0436\u0438\u0434\u0430\u0435\u0442",
      processing: "\u0412 \u0440\u0430\u0431\u043e\u0442\u0435",
      done: "\u0413\u043e\u0442\u043e\u0432\u043e",
      failed: "\u041e\u0448\u0438\u0431\u043a\u0430",
      sent: "\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e"
    },
    channels: {
      email: "Email",
      telegram: "Telegram",
      push: "Push"
    },
    jobTypes: {
      refresh_stats: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0443",
      generate_report: "\u0421\u0444\u043e\u0440\u043c\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043e\u0442\u0447\u0435\u0442",
      send_review_notifications: "\u0420\u0430\u0437\u043e\u0441\u043b\u0430\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f",
      import_words: "\u0418\u043c\u043f\u043e\u0440\u0442 \u0441\u043b\u043e\u0432",
      send_report_notifications: "\u0420\u0435\u043f\u043e\u0440\u0442\u044b: \u0443\u0432\u0435\u0434\u043e\u043c\u0438\u0442\u044c \u0430\u0434\u043c\u0438\u043d\u0430"
    }
  },
  en: {
    title: "Tech settings",
    tagline: "Notifications, queues, and background jobs.",
    loading: "Loading...",
    error: "Failed to load data.",
    save: "Save",
    saving: "Saving...",
    saved: "Saved",
    saveError: "Failed to save settings",
    notifications: {
      title: "Notifications",
      desc: "Channel switches and reminder time.",
      emailEnabled: "Email notifications",
      email: "Email address",
      telegramEnabled: "Telegram notifications",
      telegram: "Telegram chat id",
      pushEnabled: "Push notifications",
      reminder: "Reminder time",
      reminderHint: "Uses your local timezone",
      lastNotified: "Last sent",
      enable: "Enabled"
    },
    outbox: {
      title: "Notification outbox",
      desc: "Recent delivery events.",
      empty: "The outbox is empty.",
      scheduled: "Scheduled",
      sent: "Sent"
    },
    jobs: {
      title: "Background jobs",
      desc: "Recent worker activity.",
      empty: "No jobs yet.",
      created: "Created",
      finished: "Finished",
      payload: "Payload",
      error: "Error"
    },
    actions: {
      refresh: "Refresh",
      refreshing: "Refreshing..."
    },
    status: {
      pending: "Pending",
      processing: "Processing",
      done: "Done",
      failed: "Failed",
      sent: "Sent"
    },
    channels: {
      email: "Email",
      telegram: "Telegram",
      push: "Push"
    },
    jobTypes: {
      refresh_stats: "Refresh stats",
      generate_report: "Generate report",
      send_review_notifications: "Send reminders",
      import_words: "Import words",
      send_report_notifications: "Report notifications"
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

async function putJson(path, payload, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
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

function formatPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const entries = Object.entries(payload).filter(
    ([, value]) => value !== null && value !== undefined && String(value).trim() !== ""
  );
  if (!entries.length) {
    return "";
  }
  return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}

export default function TechPage() {
  const { lang } = useUiLang();
  const uiLang = lang === "en" ? "en" : "ru";
  const t = TEXT[uiLang] || TEXT.ru;
  const locale = uiLang === "en" ? "en-US" : "ru-RU";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    telegram_chat_id: "",
    email_enabled: false,
    telegram_enabled: false,
    push_enabled: false,
    review_hour: 9
  });
  const [lastNotifiedAt, setLastNotifiedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [saveError, setSaveError] = useState("");

  const [outbox, setOutbox] = useState([]);
  const [outboxLoading, setOutboxLoading] = useState(false);
  const [outboxError, setOutboxError] = useState("");

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");

  const normalizeSettings = (data) => ({
    email: data?.email || "",
    telegram_chat_id: data?.telegram_chat_id || "",
    email_enabled: Boolean(data?.email_enabled),
    telegram_enabled: Boolean(data?.telegram_enabled),
    push_enabled: Boolean(data?.push_enabled),
    review_hour: Number.isFinite(data?.review_hour) ? data.review_hour : 9
  });

  const handleAuthError = (message) => {
    if (message === "Onboarding required") {
      window.location.href = "/onboarding";
      return true;
    }
    if (message.includes("token") || message.includes("User not found")) {
      window.location.href = "/auth";
      return true;
    }
    return false;
  };

  useEffect(() => {
    let active = true;
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    Promise.all([
      getJson("/tech/notifications", token),
      getJson("/tech/notifications/outbox?limit=20", token),
      getJson("/tech/jobs?limit=20", token)
    ])
      .then(([settingsData, outboxData, jobsData]) => {
        if (!active) {
          return;
        }
        setForm(normalizeSettings(settingsData));
        setLastNotifiedAt(settingsData?.last_notified_at || "");
        setOutbox(Array.isArray(outboxData) ? outboxData : []);
        setJobs(Array.isArray(jobsData) ? jobsData : []);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        const message = err.message || t.error;
        if (handleAuthError(message)) {
          return;
        }
        setError(message);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSaveStatus("");
    setSaveError("");
  }, [
    form.email,
    form.telegram_chat_id,
    form.email_enabled,
    form.telegram_enabled,
    form.push_enabled,
    form.review_hour
  ]);

  const saveSettings = async () => {
    setSaveStatus("");
    setSaveError("");
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    setSaving(true);
    try {
      const data = await putJson(
        "/tech/notifications",
        {
          email: form.email,
          telegram_chat_id: form.telegram_chat_id,
          email_enabled: form.email_enabled,
          telegram_enabled: form.telegram_enabled,
          push_enabled: form.push_enabled,
          review_hour: form.review_hour
        },
        token
      );
      setForm(normalizeSettings(data));
      setLastNotifiedAt(data?.last_notified_at || "");
      setSaveStatus(t.saved);
    } catch (err) {
      const message = err.message || t.saveError;
      if (handleAuthError(message)) {
        return;
      }
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const refreshOutbox = async () => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    setOutboxLoading(true);
    setOutboxError("");
    try {
      const data = await getJson("/tech/notifications/outbox?limit=20", token);
      setOutbox(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err.message || t.error;
      if (handleAuthError(message)) {
        return;
      }
      setOutboxError(message);
    } finally {
      setOutboxLoading(false);
    }
  };

  const refreshJobs = async () => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    setJobsLoading(true);
    setJobsError("");
    try {
      const data = await getJson("/tech/jobs?limit=20", token);
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err.message || t.error;
      if (handleAuthError(message)) {
        return;
      }
      setJobsError(message);
    } finally {
      setJobsLoading(false);
    }
  };

  const hourOptions = useMemo(
    () =>
      HOURS.map((hour) => {
        const label = `${String(hour).padStart(2, "0")}:00`;
        return (
          <option key={hour} value={hour}>
            {label}
          </option>
        );
      }),
    []
  );

  const statusLabel = (status) => t.status?.[status] || status || "-";
  const statusTone = (status) => STATUS_TONE[status] || "warn";
  const channelLabel = (channel) => t.channels?.[channel] || channel || "-";
  const jobLabel = (jobType) => t.jobTypes?.[jobType] || jobType || "-";

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>
      </div>

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <div className="panel">
            <div className="panel-title">{t.notifications.title}</div>
            <p className="muted">{t.notifications.desc}</p>
            <div className="profile-grid">
              <div className="profile-cell">
                <label>{t.notifications.emailEnabled}</label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.email_enabled}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, email_enabled: event.target.checked }))
                    }
                  />
                  <span>{t.notifications.enable}</span>
                </label>
              </div>
              <div className="profile-cell">
                <label>{t.notifications.email}</label>
                <input
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div className="profile-cell">
                <label>{t.notifications.telegramEnabled}</label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.telegram_enabled}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, telegram_enabled: event.target.checked }))
                    }
                  />
                  <span>{t.notifications.enable}</span>
                </label>
              </div>
              <div className="profile-cell">
                <label>{t.notifications.telegram}</label>
                <input
                  value={form.telegram_chat_id}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, telegram_chat_id: event.target.value }))
                  }
                />
              </div>
              <div className="profile-cell">
                <label>{t.notifications.pushEnabled}</label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.push_enabled}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, push_enabled: event.target.checked }))
                    }
                  />
                  <span>{t.notifications.enable}</span>
                </label>
              </div>
              <div className="profile-cell">
                <label>{t.notifications.reminder}</label>
                <select
                  value={form.review_hour}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, review_hour: Number(event.target.value) }))
                  }
                >
                  {hourOptions}
                </select>
                <span className="muted">{t.notifications.reminderHint}</span>
              </div>
              <div className="profile-cell">
                <label>{t.notifications.lastNotified}</label>
                <div className="profile-value">
                  {formatDateTime(lastNotifiedAt, locale)}
                </div>
              </div>
              <div className="profile-actions">
                <button type="button" onClick={saveSettings} disabled={saving}>
                  {saving ? t.saving : t.save}
                </button>
                {saveStatus ? <span className="muted">{saveStatus}</span> : null}
                {saveError ? <span className="error">{saveError}</span> : null}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">{t.outbox.title}</div>
                <p className="muted">{t.outbox.desc}</p>
              </div>
              <button
                type="button"
                className="button-secondary"
                onClick={refreshOutbox}
                disabled={outboxLoading}
              >
                {outboxLoading ? t.actions.refreshing : t.actions.refresh}
              </button>
            </div>
            {outboxError ? <p className="error">{outboxError}</p> : null}
            {outbox.length === 0 ? <p className="muted">{t.outbox.empty}</p> : null}
            {outbox.length ? (
              <div className="social-list">
                {outbox.map((item) => (
                  <div key={item.id} className="social-item">
                    <div>
                      <strong>{channelLabel(item.channel)}</strong>
                      <div className="social-meta">
                        {t.outbox.scheduled}: {formatDateTime(item.scheduled_at, locale)}
                      </div>
                      {item.sent_at ? (
                        <div className="social-meta">
                          {t.outbox.sent}: {formatDateTime(item.sent_at, locale)}
                        </div>
                      ) : null}
                      {item.error ? <div className="error">{item.error}</div> : null}
                    </div>
                    <span className={`status-pill ${statusTone(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">{t.jobs.title}</div>
                <p className="muted">{t.jobs.desc}</p>
              </div>
              <button
                type="button"
                className="button-secondary"
                onClick={refreshJobs}
                disabled={jobsLoading}
              >
                {jobsLoading ? t.actions.refreshing : t.actions.refresh}
              </button>
            </div>
            {jobsError ? <p className="error">{jobsError}</p> : null}
            {jobs.length === 0 ? <p className="muted">{t.jobs.empty}</p> : null}
            {jobs.length ? (
              <div className="social-list">
                {jobs.map((item) => {
                  const payloadLabel = formatPayload(item.payload);
                  return (
                    <div key={item.id} className="social-item">
                      <div>
                        <strong>{jobLabel(item.job_type)}</strong>
                        <div className="social-meta">
                          {t.jobs.created}: {formatDateTime(item.created_at, locale)}
                        </div>
                        {item.finished_at ? (
                          <div className="social-meta">
                            {t.jobs.finished}: {formatDateTime(item.finished_at, locale)}
                          </div>
                        ) : null}
                        {payloadLabel ? (
                          <div className="social-meta">
                            {t.jobs.payload}: {payloadLabel}
                          </div>
                        ) : null}
                        {item.last_error ? (
                          <div className="error">
                            {t.jobs.error}: {item.last_error}
                          </div>
                        ) : null}
                      </div>
                      <span className={`status-pill ${statusTone(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </main>
  );
}
