"use client";

import { useEffect, useMemo, useState } from "react";

import { getCookie, setCookie } from "./lib/client-cookies";
import TourOverlay from "./tour-overlay";
import { useUiLang } from "./ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const TEXT = {
  ru: {
    title: "Главная",
    tagline: "Небольшие шаги каждый день дают большой результат.",
    loading: "Загрузка...",
    stats: {
      known: "Слов знаю",
      days: "Дней учимся",
      learnToday: "Учить сегодня",
      reviewToday: "Повторить сегодня",
      available: "Доступно"
    },
    today: "Сегодня",
    learnButton: "Учить",
    reviewButton: "Повторять",
    chartTitle: "График дисциплины",
    chartDesc:
      "Ось X — время, ось Y — сколько слов вы знаете. Даже пара слов в день превращается в заметный рост.",
    chartNoData: "Пока нет данных для графика. Начни учить слова.",
    chartStart: "Было",
    chartNow: "Сейчас",
    chartDelta: "за",
    langRu: "Русский",
    langEn: "English",
    chartAria: "График количества выученных слов",
    sections: {
      title: "Разделы",
      weakTitle: "Слабые слова",
      weakDesc: "Слова, в которых чаще всего ошибаешься.",
      customTitle: "Мои слова",
      customDesc: "Личный список слов для изучения.",
      reportTitle: "Сообщить о проблеме",
      reportDesc: "Сообщить об ошибке в слове или переводе.",
      helpTitle: "Инструкция",
      helpDesc: "Подсказки и быстрый тур по сервису."
    },
    tour: {
      title: "Быстрый тур",
      stepLabel: "Шаг",
      back: "Назад",
      next: "Далее",
      done: "К сообществу",
      skip: "Завершить",
      steps: [
        {
          key: "stats",
          title: "Статистика",
          desc: "Сколько слов выучено и сколько дней учишься.",
          mobileDesc:
            "Здесь видно общий прогресс: сколько слов ты знаешь, сколько дней учишься и дневные цели."
        },
        {
          key: "today",
          title: "Сегодня",
          desc: "Запуск обучения и повторения на сегодня.",
          mobileDesc:
            "Кнопки запускают обучение и повторение на сегодня. Число рядом — сколько слов запланировано."
        },
        {
          key: "sections",
          title: "Разделы",
          desc: "Слабые слова, свои слова и сообщения об ошибках.",
          mobileDesc:
            "Быстрый доступ к слабым словам, твоим словам и репортам. Здесь же инструкция по сервису."
        },
        {
          key: "chart",
          title: "График дисциплины",
          desc: "Рост словаря по дням.",
          mobileDesc:
            "График показывает рост словарного запаса по дням, чтобы видеть дисциплину и темп."
        }
      ]
    }
},
  en: {
    title: "Home",
    tagline: "Small daily steps lead to a big result.",
    loading: "Loading...",
    stats: {
      known: "Words known",
      days: "Days learning",
      learnToday: "Learn today",
      reviewToday: "Review today",
      available: "Available"
    },
    today: "Today",
    learnButton: "Learn",
    reviewButton: "Review",
    chartTitle: "Discipline chart",
    chartDesc:
      "X axis is time, Y axis is how many words you know. Even a few words a day add up quickly.",
    chartNoData: "No data yet. Start learning words.",
    chartStart: "Start",
    chartNow: "Now",
    chartDelta: "in",
    langRu: "Русский",
    langEn: "English",
    chartAria: "Chart of learned words",
    sections: {
      title: "Sections",
      weakTitle: "Weak words",
      weakDesc: "Words where you make the most mistakes.",
      customTitle: "My words",
      customDesc: "Your personal words to learn.",
      reportTitle: "Report an issue",
      reportDesc: "Tell us about a wrong word or translation.",
      helpTitle: "Help & tour",
      helpDesc: "Instructions and a quick tour."
    },
    tour: {
      title: "Quick tour",
      stepLabel: "Step",
      back: "Back",
      next: "Next",
      done: "To community",
      skip: "End tour",
      steps: [
        {
          key: "stats",
          title: "Stats",
          desc: "Your progress and daily numbers.",
          mobileDesc:
            "See your overall progress: words known, days learning, and daily targets."
        },
        {
          key: "today",
          title: "Today",
          desc: "Start today's learning or review.",
          mobileDesc:
            "Use these buttons to start learning and review sessions. Numbers show today's plan."
        },
        {
          key: "sections",
          title: "Sections",
          desc: "Weak words, custom words, and reports.",
          mobileDesc:
            "Quick access to weak words, your custom list, and issue reports. Help is here too."
        },
        {
          key: "chart",
          title: "Discipline chart",
          desc: "See progress over time.",
          mobileDesc:
            "Track how your vocabulary grows day by day to see your consistency."
        }
      ]
    }
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

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [theme, setTheme] = useState(() => getCookie("theme") || "light");
  const { lang, setLang } = useUiLang();
  const interfaceLang = lang || "ru";
  const t = TEXT[interfaceLang] || TEXT.ru;
  const locale = interfaceLang === "en" ? "en-US" : "ru-RU";
  const wordsLabel = interfaceLang === "en" ? "words" : "слов";

  const goLearn = () => {
    window.location.href = "/learn";
  };

  const goReview = () => {
    window.location.href = "/review";
  };

  const continueToCommunity = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("tour_active", "1");
      window.localStorage.setItem("tour_step", "0");
      window.localStorage.setItem("tour_stage", "community");
    }
    window.location.href = "/community";
    return "continue";
  };


  const sections = [
    {
      href: "/stats",
      title: t.sections.weakTitle,
      desc: t.sections.weakDesc
    },
    {
      href: "/custom-words",
      title: t.sections.customTitle,
      desc: t.sections.customDesc
    },
    {
      href: "/reports",
      title: t.sections.reportTitle,
      desc: t.sections.reportDesc
    },
    {
      href: "/welcome",
      title: t.sections.helpTitle,
      desc: t.sections.helpDesc
    }
  ];
  const tourSteps = t.tour ? t.tour.steps || [] : [];
  const tourLabels = t.tour || {};

  useEffect(() => {
    let active = true;
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    getJson("/dashboard", token)
      .then((data) => {
        if (!active) {
          return;
        }
        setDashboard(data);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        const message = err.message || "Не удалось загрузить статистику";
        if (message === "Onboarding required") {
          window.location.href = "/onboarding";
          return;
        }
        if (message.includes("token") || message.includes("User not found")) {
          window.location.href = "/auth";
          return;
        }
        setError(message);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!dashboard) {
      return;
    }
    const nextLang = dashboard.interface_lang || interfaceLang || "ru";
    setLang(nextLang);
    const nextTheme = dashboard.theme || theme || "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("theme", nextTheme);
    setCookie("theme", nextTheme);
  }, [dashboard]);

  const formatShortDate = (value) => {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString(locale, { day: "2-digit", month: "short" });
  };

  const chart = useMemo(() => {
    if (!dashboard) {
      return null;
    }
    const series = dashboard.learned_series || [];
    if (!series.length) {
      return {
        points: [],
        width: 720,
        height: 260,
        padding: { top: 18, right: 20, bottom: 32, left: 48 },
        minValue: 0,
        maxValue: 0,
        range: 1,
        plotHeight: 0
      };
    }

    const totalLearned = series.reduce((sum, item) => sum + (item.count || 0), 0);
    const base = Math.max(0, (dashboard.known_words || 0) - totalLearned);

    let cumulative = base;
    const rawPoints = series.map((item) => {
      cumulative += item.count || 0;
      return {
        date: item.date,
        value: cumulative
      };
    });

    const values = rawPoints.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = Math.max(1, maxValue - minValue);

    const width = 720;
    const height = 260;
    const padding = { top: 18, right: 20, bottom: 32, left: 48 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const points = rawPoints.map((point, idx) => {
      const x =
        padding.left +
        (rawPoints.length <= 1 ? plotWidth / 2 : (idx / (rawPoints.length - 1)) * plotWidth);
      const y = padding.top + (1 - (point.value - minValue) / range) * plotHeight;
      return { ...point, x, y };
    });

    const line = points
      .map((point, idx) => `${idx === 0 ? "M" : "L"}${point.x} ${point.y}`)
      .join(" ");
    const baseY = padding.top + plotHeight;
    const area = `${line} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`;

    return {
      width,
      height,
      padding,
      points,
      line,
      area,
      minValue,
      maxValue,
      range,
      plotHeight
    };
  }, [dashboard]);

  const chartSummary =
    chart && chart.points.length
      ? {
          start: chart.points[0].value,
          end: chart.points[chart.points.length - 1].value,
          days: chart.points.length
        }
      : null;
  const chartDelta = chartSummary ? chartSummary.end - chartSummary.start : 0;

  const chartTicks = chart
    ? Array.from(
        new Set([
          chart.minValue,
          Math.round((chart.minValue + chart.maxValue) / 2),
          chart.maxValue
        ])
      )
        .map((value) => ({
          value,
          y:
            chart.padding.top +
            (1 - (value - chart.minValue) / chart.range) * chart.plotHeight
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  const startLabel =
    chart && chart.points.length ? formatShortDate(chart.points[0].date) : "";
  const endLabel =
    chart && chart.points.length
      ? formatShortDate(chart.points[chart.points.length - 1].date)
      : "";

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>
      </div>

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {dashboard ? (
        <>
          <div className="stats-grid" data-tour="stats">
            <div className="stat-card">
              <div className="stat-label">{t.stats.known}</div>
              <div className="stat-value">{dashboard.known_words}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t.stats.days}</div>
              <div className="stat-value">{dashboard.days_learning}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t.stats.learnToday}</div>
              <div className="stat-value">{dashboard.learn_today}</div>
              <div className="stat-sub">
                {t.stats.available}: {dashboard.learn_available}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t.stats.reviewToday}</div>
              <div className="stat-value">{dashboard.review_today}</div>
              <div className="stat-sub">
                {t.stats.available}: {dashboard.review_available}
              </div>
            </div>
          </div>

          <div className="panel" data-tour="today">
            <div className="panel-title">{t.today}</div>
            <div className="today-actions">
              <button type="button" className="today-action" onClick={goLearn}>
                <span className="today-action-label">{t.stats.learnToday}</span>
                <span className="today-action-count">
                  {dashboard.learn_today} {wordsLabel}
                </span>
              </button>
              <button type="button" className="today-action" onClick={goReview}>
                <span className="today-action-label">{t.stats.reviewToday}</span>
                <span className="today-action-count">
                  {dashboard.review_today} {wordsLabel}
                </span>
              </button>
            </div>
          </div>

          <div className="panel" data-tour="sections">
            <div className="panel-title">{t.sections.title}</div>
            <div className="card-list card-grid-2">
              {sections.map((item) => (
                <a key={item.href} className="card card-link" href={item.href}>
                  <div className="card-title">{item.title}</div>
                  <div className="card-sub">{item.desc}</div>
                </a>
              ))}
            </div>
          </div>

          <div className="panel" data-tour="chart">
            <div className="panel-title">{t.chartTitle}</div>
            <p className="muted">{t.chartDesc}</p>
            {chart && chart.points.length ? (
              <div className="chart">
                <svg
                  className="chart-svg"
                  viewBox={`0 0 ${chart.width} ${chart.height}`}
                  role="img"
                  aria-label={t.chartAria}
                >
                  <defs>
                    <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(59, 130, 246, 0.45)" />
                      <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
                    </linearGradient>
                  </defs>
                  <g className="chart-grid">
                    {chartTicks.map((tick) => (
                      <line
                        key={`grid-${tick.value}`}
                        x1={chart.padding.left}
                        x2={chart.width - chart.padding.right}
                        y1={tick.y}
                        y2={tick.y}
                      />
                    ))}
                  </g>
                  <path d={chart.area} className="chart-area" />
                  <path d={chart.line} className="chart-line" />
                  {chart.points.map((point) => (
                    <circle
                      key={point.date}
                      cx={point.x}
                      cy={point.y}
                      r={3.5}
                      className="chart-dot"
                    />
                  ))}
                  {chartTicks.map((tick) => (
                    <text
                      key={`label-${tick.value}`}
                      x={8}
                      y={tick.y + 4}
                      className="chart-axis-label"
                    >
                      {tick.value}
                    </text>
                  ))}
                </svg>
                <div className="chart-axis">
                  <span>{startLabel}</span>
                  <span>{endLabel}</span>
                </div>
                {chartSummary ? (
                  <div className="chart-summary">
                    <span>
                      {t.chartStart}: <strong>{chartSummary.start}</strong>
                    </span>
                    <span>
                      {t.chartNow}: <strong>{chartSummary.end}</strong>
                    </span>
                    <span>
                      +{chartDelta} {t.chartDelta} {chartSummary.days}{" "}
                      {interfaceLang === "en" ? "days" : "дней"}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="muted">{t.chartNoData}</p>
            )}
          </div>
          <TourOverlay steps={tourSteps} labels={tourLabels} stage="home" onFinish={continueToCommunity} />
        </>
      ) : null}
    </main>
  );
}
