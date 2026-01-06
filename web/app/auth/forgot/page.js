"use client";

import { useState } from "react";

import { useUiLang } from "../../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const TEXT = {
  ru: {
    title: "\u0421\u0431\u0440\u043e\u0441 \u043f\u0430\u0440\u043e\u043b\u044f",
    subtitle: "\u041c\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u043c \u043f\u0438\u0441\u044c\u043c\u043e \u0441\u043e \u0441\u0441\u044b\u043b\u043a\u043e\u0439 \u0434\u043b\u044f \u0441\u0431\u0440\u043e\u0441\u0430.",
    email: "Email",
    send: "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c",
    sending: "\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u043c...",
    success:
      "\u0415\u0441\u043b\u0438 \u0442\u0430\u043a\u043e\u0439 email \u0435\u0441\u0442\u044c, \u043f\u0438\u0441\u044c\u043c\u043e \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e."
  },
  en: {
    title: "Password reset",
    subtitle: "We will send a reset link to your email.",
    email: "Email",
    send: "Send",
    sending: "Sending...",
    success: "If the email exists, a reset link has been sent."
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

export default function ForgotPage() {
  const { lang } = useUiLang();
  const uiLang = lang || "ru";
  const t = TEXT[uiLang] || TEXT.ru;
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");
    setSending(true);
    try {
      await postJson("/auth/request-password-reset", { email });
      setStatus(t.success);
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <main>
      <h1>{t.title}</h1>
      <p>{t.subtitle}</p>

      <form onSubmit={submit}>
        <div>
          <label>{t.email}</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={sending}>
          {sending ? t.sending : t.send}
        </button>
      </form>

      {status ? <p className="success">{status}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
