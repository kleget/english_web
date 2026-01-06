"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { useUiLang } from "../../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const TEXT = {
  ru: {
    title: "\u041d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c",
    subtitle: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c.",
    token: "\u041a\u043e\u0434 \u0438\u0437 \u043f\u0438\u0441\u044c\u043c\u0430",
    password: "\u041d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c",
    save: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c",
    saving: "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c...",
    success: "\u041f\u0430\u0440\u043e\u043b\u044c \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d. \u0422\u0435\u043f\u0435\u0440\u044c \u0432\u043e\u0439\u0434\u0438\u0442\u0435.",
    login: "\u041f\u0435\u0440\u0435\u0439\u0442\u0438 \u043a\u043e \u0432\u0445\u043e\u0434\u0443"
  },
  en: {
    title: "New password",
    subtitle: "Enter a new password.",
    token: "Token from email",
    password: "New password",
    save: "Save",
    saving: "Saving...",
    success: "Password updated. You can sign in now.",
    login: "Go to login"
  }
};

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export default function ResetPage() {
  const params = useSearchParams();
  const { lang } = useUiLang();
  const uiLang = lang || "ru";
  const t = TEXT[uiLang] || TEXT.ru;
  const tokenParam = params.get("token") || "";
  const [token, setToken] = useState(tokenParam);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");
    setSaving(true);
    try {
      await postJson("/auth/reset-password", { token, new_password: password });
      setStatus(t.success);
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main>
      <h1>{t.title}</h1>
      <p>{t.subtitle}</p>

      <form onSubmit={submit}>
        <div>
          <label>{t.token}</label>
          <input
            type="text"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
          />
        </div>
        <div>
          <label>{t.password}</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={saving}>
          {saving ? t.saving : t.save}
        </button>
      </form>

      {status ? (
        <div className="panel">
          <p className="success">{status}</p>
          <a className="button-secondary" href="/auth">
            {t.login}
          </a>
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
