"use client";

import { useEffect, useState } from "react";

import { getCookie, setCookie } from "../lib/client-cookies";
import { useUiLang } from "../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const TEXT = {
  ru: {
    title: "Настройки",
    tagline: "Интерфейс и управление обучением.",
    loading: "Загрузка...",
    error: "Не удалось загрузить настройки",
    interfaceSection: "Интерфейс",
    learningSection: "Обучение",
    interfaceLang: "Язык интерфейса",
    theme: "Тема",
    save: "Сохранить",
    saving: "Сохраняю...",
    saved: "Сохранено",
    saveError: "Не удалось сохранить настройки",
    themeLight: "Светлая",
    themeDark: "Темная",
    langRu: "Русский",
    langEn: "English",
    actions: {
      home: "На главную",
      profile: "Профиль",
      onboarding: "Настройки обучения"
    },
    learningHint: "Выбор сфер, языков и лимитов доступен в онбординге."
  },
  en: {
    title: "Settings",
    tagline: "Interface and learning controls.",
    loading: "Loading...",
    error: "Failed to load settings",
    interfaceSection: "Interface",
    learningSection: "Learning",
    interfaceLang: "Interface language",
    theme: "Theme",
    save: "Save",
    saving: "Saving...",
    saved: "Saved",
    saveError: "Failed to save settings",
    themeLight: "Light",
    themeDark: "Dark",
    langRu: "Русский",
    langEn: "English",
    actions: {
      home: "Home",
      profile: "Profile",
      onboarding: "Learning setup"
    },
    learningHint: "Pick corpora, languages, and limits in onboarding."
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

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ interface_lang: "ru", theme: "light" });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [saveError, setSaveError] = useState("");
  const { setLang } = useUiLang();

  const uiLang = form.interface_lang || "ru";
  const t = TEXT[uiLang] || TEXT.ru;

  useEffect(() => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    getJson("/profile", token)
      .then((data) => {
        const interfaceLang = data.interface_lang === "en" ? "en" : "ru";
        const theme = data.theme === "dark" ? "dark" : "light";
        setForm({ interface_lang: interfaceLang, theme });
        setLang(interfaceLang);
        document.documentElement.dataset.theme = theme;
        localStorage.setItem("theme", theme);
        setCookie("theme", theme);
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

  useEffect(() => {
    setStatus("");
    setSaveError("");
  }, [form.interface_lang, form.theme]);

  useEffect(() => {
    if (loading) {
      return;
    }
    const nextLang = form.interface_lang === "en" ? "en" : "ru";
    setLang(nextLang);
    const nextTheme = form.theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("theme", nextTheme);
    setCookie("theme", nextTheme);
  }, [form.interface_lang, form.theme, loading]);

  const saveSettings = async () => {
    setStatus("");
    setSaveError("");
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    setSaving(true);
    try {
      const data = await putJson(
        "/profile",
        {
          interface_lang: form.interface_lang,
          theme: form.theme
        },
        token
      );
      setForm({
        interface_lang: data.interface_lang,
        theme: data.theme
      });
      setStatus(t.saved);
    } catch (err) {
      setSaveError(err.message || t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const goHome = () => {
    window.location.href = "/";
  };

  const goProfile = () => {
    window.location.href = "/profile";
  };

  const goOnboarding = () => {
    window.location.href = "/onboarding";
  };

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
          <button type="button" className="button-secondary" onClick={goProfile}>
            {t.actions.profile}
          </button>
        </div>
      </div>

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <div className="panel">
            <div className="panel-title">{t.interfaceSection}</div>
            <div className="profile-grid">
              <div className="profile-cell">
                <label>{t.interfaceLang}</label>
                <select
                  value={form.interface_lang}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, interface_lang: event.target.value }))
                  }
                >
                  <option value="ru">{t.langRu}</option>
                  <option value="en">{t.langEn}</option>
                </select>
              </div>
              <div className="profile-cell">
                <label>{t.theme}</label>
                <select
                  value={form.theme}
                  onChange={(event) => setForm((prev) => ({ ...prev, theme: event.target.value }))}
                >
                  <option value="light">{t.themeLight}</option>
                  <option value="dark">{t.themeDark}</option>
                </select>
              </div>
              <div className="profile-actions">
                <button type="button" onClick={saveSettings} disabled={saving}>
                  {saving ? t.saving : t.save}
                </button>
                {status ? <span className="muted">{status}</span> : null}
                {saveError ? <span className="error">{saveError}</span> : null}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">{t.learningSection}</div>
            <p className="muted">{t.learningHint}</p>
            <div className="actions">
              <button type="button" className="button-secondary" onClick={goOnboarding}>
                {t.actions.onboarding}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
