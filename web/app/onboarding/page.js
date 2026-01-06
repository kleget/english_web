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
    ru: "Медико-биологические науки",
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
    title: "Онбординг",
    tagline: "Настрой обучение под себя: язык, ритм и сферы.",
    loading: "Загрузка...",
    tabs: {
      setup: "Настройка",
      known: "Известные слова"
    },
    languages: {
      title: "Языки",
      hint: "Выбери направление обучения.",
      native: "Я знаю",
      target: "Изучаю",
      swap: "Поменять местами",
      pair: "Направление"
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
      limitHint: "0 = все доступные слова"
    },
    actions: {
      save: "Сохранить настройки",
      saving: "Сохраняю...",
      saved: "Настройки сохранены.",
      saveError: "Не удалось сохранить настройки",
      goHome: "На главную",
      toImport: "Импорт известных слов",
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
    known: {
      title: "Импорт известных слов",
      hint: "Вставь список, и мы отметим слова как уже известные.",
      format: "Формат: слово - перевод",
      exampleTitle: "Пример",
      example:
        "cat - кошка\nclock - часы\nwarm - тепло\nокно - window\nмышка - mouse",
      import: "Импортировать",
      importing: "Импорт...",
      back: "Назад к настройке",
      disabled: "Сначала сохрани настройки обучения.",
      result: "Результат импорта",
      stats: {
        totalLines: "Строк всего",
        parsedLines: "Распознано строк",
        invalidLines: "Ошибочных строк",
        wordsFound: "Слова найдены",
        wordsMissing: "Слова не найдены",
        inserted: "Добавлено",
        skipped: "Уже были"
      }
    },
    langRu: "Русский",
    langEn: "English",
    errorLoad: "Не удалось загрузить данные."
  },
  en: {
    title: "Onboarding",
    tagline: "Set up your learning: language, pace, and corpora.",
    loading: "Loading...",
    tabs: {
      setup: "Setup",
      known: "Known words"
    },
    languages: {
      title: "Languages",
      hint: "Choose the learning direction.",
      native: "I know",
      target: "Learning",
      swap: "Swap",
      pair: "Direction"
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
      limitHint: "0 = all available words"
    },
    actions: {
      save: "Save settings",
      saving: "Saving...",
      saved: "Settings saved.",
      saveError: "Failed to save settings",
      goHome: "Home",
      toImport: "Import known words",
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
    known: {
      title: "Import known words",
      hint: "Paste the list and we will mark them as known.",
      format: "Format: word - translation",
      exampleTitle: "Example",
      example:
        "cat - кошка\nclock - часы\nwarm - тепло\nокно - window\nмышка - mouse",
      import: "Import",
      importing: "Importing...",
      back: "Back to setup",
      disabled: "Complete onboarding first.",
      result: "Import results",
      stats: {
        totalLines: "Total lines",
        parsedLines: "Parsed lines",
        invalidLines: "Invalid lines",
        wordsFound: "Words found",
        wordsMissing: "Words missing",
        inserted: "Inserted",
        skipped: "Already existed"
      }
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

export default function OnboardingPage() {
  const [activeTab, setActiveTab] = useState("setup");
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
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
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
    setSaveStatus("");
    setSaveError("");
  }, [nativeLang, targetLang, dailyNew, dailyReview, learnBatch, selected]);

  useEffect(() => {
    setImportError("");
  }, [importText, activeTab]);

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

  const swapLanguages = () => {
    if (nativeLang === targetLang) {
      return;
    }
    setNativeLang(targetLang);
    setTargetLang(nativeLang);
    setSelected({});
  };

  const toggleCorpus = (corpusId) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[corpusId]) {
        delete next[corpusId];
        return next;
      }
      next[corpusId] = { target_word_limit: 0, enabled: true };
      return next;
    });
  };

  const updateLimit = (corpusId, value, maxValue) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }
    let nextValue = Math.max(0, Math.round(parsed));
    if (maxValue && nextValue > maxValue) {
      nextValue = maxValue;
    }
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
    const corporaPayload = Object.entries(selected).map(([id, item]) => ({
      corpus_id: Number(id),
      target_word_limit: item.target_word_limit || 0,
      enabled: item.enabled !== false
    }));
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
    } catch (err) {
      setSaveError(err.message || t.actions.saveError);
    } finally {
      setSaving(false);
    }
  };

  const submitKnownWords = async () => {
    setImportError("");
    setImportResult(null);
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    if (!onboardingDone) {
      setImportError(t.known.disabled);
      return;
    }
    setImporting(true);
    try {
      const data = await postJson("/onboarding/known-words", { text: importText }, token);
      setImportResult(data);
    } catch (err) {
      setImportError(err.message || "Request failed");
    } finally {
      setImporting(false);
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
      const data = await getJson(`/corpora/${corpusId}/preview?limit=${limitValue}`, token);
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

  const statsItems = importResult
    ? [
        { label: t.known.stats.totalLines, value: importResult.total_lines },
        { label: t.known.stats.parsedLines, value: importResult.parsed_lines },
        { label: t.known.stats.invalidLines, value: importResult.invalid_lines },
        { label: t.known.stats.wordsFound, value: importResult.words_found },
        { label: t.known.stats.wordsMissing, value: importResult.words_missing },
        { label: t.known.stats.inserted, value: importResult.inserted },
        { label: t.known.stats.skipped, value: importResult.skipped_existing }
      ]
    : [];

  const previewSubtitle = previewCorpus
    ? t.preview.subtitle.replace("{limit}", previewLimit)
    : "";
  const previewTitle = previewCorpus ? getCorpusLabel(previewCorpus, uiLang) : t.preview.title;
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

      <div className="onboarding-tabs">
        <button
          type="button"
          className={`onboarding-tab ${activeTab === "setup" ? "is-active" : ""}`}
          onClick={() => setActiveTab("setup")}
        >
          {t.tabs.setup}
        </button>
        <button
          type="button"
          className={`onboarding-tab ${activeTab === "known" ? "is-active" : ""}`}
          onClick={() => setActiveTab("known")}
        >
          {t.tabs.known}
        </button>
      </div>

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && activeTab === "setup" ? (
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
            <div className="onboarding-actions">
              <button type="button" className="button-secondary swap-button" onClick={swapLanguages}>
                {t.languages.swap}
              </button>
              <span className="onboarding-hint">
                {t.languages.pair}: {formatLang(nativeLang)} - {formatLang(targetLang)}
              </span>
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
                    const limitValue = selected[corpus.id]?.target_word_limit ?? 0;
                    const corpusLabel = getCorpusLabel(corpus, uiLang);
                    return (
                      <div
                        key={corpus.id}
                        className={`corpus-card ${isSelected ? "is-selected" : ""}`}
                        onClick={() => toggleCorpus(corpus.id)}
                      >
                        {isSelected ? <span className="corpus-badge">{t.corpora.badge}</span> : null}
                        <div className="corpus-title">{corpusLabel}</div>
                        <div className="corpus-meta">
                          <span>
                            {corpus.words_total} {t.corpora.words}
                          </span>
                          <span>
                            {corpus.source_lang.toUpperCase()} - {corpus.target_lang.toUpperCase()}
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
                            <input
                              type="number"
                              min="0"
                              max={corpus.words_total}
                              value={limitValue}
                              onChange={(event) =>
                                updateLimit(corpus.id, event.target.value, corpus.words_total)
                              }
                            />
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
            <button
              type="button"
              className="button-secondary"
              onClick={() => setActiveTab("known")}
            >
              {t.actions.toImport}
            </button>
            {saveStatus ? <span className="success">{saveStatus}</span> : null}
            {saveError ? <span className="error">{saveError}</span> : null}
          </div>
        </div>
      ) : null}

      {!loading && activeTab === "known" ? (
        <div className="tab-panel import-panel">
          <div className="panel">
            <div className="panel-title">{t.known.title}</div>
            <p className="muted">{t.known.hint}</p>
            {!onboardingDone ? <p className="error">{t.known.disabled}</p> : null}
            <div className="import-sample">
              <div className="import-sample-title">{t.known.exampleTitle}</div>
              <pre>{t.known.example}</pre>
              <div className="import-sample-hint">{t.known.format}</div>
            </div>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder={t.known.example}
            />
            <div className="onboarding-actions">
              <button
                type="button"
                onClick={submitKnownWords}
                disabled={importing || !importText.trim() || !onboardingDone}
              >
                {importing ? t.known.importing : t.known.import}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setActiveTab("setup")}
              >
                {t.known.back}
              </button>
            </div>
            {importError ? <p className="error">{importError}</p> : null}
            {statsItems.length ? (
              <>
                <div className="panel-title">{t.known.result}</div>
                <div className="import-grid">
                  {statsItems.map((item) => (
                    <div key={item.label} className="import-card">
                      <div className="import-title">{item.label}</div>
                      <div className="import-value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
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
                  {previewCorpus
                    ? `${previewCorpus.source_lang.toUpperCase()} - ${previewCorpus.target_lang.toUpperCase()} · ${previewSubtitle}`
                    : previewSubtitle}
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
