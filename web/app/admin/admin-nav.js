"use client";

import { usePathname } from "next/navigation";

import { useUiLang } from "../ui-lang-context";

const TEXT = {
  ru: {
    overview: "Обзор",
    users: "Пользователи",
    audit: "Аудит",
    reports: "Репорты",
    support: "Поддержка"
  },
  en: {
    overview: "Overview",
    users: "Users",
    audit: "Audit",
    reports: "Reports",
    support: "Support"
  }
};

const NAV_ITEMS = [
  { href: "/admin", key: "overview" },
  { href: "/admin/users", key: "users" },
  { href: "/admin/reports", key: "reports" },
  { href: "/admin/support", key: "support" },
  { href: "/admin/audit", key: "audit" }
];

export default function AdminNav() {
  const pathname = usePathname() || "/admin";
  const { lang } = useUiLang();
  const t = TEXT[lang] || TEXT.ru;

  return (
    <nav className="admin-nav" aria-label="Admin">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <a
            key={item.href}
            href={item.href}
            className={`admin-nav-link${isActive ? " is-active" : ""}`}
          >
            {t[item.key]}
          </a>
        );
      })}
    </nav>
  );
}
