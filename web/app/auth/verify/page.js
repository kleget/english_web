"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { getCookie } from "../../lib/client-cookies";
import { useUiLang } from "../../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const REDIRECT_SECONDS = 5;

const TEXT = {
  ru: {
    title: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435 \u043f\u043e\u0447\u0442\u044b",
    subtitle:
      "\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u043f\u0438\u0441\u044c\u043c\u043e \u0438 \u043f\u0435\u0440\u0435\u0439\u0434\u0438\u0442\u0435 \u043f\u043e \u0441\u0441\u044b\u043b\u043a\u0435. \u0415\u0441\u043b\u0438 \u043f\u0438\u0441\u044c\u043c\u0430 \u043d\u0435\u0442 \u2014 \u043e\u0442\u043f\u0440\u0430\u0432\u044c\u0442\u0435 \u043f\u043e\u0432\u0442\u043e\u0440\u043d\u043e.",
    email: "Email",
    send: "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043f\u0438\u0441\u044c\u043c\u043e",
    sending: "\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u043c...",
    verifying: "\u041f\u0440\u043e\u0432\u0435\u0440\u044f\u0435\u043c \u0441\u0441\u044b\u043b\u043a\u0443...",
    verifiedTitle: "\u041f\u043e\u0447\u0442\u0430 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0430",
    verifiedDesc: "\u0422\u0435\u043f\u0435\u0440\u044c \u043c\u043e\u0436\u043d\u043e \u0432\u043e\u0439\u0442\u0438 \u0432 \u0430\u043a\u043a\u0430\u0443\u043d\u0442.",
    redirectPrefix: "\u0410\u0432\u0442\u043e\u043f\u0435\u0440\u0435\u0445\u043e\u0434 \u0447\u0435\u0440\u0435\u0437",
    redirectSuffix: "\u0441\u0435\u043a.",
    loginNow: "\u0412\u043e\u0439\u0442\u0438 \u0441\u0435\u0439\u0447\u0430\u0441",
    resendOk: "\u041f\u0438\u0441\u044c\u043c\u043e \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e.",
    verifyError:
      "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c. \u0421\u0441\u044b\u043b\u043a\u0430 \u043d\u0435\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u0430 \u0438\u043b\u0438 \u0443\u0441\u0442\u0430\u0440\u0435\u043b\u0430."
  },
  en: {
    title: "Email verification",
    subtitle:
      "Open the email and follow the link. If the email did not arrive, send it again.",
    email: "Email",
    send: "Send email",
    sending: "Sending...",
    verifying: "Verifying link...",
    verifiedTitle: "Email confirmed",
    verifiedDesc: "Now you can sign in.",
    redirectPrefix: "Redirecting in",
    redirectSuffix: "sec.",
    loginNow: "Sign in now",
    resendOk: "Email sent.",
    verifyError: "Verification failed. The link is invalid or expired."
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

export default function VerifyPage() {
  const params = useSearchParams();
  const { lang } = useUiLang();
  const uiLang = lang || "ru";
  const t = TEXT[uiLang] || TEXT.ru;
  const statusParam = params.get("status") || "";
  const token = params.get("token") || "";
  const initialEmail = params.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [verifyStatus, setVerifyStatus] = useState("idle");
  const [verifyError, setVerifyError] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("");
  const [redirectLeft, setRedirectLeft] = useState(REDIRECT_SECONDS);
  const didVerifyRef = useRef(false);
  const redirectTarget = getCookie("token") ? "/" : "/auth";

  useEffect(() => {
    if (statusParam === "ok") {
      setVerifyStatus("verified");
      setVerifyError("");
      return;
    }
    if (statusParam === "error") {
      setVerifyStatus("error");
      setVerifyError(t.verifyError);
    }
  }, [statusParam, t.verifyError]);

  useEffect(() => {
    if (!token || statusParam || didVerifyRef.current) {
      return;
    }
    didVerifyRef.current = true;
    let active = true;
    setVerifyStatus("verifying");
    setVerifyError("");
    postJson("/auth/verify", { token })
      .then(() => {
        if (!active) {
          return;
        }
        setVerifyStatus("verified");
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setVerifyStatus("error");
        setVerifyError(err.message || t.verifyError);
      });
    return () => {
      active = false;
    };
  }, [token, t.verifyError]);

  useEffect(() => {
    if (verifyStatus !== "verified") {
      return;
    }
    setRedirectLeft(REDIRECT_SECONDS);
    const timerId = setInterval(() => {
          setRedirectLeft((prev) => {
            if (prev <= 1) {
              clearInterval(timerId);
              window.location.href = redirectTarget;
              return 0;
            }
            return prev - 1;
          });
    }, 1000);
    return () => clearInterval(timerId);
  }, [verifyStatus]);

  const resend = async (event) => {
    event.preventDefault();
    setNotice("");
    setNoticeType("");
    setSending(true);
    try {
      await postJson("/auth/request-verify", { email });
      setNotice(t.resendOk);
      setNoticeType("success");
    } catch (err) {
      setNotice(err.message || "Request failed");
      setNoticeType("error");
    } finally {
      setSending(false);
    }
  };

  return (
    <main>
      <h1>{t.title}</h1>
      <p>{t.subtitle}</p>

      {verifyStatus === "verifying" ? <p className="muted">{t.verifying}</p> : null}
      {verifyStatus === "verified" ? (
        <div className="panel">
          <div className="panel-title">{t.verifiedTitle}</div>
          <p className="muted">{t.verifiedDesc}</p>
          <p className="muted">
            {t.redirectPrefix} {redirectLeft} {t.redirectSuffix}
          </p>
          <button
            type="button"
            className="button-secondary"
            onClick={() => (window.location.href = redirectTarget)}
          >
            {t.loginNow}
          </button>
        </div>
      ) : null}
      {verifyStatus === "error" ? <p className="error">{verifyError}</p> : null}

      {verifyStatus !== "verified" ? (
        <form onSubmit={resend}>
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
      ) : null}

      {notice ? <p className={noticeType === "success" ? "success" : "error"}>{notice}</p> : null}
    </main>
  );
}
