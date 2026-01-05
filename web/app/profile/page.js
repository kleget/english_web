"use client";

import { useEffect, useState } from "react";

import { getCookie } from "../lib/client-cookies";
import { useUiLang } from "../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const TEXT = {
  ru: {
    title: "Профиль",
    tagline: "Твои данные и статус обучения.",
    loading: "Загрузка...",
    error: "Не удалось загрузить профиль",
    email: "Email",
    interfaceLang: "Язык интерфейса",
    theme: "Тема",
    nativeLang: "Мой язык",
    targetLang: "Изучаю",
    onboarding: "Онбординг",
    onboardingReady: "Готово",
    onboardingPending: "Не завершен",
    actions: {
      home: "На главную",
      settings: "Настройки"
    },
    themeLight: "Светлая",
    themeDark: "Темная",
    langRu: "Русский",
    langEn: "English"
  },
  en: {
    title: "Profile",
    tagline: "Your details and learning status.",
    loading: "Loading...",
    error: "Failed to load profile",
    email: "Email",
    interfaceLang: "Interface language",
    theme: "Theme",
    nativeLang: "Native language",
    targetLang: "Learning",
    onboarding: "Onboarding",
    onboardingReady: "Ready",
    onboardingPending: "Incomplete",
    actions: {
      home: "Home",
      settings: "Settings"
    },
    themeLight: "Light",
    themeDark: "Dark",
    langRu: "Русский",
    langEn: "English"
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

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const { lang, setLang } = useUiLang();
  const uiLang = lang || "ru";

  const t = TEXT[uiLang] || TEXT.ru;

  useEffect(() => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    getJson("/auth/me", token)
      .then((data) => {
        setProfile(data);
        const nextLang = data.interface_lang === "en" ? "en" : "ru";
        setLang(nextLang);
      })
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

  const goHome = () => {
    window.location.href = "/";
  };

  const goSettings = () => {
    window.location.href = "/settings";
  };

  const langLabel = (value) => {
    if (value === "ru") {
      return t.langRu;
    }
    if (value === "en") {
      return t.langEn;
    }
    return "-";
  };

  const themeLabel = (value) => (value === "dark" ? t.themeDark : t.themeLight);

  const initials = profile?.email ? profile.email.slice(0, 1).toUpperCase() : "?";
  const onboardingReady = Boolean(profile?.onboarding_done);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="button-secondary" onClick={goHome}>
            {t.actions.home}
          </button>
          <button type="button" className="button-secondary" onClick={goSettings}>
            {t.actions.settings}
          </button>
        </div>
      </div>

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {profile ? (
        <>
          <div className="panel profile-hero">
            <div className="profile-avatar">{initials}</div>
            <div className="profile-details">
              <div className="profile-name">{profile.email}</div>
              <div className="profile-meta">{t.email}</div>
              <span className={`status-pill ${onboardingReady ? "ok" : "warn"}`}>
                {t.onboarding}: {onboardingReady ? t.onboardingReady : t.onboardingPending}
              </span>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">{t.title}</div>
            <div className="profile-grid">
              <div className="profile-cell">
                <div className="profile-label">{t.interfaceLang}</div>
                <div className="profile-value">{langLabel(profile.interface_lang)}</div>
              </div>
              <div className="profile-cell">
                <div className="profile-label">{t.theme}</div>
                <div className="profile-value">{themeLabel(profile.theme)}</div>
              </div>
              <div className="profile-cell">
                <div className="profile-label">{t.nativeLang}</div>
                <div className="profile-value">{langLabel(profile.native_lang)}</div>
              </div>
              <div className="profile-cell">
                <div className="profile-label">{t.targetLang}</div>
                <div className="profile-value">{langLabel(profile.target_lang)}</div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
