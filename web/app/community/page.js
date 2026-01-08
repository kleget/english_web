"use client";

import { useEffect, useMemo, useState } from "react";

import { getCookie } from "../lib/client-cookies";
import TourOverlay from "../tour-overlay";
import { useUiLang } from "../ui-lang-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const TEXT = {
  ru: {
    title: "\u0421\u043e\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0435 \u0444\u0438\u0447\u0438",
    tagline:
      "\u041f\u0443\u0431\u043b\u0438\u0447\u043d\u044b\u0439 \u043f\u0440\u043e\u0444\u0438\u043b\u044c, \u0434\u0440\u0443\u0437\u044c\u044f, \u0447\u0435\u043b\u043b\u0435\u043d\u0434\u0436\u0438 \u0438 \u043b\u0438\u0434\u0435\u0440\u0431\u043e\u0440\u0434\u044b.",
    loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
    error: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435.",
    tabs: {
      activity: "\u0410\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c",
      friends: "\u0414\u0440\u0443\u0437\u044c\u044f",
      profile: "\u041f\u0440\u043e\u0444\u0438\u043b\u044c",
      chat: "\u0427\u0430\u0442",
      challenges: "\u0427\u0435\u043b\u043b\u0435\u043d\u0434\u0436\u0438"
    },
    tour: {
      title: "\u0421\u043e\u043e\u0431\u0449\u0435\u0441\u0442\u0432\u043e",
      stepLabel: "\u0428\u0430\u0433",
      back: "\u041d\u0430\u0437\u0430\u0434",
      next: "\u0414\u0430\u043b\u0435\u0435",
      done: "\u0413\u043e\u0442\u043e\u0432\u043e",
      skip: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c",
      steps: [
        {
          key: "community-feed",
          title: "\u041b\u0435\u043d\u0442\u0430 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u0438",
          desc: "\u0421\u043c\u043e\u0442\u0440\u0438, \u0447\u0442\u043e \u0434\u0435\u043b\u0430\u044e\u0442 \u0434\u0440\u0443\u0433\u0438\u0435 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438."
        },
        {
          key: "community-friends",
          title: "\u0414\u0440\u0443\u0437\u044c\u044f \u0438 \u0437\u0430\u044f\u0432\u043a\u0438",
          desc: "\u0414\u043e\u0431\u0430\u0432\u043b\u044f\u0439 \u0434\u0440\u0443\u0437\u0435\u0439 \u0438 \u0443\u043f\u0440\u0430\u0432\u043b\u044f\u0439 \u0437\u0430\u044f\u0432\u043a\u0430\u043c\u0438."
        },
        {
          key: "community-profile-form",
          title: "\u041f\u0443\u0431\u043b\u0438\u0447\u043d\u044b\u0439 \u043f\u0440\u043e\u0444\u0438\u043b\u044c",
          desc: "\u041d\u0430\u0441\u0442\u0440\u043e\u0439 \u043d\u0438\u043a \u0438 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0434\u043b\u044f \u043f\u0440\u043e\u0444\u0438\u043b\u044f."
        },
        {
          key: "community-profile-stats",
          title: "\u041f\u043e\u0434\u043f\u0438\u0441\u0447\u0438\u043a\u0438 \u0438 \u044f \u0441\u043b\u0435\u0436\u0443",
          desc: "\u041f\u0440\u043e\u0432\u0435\u0440\u044c \u043c\u0435\u0442\u0440\u0438\u043a\u0438 \u0438 \u0441\u0441\u044b\u043b\u043a\u0443 \u0434\u043b\u044f \u0448\u0435\u0440\u0438\u043d\u0433\u0430."
        },
        {
          key: "community-chat",
          title: "\u041e\u0431\u0449\u0438\u0439 \u0447\u0430\u0442",
          desc: "\u041e\u0431\u0441\u0443\u0436\u0434\u0430\u0439 \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441 \u0438 \u043f\u043e\u043b\u0443\u0447\u0430\u0439 \u043c\u043e\u0442\u0438\u0432\u0430\u0446\u0438\u044e."
        },
        {
          key: "community-challenges",
          title: "\u0427\u0435\u043b\u043b\u0435\u043d\u0434\u0436\u0438",
          desc: "\u0417\u0430\u043f\u0443\u0441\u043a\u0430\u0439 \u043e\u0431\u0449\u0438\u0435 \u0447\u0435\u043b\u043b\u0435\u043d\u0434\u0436\u0438 \u0438 \u0441\u043b\u0435\u0434\u0438 \u0437\u0430 \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441\u043e\u043c."
        }
      ]
    },
    profile: {
      title: "\u041c\u043e\u0439 \u043f\u0443\u0431\u043b\u0438\u0447\u043d\u044b\u0439 \u043f\u0440\u043e\u0444\u0438\u043b\u044c",
      handle: "\u041d\u0438\u043a (\u043b\u0430\u0442\u0438\u043d\u0438\u0446\u0430)",
      displayName: "\u041e\u0442\u043e\u0431\u0440\u0430\u0436\u0430\u0435\u043c\u043e\u0435 \u0438\u043c\u044f",
      bio: "\u041e \u0441\u0435\u0431\u0435",
      public: "\u0421\u0434\u0435\u043b\u0430\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u044c \u043f\u0443\u0431\u043b\u0438\u0447\u043d\u044b\u043c",
      save: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c",
      saving: "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...",
      saved: "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e",
      share: "\u0421\u0441\u044b\u043b\u043a\u0430 \u0434\u043b\u044f \u0448\u0435\u0440\u0438\u043d\u0433\u0430",
      copy: "\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c",
      followers: "\u041f\u043e\u0434\u043f\u0438\u0441\u0447\u0438\u043a\u0438",
      following: "\u042f \u0441\u043b\u0435\u0436\u0443"
    },
    search: {
      title: "\u041f\u043e\u0438\u0441\u043a",
      hint: "\u041d\u0430\u0439\u0434\u0438 \u0434\u0440\u0443\u0437\u0435\u0439 \u043f\u043e \u043d\u0438\u043a\u0443 \u0438\u043b\u0438 \u0438\u043c\u0435\u043d\u0438.",
      placeholder: "\u041d\u0438\u043a \u0438\u043b\u0438 \u0438\u043c\u044f",
      action: "\u041d\u0430\u0439\u0442\u0438",
      empty: "\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e"
    },
    actions: {
      follow: "\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u0442\u044c\u0441\u044f",
      unfollow: "\u041e\u0442\u043f\u0438\u0441\u0430\u0442\u044c\u0441\u044f",
      open: "\u041e\u0442\u043a\u0440\u044b\u0442\u044c"
    },
    feed: {
      title: "\u041b\u0435\u043d\u0442\u0430 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u0438",
      empty: "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u0438.",
      learn: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u043b(\u0430) \u0438\u0437\u0443\u0447\u0435\u043d\u0438\u0435",
      review: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u043b(\u0430) \u043f\u043e\u0432\u0442\u043e\u0440\u0435\u043d\u0438\u0435",
      challenge: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u043b(\u0430) \u0447\u0435\u043b\u043b\u0435\u043d\u0434\u0436",
      friendship: "\u041f\u043e\u0434\u0440\u0443\u0436\u0438\u043b\u0441\u044f(\u0430\u0441\u044c) \u0441",
      groupJoin: "\u0412\u0441\u0442\u0443\u043f\u0438\u043b(\u0430) \u0432 \u043e\u0431\u0449\u0438\u0439 \u0447\u0435\u043b\u043b\u0435\u043d\u0434\u0436"
    },
    friends: {
      title: "\u0414\u0440\u0443\u0437\u044c\u044f",
      addTitle: "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0432 \u0434\u0440\u0443\u0437\u044c\u044f",
      handlePlaceholder: "\u041d\u0438\u043a",
      addAction: "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c",
      requests: "\u0412\u0445\u043e\u0434\u044f\u0449\u0438\u0435 \u0438 \u0438\u0441\u0445\u043e\u0434\u044f\u0449\u0438\u0435 \u0437\u0430\u044f\u0432\u043a\u0438",
      emptyRequests: "\u041d\u0435\u0442 \u0437\u0430\u044f\u0432\u043e\u043a.",
      list: "\u041c\u043e\u0438 \u0434\u0440\u0443\u0437\u044c\u044f",
      emptyFriends: "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0434\u0440\u0443\u0437\u0435\u0439.",
      accept: "\u041f\u0440\u0438\u043d\u044f\u0442\u044c",
      decline: "\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c",
      remove: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c",
      requestSent: "\u0417\u0430\u044f\u0432\u043a\u0430 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0430",
      pending: "\u041e\u0436\u0438\u0434\u0430\u0435\u0442"
    },
    chat: {
      title: "\u041e\u0431\u0449\u0438\u0439 \u0447\u0430\u0442",
      placeholder: "\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435",
      send: "\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c",
      refresh: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c",
      empty: "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439."
    },
    groups: {
      title: "\u041e\u0431\u0449\u0438\u0435 \u0447\u0435\u043b\u043b\u0435\u043d\u0434\u0436\u0438",
      create: "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0447\u0435\u043b\u043b\u0435\u043d\u0434\u0436",
      join: "\u0412\u0441\u0442\u0443\u043f\u0438\u0442\u044c \u043f\u043e \u043a\u043e\u0434\u0443",
      selectLabel: "\u0422\u0438\u043f \u0447\u0435\u043b\u043b\u0435\u043d\u0434\u0436\u0430",
      titleLabel: "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 (\u043e\u043f\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e)",
      codeLabel: "\u041a\u043e\u0434 \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u044f",
      createAction: "\u0421\u043e\u0437\u0434\u0430\u0442\u044c",
      joinAction: "\u0412\u0441\u0442\u0443\u043f\u0438\u0442\u044c",
      list: "\u041c\u043e\u0438 \u0447\u0435\u043b\u043b\u0435\u043d\u0434\u0436\u0438",
      empty: "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043e\u0431\u0449\u0438\u0445 \u0447\u0435\u043b\u043b\u0435\u043d\u0434\u0436\u0435\u0439.",
      members: "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438",
      membersCount: "\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432",
      details: "\u0414\u0435\u0442\u0430\u043b\u0438",
      leave: "\u0412\u044b\u0439\u0442\u0438",
      ends: "\u0414\u043e",
      status: "\u0421\u0442\u0430\u0442\u0443\u0441"
    },
    leaderboard: {
      title: "\u041b\u0438\u0434\u0435\u0440\u0431\u043e\u0440\u0434 \u0437\u0430 7 \u0434\u043d\u0435\u0439",
      learned: "\u0412\u044b\u0443\u0447\u0435\u043d\u043e",
      known: "\u0417\u043d\u0430\u0435\u0442"
    },
    challenges: {
      title: "\u0427\u0435\u043b\u043b\u0435\u043d\u0434\u0436\u0438",
      my: "\u041c\u043e\u0438 \u0447\u0435\u043b\u043b\u0435\u043d\u0434\u0436\u0438",
      start: "\u041d\u0430\u0447\u0430\u0442\u044c",
      active: "\u0410\u043a\u0442\u0438\u0432\u0435\u043d",
      completed: "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d",
      expired: "\u0418\u0441\u0442\u0435\u043a",
      progress: "\u041f\u0440\u043e\u0433\u0440\u0435\u0441\u0441"
    }
  },
  en: {
    title: "Community",
    tagline: "Public profile, friends, challenges, and leaderboards.",
    loading: "Loading...",
    error: "Failed to load data.",
    tabs: {
      activity: "Activity",
      friends: "Friends",
      profile: "Profile",
      chat: "Chat",
      challenges: "Challenges"
    },
    tour: {
      title: "Community",
      stepLabel: "Step",
      back: "Back",
      next: "Next",
      done: "Done",
      skip: "End tour",
      steps: [
        {
          key: "community-feed",
          title: "Activity feed",
          desc: "See what other learners are doing."
        },
        {
          key: "community-friends",
          title: "Friends",
          desc: "Add friends and manage requests."
        },
        {
          key: "community-profile-form",
          title: "Public profile",
          desc: "Set up your handle and bio."
        },
        {
          key: "community-profile-stats",
          title: "Followers & following",
          desc: "Check your stats and share link."
        },
        {
          key: "community-chat",
          title: "Global chat",
          desc: "Discuss progress and stay motivated."
        },
        {
          key: "community-challenges",
          title: "Challenges",
          desc: "Join group challenges and track progress."
        }
      ]
    },
    profile: {
      title: "My public profile",
      handle: "Handle",
      displayName: "Display name",
      bio: "Bio",
      public: "Make profile public",
      save: "Save",
      saving: "Saving...",
      saved: "Saved",
      share: "Share link",
      copy: "Copy",
      followers: "Followers",
      following: "Following"
    },
    search: {
      title: "Search",
      hint: "Find friends by handle or name.",
      placeholder: "Handle or name",
      action: "Search",
      empty: "No results"
    },
    actions: {
      follow: "Follow",
      unfollow: "Unfollow",
      open: "Open"
    },
    feed: {
      title: "Activity feed",
      empty: "No activity yet.",
      learn: "Completed learning",
      review: "Completed review",
      challenge: "Completed challenge",
      friendship: "Became friends with",
      groupJoin: "Joined a group challenge"
    },
    friends: {
      title: "Friends",
      addTitle: "Add a friend",
      handlePlaceholder: "Handle",
      addAction: "Send",
      requests: "Incoming and outgoing requests",
      emptyRequests: "No requests.",
      list: "My friends",
      emptyFriends: "No friends yet.",
      accept: "Accept",
      decline: "Decline",
      remove: "Remove",
      requestSent: "Request sent",
      pending: "Pending"
    },
    chat: {
      title: "Global chat",
      placeholder: "Message",
      send: "Send",
      refresh: "Refresh",
      empty: "No messages yet."
    },
    groups: {
      title: "Group challenges",
      create: "Create challenge",
      join: "Join by code",
      selectLabel: "Challenge type",
      titleLabel: "Title (optional)",
      codeLabel: "Invite code",
      createAction: "Create",
      joinAction: "Join",
      list: "My challenges",
      empty: "No group challenges yet.",
      members: "Members",
      membersCount: "Members",
      details: "Details",
      leave: "Leave",
      ends: "Ends",
      status: "Status"
    },
    leaderboard: {
      title: "Leaderboard (7 days)",
      learned: "Learned",
      known: "Known"
    },
    challenges: {
      title: "Challenges",
      my: "My challenges",
      start: "Start",
      active: "Active",
      completed: "Completed",
      expired: "Expired",
      progress: "Progress"
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

async function sendJson(path, method, payload, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined
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

export default function CommunityPage() {
  const { lang } = useUiLang();
  const t = TEXT[lang] || TEXT.ru;
  const tourSteps = t.tour ? t.tour.steps || [] : [];
  const tourLabels = t.tour || {};
  const [activeSection, setActiveSection] = useState("activity");
  const sectionKeys = ["activity", "friends", "profile", "chat", "challenges"];
  const handleTourStep = (step) => {
    if (!step) {
      return;
    }
    const map = {
      "community-feed": "activity",
      "community-friends": "friends",
      "community-profile-form": "profile",
      "community-profile-stats": "profile",
      "community-chat": "chat",
      "community-challenges": "challenges"
    };
    const next = map[step.key];
    if (next) {
      setActiveSection((prev) => (prev === next ? prev : next));
    }
  };
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    handle: "",
    display_name: "",
    bio: "",
    is_public: false
  });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [saveError, setSaveError] = useState("");

  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [myChallenges, setMyChallenges] = useState([]);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  const [feed, setFeed] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [friendHandle, setFriendHandle] = useState("");
  const [friendStatus, setFriendStatus] = useState("");
  const [friendError, setFriendError] = useState("");
  const hasRequests = incomingRequests.length > 0 || outgoingRequests.length > 0;

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [chatSending, setChatSending] = useState(false);

  const [groupChallenges, setGroupChallenges] = useState([]);
  const [groupKey, setGroupKey] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [groupDetail, setGroupDetail] = useState(null);
  const [groupError, setGroupError] = useState("");

  useEffect(() => {
    const tokenValue = getCookie("token");
    if (!tokenValue) {
      window.location.href = "/auth";
      return;
    }
    setToken(tokenValue);
    Promise.all([
      getJson("/social/profile/me", tokenValue),
      getJson("/social/leaderboard", tokenValue),
      getJson("/social/challenges", tokenValue),
      getJson("/social/challenges/my", tokenValue),
      getJson("/social/followers", tokenValue),
      getJson("/social/following", tokenValue),
      getJson("/social/feed", tokenValue),
      getJson("/social/friends", tokenValue),
      getJson("/social/friends/requests?direction=incoming", tokenValue),
      getJson("/social/friends/requests?direction=outgoing", tokenValue),
      getJson("/social/chat/messages?limit=30", tokenValue),
      getJson("/social/group-challenges", tokenValue)
    ])
      .then(
        ([
          profileData,
          leaderboardData,
          challengesData,
          myChallengesData,
          followersData,
          followingData,
          feedData,
          friendsData,
          incomingData,
          outgoingData,
          chatData,
          groupData
        ]) => {
        setProfile(profileData);
        setForm({
          handle: profileData.handle || "",
          display_name: profileData.display_name || "",
          bio: profileData.bio || "",
          is_public: Boolean(profileData.is_public)
        });
        const challengeList = Array.isArray(challengesData) ? challengesData : [];
        setLeaderboard(Array.isArray(leaderboardData) ? leaderboardData : []);
        setChallenges(challengeList);
        setMyChallenges(Array.isArray(myChallengesData) ? myChallengesData : []);
        setFollowers(Array.isArray(followersData) ? followersData : []);
        setFollowing(Array.isArray(followingData) ? followingData : []);
        setFeed(Array.isArray(feedData) ? feedData : []);
        setFriends(Array.isArray(friendsData) ? friendsData : []);
        setIncomingRequests(Array.isArray(incomingData) ? incomingData : []);
        setOutgoingRequests(Array.isArray(outgoingData) ? outgoingData : []);
        setChatMessages(Array.isArray(chatData) ? chatData : []);
        setGroupChallenges(Array.isArray(groupData) ? groupData : []);
        if (!groupKey && challengeList.length) {
          setGroupKey(challengeList[0].key);
        }
      })
      .catch((err) => {
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
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setSaveStatus("");
    setSaveError("");
  }, [form.handle, form.display_name, form.bio, form.is_public]);

  const shareUrl = useMemo(() => {
    if (!profile?.handle || typeof window === "undefined") {
      return "";
    }
    return `${window.location.origin}/u/${profile.handle}`;
  }, [profile]);

  const formatTime = (value) => {
    if (!value) {
      return "";
    }
    const locale = lang === "ru" ? "ru-RU" : "en-US";
    try {
      return new Date(value).toLocaleString(locale, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "";
    }
  };

  const challengeTitle = (key) => {
    if (!key) {
      return "";
    }
    const match = challenges.find((item) => item.key === key);
    if (!match) {
      return key;
    }
    return match.title?.[lang] || match.title?.ru || match.title?.en || key;
  };

  const formatFeedText = (item) => {
    const payload = item?.payload || {};
    if (item?.event_type === "study") {
      const label = payload.session_type === "review" ? t.feed.review : t.feed.learn;
      const total = payload.words_total ?? 0;
      const correct = payload.words_correct ?? total;
      return `${label}: ${correct}/${total}`;
    }
    if (item?.event_type === "challenge") {
      return `${t.feed.challenge}: ${challengeTitle(payload.challenge_key)}`;
    }
    if (item?.event_type === "friendship") {
      const friend = payload.friend_handle ? `@${payload.friend_handle}` : "";
      return `${t.feed.friendship} ${friend}`.trim();
    }
    if (item?.event_type === "group_join") {
      return `${t.feed.groupJoin}: ${challengeTitle(payload.challenge_key)}`;
    }
    return "";
  };

  const refreshFeed = async () => {
    if (!token) {
      return;
    }
    try {
      const data = await getJson("/social/feed", token);
      setFeed(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t.error);
    }
  };

  const refreshFriends = async () => {
    if (!token) {
      return;
    }
    try {
      const [friendsData, incomingData, outgoingData] = await Promise.all([
        getJson("/social/friends", token),
        getJson("/social/friends/requests?direction=incoming", token),
        getJson("/social/friends/requests?direction=outgoing", token)
      ]);
      setFriends(Array.isArray(friendsData) ? friendsData : []);
      setIncomingRequests(Array.isArray(incomingData) ? incomingData : []);
      setOutgoingRequests(Array.isArray(outgoingData) ? outgoingData : []);
    } catch (err) {
      setFriendError(err.message || t.error);
    }
  };

  const refreshChat = async () => {
    if (!token) {
      return;
    }
    try {
      const data = await getJson("/social/chat/messages?limit=30", token);
      setChatMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setChatError(err.message || t.error);
    }
  };

  const refreshGroups = async () => {
    if (!token) {
      return;
    }
    try {
      const data = await getJson("/social/group-challenges", token);
      setGroupChallenges(Array.isArray(data) ? data : []);
    } catch (err) {
      setGroupError(err.message || t.error);
    }
  };

  const saveProfile = async () => {
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    setSaving(true);
    setSaveStatus("");
    setSaveError("");
    try {
      const data = await sendJson("/social/profile", "PUT", form, token);
      setProfile(data);
      setSaveStatus(t.profile.saved);
    } catch (err) {
      setSaveError(err.message || t.error);
    } finally {
      setSaving(false);
    }
  };

  const copyShare = async () => {
    if (!shareUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setSaveStatus(t.profile.saved);
    } catch {
      setSaveError(t.error);
    }
  };

  const sendFriendRequest = async () => {
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    const handle = friendHandle.trim();
    if (!handle) {
      return;
    }
    setFriendError("");
    setFriendStatus("");
    try {
      await sendJson("/social/friends/requests", "POST", { handle }, token);
      setFriendHandle("");
      setFriendStatus(t.friends.requestSent);
      await refreshFriends();
      await refreshFeed();
    } catch (err) {
      setFriendError(err.message || t.error);
    }
  };

  const acceptFriendRequest = async (id) => {
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    try {
      await sendJson(`/social/friends/requests/${id}/accept`, "POST", {}, token);
      await refreshFriends();
      await refreshFeed();
    } catch (err) {
      setFriendError(err.message || t.error);
    }
  };

  const declineFriendRequest = async (id) => {
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    try {
      await sendJson(`/social/friends/requests/${id}/decline`, "POST", {}, token);
      await refreshFriends();
    } catch (err) {
      setFriendError(err.message || t.error);
    }
  };

  const removeFriend = async (handle) => {
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    try {
      await sendJson(`/social/friends/${handle}`, "DELETE", null, token);
      await refreshFriends();
    } catch (err) {
      setFriendError(err.message || t.error);
    }
  };

  const sendChatMessage = async () => {
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    const message = chatInput.trim();
    if (!message) {
      return;
    }
    setChatSending(true);
    setChatError("");
    try {
      await sendJson("/social/chat/messages", "POST", { message }, token);
      setChatInput("");
      await refreshChat();
    } catch (err) {
      setChatError(err.message || t.error);
    } finally {
      setChatSending(false);
    }
  };

  const createGroupChallenge = async () => {
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    if (!groupKey) {
      return;
    }
    setGroupError("");
    try {
      await sendJson(
        "/social/group-challenges",
        "POST",
        { challenge_key: groupKey, title: groupTitle },
        token
      );
      setGroupTitle("");
      await refreshGroups();
    } catch (err) {
      setGroupError(err.message || t.error);
    }
  };

  const joinGroupChallenge = async () => {
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    const code = groupCode.trim();
    if (!code) {
      return;
    }
    setGroupError("");
    try {
      await sendJson("/social/group-challenges/join", "POST", { invite_code: code }, token);
      setGroupCode("");
      await refreshGroups();
    } catch (err) {
      setGroupError(err.message || t.error);
    }
  };

  const loadGroupDetail = async (id) => {
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    setGroupError("");
    try {
      const data = await getJson(`/social/group-challenges/${id}`, token);
      setGroupDetail(data);
    } catch (err) {
      setGroupError(err.message || t.error);
    }
  };

  const leaveGroupChallenge = async (id) => {
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    setGroupError("");
    try {
      await sendJson(`/social/group-challenges/${id}/leave`, "POST", {}, token);
      if (groupDetail?.group?.id === id) {
        setGroupDetail(null);
      }
      await refreshGroups();
    } catch (err) {
      setGroupError(err.message || t.error);
    }
  };

  const runSearch = async () => {
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    setSearching(true);
    setSearchError("");
    try {
      const data = await getJson(`/social/search?query=${encodeURIComponent(query)}`, token);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      setSearchError(err.message || t.error);
    } finally {
      setSearching(false);
    }
  };

  const toggleFollow = async (handle, isFollowing) => {
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    try {
      if (isFollowing) {
        await sendJson(`/social/follow/${handle}`, "DELETE", null, token);
      } else {
        await sendJson(`/social/follow/${handle}`, "POST", {}, token);
      }
      const updatedFollowing = await getJson("/social/following", token);
      setFollowing(Array.isArray(updatedFollowing) ? updatedFollowing : []);
      setSearchResults((prev) =>
        prev.map((item) =>
          item.handle === handle ? { ...item, is_following: !isFollowing } : item
        )
      );
    } catch (err) {
      setSearchError(err.message || t.error);
    }
  };

  const startChallenge = async (challengeKey) => {
    if (!token) {
      window.location.href = "/auth";
      return;
    }
    try {
      await sendJson("/social/challenges/start", "POST", { challenge_key: challengeKey }, token);
      const data = await getJson("/social/challenges/my", token);
      setMyChallenges(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t.error);
    }
  };

  const challengeStatusLabel = (status) => {
    if (status === "completed") {
      return t.challenges.completed;
    }
    if (status === "expired") {
      return t.challenges.expired;
    }
    return t.challenges.active;
  };

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.tagline}</p>
        </div>
      </div>

      {loading ? <p className="muted">{t.loading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && profile ? (
        <>
          <div className="community-tabs">
            <div className="segmented">
              {sectionKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={activeSection === key ? "is-active" : ""}
                  onClick={() => setActiveSection(key)}
                >
                  {t.tabs[key]}
                </button>
              ))}
            </div>
          </div>
          {activeSection === "activity" ? (
            <div className="panel" data-tour="community-feed">
              <div className="panel-title">{t.feed.title}</div>
              {feed.length === 0 ? (
                <p className="muted">{t.feed.empty}</p>
              ) : (
                <div className="feed-list">
                  {feed.map((item, index) => (
                    <div
                      key={`${item.event_type}-${item.created_at}-${index}`}
                      className="feed-item"
                    >
                      <div className="feed-main">
                        <strong>@{item.actor.handle}</strong>
                        <span className="feed-text">{formatFeedText(item)}</span>
                      </div>
                      <div className="feed-time">{formatTime(item.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {activeSection === "friends" ? (
            <div className="panel" data-tour="community-friends">
              <div className="panel-title">{t.friends.title}</div>
              <div className="community-grid">
                <div className="community-card community-card-compact community-card-tight">
                  <div className="panel-title">{t.friends.addTitle}</div>
                  <div className="community-inline">
                    <input
                      value={friendHandle}
                      placeholder={t.friends.handlePlaceholder}
                      onChange={(event) => setFriendHandle(event.target.value)}
                    />
                    <button type="button" onClick={sendFriendRequest}>
                      {t.friends.addAction}
                    </button>
                  </div>
                  {friendStatus ? <p className="success">{friendStatus}</p> : null}
                  {friendError ? <p className="error">{friendError}</p> : null}
                </div>
                <div className="community-card community-card-compact">
                  <div className="panel-title">{t.friends.requests}</div>
                  {hasRequests ? (
                    <div className="social-list">
                      {incomingRequests.map((item) => (
                        <div key={`incoming-${item.id}`} className="social-item">
                          <div>
                            <strong>@{item.handle}</strong>
                            <div className="social-meta">{item.display_name || "-"}</div>
                          </div>
                          <div className="community-inline">
                            <button type="button" onClick={() => acceptFriendRequest(item.id)}>
                              {t.friends.accept}
                            </button>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => declineFriendRequest(item.id)}
                            >
                              {t.friends.decline}
                            </button>
                          </div>
                        </div>
                      ))}
                      {outgoingRequests.map((item) => (
                        <div key={`outgoing-${item.id}`} className="social-item">
                          <div>
                            <strong>@{item.handle}</strong>
                            <div className="social-meta">{item.display_name || "-"}</div>
                          </div>
                          <span className="status-pill warn">{t.friends.pending}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">{t.friends.emptyRequests}</p>
                  )}
                </div>
              </div>
              <div className="panel-title">{t.friends.list}</div>
              {friends.length === 0 ? (
                <p className="muted">{t.friends.emptyFriends}</p>
              ) : (
                <div className="social-list">
                  {friends.map((item) => (
                    <div key={item.handle} className="social-item">
                      <div>
                        <strong>@{item.handle}</strong>
                        <div className="social-meta">{item.display_name || "-"}</div>
                      </div>
                      <div className="community-inline">
                        <a className="button-secondary" href={`/u/${item.handle}`}>
                          {t.actions.open}
                        </a>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => removeFriend(item.handle)}
                        >
                          {t.friends.remove}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {activeSection === "challenges" ? (
            <div className="panel">
              <div className="panel-title">{t.groups.title}</div>
            <div className="community-grid">
              <div className="community-card">
                <div className="panel-title">{t.groups.create}</div>
                <label>{t.groups.selectLabel}</label>
                <select value={groupKey} onChange={(event) => setGroupKey(event.target.value)}>
                  {challenges.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.title?.[lang] || item.title?.ru}
                    </option>
                  ))}
                </select>
                <label>{t.groups.titleLabel}</label>
                <input
                  value={groupTitle}
                  onChange={(event) => setGroupTitle(event.target.value)}
                />
                <button type="button" onClick={createGroupChallenge}>
                  {t.groups.createAction}
                </button>
              </div>
              <div className="community-card">
                <div className="panel-title">{t.groups.join}</div>
                <label>{t.groups.codeLabel}</label>
                <input value={groupCode} onChange={(event) => setGroupCode(event.target.value)} />
                <button type="button" onClick={joinGroupChallenge}>
                  {t.groups.joinAction}
                </button>
              </div>
            </div>
            {groupError ? <p className="error">{groupError}</p> : null}
            <div className="panel-title">{t.groups.list}</div>
            {groupChallenges.length === 0 ? (
              <p className="muted">{t.groups.empty}</p>
            ) : (
              <div className="social-list">
                {groupChallenges.map((item) => (
                  <div key={item.id} className="social-item">
                    <div>
                      <strong>{challengeTitle(item.challenge_key)}</strong>
                      <div className="social-meta">
                        {t.groups.membersCount}: {item.members_count} · {t.groups.ends}{" "}
                        {formatTime(item.ends_at)}
                      </div>
                      <div className="social-meta">Code: {item.invite_code}</div>
                    </div>
                    <div className="community-inline">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => loadGroupDetail(item.id)}
                      >
                        {t.groups.details}
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => leaveGroupChallenge(item.id)}
                      >
                        {t.groups.leave}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
              {groupDetail ? (
                <div className="panel group-detail">
                  <div className="panel-title">{t.groups.members}</div>
                  <div className="social-list">
                    {groupDetail.members.map((member) => (
                      <div key={member.handle} className="social-item">
                        <div>
                          <strong>@{member.handle}</strong>
                          <div className="social-meta">{member.display_name || "-"}</div>
                        </div>
                        <div className="group-progress">
                          <span>
                            {member.progress}/{member.target}
                          </span>
                          <div className="progress-bar">
                            <span
                              style={{
                                width: `${Math.min(100, (member.progress / member.target) * 100)}%`
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeSection === "chat" ? (
            <div className="panel" data-tour="community-chat">
              <div className="panel-title">{t.chat.title}</div>
              <div className="chat-panel">
              <div className="chat-header">
                <button type="button" className="button-secondary" onClick={refreshChat}>
                  {t.chat.refresh}
                </button>
              </div>
              <div className="chat-messages">
                {chatMessages.length === 0 ? (
                  <p className="muted">{t.chat.empty}</p>
                ) : (
                  chatMessages.map((item) => (
                    <div key={item.id} className="chat-message">
                      <div className="chat-meta">
                        <strong>@{item.author.handle}</strong>
                        <span>{formatTime(item.created_at)}</span>
                      </div>
                      <div className="chat-text">{item.message}</div>
                    </div>
                  ))
                )}
              </div>
              <div className="chat-input">
                <input
                  value={chatInput}
                  placeholder={t.chat.placeholder}
                  onChange={(event) => setChatInput(event.target.value)}
                />
                <button type="button" onClick={sendChatMessage} disabled={chatSending}>
                  {t.chat.send}
                </button>
              </div>
                {chatError ? <p className="error">{chatError}</p> : null}
              </div>
            </div>
          ) : null}

          {activeSection === "profile" ? (
            <div className="panel">
              <div className="panel-title">{t.profile.title}</div>
              <div className="community-grid">
                <div className="community-form" data-tour="community-profile-form">
                  <label>{t.profile.handle}</label>
                  <input
                    value={form.handle}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, handle: event.target.value }))
                    }
                  />
                  <label>{t.profile.displayName}</label>
                  <input
                    value={form.display_name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, display_name: event.target.value }))
                    }
                  />
                  <label>{t.profile.bio}</label>
                  <textarea
                    value={form.bio}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, bio: event.target.value }))
                    }
                  />
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.is_public}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, is_public: event.target.checked }))
                      }
                    />
                    <span>{t.profile.public}</span>
                  </label>
                  <div className="community-inline">
                    <button type="button" onClick={saveProfile} disabled={saving}>
                      {saving ? t.profile.saving : t.profile.save}
                    </button>
                    {saveStatus ? <span className="success">{saveStatus}</span> : null}
                    {saveError ? <span className="error">{saveError}</span> : null}
                  </div>
                </div>
                <div className="community-card" data-tour="community-profile-stats">
                  <div className="community-stat">
                    <div className="community-stat-label">{t.profile.followers}</div>
                    <div className="community-stat-value">{profile.followers}</div>
                  </div>
                  <div className="community-stat">
                    <div className="community-stat-label">{t.profile.following}</div>
                    <div className="community-stat-value">{profile.following}</div>
                  </div>
                  <div className="community-share">
                    <div className="panel-title">{t.profile.share}</div>
                    <input value={shareUrl} readOnly />
                    <button type="button" className="button-secondary" onClick={copyShare}>
                      {t.profile.copy}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "friends" ? (
            <div className="panel">
              <div className="panel-title">{t.search.title}</div>
              <p className="muted">{t.search.hint}</p>
              <div className="community-inline">
                <input
                  value={query}
                  placeholder={t.search.placeholder}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <button type="button" onClick={runSearch} disabled={searching || query.length < 2}>
                  {t.search.action}
                </button>
              </div>
              {searchError ? <p className="error">{searchError}</p> : null}
              {!searching && query.length >= 2 && searchResults.length === 0 ? (
                <p className="muted">{t.search.empty}</p>
              ) : null}
              {searchResults.length ? (
                <div className="social-list">
                  {searchResults.map((item) => (
                    <div key={item.handle} className="social-item">
                      <div>
                        <strong>@{item.handle}</strong>
                        <div className="social-meta">{item.display_name || "-"}</div>
                      </div>
                      <div className="community-inline">
                        <a className="button-secondary" href={`/u/${item.handle}`}>
                          {t.actions.open}
                        </a>
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() => toggleFollow(item.handle, item.is_following)}
                        >
                          {item.is_following ? t.actions.unfollow : t.actions.follow}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {activeSection === "activity" ? (
            <div className="panel">
              <div className="panel-title">{t.leaderboard.title}</div>
              <div className="social-list">
                {leaderboard.map((row) => (
                  <div key={row.handle} className="social-item">
                    <div className="leaderboard-rank">#{row.rank}</div>
                    <div className="leaderboard-main">
                      <strong>@{row.handle}</strong>
                      <div className="social-meta">{row.display_name || "-"}</div>
                    </div>
                    <div className="leaderboard-stats">
                      <span>
                        {t.leaderboard.learned}: {row.learned_7d}
                      </span>
                      <span>
                        {t.leaderboard.known}: {row.known_words}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeSection === "challenges" ? (
            <div className="panel" data-tour="community-challenges">
              <div className="panel-title">{t.challenges.title}</div>
              <div className="community-grid">
                <div className="social-list">
                  {challenges.map((item) => (
                    <div key={item.key} className="challenge-card">
                      <div className="challenge-title">
                        {item.title?.[lang] || item.title?.ru}
                      </div>
                      <div className="social-meta">
                        {item.description?.[lang] || item.description?.ru}
                      </div>
                      <div className="community-inline">
                        <span>
                          {t.challenges.progress}: {item.target}
                        </span>
                        <button type="button" onClick={() => startChallenge(item.key)}>
                          {t.challenges.start}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="social-list">
                  <div className="panel-title">{t.challenges.my}</div>
                  {myChallenges.length === 0 ? (
                    <p className="muted">{t.search.empty}</p>
                  ) : null}
                  {myChallenges.map((item) => (
                    <div key={item.id} className="challenge-card">
                      <div className="challenge-title">
                        {item.title?.[lang] || item.title?.ru}
                      </div>
                      <div className="social-meta">
                        {item.description?.[lang] || item.description?.ru}
                      </div>
                      <div className="community-inline">
                        <span className="status-pill ok">{challengeStatusLabel(item.status)}</span>
                        <span>
                          {item.progress}/{item.target}
                        </span>
                      </div>
                      <div className="progress-bar">
                        <span
                          style={{
                            width: `${Math.min(100, (item.progress / item.target) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "friends" ? (
            <div className="panel">
              <div className="panel-title">{t.profile.followers}</div>
              <div className="community-grid">
                <div className="social-list">
                  {followers.map((item) => (
                    <div key={item.handle} className="social-item">
                      <div>
                        <strong>@{item.handle}</strong>
                        <div className="social-meta">{item.display_name || "-"}</div>
                      </div>
                      <a className="button-secondary" href={`/u/${item.handle}`}>
                        {t.actions.open}
                      </a>
                    </div>
                  ))}
                </div>
                <div className="social-list">
                  <div className="panel-title">{t.profile.following}</div>
                  {following.map((item) => (
                    <div key={item.handle} className="social-item">
                      <div>
                        <strong>@{item.handle}</strong>
                        <div className="social-meta">{item.display_name || "-"}</div>
                      </div>
                      <a className="button-secondary" href={`/u/${item.handle}`}>
                        {t.actions.open}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <TourOverlay
            steps={tourSteps}
            labels={tourLabels}
            stage="community"
            onStepChange={handleTourStep}
          />
        </>
      ) : null}
    </main>
  );
}
