"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getCookie, setCookie } from "./lib/client-cookies";

const UiLangContext = createContext({
  lang: "ru",
  setLang: () => {}
});

export function UiLangProvider({ children, initialLang = "ru" }) {
  const safeInitial = initialLang === "en" ? "en" : "ru";
  const [lang, setLangState] = useState(safeInitial);

  useEffect(() => {
    const cookieLang = getCookie("ui_lang");
    if (cookieLang === "ru" || cookieLang === "en") {
      setLangState((prev) => (prev === cookieLang ? prev : cookieLang));
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (value) => {
    const next = value === "en" ? "en" : "ru";
    setLangState(next);
    setCookie("ui_lang", next);
  };

  const contextValue = useMemo(() => ({ lang, setLang }), [lang]);

  return <UiLangContext.Provider value={contextValue}>{children}</UiLangContext.Provider>;
}

export function useUiLang() {
  return useContext(UiLangContext);
}
