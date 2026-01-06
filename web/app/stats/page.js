"use client";

import { useEffect, useMemo, useState } from "react";

import { getCookie } from "../lib/client-cookies";
import { useUiLang } from "../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const DEFAULT_LIMIT = 100;

const TEXT = {
  ru: {
    title: "Слабые слова",
    tagline: "Слова, в которых чаще всего ошибаешься.",
    loading: "Загрузка...",
    error: "Не удалось загрузить статистику",
    empty: "Пока нет ошибок для статистики.",
    refresh: "Обновить",
    accuracy: "Точность",
    wrong: "Ошибки",
    correct: "Верно",
    nextReview: "След. повтор",
    learnedAt: "Выучено",
    sortLabel: "Сортировка",
    sortWrong: "По ошибкам",
    sortCorrect: "По верности",
    sortAccuracy: "По точности",
    sortAlpha: "По алфавиту",
    sortAsc: "По возрастанию",
    sortDesc: "По убыванию",
    total: "Всего",
    shown: "Показано"
  },
  en: {
    title: "Weak words",
    tagline: "Words you miss most often.",
    loading: "Loading...",
    error: "Failed to load stats",
    empty: "No error stats yet.",
    refresh: "Refresh",
    accuracy: "Accuracy",
    wrong: "Wrong",
    correct: "Correct",
    nextReview: "Next review",
    learnedAt: "Learned",
    sortLabel: "Sort",
    sortWrong: "By errors",
    sortCorrect: "By correct",
    sortAccuracy: "By accuracy",
    sortAlpha: "Alphabetical",
    sortAsc: "Ascending",
    sortDesc: "Descending",
    total: "Total",
    shown: "Shown"
  }
};

function formatDate(value, locale) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(locale);
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

export default function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [sortKey, setSortKey] = useState("wrong");
  const [sortDir, setSortDir] = useState("desc");
  const { lang } = useUiLang();
  const uiLang = lang === "en" ? "en" : "ru";
  const t = TEXT[uiLang] || TEXT.ru;
  const locale = uiLang === "en" ? "en-US" : "ru-RU";

  useEffect(() => {
    setSortDir(sortKey === "alpha" ? "asc" : "desc");
  }, [sortKey]);

  const loadStats = async () => {
    setLoading(true);
    setError("");
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    try {
      const data = await getJson(`/stats/weak-words?limit=${DEFAULT_LIMIT}`, token);
      if (Array.isArray(data)) {
        setItems(data);
        setTotal(data.length);
      } else {
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number.isFinite(data?.total) ? data.total : 0);
      }
    } catch (err) {
      setError(err.message || t.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const sortOptions = [
    { value: "wrong", label: t.sortWrong },
    { value: "correct", label: t.sortCorrect },
    { value: "accuracy", label: t.sortAccuracy },
    { value: "alpha", label: t.sortAlpha }
  ];

  const sortedItems = useMemo(() => {
    const data = [...items];
    data.sort((a, b) => {
      let compare = 0;
      if (sortKey === "alpha") {
        compare = String(a.word || "").localeCompare(String(b.word || ""), locale, {
          sensitivity: "base"
        });
      } else if (sortKey === "accuracy") {
        compare = (a.accuracy || 0) - (b.accuracy || 0);
      } else if (sortKey === "correct") {
        compare = (a.correct_count || 0) - (b.correct_count || 0);
      } else {
        compare = (a.wrong_count || 0) - (b.wrong_count || 0);
      }
      if (compare === 0) {
        compare = String(a.word || "").localeCompare(String(b.word || ""), locale, {
          sensitivity: "base"
        });
      }
      return sortDir === "asc" ? compare : -compare;
    });
    return data;
  }, [items, sortKey, sortDir, locale]);

  const toggleSortDir = () => {
    setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const showToolbar = !loading && !error && (total > 0 || items.length > 0);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="button-secondary" onClick={loadStats}>
            {t.refresh}
          </button>
        </div>
      </div>

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="panel">
          <p className="muted">{t.empty}</p>
        </div>
      ) : null}

      {showToolbar ? (
        <div className="weak-toolbar">
          <div className="weak-count">
            <span>
              {t.total}: <strong>{total}</strong>
            </span>
            <span>
              {t.shown}: <strong>{sortedItems.length}</strong>
            </span>
          </div>
          <div className="weak-sorts">
            <div className="weak-sort-field">
              <span className="weak-sort-label">{t.sortLabel}</span>
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="button-secondary" onClick={toggleSortDir}>
              {sortDir === "asc" ? t.sortAsc : t.sortDesc}
            </button>
          </div>
        </div>
      ) : null}

      {sortedItems.length ? (
        <div className="weak-list">
          {sortedItems.map((item) => (
            <div key={item.word_id} className="weak-card">
              <div>
                <div className="weak-word">{item.word}</div>
                <div className="weak-translation">
                  {item.translations && item.translations.length
                    ? item.translations.slice(0, 3).join(", ")
                    : "-"}
                </div>
              </div>
              <div className="weak-metrics">
                <div className="weak-badge">
                  {t.wrong}: {item.wrong_count}
                </div>
                <div className="weak-badge">
                  {t.correct}: {item.correct_count}
                </div>
                <div className="weak-badge">
                  {t.accuracy}: {Math.round((item.accuracy || 0) * 100)}%
                </div>
              </div>
              <div className="weak-meta">
                <span>
                  {t.learnedAt}: {formatDate(item.learned_at, locale)}
                </span>
                <span>
                  {t.nextReview}: {formatDate(item.next_review_at, locale)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </main>
  );
}
