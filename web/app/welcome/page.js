"use client";

import { useEffect, useMemo, useState } from "react";

import { getCookie } from "../lib/client-cookies";
import { useUiLang } from "../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const TEXT = {
  ru: {
    title: "Добро пожаловать в Recallio",
    tagline: "Коротко о том, как мы помогаем учить слова без перегруза.",
    loading: "Загрузка...",
    error: "Не удалось загрузить данные.",
    start: "Начать настройку",
    startTour: "Быстрый тур",
    goHome: "На главную",
    sections: {
      steps: "Как это работает",
      features: "Что внутри",
      habits: "Как получить результат"
    },
    checklist: {
      title: "Первые шаги",
      loading: "Обновляем чек-лист...",
      onboarding: "Настройка обучения пройдена",
      learned: "Выучено слов: {count}",
      custom: "Добавлено своих слов: {count}",
      done: "Готово",
      todo: "Впереди"
    },
    steps: [
      {
        title: "1. Выбираешь направление",
        desc: "Язык, сферы и сколько слов хочешь выучить."
      },
      {
        title: "2. Учишь короткими сессиями",
        desc: "Карточки + тест — минимум времени, максимум фокуса."
      },
      {
        title: "3. Повторяешь по расписанию",
        desc: "SRS напоминает слова именно тогда, когда нужно."
      }
    ],
    features: [
      {
        title: "Учить и повторять",
        desc: "Пачки слов на день и контрольный тест."
      },
      {
        title: "Слабые слова",
        desc: "Фокус на том, где больше всего ошибок."
      },
      {
        title: "Мои слова",
        desc: "Добавляй свои слова и учи их вместе с базой."
      },
      {
        title: "Статистика",
        desc: "Прогресс по дням и дисциплина в графике."
      },
      {
        title: "Сообщество",
        desc: "Лента, чат и челленджи для мотивации."
      },
      {
        title: "Уведомления",
        desc: "Email/Telegram напоминания о повторениях."
      }
    ],
    habits: [
      "5–10 минут в день важнее, чем редкие длинные сессии.",
      "Повторение сильнее нового материала — не пропускай ревью.",
      "Сферы можно менять, но лучше держать фокус 2–3 недели."
    ]
  },
  en: {
    title: "Welcome to Recallio",
    tagline: "A quick tour of how we help you learn words without overload.",
    loading: "Loading...",
    error: "Failed to load data.",
    start: "Start setup",
    startTour: "Quick tour",
    goHome: "Go to home",
    sections: {
      steps: "How it works",
      features: "What you get",
      habits: "How to get results"
    },
    checklist: {
      title: "Getting started",
      loading: "Updating checklist...",
      onboarding: "Setup completed",
      learned: "Words learned: {count}",
      custom: "Custom words added: {count}",
      done: "Done",
      todo: "Next"
    },
    steps: [
      {
        title: "1. Pick your direction",
        desc: "Language pair, domains, and word limits."
      },
      {
        title: "2. Learn in short sessions",
        desc: "Cards + a quick test to lock in memory."
      },
      {
        title: "3. Review on schedule",
        desc: "SRS reminds you exactly when needed."
      }
    ],
    features: [
      {
        title: "Learn & review",
        desc: "Daily batches with a control test."
      },
      {
        title: "Weak words",
        desc: "Focus on what you miss most."
      },
      {
        title: "My words",
        desc: "Add your own vocabulary and learn it together."
      },
      {
        title: "Stats",
        desc: "Day-by-day progress and discipline chart."
      },
      {
        title: "Community",
        desc: "Feed, chat, and challenges for motivation."
      },
      {
        title: "Notifications",
        desc: "Email/Telegram reminders for reviews."
      }
    ],
    habits: [
      "5–10 minutes daily beats rare long sessions.",
      "Review is more important than new words.",
      "Switching domains is ok, but keep focus for 2–3 weeks."
    ]
  }
};

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

export default function WelcomePage() {
  const { lang, setLang } = useUiLang();
  const uiLang = lang || "ru";
  const t = TEXT[uiLang] || TEXT.ru;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [checklist, setChecklist] = useState({ learned: 0, custom: 0 });
  const [checklistLoading, setChecklistLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    const load = async () => {
      try {
        const data = await getJson("/auth/me", token);
        if (!active) {
          return;
        }
        const interfaceLang = data.interface_lang === "en" ? "en" : "ru";
        setLang(interfaceLang);
        const isOnboarded = Boolean(data.onboarding_done);
        setOnboardingDone(isOnboarded);
        if (isOnboarded) {
          setChecklistLoading(true);
          const [dashboardResult, customResult] = await Promise.allSettled([
            getJson("/dashboard", token),
            getJson("/custom-words?limit=1", token)
          ]);
          if (!active) {
            return;
          }
          if (dashboardResult.status === "fulfilled") {
            setChecklist((prev) => ({
              ...prev,
              learned: dashboardResult.value.known_words || 0
            }));
          }
          if (customResult.status === "fulfilled") {
            setChecklist((prev) => ({
              ...prev,
              custom: Array.isArray(customResult.value) ? customResult.value.length : 0
            }));
          }
        }
      } catch (err) {
        if (!active) {
          return;
        }
        const message = err.message || t.error;
        if (message.includes("token") || message.includes("User not found")) {
          window.location.href = "/auth";
          return;
        }
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
          setChecklistLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const goOnboarding = () => {
    window.location.href = "/onboarding";
  };

  const goHome = () => {
    window.location.href = "/";
  };

  const startTour = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("tour_active", "1");
      window.localStorage.setItem("tour_step", "0");
      window.localStorage.setItem("tour_stage", "home");
    }
    window.location.href = "/";
  };

  const checklistItems = useMemo(() => {
    const learnedText = t.checklist.learned.replace("{count}", String(checklist.learned));
    const customText = t.checklist.custom.replace("{count}", String(checklist.custom));
    return [
      {
        key: "onboarding",
        done: onboardingDone,
        text: t.checklist.onboarding
      },
      {
        key: "learned",
        done: checklist.learned > 0,
        text: learnedText
      },
      {
        key: "custom",
        done: checklist.custom > 0,
        text: customText
      }
    ];
  }, [t, onboardingDone, checklist]);

  const stepCards = useMemo(
    () =>
      t.steps.map((item) => ({
        title: item.title,
        desc: item.desc
      })),
    [t]
  );

  const featureCards = useMemo(
    () =>
      t.features.map((item) => ({
        title: item.title,
        desc: item.desc
      })),
    [t]
  );

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>
        <div className="page-header-actions">
          {onboardingDone ? (
            <>
              <button type="button" className="button-secondary" onClick={startTour}>
                {t.startTour}
              </button>
              <button type="button" onClick={goHome}>
                {t.goHome}
              </button>
            </>
          ) : (
            <button type="button" onClick={goOnboarding}>
              {t.start}
            </button>
          )}
        </div>
      </div>

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <div className="panel">
            <div className="panel-title">{t.checklist.title}</div>
            {checklistLoading ? <p className="muted">{t.checklist.loading}</p> : null}
            <div className="check-list">
              {checklistItems.map((item) => (
                <div key={item.key} className="check-row">
                  <span className={`status-pill ${item.done ? "ok" : "warn"}`}>
                    {item.done ? t.checklist.done : t.checklist.todo}
                  </span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-title">{t.sections.steps}</div>
            <div className="feature-grid">
              {stepCards.map((item) => (
                <div key={item.title} className="feature-card">
                  <div className="feature-title">{item.title}</div>
                  <p className="feature-desc">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">{t.sections.features}</div>
            <div className="feature-grid">
              {featureCards.map((item) => (
                <div key={item.title} className="feature-card">
                  <div className="feature-title">{item.title}</div>
                  <p className="feature-desc">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">{t.sections.habits}</div>
            <div className="feature-grid">
              {t.habits.map((item) => (
                <div key={item} className="feature-card">
                  <div className="feature-title">{item}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
