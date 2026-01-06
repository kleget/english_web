import "../styles/globals.css";
import { cookies } from "next/headers";

import ThemeClient from "./theme-client";
import SiteNav from "./site-nav";
import { UiLangProvider } from "./ui-lang-context";
import OnboardingGate from "./onboarding-gate";

export const metadata = {
  title: "English Web",
  description: "MVP"
};

export default function RootLayout({ children }) {
  const cookieStore = cookies();
  const langCookie = cookieStore.get("ui_lang")?.value;
  const initialLang = langCookie === "en" ? "en" : "ru";
  const themeCookie = cookieStore.get("theme")?.value;
  const initialTheme = themeCookie === "dark" ? "dark" : "light";
  return (
    <html lang={initialLang} data-theme={initialTheme}>
      <body>
        <ThemeClient />
        <UiLangProvider initialLang={initialLang}>
          <OnboardingGate />
          <SiteNav />
          {children}
        </UiLangProvider>
      </body>
    </html>
  );
}
