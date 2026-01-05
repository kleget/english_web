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
    settings: "Настройки"
  },
  en: {
    home: "Home",
    learn: "Learn",
    review: "Review",
    onboarding: "Onboarding",
    profile: "Profile",
    settings: "Settings"
  }
};

const NAV_ITEMS = [
  { href: "/", key: "home" },
  { href: "/learn", key: "learn" },
  { href: "/review", key: "review" },
  { href: "/onboarding", key: "onboarding" },
  { href: "/profile", key: "profile" },
  { href: "/settings", key: "settings" }
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
