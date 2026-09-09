import axios from "axios";
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api/v1", withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("yneet_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Session invalid/expired — there's no local login page anymore, so bounce
      // back to Raise Academy to re-authenticate and re-enter via the SSO bridge.
      localStorage.removeItem("yneet_token");
      localStorage.removeItem("yneet_user");
      const raiseUrl = import.meta.env.VITE_RAISE_ACADEMY_URL || "/";
      window.location.href = raiseUrl;
    } else if (err.response?.status === 402) {
      // Valid session, but no active subscription — send to pricing, not logout.
      if (window.location.pathname !== "/pricing") window.location.href = "/pricing";
    }
    return Promise.reject(err);
  }
);
export default api;
