"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { getCookie } from "../../lib/client-cookies";
import { useUiLang } from "../../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const TEXT = {
  ru: {
    loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
    notFound: "\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d",
    follow: "\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u0442\u044c\u0441\u044f",
    unfollow: "\u041e\u0442\u043f\u0438\u0441\u0430\u0442\u044c\u0441\u044f",
    stats: {
      known: "\u0417\u043d\u0430\u0435\u0442",
      learned: "\u0412\u044b\u0443\u0447\u0435\u043d\u043e \u0437\u0430 7 \u0434\u043d\u0435\u0439",
      days: "\u0414\u043d\u0435\u0439 \u0432 \u0443\u0447\u0451\u0431\u0435",
      streak: "\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u0441\u0442\u0440\u0438\u043a",
      best: "\u041b\u0443\u0447\u0448\u0438\u0439 \u0441\u0442\u0440\u0438\u043a"
    }
  },
  en: {
    loading: "Loading...",
    notFound: "Profile not found",
    follow: "Follow",
    unfollow: "Unfollow",
    stats: {
      known: "Known words",
      learned: "Learned in 7 days",
      days: "Days learning",
      streak: "Current streak",
      best: "Best streak"
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
    if (response.status === 404) {
      return null;
    }
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

async function sendJson(path, method, token) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, { method, headers });
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

export default function PublicProfilePage() {
  const params = useParams();
  const handle = params?.handle;
  const { lang } = useUiLang();
  const t = TEXT[lang] || TEXT.ru;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!handle) {
      return;
    }
    const token = getCookie("token");
    setLoading(true);
    setError("");
    getJson(`/social/profile/${handle}`, null)
      .then((data) => {
        setProfile(data);
      })
      .catch((err) => {
        setError(err.message || t.notFound);
      })
      .finally(() => {
        setLoading(false);
      });

    if (token) {
      getJson(`/social/follow/status/${handle}`, token)
        .then((data) => {
          setFollowing(Boolean(data?.following));
        })
        .catch(() => {});
    }
  }, [handle]);

  const toggleFollow = async () => {
    const token = getCookie("token");
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    try {
      if (following) {
        await sendJson(`/social/follow/${handle}`, "DELETE", token);
        setFollowing(false);
      } else {
        await sendJson(`/social/follow/${handle}`, "POST", token);
        setFollowing(true);
      }
    } catch (err) {
      setError(err.message || "Request failed");
    }
  };

  if (loading) {
    return (
      <main>
        <p className="muted">{t.loading}</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main>
        <p className="error">{error || t.notFound}</p>
      </main>
    );
  }

  return (
    <main>
      <div className="panel public-profile-card">
        <div className="public-profile-header">
          <div>
            <h1>@{profile.handle}</h1>
            <p>{profile.display_name || "-"}</p>
          </div>
          <button type="button" onClick={toggleFollow}>
            {following ? t.unfollow : t.follow}
          </button>
        </div>
        {profile.bio ? <p className="muted">{profile.bio}</p> : null}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">{t.stats.known}</div>
          <div className="stat-value">{profile.stats?.known_words ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.stats.learned}</div>
          <div className="stat-value">{profile.stats?.learned_7d ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.stats.days}</div>
          <div className="stat-value">{profile.stats?.days_learning ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.stats.streak}</div>
          <div className="stat-value">{profile.stats?.streak_current ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.stats.best}</div>
          <div className="stat-value">{profile.stats?.streak_best ?? 0}</div>
        </div>
      </div>
    </main>
  );
}
