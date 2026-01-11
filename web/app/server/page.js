"use client";

import { useUiLang } from "../ui-lang-context";

const TEXT = {
  ru: {
    title: "О сервере",
    subtitle: "Коротко о том, где и как работает Recallio.",
    stackTitle: "Инфраструктура",
    stack: [
      {
        title: "VPS + Linux",
        desc: "Проект работает на отдельном VPS под Linux."
      },
      {
        title: "Nginx",
        desc: "Обрабатывает HTTPS и проксирует запросы к API и веб‑интерфейсу."
      },
      {
        title: "FastAPI + Uvicorn",
        desc: "Серверная логика и API."
      },
      {
        title: "Next.js",
        desc: "Веб‑интерфейс и клиентская часть."
      },
      {
        title: "PostgreSQL + Redis",
        desc: "Хранение данных и вспомогательные очереди."
      }
    ],
    dataTitle: "Какие данные хранятся",
    data: [
      {
        title: "Аккаунт",
        desc: "Email и настройки профиля/интерфейса."
      },
      {
        title: "Обучение",
        desc: "Выбранные сферы, слова для изучения и повторений."
      },
      {
        title: "Обратная связь",
        desc: "Сообщения о проблемах в словах и переводах."
      }
    ],
    statusTitle: "Статус проекта",
    status: [
      {
        title: "Пет‑проект",
        desc: "Сервис в активной разработке, возможны изменения и сбои."
      },
      {
        title: "Связь",
        desc: "Контакты разработчика — в подвале сайта."
      }
    ]
  },
  en: {
    title: "Server info",
    subtitle: "A short summary of how Recallio runs.",
    stackTitle: "Infrastructure",
    stack: [
      {
        title: "VPS + Linux",
        desc: "Runs on a dedicated Linux VPS."
      },
      {
        title: "Nginx",
        desc: "Handles HTTPS and proxies API/Web traffic."
      },
      {
        title: "FastAPI + Uvicorn",
        desc: "Backend logic and API."
      },
      {
        title: "Next.js",
        desc: "Web interface and client app."
      },
      {
        title: "PostgreSQL + Redis",
        desc: "Data storage and helper queues."
      }
    ],
    dataTitle: "Stored data",
    data: [
      {
        title: "Account",
        desc: "Email and profile/interface settings."
      },
      {
        title: "Learning",
        desc: "Selected domains, words to learn and review."
      },
      {
        title: "Feedback",
        desc: "Reports about words or translations."
      }
    ],
    statusTitle: "Project status",
    status: [
      {
        title: "Pet project",
        desc: "In active development, changes and outages are possible."
      },
      {
        title: "Contact",
        desc: "Developer contacts are listed in the footer."
      }
    ]
  }
};

export default function ServerPage() {
  const { lang } = useUiLang();
  const uiLang = lang || "ru";
  const t = TEXT[uiLang] || TEXT.ru;

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-title">{t.stackTitle}</div>
        <div className="feature-grid">
          {t.stack.map((item) => (
            <div className="feature-card" key={item.title}>
              <div className="feature-title">{item.title}</div>
              <p className="feature-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">{t.dataTitle}</div>
        <div className="feature-grid">
          {t.data.map((item) => (
            <div className="feature-card" key={item.title}>
              <div className="feature-title">{item.title}</div>
              <p className="feature-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">{t.statusTitle}</div>
        <div className="feature-grid">
          {t.status.map((item) => (
            <div className="feature-card" key={item.title}>
              <div className="feature-title">{item.title}</div>
              <p className="feature-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
