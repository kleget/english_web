"use client";

import { useUiLang } from "./ui-lang-context";

const TEXT = {
  ru: {
    title: "Recallio",
    description:
      "Изучение слов без перегруза: карточки, тесты и повторения по уму.",
    developer: "Разработчик: Kleget",
    contacts: "Контакты разработчика",
    telegram: "Telegram",
    email: "Email",
    vk: "VK",
    rights: "Все права защищены"
  },
  en: {
    title: "Recallio",
    description:
      "Learn words without overload: cards, recall tests, and smart reviews.",
    developer: "Developer: Kleget",
    contacts: "Developer contacts",
    telegram: "Telegram",
    email: "Email",
    vk: "VK",
    rights: "All rights reserved"
  }
};

export default function Footer() {
  const { lang } = useUiLang();
  const uiLang = lang || "ru";
  const t = TEXT[uiLang] || TEXT.ru;
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-main">
          <div className="footer-title">{t.title}</div>
          <p className="footer-desc">{t.description}</p>
          <p className="footer-meta">{t.developer}</p>
        </div>
        <div className="footer-links">
          <div className="footer-links-title">{t.contacts}</div>
          <div className="footer-links-list">
            <a href="https://t.me/kleget" target="_blank" rel="noopener noreferrer">
              {t.telegram}
            </a>
            <a href="mailto:kleget_dev@mail.ru">{t.email}</a>
            <a href="https://vk.com/kleget" target="_blank" rel="noopener noreferrer">
              {t.vk}
            </a>
          </div>
          <div className="footer-rights">
            © {year} {t.title}. {t.rights}.
          </div>
        </div>
      </div>
    </footer>
  );
}
