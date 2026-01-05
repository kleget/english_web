"use client";

import { useEffect } from "react";

import { getCookie } from "./lib/client-cookies";

export default function ThemeClient() {
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme") || getCookie("theme");
    if (storedTheme) {
      document.documentElement.dataset.theme = storedTheme;
    }
  }, []);

  return null;
}
