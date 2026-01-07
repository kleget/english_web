"use client";

import { useEffect, useMemo, useState } from "react";

import { getCookie, setCookie } from "../../lib/client-cookies";
import { useUiLang } from "../../ui-lang-context";
import AdminNav from "../admin-nav";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const TEXT = {
  ru: {
    title: "Пользователи",
    tagline: "Управление аккаунтами и доступом.",
    loading: "Загрузка...",
    error: "Не удалось загрузить пользователей.",
    forbidden: "Нет доступа.",
    refresh: "Обновить",
    search: "Поиск",
    placeholder: "Email или часть",
    save: "Сохранить",
    saving: "Сохранение...",
    fields: {
      email: "Email",
      created: "Создан",
      status: "Статус",
      active: "Активен",
      inactive: "Выключен",
      verified: "Подтверждён",
      unverified: "Не подтверждён",
      admin: "Админ",
      lang: "Язык интерфейса",
      theme: "Тема",
      onboarding: "Настройка обучения",
      native: "Родной язык",
      target: "Целевой язык"
    }
  },
  en: {
    title: "Users",
    tagline: "Manage accounts and access.",
    loading: "Loading...",
    error: "Failed to load users.",
    forbidden: "Access denied.",
    refresh: "Refresh",
    search: "Search",
    placeholder: "Email or part",
    save: "Save",
    saving: "Saving...",
    fields: {
      email: "Email",
      created: "Created",
      status: "Status",
      active: "Active",
      inactive: "Inactive",
      verified: "Verified",
      unverified: "Unverified",
      admin: "Admin",
      lang: "Interface language",
      theme: "Theme",
      onboarding: "Setup",
      native: "Native",
      target: "Target"
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

export default function AdminUsersPage() {
  const { lang } = useUiLang();
  const uiLang = lang === "en" ? "en" : "ru";
  const t = TEXT[uiLang] || TEXT.ru;
  const locale = uiLang === "en" ? "en-US" : "ru-RU";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [overrides, setOverrides] = useState({});

  const loadUsers = async (searchValue) => {
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
    const encoded = encodeURIComponent(searchValue || "");
    const data = await getJson(`/admin/users?limit=50&offset=0&query=${encoded}`, token);
    setUsers(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadUsers("")
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

  const changeOverride = (userId, patch) => {
    setOverrides((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] || {}), ...patch }
    }));
  };

  const getOverride = (userId, field, fallback) => {
    const item = overrides[userId];
    if (item && Object.prototype.hasOwnProperty.call(item, field)) {
      return item[field];
    }
    return fallback;
  };

  const saveUser = async (user) => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    const patch = overrides[user.id] || {};
    if (!Object.keys(patch).length) {
      return;
    }
    setSavingId(user.id);
    try {
      const data = await patchJson(`/admin/users/${user.id}`, patch, token);
      setUsers((prev) => prev.map((item) => (item.id === user.id ? data : item)));
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
    } catch (err) {
      setError(err.message || t.error);
    } finally {
      setSavingId(null);
    }
  };

  const statusPill = (label, tone) => (
    <span className={`status-pill ${tone}`}>{label}</span>
  );

  const list = useMemo(() => users, [users]);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="button-secondary" onClick={() => loadUsers(query)}>
            {t.refresh}
          </button>
        </div>
      </div>
      <AdminNav />

      <div className="panel">
        <div className="community-inline">
          <label>{t.search}</label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.placeholder}
          />
          <button type="button" className="button-secondary" onClick={() => loadUsers(query)}>
            {t.search}
          </button>
        </div>
      </div>

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <div className="social-list">
          {list.map((item) => {
            const activeValue = getOverride(item.id, "is_active", item.is_active);
            const verifiedValue = getOverride(item.id, "email_verified", item.email_verified);
            const langValue = getOverride(item.id, "interface_lang", item.interface_lang || "ru");
            const themeValue = getOverride(item.id, "theme", item.theme || "light");

            return (
              <div key={item.id} className="social-item">
                <div>
                  <strong>{item.email}</strong>
                  <div className="social-meta">
                    {t.fields.created}: {formatDate(item.created_at, locale)}
                  </div>
                  <div className="social-meta">
                    {t.fields.onboarding}: {item.onboarding_done ? "OK" : "-"}
                  </div>
                  <div className="social-meta">
                    {t.fields.native}: {item.native_lang || "-"} · {t.fields.target}: {item.target_lang || "-"}
                  </div>
                  <div className="community-inline">
                    {statusPill(
                      activeValue ? t.fields.active : t.fields.inactive,
                      activeValue ? "ok" : "danger"
                    )}
                    {statusPill(
                      verifiedValue ? t.fields.verified : t.fields.unverified,
                      verifiedValue ? "ok" : "warn"
                    )}
                    {item.is_admin ? statusPill(t.fields.admin, "warn") : null}
                  </div>
                  <div className="community-inline">
                    <label>{t.fields.active}</label>
                    <select
                      value={activeValue ? "1" : "0"}
                      onChange={(event) =>
                        changeOverride(item.id, { is_active: event.target.value === "1" })
                      }
                    >
                      <option value="1">{t.fields.active}</option>
                      <option value="0">{t.fields.inactive}</option>
                    </select>
                    <label>{t.fields.verified}</label>
                    <select
                      value={verifiedValue ? "1" : "0"}
                      onChange={(event) =>
                        changeOverride(item.id, { email_verified: event.target.value === "1" })
                      }
                    >
                      <option value="1">{t.fields.verified}</option>
                      <option value="0">{t.fields.unverified}</option>
                    </select>
                  </div>
                  <div className="community-inline">
                    <label>{t.fields.lang}</label>
                    <select
                      value={langValue}
                      onChange={(event) => changeOverride(item.id, { interface_lang: event.target.value })}
                    >
                      <option value="ru">ru</option>
                      <option value="en">en</option>
                    </select>
                    <label>{t.fields.theme}</label>
                    <select
                      value={themeValue}
                      onChange={(event) => changeOverride(item.id, { theme: event.target.value })}
                    >
                      <option value="light">light</option>
                      <option value="dark">dark</option>
                    </select>
                  </div>
                  <div className="community-inline">
                    <button
                      type="button"
                      onClick={() => saveUser(item)}
                      disabled={savingId === item.id || !overrides[item.id]}
                    >
                      {savingId === item.id ? t.saving : t.save}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </main>
  );
}
