import "../styles/globals.css";
import { cookies } from "next/headers";

import ThemeClient from "./theme-client";
import SiteNav from "./site-nav";
import { UiLangProvider } from "./ui-lang-context";

export const metadata = {
  title: "English Web",
  description: "MVP"
};

export default function RootLayout({ children }) {
  const cookieStore = cookies();
  const langCookie = cookieStore.get("ui_lang")?.value;
  const initialLang = langCookie === "en" ? "en" : "ru";
  return (
    <html lang={initialLang}>
      <body>
        <ThemeClient />
        <UiLangProvider initialLang={initialLang}>
          <SiteNav />
          {children}
        </UiLangProvider>
      </body>
    </html>
  );
}
