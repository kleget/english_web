"use client";

import { useEffect } from "react";

import { useUiLang } from "../ui-lang-context";

const TEXT = {
  ru: {
    title: "Настройки перенесены",
    message: "Теперь все настройки находятся в профиле.",
    action: "Перейти в профиль",
    note: "Перенаправляем..."
  },
  en: {
    title: "Settings moved",
    message: "All settings are now available in your profile.",
    action: "Go to profile",
    note: "Redirecting..."
  }
};

export default function SettingsPage() {
  const { lang } = useUiLang();
  const t = TEXT[lang] || TEXT.ru;

  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = "/profile";
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.message}</p>
        </div>
      </div>
      <div className="panel">
        <p className="muted">{t.note}</p>
        <div className="actions">
          <button type="button" onClick={() => (window.location.href = "/profile")}>
            {t.action}
          </button>
        </div>
      </div>
    </main>
  );
}
