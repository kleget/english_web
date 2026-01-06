"use client";

import { usePathname } from "next/navigation";

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
    tech: "\u0422\u0435\u0445-\u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438"
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
    tech: "Tech"
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
  { href: "/community", key: "community" },
  { href: "/stats", key: "stats" },
  { href: "/custom-words", key: "custom" }
];

export default function SiteNav() {
  const pathname = usePathname() || "/";
  const { lang } = useUiLang();
  const t = TEXT[lang] || TEXT.ru;

  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <a className="nav-brand" href="/">
          English Web
        </a>
        <nav className="nav-links" aria-label="Main">
          {NAV_ITEMS.map((item) => {
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
