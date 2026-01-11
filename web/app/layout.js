import "../styles/globals.css";
import { cookies } from "next/headers";

import ThemeClient from "./theme-client";
import SiteNav from "./site-nav";
import Footer from "./footer";
import { UiLangProvider } from "./ui-lang-context";
import OnboardingGate from "./onboarding-gate";

export const metadata = {
  metadataBase: new URL(process.env.APP_BASE_URL || "https://recallio.tech"),
  title: "Recallio",
  description:
    "Recallio — сервис для изучения слов: карточки, тесты, повторения и рост словаря без перегруза.",
  icons: {
    icon: "/brand/R_main.png",
    apple: "/brand/R_main.png"
  },
  openGraph: {
    title: "Recallio",
    description:
      "Умный сервис для изучения слов: карточки, тесты, повторения и рост словаря.",
    url: "/",
    siteName: "Recallio",
    type: "website",
    images: [
      {
        url: "/brand/Recallio_main.png",
        width: 1200,
        height: 630,
        alt: "Recallio"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Recallio",
    description:
      "Умный сервис для изучения слов: карточки, тесты, повторения и рост словаря.",
    images: ["/brand/Recallio_main.png"]
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }) {
  const cookieStore = cookies();
  const langCookie = cookieStore.get("ui_lang")?.value;
  const initialLang = langCookie === "en" ? "en" : "ru";
  const themeCookie = cookieStore.get("theme")?.value;
  const initialTheme = themeCookie === "dark" ? "dark" : "light";
  const adminCookie = cookieStore.get("is_admin")?.value;
  const initialIsAdmin = adminCookie === "1";
  return (
    <html lang={initialLang} data-theme={initialTheme}>
      <body>
        <ThemeClient />
        <UiLangProvider initialLang={initialLang}>
          <OnboardingGate />
          <SiteNav initialIsAdmin={initialIsAdmin} />
          {children}
          <Footer />
        </UiLangProvider>
      </body>
    </html>
  );
}
