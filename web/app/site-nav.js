"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { getCookie } from "./lib/client-cookies";
import { useUiLang } from "./ui-lang-context";

const TEXT = {
  ru: {
    home: "Главная",
    learn: "Учить",
    review: "Повторять",
    onboarding: "Онбординг",
    profile: "Профиль",
    settings: "Настройки",
    community: "Сообщество",
    stats: "Слабые слова",
    custom: "Мои слова",
    tech: "\u0422\u0435\u0445-\u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438",
    report: "\u0421\u043e\u043e\u0431\u0449\u0438\u0442\u044c",
    admin: "\u0410\u0434\u043c\u0438\u043d\u043a\u0430"
  },
  en: {
    home: "Home",
    learn: "Learn",
    review: "Review",
    onboarding: "Onboarding",
    profile: "Profile",
    settings: "Settings",
    community: "Community",
    stats: "Weak words",
    custom: "My words",
    tech: "Tech",
    report: "Report",
    admin: "Admin"
  }
};

const NAV_ITEMS = [
  { href: "/", key: "home" },
  { href: "/learn", key: "learn" },
  { href: "/review", key: "review" },
  { href: "/onboarding", key: "onboarding" },
  { href: "/profile", key: "profile" },
  { href: "/settings", key: "settings" },
  { href: "/tech", key: "tech" },
  { href: "/reports", key: "report" },
  { href: "/community", key: "community" },
  { href: "/stats", key: "stats" },
  { href: "/custom-words", key: "custom" },
  { href: "/admin", key: "admin", admin: true }
];

export default function SiteNav() {
  const pathname = usePathname() || "/";
  const { lang } = useUiLang();
  const t = TEXT[lang] || TEXT.ru;
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(getCookie("is_admin") === "1");
  }, [pathname]);

  const items = isAdmin ? NAV_ITEMS : NAV_ITEMS.filter((item) => !item.admin);

  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <a className="nav-brand" href="/">
          English Web
        </a>
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
      </div>
    </header>
  );
}
