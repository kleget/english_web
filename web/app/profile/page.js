"use client";

import { useEffect, useState } from "react";

import { deleteCookie, getCookie } from "../lib/client-cookies";
import { useUiLang } from "../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const TEXT = {
  ru: {
    title: "Профиль",
    tagline: "Твои данные и настройки аккаунта.",
    loading: "Загрузка...",
    error: "Не удалось загрузить профиль",
    email: "Email",
    interfaceSection: "Интерфейс",
    interfaceLang: "Язык интерфейса",
    theme: "Тема",
    themeHint: "Переключается в верхней панели.",
    nativeLang: "Мой язык",
    targetLang: "Изучаемый язык",
    onboarding: "Настройка обучения",
    onboardingReady: "Готово",
    onboardingPending: "Не завершено",
    save: "Сохранить",
    saving: "Сохранение...",
    saved: "Сохранено",
    saveError: "Не удалось сохранить настройки",
    sections: {
      learning: "Обучение",
      tech: "Тех-настройки",
      help: "Помощь"
    },
    wordsSection: "Слова",
    wordsLearnTitle: "Мои слова для изучения",
    wordsLearnDesc:
      "Добавляй слова, которые хочешь выучить. Они попадают в обучение и повторение.",
    wordsLearnAction: "Открыть мои слова",
    learningHint: "Выбор сфер, языков и лимитов доступен в настройке обучения.",
    techHint: "Уведомления, очередь и фоновые задачи.",
    helpHint: "Добро пожаловать и быстрый тур по Recallio.",
    actions: {
      logout: "Выйти",
      onboarding: "Открыть настройку обучения",
      tech: "Открыть тех-настройки",
      help: "Открыть инструкцию"
    },
    known: {
      title: "Известные слова",
      hint:
        "Слова, которые ты уже знаешь. Импорт отмечает их как известные и не предлагает в изучении.",
      disabled: "Сначала нужно пройти настройку обучения.",
      format: "Формат: слово - перевод",
      exampleTitle: "Пример",
      example:
        "dog - собака\nclock - часы\nwarm - тепло\nокно - window\nмышь - mouse",
      import: "Импортировать",
      importing: "Импорт...",
      result: "Результат импорта",
      stats: {
        totalLines: "Всего строк",
        parsedLines: "Распознано",
        invalidLines: "Ошибка формата",
        wordsFound: "Найдено",
        wordsMissing: "Не найдено",
        inserted: "Добавлено",
        skipped: "Пропущено"
      }
    },
    danger: {
      title: "Удаление аккаунта",
      subtitle: "Подтвердите удаление аккаунта.",
      warning:
        "Это действие необратимо: будут удалены настройки, прогресс, слова и история.",
      confirm: "Да, действительно удалить аккаунт",
      confirmError: "Подтвердите удаление аккаунта.",
      cancel: "Отмена",
      start: "Удалить аккаунт",
      delete: "Удалить аккаунт",
      deleting: "Удаление...",
      error: "Не удалось удалить аккаунт"
    },
    themeLight: "Светлая",
    themeDark: "Темная",
    langRu: "Русский",
    langEn: "English"
  },
  en: {
    title: "Profile",
    tagline: "Your details and account settings.",
    loading: "Loading...",
    error: "Failed to load profile",
    email: "Email",
    interfaceSection: "Interface",
    interfaceLang: "Interface language",
    theme: "Theme",
    themeHint: "Toggle in the top bar.",
    nativeLang: "Native language",
    targetLang: "Learning",
    onboarding: "Learning setup",
    onboardingReady: "Complete",
    onboardingPending: "Incomplete",
    save: "Save",
    saving: "Saving...",
    saved: "Saved",
    saveError: "Failed to save settings",
    sections: {
      learning: "Learning",
      tech: "Tech settings",
      help: "Help"
    },
    wordsSection: "Words",
    wordsLearnTitle: "My words to learn",
    wordsLearnDesc:
      "Add words you want to learn. They appear in learning and review.",
    wordsLearnAction: "Open my words",
    learningHint: "Pick corpora, languages, and limits in learning setup.",
    techHint: "Notifications, outbox, and background jobs.",
    helpHint: "Welcome guide and quick tour of Recallio.",
    actions: {
      logout: "Log out",
      onboarding: "Open learning setup",
      tech: "Open tech settings",
      help: "Open help"
    },
    known: {
      title: "Known words",
      hint:
        "Words you already know. Import marks them as known and removes them from learning.",
      disabled: "Complete learning setup first.",
      format: "Format: word - translation",
      exampleTitle: "Example",
      example:
        "dog - собака\nclock - часы\nwarm - тепло\nокно - window\nмышь - mouse",
      import: "Import",
      importing: "Importing...",
      result: "Import result",
      stats: {
        totalLines: "Total lines",
        parsedLines: "Parsed",
        invalidLines: "Invalid",
        wordsFound: "Found",
        wordsMissing: "Missing",
        inserted: "Inserted",
        skipped: "Skipped"
      }
    },
    danger: {
      title: "Delete account",
      subtitle: "Confirm account deletion.",
      warning:
        "This action is irreversible: settings, progress, words, and history will be deleted.",
      confirm: "Yes, delete my account",
      confirmError: "Please confirm account deletion.",
      cancel: "Cancel",
      start: "Delete account",
      delete: "Delete account",
      deleting: "Deleting...",
      error: "Failed to delete account"
    },
    themeLight: "Light",
    themeDark: "Dark",
    langRu: "Russian",
    langEn: "English"
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

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [knownText, setKnownText] = useState("");
  const [knownResult, setKnownResult] = useState(null);
  const [knownError, setKnownError] = useState("");
  const [knownImporting, setKnownImporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [interfaceLang, setInterfaceLang] = useState("ru");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [saveError, setSaveError] = useState("");
  const { lang, setLang } = useUiLang();
  const uiLang = lang || "ru";

  const t = TEXT[uiLang] || TEXT.ru;

  useEffect(() => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    getJson("/auth/me", token)
      .then((data) => {
        setProfile(data);
        const nextLang = data.interface_lang === "en" ? "en" : "ru";
        setLang(nextLang);
        setInterfaceLang(nextLang);
      })
      .catch((err) => {
        const message = err.message || t.error;
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
    setStatus("");
    setSaveError("");
  }, [interfaceLang]);

  useEffect(() => {
    setKnownError("");
  }, [knownText]);

  const logout = () => {
    deleteCookie("token");
    deleteCookie("is_admin");
    window.location.href = "/auth";
  };

  const openDelete = () => {
    setConfirmOpen(true);
    setConfirmDelete(false);
    setDeleteError("");
  };

  const cancelDelete = () => {
    setConfirmOpen(false);
    setConfirmDelete(false);
    setDeleteError("");
  };

  const deleteAccount = async () => {
    setDeleteError("");
    if (!confirmDelete) {
      setDeleteError(t.danger.confirmError);
      return;
    }
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    setDeleting(true);
    try {
      await deleteJson("/profile", token);
      deleteCookie("token");
      deleteCookie("is_admin");
      window.location.href = "/auth";
    } catch (err) {
      setDeleteError(err.message || t.danger.error);
    } finally {
      setDeleting(false);
    }
  };

  const saveInterface = async () => {
    setStatus("");
    setSaveError("");
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    setSaving(true);
    try {
      const data = await putJson(
        "/profile",
        { interface_lang: interfaceLang },
        token
      );
      const nextLang = data.interface_lang === "en" ? "en" : "ru";
      setLang(nextLang);
      setProfile((prev) =>
        prev ? { ...prev, interface_lang: data.interface_lang } : prev
      );
      setStatus(t.saved);
    } catch (err) {
      setSaveError(err.message || t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const importKnownWords = async () => {
    setKnownError("");
    setKnownResult(null);
    if (!onboardingReady) {
      setKnownError(t.known.disabled);
      return;
    }
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    if (!knownText.trim()) {
      return;
    }
    setKnownImporting(true);
    try {
      const data = await postJson("/onboarding/known-words", { text: knownText }, token);
      setKnownResult(data);
    } catch (err) {
      setKnownError(err.message || t.saveError);
    } finally {
      setKnownImporting(false);
    }
  };

  const goCustomWords = () => {
    window.location.href = "/custom-words";
  };

  const goOnboarding = () => {
    window.location.href = "/onboarding";
  };

  const goTech = () => {
    window.location.href = "/tech";
  };

  const goHelp = () => {
    window.location.href = "/welcome";
  };

  const langLabel = (value) => {
    if (value === "ru") {
      return t.langRu;
    }
    if (value === "en") {
      return t.langEn;
    }
    return "-";
  };

  const themeLabel = (value) => (value === "dark" ? t.themeDark : t.themeLight);

  const initials = profile?.email ? profile.email.slice(0, 1).toUpperCase() : "?";
  const onboardingReady = Boolean(profile?.onboarding_done);
  const currentLang = profile?.interface_lang === "en" ? "en" : "ru";
  const canSave = Boolean(profile) && interfaceLang !== currentLang;
  const knownStats = knownResult
    ? [
        { label: t.known.stats.totalLines, value: knownResult.total_lines },
        { label: t.known.stats.parsedLines, value: knownResult.parsed_lines },
        { label: t.known.stats.invalidLines, value: knownResult.invalid_lines },
        { label: t.known.stats.wordsFound, value: knownResult.words_found },
        { label: t.known.stats.wordsMissing, value: knownResult.words_missing },
        { label: t.known.stats.inserted, value: knownResult.inserted },
        { label: t.known.stats.skipped, value: knownResult.skipped_existing }
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
          <button type="button" className="button-secondary" onClick={logout}>
            {t.actions.logout}
          </button>
        </div>
      </div>

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {profile ? (
        <>
          <div className="panel profile-hero">
            <div className="profile-avatar">{initials}</div>
            <div className="profile-details">
              <div className="profile-name">{profile.email}</div>
              <div className="profile-meta">{t.email}</div>
              <span className={`status-pill ${onboardingReady ? "ok" : "warn"}`}>
                {t.onboarding}: {onboardingReady ? t.onboardingReady : t.onboardingPending}
              </span>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">{t.interfaceSection}</div>
            <div className="profile-grid profile-grid-top">
              <div className="profile-cell">
                <label>{t.interfaceLang}</label>
                <select
                  value={interfaceLang}
                  onChange={(event) => setInterfaceLang(event.target.value)}
                >
                  <option value="ru">{t.langRu}</option>
                  <option value="en">{t.langEn}</option>
                </select>
              </div>
              <div className="profile-cell">
                <div className="profile-label">{t.theme}</div>
                <div className="profile-value">{themeLabel(profile.theme)}</div>
                <div className="muted">{t.themeHint}</div>
              </div>
              <div className="profile-actions full">
                <button type="button" onClick={saveInterface} disabled={saving || !canSave}>
                  {saving ? t.saving : t.save}
                </button>
                {status ? <span className="muted">{status}</span> : null}
                {saveError ? <span className="error">{saveError}</span> : null}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">{t.sections.learning}</div>
            <div className="profile-grid profile-grid-top">
              <div className="profile-cell">
                <div className="profile-label">{t.nativeLang}</div>
                <div className="profile-value">{langLabel(profile.native_lang)}</div>
              </div>
              <div className="profile-cell">
                <div className="profile-label">{t.targetLang}</div>
                <div className="profile-value">{langLabel(profile.target_lang)}</div>
              </div>
              <div className="profile-actions full">
                <button type="button" className="button-secondary" onClick={goOnboarding}>
                  {t.actions.onboarding}
                </button>
              </div>
            </div>
            <p className="muted">{t.learningHint}</p>
          </div>

          <div className="panel">
            <div className="panel-title">{t.wordsSection}</div>
            <div className="profile-grid profile-grid-top">
              <div className="profile-cell">
                <div className="profile-label">{t.wordsLearnTitle}</div>
                <div className="profile-value">{t.wordsLearnDesc}</div>
              </div>
              <div className="profile-actions full">
                <button type="button" className="button-secondary" onClick={goCustomWords}>
                  {t.wordsLearnAction}
                </button>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">{t.known.title}</div>
            <p className="muted">{t.known.hint}</p>
            {!onboardingReady ? <p className="error">{t.known.disabled}</p> : null}
            <div className="import-sample">
              <div className="import-sample-title">{t.known.exampleTitle}</div>
              <pre>{t.known.example}</pre>
              <div className="import-sample-hint">{t.known.format}</div>
            </div>
            <textarea
              value={knownText}
              onChange={(event) => setKnownText(event.target.value)}
              placeholder={t.known.example}
            />
            <div className="actions">
              <button
                type="button"
                onClick={importKnownWords}
                disabled={knownImporting || !knownText.trim() || !onboardingReady}
              >
                {knownImporting ? t.known.importing : t.known.import}
              </button>
              {knownError ? <span className="error">{knownError}</span> : null}
            </div>
            {knownStats.length ? (
              <>
                <div className="panel-title">{t.known.result}</div>
                <div className="import-grid">
                  {knownStats.map((item) => (
                    <div key={item.label} className="import-card">
                      <div className="import-title">{item.label}</div>
                      <div className="import-value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="panel">
            <div className="panel-title">{t.sections.tech}</div>
            <p className="muted">{t.techHint}</p>
            <div className="actions">
              <button type="button" className="button-secondary" onClick={goTech}>
                {t.actions.tech}
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">{t.sections.help}</div>
            <p className="muted">{t.helpHint}</p>
            <div className="actions">
              <button type="button" className="button-secondary" onClick={goHelp}>
                {t.actions.help}
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">{t.danger.title}</div>
            <div className="actions">
              <button type="button" className="button-danger" onClick={openDelete}>
                {t.danger.start}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {confirmOpen ? (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-card delete-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{t.danger.title}</div>
                <div className="modal-sub">{t.danger.subtitle}</div>
              </div>
              <button type="button" className="button-secondary" onClick={cancelDelete}>
                {t.danger.cancel}
              </button>
            </div>
            <div className="modal-body">
              <p className="error">{t.danger.warning}</p>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={confirmDelete}
                  onChange={(event) => setConfirmDelete(event.target.checked)}
                />
                {t.danger.confirm}
              </label>
              {deleteError ? <p className="error">{deleteError}</p> : null}
            </div>
            <div className="modal-footer">
              <button type="button" className="button-secondary" onClick={cancelDelete}>
                {t.danger.cancel}
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={deleteAccount}
                disabled={!confirmDelete || deleting}
              >
                {deleting ? t.danger.deleting : t.danger.delete}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
