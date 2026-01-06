"use client";

import { useEffect, useMemo, useState } from "react";

import { getCookie, setCookie } from "../../lib/client-cookies";
import { useUiLang } from "../../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const TEXT = {
  ru: {
    title: "Аудит",
    tagline: "Системные события и ошибки.",
    loading: "Загрузка...",
    error: "Не удалось загрузить лог.",
    forbidden: "Нет доступа.",
    refresh: "Обновить",
    fields: {
      action: "Действие",
      status: "Статус",
      user: "Пользователь",
      ip: "IP",
      agent: "User-Agent",
      meta: "Детали",
      created: "Дата"
    }
  },
  en: {
    title: "Audit",
    tagline: "System events and errors.",
    loading: "Loading...",
    error: "Failed to load logs.",
    forbidden: "Access denied.",
    refresh: "Refresh",
    fields: {
      action: "Action",
      status: "Status",
      user: "User",
      ip: "IP",
      agent: "User-Agent",
      meta: "Meta",
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

function formatDate(value, locale) {
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

function formatMeta(value) {
  if (!value) {
    return "-";
  }
  const raw = JSON.stringify(value);
  if (raw.length <= 200) {
    return raw;
  }
  return `${raw.slice(0, 200)}...`;
}

function formatAgent(value) {
  if (!value) {
    return "-";
  }
  if (value.length <= 120) {
    return value;
  }
  return `${value.slice(0, 120)}...`;
}

export default function AdminAuditPage() {
  const { lang } = useUiLang();
  const uiLang = lang === "en" ? "en" : "ru";
  const t = TEXT[uiLang] || TEXT.ru;
  const locale = uiLang === "en" ? "en-US" : "ru-RU";

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLogs = async () => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    const me = await getJson("/auth/me", token);
    if (!me.is_admin) {
      setError(t.forbidden);
      return;
    }
    setCookie("is_admin", me.is_admin ? "1" : "0");
    const data = await getJson("/admin/audit?limit=120", token);
    setLogs(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadLogs()
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

  const list = useMemo(() => logs, [logs]);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="button-secondary" onClick={loadLogs}>
            {t.refresh}
          </button>
        </div>
      </div>

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <div className="social-list">
          {list.map((item) => (
            <div key={item.id} className="social-item">
              <div>
                <strong>{item.action}</strong>
                <div className="social-meta">
                  {t.fields.status}: {item.status}
                </div>
                <div className="social-meta">
                  {t.fields.user}: {item.user_email || item.user_id || "-"}
                </div>
                <div className="social-meta">
                  {t.fields.ip}: {item.ip || "-"}
                </div>
                <div className="social-meta">
                  {t.fields.agent}: {formatAgent(item.user_agent)}
                </div>
                <div className="social-meta">
                  {t.fields.meta}: {formatMeta(item.meta)}
                </div>
                <div className="social-meta">
                  {t.fields.created}: {formatDate(item.created_at, locale)}
                </div>
              </div>
              <span className={`status-pill ${item.status === "success" ? "ok" : "danger"}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </main>
  );
}
