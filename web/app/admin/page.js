"use client";

import { useEffect, useMemo, useState } from "react";

import { getCookie, setCookie } from "../lib/client-cookies";
import { useUiLang } from "../ui-lang-context";
import AdminNav from "./admin-nav";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const TEXT = {
  ru: {
    title: "Админ-панель",
    tagline: "Сводка по сервису и быстрые действия.",
    loading: "Загрузка...",
    error: "Не удалось загрузить данные.",
    forbidden: "Нет доступа.",
    refresh: "Обновить",
    blocks: {
      users: "Пользователи",
      learning: "Обучение",
      reports: "Репорты",
      jobs: "Фоновые задачи",
      notifications: "Уведомления"
    },
    fields: {
      totalUsers: "Всего пользователей",
      activeUsers: "Активных",
      verifiedUsers: "Подтверждённых",
      onboardedUsers: "С настройкой",
      profiles: "Профилей обучения",
      corpora: "Сфер",
      reportsOpen: "Новые",
      reportsInProgress: "В работе",
      reportsResolved: "Исправлены",
      reportsRejected: "Отклонены",
      jobsPending: "В очереди",
      jobsRunning: "Выполняются",
      jobsDone: "Готово",
      jobsFailed: "Ошибки",
      notifPending: "В очереди",
      notifSent: "Отправлены",
      notifFailed: "Ошибки"
    },
    actions: {
      users: "Управление аккаунтами",
      audit: "Аудит и лог",
      reports: "Репорты",
      tech: "Тех-настройки"
    }
  },
  en: {
    title: "Admin panel",
    tagline: "Service summary and quick actions.",
    loading: "Loading...",
    error: "Failed to load data.",
    forbidden: "Access denied.",
    refresh: "Refresh",
    blocks: {
      users: "Users",
      learning: "Learning",
      reports: "Reports",
      jobs: "Background jobs",
      notifications: "Notifications"
    },
    fields: {
      totalUsers: "Total users",
      activeUsers: "Active",
      verifiedUsers: "Verified",
      onboardedUsers: "Setup done",
      profiles: "Learning profiles",
      corpora: "Corpora",
      reportsOpen: "Open",
      reportsInProgress: "In progress",
      reportsResolved: "Resolved",
      reportsRejected: "Rejected",
      jobsPending: "Pending",
      jobsRunning: "Running",
      jobsDone: "Done",
      jobsFailed: "Failed",
      notifPending: "Pending",
      notifSent: "Sent",
      notifFailed: "Failed"
    },
    actions: {
      users: "Manage accounts",
      audit: "Audit logs",
      reports: "Reports",
      tech: "Tech"
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

export default function AdminPage() {
  const { lang } = useUiLang();
  const uiLang = lang === "en" ? "en" : "ru";
  const t = TEXT[uiLang] || TEXT.ru;

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSummary = async () => {
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
    const data = await getJson("/admin/summary", token);
    setSummary(data);
  };

  useEffect(() => {
    loadSummary()
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

  const userCards = useMemo(() => {
    if (!summary) {
      return [];
    }
    return [
      { label: t.fields.totalUsers, value: summary.total_users },
      { label: t.fields.activeUsers, value: summary.active_users },
      { label: t.fields.verifiedUsers, value: summary.verified_users },
      { label: t.fields.onboardedUsers, value: summary.onboarded_users }
    ];
  }, [summary, t]);

  const learningCards = useMemo(() => {
    if (!summary) {
      return [];
    }
    return [
      { label: t.fields.profiles, value: summary.learning_profiles },
      { label: t.fields.corpora, value: summary.corpora }
    ];
  }, [summary, t]);

  const reportCards = useMemo(() => {
    if (!summary) {
      return [];
    }
    return [
      { label: t.fields.reportsOpen, value: summary.reports_open },
      { label: t.fields.reportsInProgress, value: summary.reports_in_progress },
      { label: t.fields.reportsResolved, value: summary.reports_resolved },
      { label: t.fields.reportsRejected, value: summary.reports_rejected }
    ];
  }, [summary, t]);

  const jobCards = useMemo(() => {
    if (!summary) {
      return [];
    }
    return [
      { label: t.fields.jobsPending, value: summary.jobs_pending },
      { label: t.fields.jobsRunning, value: summary.jobs_running },
      { label: t.fields.jobsDone, value: summary.jobs_done },
      { label: t.fields.jobsFailed, value: summary.jobs_failed }
    ];
  }, [summary, t]);

  const notificationCards = useMemo(() => {
    if (!summary) {
      return [];
    }
    return [
      { label: t.fields.notifPending, value: summary.notifications_pending },
      { label: t.fields.notifSent, value: summary.notifications_sent },
      { label: t.fields.notifFailed, value: summary.notifications_failed }
    ];
  }, [summary, t]);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="button-secondary" onClick={loadSummary}>
            {t.refresh}
          </button>
        </div>
      </div>
      <AdminNav />

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error && summary ? (
        <>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">{t.blocks.users}</div>
            </div>
            <div className="stats-grid">
              {userCards.map((item) => (
                <div key={item.label} className="stat-card">
                  <div className="stat-label">{item.label}</div>
                  <div className="stat-value">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">{t.blocks.learning}</div>
            </div>
            <div className="stats-grid">
              {learningCards.map((item) => (
                <div key={item.label} className="stat-card">
                  <div className="stat-label">{item.label}</div>
                  <div className="stat-value">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">{t.blocks.reports}</div>
            </div>
            <div className="stats-grid">
              {reportCards.map((item) => (
                <div key={item.label} className="stat-card">
                  <div className="stat-label">{item.label}</div>
                  <div className="stat-value">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">{t.blocks.jobs}</div>
            </div>
            <div className="stats-grid">
              {jobCards.map((item) => (
                <div key={item.label} className="stat-card">
                  <div className="stat-label">{item.label}</div>
                  <div className="stat-value">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">{t.blocks.notifications}</div>
            </div>
            <div className="stats-grid">
              {notificationCards.map((item) => (
                <div key={item.label} className="stat-card">
                  <div className="stat-label">{item.label}</div>
                  <div className="stat-value">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

        </>
      ) : null}
    </main>
  );
}
