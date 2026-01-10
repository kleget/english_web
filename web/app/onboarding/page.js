"use client";

import { useEffect, useMemo, useState } from "react";

import { getCookie } from "../lib/client-cookies";
import { useUiLang } from "../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const CORPUS_NAME_MAP = {
  agronomandagricult: {
    ru: "Агрономия и сельское хозяйство",
    en: "Agronomy and Agriculture"
  },
  biologicalsciences: {
    ru: "Биологические науки",
    en: "Biological Sciences"
  },
  chemicalsciences: {
    ru: "Химические науки",
    en: "Chemical Sciences"
  },
  economicsciences: {
    ru: "Экономические науки",
    en: "Economic Sciences"
  },
  engineeringsciences: {
    ru: "Инженерные науки",
    en: "Engineering Sciences"
  },
  geosciences: {
    ru: "Науки о Земле",
    en: "Geosciences"
  },
  humanities: {
    ru: "Гуманитарные науки",
    en: "Humanities"
  },
  it: {
    ru: "Информационные технологии",
    en: "Information Technology"
  },
  mathematicalscience: {
    ru: "Математические науки",
    en: "Mathematical Sciences"
  },
  medicalbiomedical: {
    ru: "Медицинские и биомедицинские науки",
    en: "Medical and Biomedical Sciences"
  },
  nonscientificenglish: {
    ru: "Общий английский",
    en: "General English"
  },
  nonscientificrussian: {
    ru: "Общий русский",
    en: "General Russian"
  },
  physicalsciences: {
    ru: "Физические науки",
    en: "Physical Sciences"
  },
  psychologyandcognitive: {
    ru: "Психология и когнитивные науки",
    en: "Psychology and Cognitive Sciences"
  },
  socialsciences: {
    ru: "Социальные науки",
    en: "Social Sciences"
  }
};

const TEXT = {
  ru: {
    title: "Настройка обучения",
    tagline: "Настрой обучение под себя: язык, ритм и сферы.",
    loading: "Загрузка...",
    languages: {
      title: "Языки",
      hint: "Выбери направление обучения.",
      native: "Я знаю",
      target: "Изучаю"
    },
    settings: {
      title: "Ритм обучения",
      dailyNew: "Новых слов в день",
      dailyReview: "Повторений в день",
      batch: "Размер набора",
      dailyNewHint: "Сколько новых слов добавлять ежедневно.",
      dailyReviewHint: "Сколько слов повторять ежедневно.",
      batchHint: "Сколько карточек в одном подходе."
    },
    corpora: {
      title: "Сферы",
      hint: "Выбери области, откуда брать слова. Можно несколько.",
      empty: "Нет сфер для выбранного направления.",
      selected: "Выбрано сфер",
      badge: "Выбрано",
      words: "слов",
      limit: "Лимит слов",
      limitHint: "Выберите количество слов для этой сферы.",
      all: "Все слова"
    },
    actions: {
      save: "Сохранить настройки",
      saving: "Сохраняю...",
      saved: "Настройки сохранены.",
      saveError: "Не удалось сохранить настройки",
      goHome: "На главную",
      corporaRequired: "Нужно выбрать хотя бы одну сферу."
    },
    preview: {
      button: "Слова",
      title: "Слова из сферы",
      subtitle: "Первые {limit} слов по частоте",
      loading: "Загружаю слова...",
      error: "Не удалось загрузить слова",
      empty: "Нет слов для предпросмотра.",
      close: "Закрыть",
      more: "Показать еще",
      count: "Частота",
      noTranslation: "Перевод не найден"
    },
    langRu: "Русский",
    langEn: "English",
    errorLoad: "Не удалось загрузить данные."
  },
  en: {
    title: "Learning setup",
    tagline: "Set up your learning: language, pace, and corpora.",
    loading: "Loading...",
    languages: {
      title: "Languages",
      hint: "Choose the learning direction.",
      native: "I know",
      target: "Learning"
    },
    settings: {
      title: "Learning pace",
      dailyNew: "New words per day",
      dailyReview: "Reviews per day",
      batch: "Batch size",
      dailyNewHint: "How many new words to add daily.",
      dailyReviewHint: "How many words to review daily.",
      batchHint: "How many cards in one session."
    },
    corpora: {
      title: "Corpora",
      hint: "Pick areas you want to learn from. You can select multiple.",
      empty: "No corpora for this language pair.",
      selected: "Corpora selected",
      badge: "Selected",
      words: "words",
      limit: "Word limit",
      limitHint: "Choose how many words to take from this corpus.",
      all: "All words"
    },
    actions: {
      save: "Save settings",
      saving: "Saving...",
      saved: "Settings saved.",
      saveError: "Failed to save settings",
      goHome: "Home",
      corporaRequired: "Select at least one corpus."
    },
    preview: {
      button: "Preview words",
      title: "Words in corpus",
      subtitle: "Top {limit} by frequency",
      loading: "Loading words...",
      error: "Failed to load words",
      empty: "No words to preview.",
      close: "Close",
      more: "Load more",
      count: "Frequency",
      noTranslation: "No translation"
    },
    langRu: "Russian",
    langEn: "English",
    errorLoad: "Failed to load data."
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

async function postJson(path, payload, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
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

function normalizeCorpusKey(corpus) {
  const raw = (corpus?.slug || corpus?.name || "").toString();
  if (!raw) {
    return "";
  }
  return raw.replace(/_(ru|en)_(ru|en)$/i, "").toLowerCase();
}

function getCorpusLabel(corpus, uiLang) {
  const key = normalizeCorpusKey(corpus);
  const entry = key ? CORPUS_NAME_MAP[key] : null;
  if (entry) {
    return entry[uiLang] || entry.en || entry.ru;
  }
  return corpus?.name || corpus?.slug || "";
}

function clampNumber(value, minValue, maxValue) {
  const safe = Math.round(value);
  return Math.min(maxValue, Math.max(minValue, safe));
}

const DEFAULT_CORPUS_LIMIT = 300;

function getDefaultCorpusLimit(total) {
  if (!Number.isFinite(total) || total <= 0) {
    return DEFAULT_CORPUS_LIMIT;
  }
  return Math.min(total, DEFAULT_CORPUS_LIMIT);
}

function normalizeLimit(value, total) {
  if (!Number.isFinite(value) || value <= 0) {
    return getDefaultCorpusLimit(total);
  }
  let safe = Math.round(value);
  if (Number.isFinite(total) && total > 0) {
    safe = Math.min(safe, total);
  }
  return Math.max(1, safe);
}

function buildLimitPresets(total, t) {
  const presets = [];
  const seen = new Set();
  const safeTotal = Number.isFinite(total) && total > 0 ? total : null;
  [100, 300, 500, 1000].forEach((value) => {
    const limit = safeTotal ? Math.min(value, safeTotal) : value;
    if (!limit || seen.has(limit)) {
      return;
    }
    seen.add(limit);
    presets.push({ value: limit, label: String(limit) });
  });
  if (safeTotal) {
    if (seen.has(safeTotal)) {
      presets.forEach((item) => {
        if (item.value === safeTotal) {
          item.label = t.corpora.all;
        }
      });
    } else {
      presets.push({ value: safeTotal, label: t.corpora.all });
    }
  }
  return presets;
}

export default function OnboardingPage() {
  const { lang, setLang } = useUiLang();
  const uiLang = lang || "ru";
  const [nativeLang, setNativeLang] = useState("ru");
  const [targetLang, setTargetLang] = useState("en");
  const [dailyNew, setDailyNew] = useState(5);
  const [dailyReview, setDailyReview] = useState(10);
  const [learnBatch, setLearnBatch] = useState(5);
  const [corpora, setCorpora] = useState([]);
  const [selected, setSelected] = useState({});
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [corporaLoading, setCorporaLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCorpus, setPreviewCorpus] = useState(null);
  const [previewWords, setPreviewWords] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewLimit, setPreviewLimit] = useState(20);

  const t = TEXT[uiLang] || TEXT.ru;

  useEffect(() => {
    const tokenValue = getCookie("token");
    if (!tokenValue) {
      window.location.href = "/auth";
      return;
    }
    setToken(tokenValue);
    Promise.all([getJson("/auth/me", tokenValue), getJson("/onboarding", tokenValue)])
      .then(([me, onboarding]) => {
        const interfaceLang = me.interface_lang === "en" ? "en" : "ru";
        setLang(interfaceLang);
        const native = me.native_lang || onboarding.native_lang;
        const target = me.target_lang || onboarding.target_lang;
        if (native) {
          setNativeLang(native);
        }
        if (target) {
          setTargetLang(target);
        }
        setOnboardingDone(Boolean(me.onboarding_done || onboarding.onboarding_done));
        if (Number.isFinite(onboarding.daily_new_words)) {
          setDailyNew(onboarding.daily_new_words);
        }
        if (Number.isFinite(onboarding.daily_review_words)) {
          setDailyReview(onboarding.daily_review_words);
        }
        if (Number.isFinite(onboarding.learn_batch_size)) {
          setLearnBatch(onboarding.learn_batch_size);
        }
        if (Array.isArray(onboarding.corpora)) {
          const selectedMap = {};
          onboarding.corpora.forEach((item) => {
            if (!item || typeof item.corpus_id !== "number") {
              return;
            }
            selectedMap[item.corpus_id] = {
              target_word_limit: item.target_word_limit || 0,
              enabled: item.enabled !== false
            };
          });
          setSelected(selectedMap);
        }
      })
      .catch((err) => {
        const message = err.message || t.errorLoad;
        if (message.includes("token") || message.includes("User not found")) {
          window.location.href = "/auth";
          return;
        }
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }
    setCorporaLoading(true);
    setError("");
    getJson(`/corpora?source_lang=${nativeLang}&target_lang=${targetLang}`, token)
      .then((data) => {
        setCorpora(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        setError(err.message || t.errorLoad);
      })
      .finally(() => {
        setCorporaLoading(false);
      });
  }, [token, nativeLang, targetLang, t.errorLoad]);

  useEffect(() => {
    if (!corpora.length) {
      return;
    }
    setSelected((prev) => {
      let changed = false;
      const next = { ...prev };
      corpora.forEach((corpus) => {
        const current = next[corpus.id];
        if (!current) {
          return;
        }
        const normalized = normalizeLimit(current.target_word_limit, corpus.words_total);
        if (current.target_word_limit !== normalized) {
          next[corpus.id] = { ...current, target_word_limit: normalized };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [corpora]);

  useEffect(() => {
    setSaveStatus("");
    setSaveError("");
  }, [nativeLang, targetLang, dailyNew, dailyReview, learnBatch, selected]);

  useEffect(() => {
    if (!previewOpen) {
      setPreviewWords([]);
      setPreviewError("");
      setPreviewCorpus(null);
      setPreviewLimit(20);
    }
  }, [previewOpen]);

  const selectedCount = useMemo(() => Object.keys(selected).length, [selected]);

  const formatLang = (value) => (value === "en" ? t.langEn : t.langRu);

  const updateNative = (value) => {
    const safe = value === "en" ? "en" : "ru";
    if (safe === nativeLang) {
      return;
    }
    setNativeLang(safe);
    if (safe === targetLang) {
      setTargetLang(safe === "ru" ? "en" : "ru");
    }
    setSelected({});
  };

  const updateTarget = (value) => {
    const safe = value === "en" ? "en" : "ru";
    if (safe === targetLang) {
      return;
    }
    setTargetLang(safe);
    if (safe === nativeLang) {
      setNativeLang(safe === "ru" ? "en" : "ru");
    }
    setSelected({});
  };

  const toggleCorpus = (corpus) => {
    const corpusId = corpus.id;
    const defaultLimit = getDefaultCorpusLimit(corpus.words_total);
    setSelected((prev) => {
      const next = { ...prev };
      if (next[corpusId]) {
        delete next[corpusId];
        return next;
      }
      next[corpusId] = { target_word_limit: defaultLimit, enabled: true };
      return next;
    });
  };

  const updateLimit = (corpusId, value, maxValue) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }
    const nextValue = normalizeLimit(parsed, maxValue);
    setSelected((prev) => ({
      ...prev,
      [corpusId]: { ...(prev[corpusId] || { enabled: true }), target_word_limit: nextValue }
    }));
  };

  const applyOnboarding = async () => {
    setSaveStatus("");
    setSaveError("");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    const wasOnboarded = onboardingDone;
    const corporaMap = new Map(corpora.map((item) => [item.id, item]));
    const corporaPayload = Object.entries(selected).map(([id, item]) => {
      const corpusId = Number(id);
      const corpus = corporaMap.get(corpusId);
      const total = corpus?.words_total ?? 0;
      return {
        corpus_id: corpusId,
        target_word_limit: normalizeLimit(item.target_word_limit, total),
        enabled: item.enabled !== false
      };
    });
    if (!corporaPayload.length) {
      setSaveError(t.actions.corporaRequired);
      return;
    }
    setSaving(true);
    try {
      await postJson(
        "/onboarding",
        {
          native_lang: nativeLang,
          target_lang: targetLang,
          daily_new_words: dailyNew,
          daily_review_words: dailyReview,
          learn_batch_size: learnBatch,
          corpora: corporaPayload
        },
        token
      );
      setSaveStatus(t.actions.saved);
      setOnboardingDone(true);
      if (!wasOnboarded) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("tour_active", "1");
          window.localStorage.setItem("tour_step", "0");
          window.localStorage.setItem("tour_stage", "home");
        }
        setTimeout(() => {
          window.location.href = "/";
        }, 400);
      }
    } catch (err) {
      setSaveError(err.message || t.actions.saveError);
    } finally {
      setSaving(false);
    }
  };

  const fetchPreview = async (corpusId, limitValue) => {
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const params = new URLSearchParams({
        limit: String(limitValue),
        source_lang: nativeLang,
        target_lang: targetLang
      });
      const data = await getJson(`/corpora/${corpusId}/preview?${params.toString()}`, token);
      setPreviewWords(Array.isArray(data.words) ? data.words : []);
      setPreviewLimit(limitValue);
    } catch (err) {
      setPreviewError(err.message || t.preview.error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const openPreview = (corpus) => {
    setPreviewCorpus(corpus);
    setPreviewOpen(true);
    fetchPreview(corpus.id, 20);
  };

  const closePreview = () => {
    setPreviewOpen(false);
  };

  const loadMorePreview = () => {
    if (!previewCorpus) {
      return;
    }
    const nextLimit = Math.min(previewLimit + 20, 100);
    fetchPreview(previewCorpus.id, nextLimit);
  };

  const adjustValue = (setter, value, step, minValue, maxValue) => {
    setter(clampNumber(value + step, minValue, maxValue));
  };

  const handleInputChange = (setter, event, minValue, maxValue) => {
    const nextValue = event.target.valueAsNumber;
    if (Number.isNaN(nextValue)) {
      return;
    }
    setter(clampNumber(nextValue, minValue, maxValue));
  };

  const goHome = () => {
    window.location.href = "/";
  };

  const previewSubtitle = previewCorpus
    ? t.preview.subtitle.replace("{limit}", previewLimit)
    : "";
  const previewTitle = previewCorpus ? getCorpusLabel(previewCorpus, uiLang) : t.preview.title;
  const languagePair = `${nativeLang.toUpperCase()} - ${targetLang.toUpperCase()}`;
  const canLoadMore =
    previewWords.length >= previewLimit && previewLimit < 100 && !previewLoading;

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="button-secondary" onClick={goHome}>
            {t.actions.goHome}
          </button>
        </div>
      </div>

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading ? (
        <div className="tab-panel onboarding-shell">
          <div className="panel">
            <div className="panel-title">{t.languages.title}</div>
            <p className="muted">{t.languages.hint}</p>
            <div className="language-grid">
              <div className="language-card">
                <div className="language-title">{t.languages.native}</div>
                <div className="segmented">
                  <button
                    type="button"
                    className={nativeLang === "ru" ? "is-active" : ""}
                    onClick={() => updateNative("ru")}
                  >
                    {t.langRu}
                  </button>
                  <button
                    type="button"
                    className={nativeLang === "en" ? "is-active" : ""}
                    onClick={() => updateNative("en")}
                  >
                    {t.langEn}
                  </button>
                </div>
              </div>
              <div className="language-card">
                <div className="language-title">{t.languages.target}</div>
                <div className="segmented">
                  <button
                    type="button"
                    className={targetLang === "ru" ? "is-active" : ""}
                    onClick={() => updateTarget("ru")}
                  >
                    {t.langRu}
                  </button>
                  <button
                    type="button"
                    className={targetLang === "en" ? "is-active" : ""}
                    onClick={() => updateTarget("en")}
                  >
                    {t.langEn}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">{t.settings.title}</div>
            <div className="settings-grid">
              <div className="setting-card">
                <div className="setting-title">{t.settings.dailyNew}</div>
                <div className="setting-desc">{t.settings.dailyNewHint}</div>
                <div className="stepper">
                  <button
                    type="button"
                    className="button-secondary stepper-button"
                    onClick={() => adjustValue(setDailyNew, dailyNew, -1, 1, 50)}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={dailyNew}
                    onChange={(event) => handleInputChange(setDailyNew, event, 1, 50)}
                  />
                  <button
                    type="button"
                    className="button-secondary stepper-button"
                    onClick={() => adjustValue(setDailyNew, dailyNew, 1, 1, 50)}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="setting-card">
                <div className="setting-title">{t.settings.dailyReview}</div>
                <div className="setting-desc">{t.settings.dailyReviewHint}</div>
                <div className="stepper">
                  <button
                    type="button"
                    className="button-secondary stepper-button"
                    onClick={() => adjustValue(setDailyReview, dailyReview, -1, 1, 200)}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={dailyReview}
                    onChange={(event) => handleInputChange(setDailyReview, event, 1, 200)}
                  />
                  <button
                    type="button"
                    className="button-secondary stepper-button"
                    onClick={() => adjustValue(setDailyReview, dailyReview, 1, 1, 200)}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="setting-card">
                <div className="setting-title">{t.settings.batch}</div>
                <div className="setting-desc">{t.settings.batchHint}</div>
                <div className="stepper">
                  <button
                    type="button"
                    className="button-secondary stepper-button"
                    onClick={() => adjustValue(setLearnBatch, learnBatch, -1, 1, 20)}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={learnBatch}
                    onChange={(event) => handleInputChange(setLearnBatch, event, 1, 20)}
                  />
                  <button
                    type="button"
                    className="button-secondary stepper-button"
                    onClick={() => adjustValue(setLearnBatch, learnBatch, 1, 1, 20)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">{t.corpora.title}</div>
            <p className="muted">{t.corpora.hint}</p>
            {corporaLoading ? <p className="muted">{t.loading}</p> : null}
            {!corporaLoading && corpora.length === 0 ? (
              <p className="muted">{t.corpora.empty}</p>
            ) : null}
            {corpora.length ? (
              <>
                <div className="corpora-grid">
                  {corpora.map((corpus) => {
                    const isSelected = Boolean(selected[corpus.id]);
                    const rawLimit = selected[corpus.id]?.target_word_limit;
                    const limitValue = isSelected
                      ? normalizeLimit(rawLimit, corpus.words_total)
                      : 0;
                    const corpusLabel = getCorpusLabel(corpus, uiLang);
                    const presets = buildLimitPresets(corpus.words_total, t);
                    const stepValue = Math.max(
                      1,
                      Math.round(((corpus.words_total || DEFAULT_CORPUS_LIMIT) / 20) || 1)
                    );
                    return (
                      <div
                        key={corpus.id}
                        className={`corpus-card ${isSelected ? "is-selected" : ""}`}
                        onClick={() => toggleCorpus(corpus)}
                      >
                        <div className="corpus-header">
                          <div className="corpus-title">{corpusLabel}</div>
                          {isSelected ? (
                            <span className="corpus-badge">{t.corpora.badge}</span>
                          ) : null}
                        </div>
                        <div className="corpus-meta">
                          <span>
                            {corpus.words_total} {t.corpora.words}
                          </span>
                          <span>
                            {languagePair}
                          </span>
                        </div>
                        <div
                          className="corpus-actions"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="button-secondary corpus-preview-button"
                            onClick={() => openPreview(corpus)}
                          >
                            {t.preview.button}
                          </button>
                        </div>
                        {isSelected ? (
                          <div
                            className="corpus-limit"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <label>{t.corpora.limit}</label>
                            <div className="limit-stepper">
                              <button
                                type="button"
                                className="button-secondary stepper-button"
                                onClick={() =>
                                  updateLimit(
                                    corpus.id,
                                    limitValue - stepValue,
                                    corpus.words_total
                                  )
                                }
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={corpus.words_total}
                                value={limitValue}
                                onFocus={(event) => event.target.select()}
                                onChange={(event) =>
                                  updateLimit(corpus.id, event.target.value, corpus.words_total)
                                }
                              />
                              <button
                                type="button"
                                className="button-secondary stepper-button"
                                onClick={() =>
                                  updateLimit(
                                    corpus.id,
                                    limitValue + stepValue,
                                    corpus.words_total
                                  )
                                }
                              >
                                +
                              </button>
                            </div>
                            <div className="limit-presets">
                              {presets.map((preset) => (
                                <button
                                  key={`${corpus.id}-${preset.value}`}
                                  type="button"
                                  className={`button-secondary limit-preset${
                                    limitValue === preset.value ? " is-active" : ""
                                  }`}
                                  onClick={() =>
                                    updateLimit(corpus.id, preset.value, corpus.words_total)
                                  }
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                            <small>{t.corpora.limitHint}</small>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="onboarding-actions">
                  <span className="onboarding-hint">
                    {t.corpora.selected}: {selectedCount}
                  </span>
                </div>
              </>
            ) : null}
          </div>

          <div className="onboarding-actions">
            <button type="button" onClick={applyOnboarding} disabled={saving}>
              {saving ? t.actions.saving : t.actions.save}
            </button>
            {saveStatus ? <span className="success">{saveStatus}</span> : null}
            {saveError ? <span className="error">{saveError}</span> : null}
          </div>
        </div>
      ) : null}

      {previewOpen ? (
        <div className="modal-overlay" onClick={closePreview}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{previewTitle}</div>
                <div className="modal-sub">
                  {previewCorpus ? `${languagePair} | ${previewSubtitle}` : previewSubtitle}
                </div>
              </div>
              <button type="button" className="button-secondary modal-close" onClick={closePreview}>
                {t.preview.close}
              </button>
            </div>
            <div className="modal-body">
              {previewLoading ? <p className="muted">{t.preview.loading}</p> : null}
              {previewError ? <p className="error">{previewError}</p> : null}
              {!previewLoading && !previewError && previewWords.length === 0 ? (
                <p className="muted">{t.preview.empty}</p>
              ) : null}
              {previewWords.length ? (
                <div className="preview-list">
                  {previewWords.map((word) => (
                    <div key={word.word_id} className="preview-item">
                      <div className="preview-main">
                        <div className="preview-word">{word.lemma}</div>
                        <div className="preview-translation">
                          {word.translations && word.translations.length
                            ? word.translations.slice(0, 3).join(", ")
                            : t.preview.noTranslation}
                        </div>
                      </div>
                      <div className="preview-count">
                        {t.preview.count}: {word.count}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="modal-footer">
              {canLoadMore ? (
                <button type="button" className="button-secondary" onClick={loadMorePreview}>
                  {t.preview.more}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
