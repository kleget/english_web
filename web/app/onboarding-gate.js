"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { getCookie, setCookie } from "./lib/client-cookies";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const SKIP_PREFIXES = ["/auth", "/onboarding", "/welcome", "/u/"];

function shouldSkip(pathname) {
  if (!pathname) {
    return true;
  }
  if (pathname === "/u") {
    return true;
  }
  return SKIP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

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

export default function OnboardingGate() {
  const pathname = usePathname() || "/";
  const checkingRef = useRef(false);

  useEffect(() => {
    if (shouldSkip(pathname) || checkingRef.current) {
      return;
    }
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    checkingRef.current = true;
    getJson("/auth/me", token)
      .then((data) => {
        if (data && typeof data.is_admin === "boolean") {
          setCookie("is_admin", data.is_admin ? "1" : "0");
        }
        if (data && data.onboarding_done === false) {
          window.location.href = "/onboarding";
        }
      })
      .catch((err) => {
        const message = err.message || "";
        if (message.includes("token") || message.includes("User not found") || message.includes("inactive")) {
          window.location.href = "/auth";
        }
      })
      .finally(() => {
        checkingRef.current = false;
      });
  }, [pathname]);

  return null;
}
