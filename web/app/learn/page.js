"use client";

import { useEffect, useState } from "react";

import { getCookie } from "../lib/client-cookies";
import { useUiLang } from "../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const READ_SECONDS = 30;

const TEXT = {
  ru: {
    title: "Изучение",
    tagline: "Сначала выучи карточки, затем переходи к проверке.",
    home: "На главную",
    loading: "Загрузка...",
    noWords: "Новых слов нет.",
    refresh: "Обновить",
    report: "\u0421\u043e\u043e\u0431\u0449\u0438\u0442\u044c \u043e\u0431 \u043e\u0448\u0438\u0431\u043a\u0435",
    progress: "Прогресс сессии",
    tip: "Совет: сначала проговори перевод вслух, а потом вводи ответ.",
    tapCard: "Нажми на карточку, чтобы открыть перевод",
    wordLabel: "Слово",
    cardProgress: "Карточка {current} из {total}",
    learnedNext: "Выучил, дальше",
    cardsDone: "Карточки пройдены",
    cardsDoneHint: "Можно переходить к небольшому чтению и тесту.",
    goReading: "Перейти к чтению",
    restartCards: "Пройти карточки заново",
    readingTitle: "Небольшой текст",
    readingText:
      "Небольшая пауза помогает перевести слова из кратковременной памяти. Прочитай текст, не возвращаясь к карточкам.",
    timeLeft: "Осталось",
    seconds: "сек",
    backToCards: "Назад к карточкам",
    skipText: "Пропустить текст",
    testTitle: "Тест",
    testHint: "Введи перевод для каждого слова.",
    translationPlaceholder: "Перевод",
    correct: "Верно",
    wrong: "Ошибка",
    correctAnswer: "Правильный ответ: {answer}",
    submit: "Отправить ответы",
    nextBatch: "Следующий набор",
    resultAllCorrect: "Все ответы верны.",
    resultHasErrors: "Есть ошибки, попробуй снова.",
    resultScore: "Верно: {correct} / {total}",
    loadError: "Не удалось загрузить слова",
    submitError: "Не удалось отправить ответы"
  },
  en: {
    title: "Learning",
    tagline: "Learn the cards first, then move to the test.",
    home: "Home",
    loading: "Loading...",
    noWords: "No new words yet.",
    refresh: "Refresh",
    report: "Report issue",
    progress: "Session progress",
    tip: "Tip: say the translation out loud before typing.",
    tapCard: "Tap the card to reveal the translation",
    wordLabel: "Word",
    cardProgress: "Card {current} of {total}",
    learnedNext: "Learned, next",
    cardsDone: "Cards completed",
    cardsDoneHint: "You can proceed to short reading and the test.",
    goReading: "Go to reading",
    restartCards: "Restart cards",
    readingTitle: "Short text",
    readingText:
      "A short pause helps move words from short-term memory. Read the text without returning to the cards.",
    timeLeft: "Time left",
    seconds: "sec",
    backToCards: "Back to cards",
    skipText: "Skip reading",
    testTitle: "Test",
    testHint: "Type the translation for each word.",
    translationPlaceholder: "Translation",
    correct: "Correct",
    wrong: "Wrong",
    correctAnswer: "Correct answer: {answer}",
    submit: "Submit answers",
    nextBatch: "Next batch",
    resultAllCorrect: "All answers are correct.",
    resultHasErrors: "There are mistakes, try again.",
    resultScore: "Correct: {correct} / {total}",
    loadError: "Failed to load words",
    submitError: "Failed to submit answers"
  }
};

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

export default function LearnPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [words, setWords] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [showTranslation, setShowTranslation] = useState({});
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [checkMap, setCheckMap] = useState({});
  const [correctMap, setCorrectMap] = useState({});
  const [reading, setReading] = useState(null);
  const [phase, setPhase] = useState("cards");
  const [readingLeft, setReadingLeft] = useState(READ_SECONDS);
  const [cardIndex, setCardIndex] = useState(0);
  const { lang } = useUiLang();
  const uiLang = lang === "en" ? "en" : "ru";
  const t = TEXT[uiLang] || TEXT.ru;

  const loadWords = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    try {
      const data = await postJson("/study/learn/start", {}, token);
      setWords(data.words || []);
      setSessionId(data.session_id);
      setReading(data.reading || null);
      const initialAnswers = {};
      (data.words || []).forEach((item) => {
        initialAnswers[item.word_id] = "";
      });
      setAnswers(initialAnswers);
      setShowTranslation({});
      setCheckMap({});
      setCorrectMap({});
      setPhase("cards");
      setReadingLeft(READ_SECONDS);
      setCardIndex(0);
    } catch (err) {
      const message = err.message || t.loadError;
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
    loadWords();
  }, []);

  useEffect(() => {
    if (phase !== "reading") {
      return;
    }
    if (readingLeft <= 0) {
      setPhase("test");
      return;
    }
    const timerId = setTimeout(() => {
      setReadingLeft((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timerId);
  }, [phase, readingLeft]);

  const toggleTranslation = (wordId) => {
    setShowTranslation((prev) => ({ ...prev, [wordId]: !prev[wordId] }));
  };

  const updateAnswer = (wordId, value) => {
    setAnswers((prev) => ({ ...prev, [wordId]: value }));
    setCheckMap((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, wordId)) {
        return prev;
      }
      const next = { ...prev };
      delete next[wordId];
      return next;
    });
    setCorrectMap((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, wordId)) {
        return prev;
      }
      const next = { ...prev };
      delete next[wordId];
      return next;
    });
  };

  const startReading = () => {
    setPhase("reading");
    setReadingLeft(READ_SECONDS);
  };

  const backToCards = () => {
    setPhase("cards");
    setCardIndex(0);
    setShowTranslation({});
  };

  const restartCards = () => {
    setCardIndex(0);
    setShowTranslation({});
  };

  const skipReading = () => {
    setPhase("test");
    setReadingLeft(0);
  };

  const goHome = () => {
    window.location.href = "/";
  };

  const reportIssue = (wordItem) => {
    const params = new URLSearchParams();
    params.set("source", "learn");
    if (wordItem?.word) {
      params.set("word", wordItem.word);
    }
    if (wordItem?.translation) {
      params.set("translation", wordItem.translation);
    }
    if (wordItem?.word_id) {
      params.set("word_id", String(wordItem.word_id));
    }
    window.location.href = `/reports?${params.toString()}`;
  };

  const advanceCard = () => {
    setCardIndex((prev) => Math.min(prev + 1, words.length));
    setShowTranslation({});
  };

  const submit = async () => {
    setError("");
    setResult(null);
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    const payload = {
      session_id: sessionId,
      words: words.map((item) => ({
        word_id: item.word_id,
        answer: answers[item.word_id] || ""
      }))
    };
    try {
      const data = await postJson("/study/learn/submit", payload, token);
      setResult(data);
      const map = {};
      const correctAnswers = {};
      (data.results || []).forEach((item) => {
        map[item.word_id] = item.correct;
        correctAnswers[item.word_id] = item.correct_answers || [];
      });
      setCheckMap(map);
      setCorrectMap(correctAnswers);
      if (data.all_correct) {
        setTimeout(() => {
          window.location.href = "/";
        }, 1200);
      }
    } catch (err) {
      setError(err.message || t.submitError);
    }
  };

  const cardsTotal = words.length;
  const cardsDone = Math.min(cardIndex, cardsTotal);
  const progressPercent = cardsTotal > 0 ? Math.round((cardsDone / cardsTotal) * 100) : 0;
  const cardsFinished = cardsTotal > 0 && cardIndex >= cardsTotal;
  const currentCard = cardIndex < cardsTotal ? words[cardIndex] : null;
  const readingTitle = reading?.title || t.readingTitle;
  const readingText = reading?.text || t.readingText;
  const readingMetaLabel = uiLang === "en" ? "Domain" : "Сфера";
  const readingMeta = reading?.corpus_name ? `${readingMetaLabel}: ${reading.corpus_name}` : "";

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

      {!loading && words.length === 0 ? (
        <div className="panel">
          <p className="muted">{t.noWords}</p>
          <button type="button" onClick={loadWords}>
            {t.refresh}
          </button>
        </div>
      ) : null}

      {words.length > 0 ? (
        <>
          <div className="panel progress-panel">
            <div className="panel-title">{t.progress}</div>
            <div className="progress-row">
              <div className="progress-bar">
                <span
                  style={{
                    width: `${progressPercent}%`
                  }}
                />
              </div>
              <div className="progress-text">
                {cardsDone} / {words.length}
              </div>
            </div>
            <p className="muted tip">{t.tip}</p>
          </div>
          {phase === "cards" ? (
            <>
              {!cardsFinished && currentCard ? (
                <div className="card focus-card">
                  <div
                    className={`flip-card ${
                      showTranslation[currentCard.word_id] ? "is-flipped" : ""
                    }`}
                    onClick={() => toggleTranslation(currentCard.word_id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleTranslation(currentCard.word_id);
                      }
                    }}
                  >
                    <div className="flip-inner">
                      <div className="flip-face flip-front">
                        <div className="card-title">{currentCard.word}</div>
                        <div className="card-sub muted">{t.tapCard}</div>
                      </div>
                      <div className="flip-face flip-back">
                        <div className="card-title">{currentCard.translation}</div>
                        <div className="card-sub muted">
                          {t.wordLabel}: {currentCard.word}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card-meta">
                    <span className="card-progress">
                      {t.cardProgress
                        .replace("{current}", cardIndex + 1)
                        .replace("{total}", cardsTotal)}
                    </span>
                  </div>
                  <div className="card-actions">
                    <button type="button" onClick={advanceCard}>
                      {t.learnedNext}
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => reportIssue(currentCard)}
                    >
                      {t.report}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="panel">
                  <div className="panel-title">{t.cardsDone}</div>
                  <p className="muted">{t.cardsDoneHint}</p>
                  <div className="actions">
                    <button type="button" onClick={startReading}>
                      {t.goReading}
                    </button>
                    <button type="button" className="button-secondary" onClick={restartCards}>
                      {t.restartCards}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}

          {phase === "reading" ? (
            <div className="panel reading-panel">
              <div className="panel-title">{readingTitle}</div>
              <p className="reading-text">{readingText}</p>
              {readingMeta ? <p className="muted reading-meta">{readingMeta}</p> : null}
              <div className="timer">
                {t.timeLeft}: <span className="timer-value">{readingLeft}</span> {t.seconds}
              </div>
              <div className="actions">
                <button type="button" className="button-secondary" onClick={backToCards}>
                  {t.backToCards}
                </button>
                <button type="button" onClick={skipReading}>
                  {t.skipText}
                </button>
              </div>
            </div>
          ) : null}

          {phase === "test" ? (
            <div className="panel">
              <div className="panel-title">{t.testTitle}</div>
              <p className="muted">{t.testHint}</p>
              <div className="input-list">
                {words.map((item) => (
                  <div
                    key={item.word_id}
                    className={`input-row ${checkMap[item.word_id] === true ? "correct" : ""} ${
                      checkMap[item.word_id] === false ? "wrong" : ""
                    }`}
                  >
                    <div className="input-word">{item.word}</div>
                    <input
                      type="text"
                      value={answers[item.word_id] || ""}
                      onChange={(event) => updateAnswer(item.word_id, event.target.value)}
                      placeholder={t.translationPlaceholder}
                    />
                    {checkMap[item.word_id] === true ? (
                      <span className="input-status correct">{t.correct}</span>
                    ) : null}
                    {checkMap[item.word_id] === false ? (
                      <span className="input-status wrong">{t.wrong}</span>
                    ) : null}
                    {checkMap[item.word_id] === false ? (
                      <div className="input-hint">
                        {t.correctAnswer.replace(
                          "{answer}",
                          correctMap[item.word_id]?.join(", ") || "-"
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="actions">
                <button type="button" onClick={submit}>
                  {t.submit}
                </button>
              <button type="button" className="button-secondary" onClick={backToCards}>
                {t.backToCards}
              </button>
              <button type="button" className="button-secondary" onClick={loadWords}>
                {t.nextBatch}
              </button>
            </div>
              {result ? (
                <div className="result">
                  {result.all_correct ? t.resultAllCorrect : t.resultHasErrors}
                  <div>
                    {t.resultScore
                      .replace("{correct}", result.words_correct)
                      .replace("{total}", result.words_total)}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
