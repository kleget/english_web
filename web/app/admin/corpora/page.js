"use client";

import { useEffect, useMemo, useState } from "react";

import { getCookie, setCookie } from "../../lib/client-cookies";
import { useUiLang } from "../../ui-lang-context";
import AdminNav from "../admin-nav";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const DEFAULT_LIMIT = 50;

const TEXT = {
  ru: {
    title: "\u0421\u0444\u0435\u0440\u044b \u0438 \u0441\u043b\u043e\u0432\u0430",
    tagline: "\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u0438 \u043f\u0440\u0430\u0432\u043a\u0430 \u0441\u043b\u043e\u0432 \u043f\u043e \u0441\u0444\u0435\u0440\u0430\u043c.",
    loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
    error: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435.",
    forbidden: "\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430.",
    refresh: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c",
    empty: "\u0421\u043b\u043e\u0432\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b.",
    filters: {
      corpus: "\u0421\u0444\u0435\u0440\u0430",
      source: "\u042f\u0437\u044b\u043a \u0441\u043b\u043e\u0432",
      target: "\u042f\u0437\u044b\u043a \u043f\u0435\u0440\u0435\u0432\u043e\u0434\u0430",
      query: "\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u0441\u043b\u043e\u0432\u0443 \u0438\u043b\u0438 \u043f\u0435\u0440\u0435\u0432\u043e\u0434\u0443",
      search: "\u041d\u0430\u0439\u0442\u0438",
      reset: "\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c",
      sort: "\u0421\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u043a\u0430",
      order: "\u041f\u043e\u0440\u044f\u0434\u043e\u043a",
      limit: "\u041d\u0430 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0435"
    },
    langRu: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439",
    langEn: "English",
    sort: {
      rank: "\u041f\u043e \u0440\u0430\u043d\u0433\u0443",
      count: "\u041f\u043e \u0447\u0430\u0441\u0442\u043e\u0442\u0435",
      lemma: "\u041f\u043e \u0441\u043b\u043e\u0432\u0443"
    },
    order: {
      asc: "\u041f\u043e \u0432\u043e\u0437\u0440\u0430\u0441\u0442\u0430\u043d\u0438\u044e",
      desc: "\u041f\u043e \u0443\u0431\u044b\u0432\u0430\u043d\u0438\u044e"
    },
    word: {
      title: "\u0421\u043b\u043e\u0432\u043e",
      translations: "\u041f\u0435\u0440\u0435\u0432\u043e\u0434\u044b",
      count: "\u0427\u0430\u0441\u0442\u043e\u0442\u0430",
      rank: "\u0420\u0430\u043d\u0433",
      save: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0441\u043b\u043e\u0432\u043e",
      delete: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043b\u043e\u0432\u043e",
      confirmDelete: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043b\u043e\u0432\u043e \u0438 \u0432\u0441\u0435 \u0435\u0433\u043e \u043f\u0435\u0440\u0435\u0432\u043e\u0434\u044b?",
      saveTranslation: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043f\u0435\u0440\u0435\u0432\u043e\u0434",
      deleteTranslation: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043f\u0435\u0440\u0435\u0432\u043e\u0434",
      confirmDeleteTranslation: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u044d\u0442\u043e\u0442 \u043f\u0435\u0440\u0435\u0432\u043e\u0434?",
      noTranslations: "\u041d\u0435\u0442 \u043f\u0435\u0440\u0435\u0432\u043e\u0434\u043e\u0432"
    },
    paging: {
      prev: "\u041d\u0430\u0437\u0430\u0434",
      next: "\u0412\u043f\u0435\u0440\u0435\u0434",
      showing: "\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u043e"
    }
  },
  en: {
    title: "Corpora & words",
    tagline: "Browse and edit words by corpus.",
    loading: "Loading...",
    error: "Failed to load data.",
    forbidden: "Access denied.",
    refresh: "Refresh",
    empty: "No words found.",
    filters: {
      corpus: "Corpus",
      source: "Word language",
      target: "Translation language",
      query: "Search by word or translation",
      search: "Search",
      reset: "Reset",
      sort: "Sort",
      order: "Order",
      limit: "Per page"
    },
    langRu: "Russian",
    langEn: "English",
    sort: {
      rank: "By rank",
      count: "By frequency",
      lemma: "By word"
    },
    order: {
      asc: "Ascending",
      desc: "Descending"
    },
    word: {
      title: "Word",
      translations: "Translations",
      count: "Count",
      rank: "Rank",
      save: "Save word",
      delete: "Delete word",
      confirmDelete: "Delete the word and all its translations?",
      saveTranslation: "Save translation",
      deleteTranslation: "Delete translation",
      confirmDeleteTranslation: "Delete only this translation?",
      noTranslations: "No translations"
    },
    paging: {
      prev: "Previous",
      next: "Next",
      showing: "Showing"
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

async function patchJson(path, payload, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
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

async function deleteJson(path, token) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers
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

export default function AdminCorporaPage() {
  const { lang } = useUiLang();
  const uiLang = lang === "en" ? "en" : "ru";
  const t = TEXT[uiLang] || TEXT.ru;

  const [corpora, setCorpora] = useState([]);
  const [selectedCorpus, setSelectedCorpus] = useState("");
  const [words, setWords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingWords, setLoadingWords] = useState(false);
  const [error, setError] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("rank");
  const [order, setOrder] = useState("asc");
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [page, setPage] = useState(0);
  const [sourceLang, setSourceLang] = useState("ru");
  const [targetLang, setTargetLang] = useState("en");
  const [savingWordId, setSavingWordId] = useState(null);
  const [savingTranslationId, setSavingTranslationId] = useState(null);
  const [deletingWordId, setDeletingWordId] = useState(null);
  const [deletingTranslationId, setDeletingTranslationId] = useState(null);
  const [wordMap, setWordMap] = useState({});
  const [translationMap, setTranslationMap] = useState({});

  const loadCorpora = async (token) => {
    const me = await getJson("/auth/me", token);
    if (!me.is_admin) {
      setError(t.forbidden);
      return;
    }
    setCookie("is_admin", me.is_admin ? "1" : "0");
    const params = new URLSearchParams();
    if (sourceLang) {
      params.set("source_lang", sourceLang);
    }
    const data = await getJson(`/admin/content/corpora?${params.toString()}`, token);
    const list = Array.isArray(data) ? data : [];
    setCorpora(list);
    if (list.length) {
      const existing = list.find((item) => String(item.id) === String(selectedCorpus));
      if (!existing) {
        setSelectedCorpus(String(list[0].id));
      }
    } else if (selectedCorpus) {
      setSelectedCorpus("");
    }
  };

  const loadWords = async (token, corpusId, nextPage = page) => {
    if (!corpusId) {
      setWords([]);
      setTotal(0);
      return;
    }
    setLoadingWords(true);
    try {
      const offset = nextPage * limit;
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        sort,
        order,
        source_lang: sourceLang,
        target_lang: targetLang
      });
      if (query) {
        params.set("query", query);
      }
      const data = await getJson(`/admin/content/corpora/${corpusId}/words?${params}`, token);
      setWords(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number.isFinite(data?.total) ? data.total : 0);
    } finally {
      setLoadingWords(false);
    }
  };

  useEffect(() => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    loadCorpora(token)
      .catch((err) => {
        const message = err.message || t.error;
        if (message.includes("token") || message.includes("User not found")) {
          window.location.href = "/auth";
          return;
        }
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [sourceLang]);

  useEffect(() => {
    const token = getCookie("token");
    if (!token || !selectedCorpus) {
      return;
    }
    setError("");
    loadWords(token, selectedCorpus, page).catch((err) => {
      setError(err.message || t.error);
    });
  }, [selectedCorpus, query, sort, order, limit, page, sourceLang, targetLang]);

  const langLabel = (code) => (code === "en" ? t.langEn : t.langRu);

  const corpusOptions = useMemo(
    () =>
      corpora.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name} ({sourceLang.toUpperCase()} \u2192 {targetLang.toUpperCase()})
        </option>
      )),
    [corpora, sourceLang, targetLang]
  );

  const totalPages = Math.max(Math.ceil(total / limit), 1);

  const handleSearch = () => {
    setPage(0);
    setQuery(queryInput.trim());
  };

  const handleReset = () => {
    setQueryInput("");
    setQuery("");
    setPage(0);
  };

  const refresh = async () => {
    setError("");
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    try {
      await loadWords(token, selectedCorpus, page);
    } catch (err) {
      setError(err.message || t.error);
    }
  };

  const saveWord = async (item) => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    const value = (wordMap[item.word_id] ?? item.lemma ?? "").trim();
    if (!value) {
      setError(t.error);
      return;
    }
    setSavingWordId(item.word_id);
    try {
      const data = await patchJson(`/admin/content/words/${item.word_id}`, { lemma: value }, token);
      setWordMap((prev) => ({ ...prev, [item.word_id]: data.lemma }));
      if (data.id !== item.word_id) {
        await loadWords(token, selectedCorpus, page);
      } else {
        setWords((prev) =>
          prev.map((word) =>
            word.word_id === item.word_id ? { ...word, lemma: data.lemma } : word
          )
        );
      }
    } catch (err) {
      setError(err.message || t.error);
    } finally {
      setSavingWordId(null);
    }
  };

  const deleteWord = async (item) => {
    if (!window.confirm(t.word.confirmDelete)) {
      return;
    }
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    setDeletingWordId(item.word_id);
    try {
      await deleteJson(`/admin/content/words/${item.word_id}`, token);
      await loadWords(token, selectedCorpus, page);
    } catch (err) {
      setError(err.message || t.error);
    } finally {
      setDeletingWordId(null);
    }
  };

  const saveTranslation = async (translation, wordId) => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    const value = (translationMap[translation.id] ?? translation.translation ?? "").trim();
    if (!value) {
      setError(t.error);
      return;
    }
    setSavingTranslationId(translation.id);
    try {
      const data = await patchJson(
        `/admin/content/translations/${translation.id}`,
        { translation: value },
        token
      );
      setTranslationMap((prev) => ({ ...prev, [translation.id]: data.translation }));
      setWords((prev) =>
        prev.map((word) =>
          word.word_id === wordId
            ? {
                ...word,
                translations: word.translations.map((item) =>
                  item.id === translation.id ? { ...item, translation: data.translation } : item
                )
              }
            : word
        )
      );
    } catch (err) {
      setError(err.message || t.error);
    } finally {
      setSavingTranslationId(null);
    }
  };

  const deleteTranslation = async (translation, wordId) => {
    if (!window.confirm(t.word.confirmDeleteTranslation)) {
      return;
    }
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    setDeletingTranslationId(translation.id);
    try {
      await deleteJson(`/admin/content/translations/${translation.id}`, token);
      setWords((prev) =>
        prev.map((word) =>
          word.word_id === wordId
            ? {
                ...word,
                translations: word.translations.filter((item) => item.id !== translation.id)
              }
            : word
        )
      );
      setTranslationMap((prev) => {
        const next = { ...prev };
        delete next[translation.id];
        return next;
      });
    } catch (err) {
      setError(err.message || t.error);
    } finally {
      setDeletingTranslationId(null);
    }
  };

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="button-secondary" onClick={refresh}>
            {t.refresh}
          </button>
        </div>
      </div>
      <AdminNav />

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading ? (
        <div className="panel">
          <div className="admin-toolbar">
            <div className="admin-field">
              <label>{t.filters.corpus}</label>
              <select
                value={selectedCorpus}
                onChange={(event) => {
                  setSelectedCorpus(event.target.value);
                  setPage(0);
                }}
              >
                {corpusOptions}
              </select>
            </div>
            <div className="admin-field">
              <label>{t.filters.source}</label>
              <select
                value={sourceLang}
                onChange={(event) => {
                  const value = event.target.value === "en" ? "en" : "ru";
                  setSourceLang(value);
                  if (value === targetLang) {
                    setTargetLang(value === "ru" ? "en" : "ru");
                  }
                  setPage(0);
                }}
              >
                <option value="ru">{langLabel("ru")}</option>
                <option value="en">{langLabel("en")}</option>
              </select>
            </div>
            <div className="admin-field">
              <label>{t.filters.target}</label>
              <select
                value={targetLang}
                onChange={(event) => {
                  const value = event.target.value === "en" ? "en" : "ru";
                  setTargetLang(value);
                  if (value === sourceLang) {
                    setSourceLang(value === "ru" ? "en" : "ru");
                  }
                  setPage(0);
                }}
              >
                <option value="ru">{langLabel("ru")}</option>
                <option value="en">{langLabel("en")}</option>
              </select>
            </div>
            <div className="admin-field admin-field-wide">
              <label>{t.filters.query}</label>
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSearch();
                  }
                }}
              />
            </div>
            <div className="admin-field">
              <label>{t.filters.sort}</label>
              <select
                value={sort}
                onChange={(event) => {
                  const nextSort = event.target.value;
                  setSort(nextSort);
                  setPage(0);
                  if (nextSort === "count") {
                    setOrder("desc");
                  } else if (nextSort === "rank") {
                    setOrder("asc");
                  }
                }}
              >
                <option value="rank">{t.sort.rank}</option>
                <option value="count">{t.sort.count}</option>
                <option value="lemma">{t.sort.lemma}</option>
              </select>
            </div>
            <div className="admin-field">
              <label>{t.filters.order}</label>
              <select
                value={order}
                onChange={(event) => {
                  setOrder(event.target.value);
                  setPage(0);
                }}
              >
                <option value="asc">{t.order.asc}</option>
                <option value="desc">{t.order.desc}</option>
              </select>
            </div>
            <div className="admin-field">
              <label>{t.filters.limit}</label>
              <select
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(0);
                }}
              >
                {[20, 50, 100, 150].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-actions">
              <button type="button" onClick={handleSearch}>
                {t.filters.search}
              </button>
              <button type="button" className="button-secondary" onClick={handleReset}>
                {t.filters.reset}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!loading ? (
        <div className="panel">
          {loadingWords ? <p className="muted">{t.loading}</p> : null}
          {!loadingWords && !words.length ? <p className="muted">{t.empty}</p> : null}
          <div className="admin-word-list">
            {words.map((item) => (
              <div key={item.word_id} className="admin-word-card">
                <div className="admin-word-header">
                  <div>
                    <div className="admin-word-title">{item.lemma}</div>
                    <div className="admin-word-meta">
                      <span>
                        {t.word.count}: {item.count}
                      </span>
                      {item.rank !== null && item.rank !== undefined ? (
                        <span>
                          {t.word.rank}: {item.rank}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="admin-word-actions">
                    <button
                      type="button"
                      onClick={() => saveWord(item)}
                      disabled={savingWordId === item.word_id}
                    >
                      {t.word.save}
                    </button>
                    <button
                      type="button"
                      className="button-danger"
                      onClick={() => deleteWord(item)}
                      disabled={deletingWordId === item.word_id}
                    >
                      {t.word.delete}
                    </button>
                  </div>
                </div>
                <div className="admin-word-edit">
                  <label>{t.word.title}</label>
                  <input
                    value={wordMap[item.word_id] ?? item.lemma ?? ""}
                    onChange={(event) =>
                      setWordMap((prev) => ({ ...prev, [item.word_id]: event.target.value }))
                    }
                  />
                </div>
                <div className="admin-word-edit">
                  <label>{t.word.translations}</label>
                  {item.translations?.length ? (
                    <div className="admin-translation-list">
                      {item.translations.map((translation) => (
                        <div key={translation.id} className="admin-translation-row">
                          <input
                            value={translationMap[translation.id] ?? translation.translation}
                            onChange={(event) =>
                              setTranslationMap((prev) => ({
                                ...prev,
                                [translation.id]: event.target.value
                              }))
                            }
                          />
                          <button
                            type="button"
                            onClick={() => saveTranslation(translation, item.word_id)}
                            disabled={savingTranslationId === translation.id}
                          >
                            {t.word.saveTranslation}
                          </button>
                          <button
                            type="button"
                            className="button-danger"
                            onClick={() => deleteTranslation(translation, item.word_id)}
                            disabled={deletingTranslationId === translation.id}
                          >
                            {t.word.deleteTranslation}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">{t.word.noTranslations}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {total > 0 ? (
            <div className="admin-pagination">
              <span>
                {t.paging.showing} {words.length} / {total}
              </span>
              <div className="admin-pagination-actions">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                  disabled={page === 0}
                >
                  {t.paging.prev}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
                  disabled={page >= totalPages - 1}
                >
                  {t.paging.next}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
