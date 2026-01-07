"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { getCookie, setCookie } from "./lib/client-cookies";
import { useUiLang } from "./ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const TEXT = {
  ru: {
    home: "Главная",
    community: "Сообщество",
    profile: "Профиль",
    admin: "Админка",
    theme: "Тема",
    themeLight: "Светлая",
    themeDark: "Темная"
  },
  en: {
    home: "Home",
    community: "Community",
    profile: "Profile",
    admin: "Admin",
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark"
  }
};

const NAV_ITEMS = [
  { href: "/", key: "home" },
  { href: "/community", key: "community" },
  { href: "/profile", key: "profile" },
  { href: "/admin", key: "admin", admin: true }
];

export default function SiteNav({ initialIsAdmin = false }) {
  const pathname = usePathname() || "/";
  const { lang } = useUiLang();
  const t = TEXT[lang] || TEXT.ru;
  const [isAdmin, setIsAdmin] = useState(
    () => Boolean(initialIsAdmin) || getCookie("is_admin") === "1"
  );
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const next = getCookie("is_admin") === "1";
    setIsAdmin((prev) => (prev === next ? prev : next));
  }, [pathname]);

  useEffect(() => {
    const stored =
      localStorage.getItem("theme") ||
      getCookie("theme") ||
      document.documentElement.dataset.theme;
    const nextTheme = stored === "dark" ? "dark" : "light";
    setTheme(nextTheme);
  }, []);

  const items = isAdmin ? NAV_ITEMS : NAV_ITEMS.filter((item) => !item.admin);
  const themeLabel = theme === "dark" ? t.themeDark : t.themeLight;

  const applyTheme = (nextTheme) => {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("theme", nextTheme);
    setCookie("theme", nextTheme);
  };

  const persistTheme = async (nextTheme) => {
    const token = getCookie("token");
    if (!token) {
      return;
    }
    try {
      await fetch(`${API_BASE}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ theme: nextTheme })
      });
    } catch (err) {
      console.warn("Theme update failed", err);
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    persistTheme(nextTheme);
  };

  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <a className="nav-brand" href="/">
          <img className="brand-logo" src="/brand/Recallio_main.png" alt="Recallio" />
          <img className="brand-mark" src="/brand/R_main.png" alt="Recallio" />
        </a>
        <div className="nav-actions">
          <nav className="nav-links" aria-label="Main">
            {items.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`nav-link${isActive ? " is-active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {t[item.key]}
                </a>
              );
            })}
          </nav>
          <button
            type="button"
            className={`theme-toggle${theme === "dark" ? " is-dark" : ""}`}
            onClick={toggleTheme}
            aria-label={`${t.theme}: ${themeLabel}`}
            title={`${t.theme}: ${themeLabel}`}
          >
            <span className="theme-toggle-track">
              <span className="theme-toggle-thumb" />
            </span>
            <span className="theme-toggle-text">{themeLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
