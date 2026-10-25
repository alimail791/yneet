import axios from "axios";

// Separate client for the creator dashboard: its own token, and a 401 sends the
// creator to /creator/login (the student client bounces to Raise Academy instead).
export const CREATOR_TOKEN = "yneet_creator_token";
const creatorApi = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api/v1" });

creatorApi.interceptors.request.use((config) => {
  try {
    const t = localStorage.getItem(CREATOR_TOKEN);
    if (t) config.headers.Authorization = `Bearer ${t}`;
  } catch { /* storage unavailable */ }
  return config;
});

creatorApi.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || "";
    if (err.response?.status === 401 && !url.includes("/creator/login") && !url.includes("/creator/apply")) {
      try { localStorage.removeItem(CREATOR_TOKEN); } catch { /* ignore */ }
      if (!window.location.pathname.startsWith("/creator/login")) window.location.href = "/creator/login";
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e, fallback = "Something went wrong") => e?.response?.data?.message || fallback;
export default creatorApi;
