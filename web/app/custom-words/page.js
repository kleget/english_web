"use client";

import { useEffect, useState } from "react";

import { getCookie } from "../lib/client-cookies";
import { useUiLang } from "../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const TEXT = {
  ru: {
    title: "Мои слова",
    tagline: "Добавляй слова, которые хочешь изучить.",
    hint: "Эти слова попадут в раздел «Учить».",
    loading: "Загрузка...",
    error: "Не удалось загрузить список",
    saveError: "Не удалось добавить слово",
    saved: "Слово добавлено",
    add: "Добавить",
    adding: "Добавляем...",
    wordLabel: "Слово (родной язык)",
    translationLabel: "Перевод (изучаемый язык)",
    wordPlaceholder: "Например: кот",
    translationPlaceholder: "Например: cat",
    listTitle: "Добавленные слова",
    empty: "Пока нет добавленных слов.",
    direction: "Направление",
    home: "На главную",
    edit: "Редактировать",
    delete: "Удалить",
    cancel: "Отмена",
    save: "Сохранить",
    saving: "Сохранение...",
    deleteConfirm: "Удалить слово?",
    listHint: "Можно править перевод и слово.",
    importTitle: "Импорт списком",
    importHint: "Формат: слово - перевод, по одному на строку.",
    importExampleTitle: "Пример",
    importExample:
      "cat - кот\nclock - часы\nwarm - тепло\nокно - window\nмышка - mouse",
    importAction: "Импортировать",
    importing: "Импорт...",
    importResult: "Результат импорта",
    stats: {
      totalLines: "Строк всего",
      parsedLines: "Распознано строк",
      invalidLines: "Ошибочных строк",
      inserted: "Добавлено",
      updated: "Обновлено",
      skipped: "Без изменений"
    },
    langRu: "Русский",
    langEn: "English"
  },
  en: {
    title: "My words",
    tagline: "Add words you want to learn.",
    hint: "These words will appear in Learn.",
    loading: "Loading...",
    error: "Failed to load list",
    saveError: "Failed to add word",
    saved: "Word added",
    add: "Add",
    adding: "Adding...",
    wordLabel: "Word (native language)",
    translationLabel: "Translation (learning language)",
    wordPlaceholder: "e.g. кот",
    translationPlaceholder: "e.g. cat",
    listTitle: "Added words",
    empty: "No custom words yet.",
    direction: "Direction",
    home: "Home",
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    deleteConfirm: "Delete this word?",
    listHint: "You can edit word and translation.",
    importTitle: "Import list",
    importHint: "Format: word - translation, one per line.",
    importExampleTitle: "Example",
    importExample:
      "cat - кот\nclock - часы\nwarm - тепло\nокно - window\nмышка - mouse",
    importAction: "Import",
    importing: "Importing...",
    importResult: "Import result",
    stats: {
      totalLines: "Total lines",
      parsedLines: "Parsed lines",
      invalidLines: "Invalid lines",
      inserted: "Inserted",
      updated: "Updated",
      skipped: "Unchanged"
    },
    langRu: "Russian",
    langEn: "English"
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

async function putJson(path, payload, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
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

export default function CustomWordsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [editError, setEditError] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState([]);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ word: "", translation: "" });
  const [editForm, setEditForm] = useState({ word: "", translation: "" });
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const { lang, setLang } = useUiLang();
  const uiLang = lang || "ru";
  const t = TEXT[uiLang] || TEXT.ru;
  const locale = uiLang === "en" ? "en-US" : "ru-RU";

  const loadData = async () => {
    setLoading(true);
    setError("");
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    try {
      const [me, words] = await Promise.all([
        getJson("/auth/me", token),
        getJson("/custom-words?limit=50", token)
      ]);
      if (me?.interface_lang) {
        setLang(me.interface_lang === "en" ? "en" : "ru");
      }
      setProfile(me);
      setItems(Array.isArray(words) ? words : []);
    } catch (err) {
      const message = err.message || t.error;
      if (message === "Onboarding required") {
        window.location.href = "/onboarding";
        return;
      }
      if (message.includes("token") || message.includes("User not found")) {
        window.location.href = "/auth";
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSaveError("");
    setStatus("");
  }, [form.word, form.translation]);

  useEffect(() => {
    setEditError("");
  }, [editForm.word, editForm.translation, editingId]);

  useEffect(() => {
    setImportError("");
  }, [importText]);

  const addWord = async (event) => {
    event.preventDefault();
    setSaveError("");
    setStatus("");
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    const payload = {
      word: form.word.trim(),
      translation: form.translation.trim()
    };
    if (!payload.word || !payload.translation) {
      setSaveError(t.saveError);
      return;
    }
    setSaving(true);
    try {
      await postJson("/custom-words", payload, token);
      setForm({ word: "", translation: "" });
      setStatus(t.saved);
      await loadData();
    } catch (err) {
      setSaveError(err.message || t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.word_id);
    setEditForm({ word: item.word, translation: item.translation });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ word: "", translation: "" });
  };

  const saveEdit = async () => {
    setEditError("");
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    const payload = {
      word: editForm.word.trim(),
      translation: editForm.translation.trim()
    };
    if (!payload.word || !payload.translation) {
      setEditError(t.saveError);
      return;
    }
    setEditSaving(true);
    try {
      await putJson(`/custom-words/${editingId}`, payload, token);
      await loadData();
      cancelEdit();
    } catch (err) {
      setEditError(err.message || t.saveError);
    } finally {
      setEditSaving(false);
    }
  };

  const removeWord = async (wordId) => {
    setSaveError("");
    setStatus("");
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    if (!window.confirm(t.deleteConfirm)) {
      return;
    }
    try {
      await deleteJson(`/custom-words/${wordId}`, token);
      if (editingId === wordId) {
        cancelEdit();
      }
      await loadData();
    } catch (err) {
      setSaveError(err.message || t.saveError);
    }
  };

  const importList = async () => {
    setImportError("");
    setImportResult(null);
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    if (!importText.trim()) {
      return;
    }
    setImporting(true);
    try {
      const data = await postJson("/custom-words/import", { text: importText }, token);
      setImportResult(data);
      await loadData();
    } catch (err) {
      setImportError(err.message || t.saveError);
    } finally {
      setImporting(false);
    }
  };

  const goHome = () => {
    window.location.href = "/";
  };

  const langLabel = (value) => {
    if (value === "en") {
      return t.langEn;
    }
    if (value === "ru") {
      return t.langRu;
    }
    return value || "-";
  };

  const direction = profile
    ? `${langLabel(profile.native_lang)} \u2192 ${langLabel(profile.target_lang)}`
    : "-";

  const importStats = importResult
    ? [
        { label: t.stats.totalLines, value: importResult.total_lines },
        { label: t.stats.parsedLines, value: importResult.parsed_lines },
        { label: t.stats.invalidLines, value: importResult.invalid_lines },
        { label: t.stats.inserted, value: importResult.inserted },
        { label: t.stats.updated, value: importResult.updated },
        { label: t.stats.skipped, value: importResult.skipped }
      ]
    : [];

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="button-secondary" onClick={goHome}>
            {t.home}
          </button>
        </div>
      </div>

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <div className="panel">
            <div className="panel-title">{t.title}</div>
            <p className="muted">{t.hint}</p>
            <div className="custom-inline muted">
              <span>{t.direction}:</span>
              <strong>{direction}</strong>
            </div>
            <form className="custom-form" onSubmit={addWord}>
              <div className="custom-form-row">
                <div>
                  <label>{t.wordLabel}</label>
                  <input
                    type="text"
                    value={form.word}
                    onChange={(event) => setForm((prev) => ({ ...prev, word: event.target.value }))}
                    placeholder={t.wordPlaceholder}
                  />
                </div>
                <div>
                  <label>{t.translationLabel}</label>
                  <input
                    type="text"
                    value={form.translation}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, translation: event.target.value }))
                    }
                    placeholder={t.translationPlaceholder}
                  />
                </div>
              </div>
              <div className="actions">
                <button type="submit" disabled={saving}>
                  {saving ? t.adding : t.add}
                </button>
                {status ? <span className="success">{status}</span> : null}
                {saveError ? <span className="error">{saveError}</span> : null}
              </div>
            </form>
          </div>

          <div className="panel">
            <div className="panel-title">{t.listTitle}</div>
            <p className="muted">{t.listHint}</p>
            {items.length === 0 ? <p className="muted">{t.empty}</p> : null}
            {items.length ? (
              <div className="custom-list">
                {items.map((item) => (
                  <div key={item.word_id} className="custom-card">
                    {editingId === item.word_id ? (
                      <>
                        <div className="custom-form-row">
                          <div>
                            <label>{t.wordLabel}</label>
                            <input
                              type="text"
                              value={editForm.word}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  word: event.target.value
                                }))
                              }
                              placeholder={t.wordPlaceholder}
                            />
                          </div>
                          <div>
                            <label>{t.translationLabel}</label>
                            <input
                              type="text"
                              value={editForm.translation}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  translation: event.target.value
                                }))
                              }
                              placeholder={t.translationPlaceholder}
                            />
                          </div>
                        </div>
                        <div className="custom-actions">
                          <button type="button" onClick={saveEdit} disabled={editSaving}>
                            {editSaving ? t.saving : t.save}
                          </button>
                          <button type="button" className="button-secondary" onClick={cancelEdit}>
                            {t.cancel}
                          </button>
                          {editError ? <span className="error">{editError}</span> : null}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="custom-word">{item.word}</div>
                        <div className="custom-translation">{item.translation}</div>
                        <div className="custom-meta">
                          {formatDate(item.created_at, locale)}
                        </div>
                        <div className="custom-actions">
                          <button type="button" className="button-secondary" onClick={() => startEdit(item)}>
                            {t.edit}
                          </button>
                          <button type="button" className="button-secondary" onClick={() => removeWord(item.word_id)}>
                            {t.delete}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="panel">
            <div className="panel-title">{t.importTitle}</div>
            <p className="muted">{t.importHint}</p>
            <div className="import-sample">
              <div className="import-sample-title">{t.importExampleTitle}</div>
              <pre>{t.importExample}</pre>
            </div>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder={t.importExample}
            />
            <div className="actions">
              <button type="button" onClick={importList} disabled={importing || !importText.trim()}>
                {importing ? t.importing : t.importAction}
              </button>
              {importError ? <span className="error">{importError}</span> : null}
            </div>
            {importStats.length ? (
              <>
                <div className="panel-title">{t.importResult}</div>
                <div className="import-grid">
                  {importStats.map((item) => (
                    <div key={item.label} className="import-card">
                      <div className="import-title">{item.label}</div>
                      <div className="import-value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </main>
  );
}
