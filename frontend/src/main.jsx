import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary";
import { installErrorReporting } from "./lib/errorReport";

installErrorReporting();
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Offline shell + installability (production only, so dev hot-reload isn't cached).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Back button after logout: browsers can show a page from memory (back/forward
// cache) without running any code, so a signed-out student could still see the
// app. Reload such pages; the sign-in check then sends them to the website.
window.addEventListener("pageshow", (e) => {
  if (e.persisted && !localStorage.getItem("yneet_token") && !location.pathname.startsWith("/creator")) location.reload();
});
