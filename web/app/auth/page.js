"use client";

import { useState } from "react";

import { setCookie } from "../lib/client-cookies";
import { useUiLang } from "../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

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

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { lang, setLang } = useUiLang();
  const interfaceLang = lang || "ru";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = { email, password, interface_lang: interfaceLang };
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const data = await postJson(path, payload);
      setCookie("token", data.access_token);
      setLang(interfaceLang);
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Auth failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <h1>{mode === "login" ? "Login" : "Register"}</h1>
      <p>Choose interface language and sign in.</p>

      <form onSubmit={submit}>
        <div>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <div>
          <label>Interface language</label>
          <select value={interfaceLang} onChange={(event) => setLang(event.target.value)}>
            <option value="ru">ru</option>
            <option value="en">en</option>
          </select>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
        </button>
      </form>

      {error ? <p>{error}</p> : null}

      <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Create account" : "I already have an account"}
      </button>
    </main>
  );
}
