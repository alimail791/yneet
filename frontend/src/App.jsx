import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/layout/Layout";
import BridgePage           from "./pages/BridgePage";
import PricingPage          from "./pages/PricingPage";
import DashboardPage        from "./pages/DashboardPage";
import MockPage             from "./pages/MockPage";
import MockTestPage         from "./pages/MockTestPage";
import AnalysisPage         from "./pages/AnalysisPage";
import QuizPage             from "./pages/QuizPage";
import PracticePage         from "./pages/PracticePage";
import PlannerPage          from "./pages/PlannerPage";
import BiologyPage          from "./pages/BiologyPage";
import PhysicsPage          from "./pages/PhysicsPage";
import ChemistryPage        from "./pages/ChemistryPage";
import MistakesPage         from "./pages/MistakesPage";
import ProfilePage          from "./pages/ProfilePage";
import ReferralPage         from "./pages/ReferralPage";
import AdminLayout          from "./components/admin/AdminLayout";
import AdminSummaryPage     from "./pages/admin/AdminSummaryPage";
import AdminUsersPage       from "./pages/admin/AdminUsersPage";
import AdminQuestionsPage   from "./pages/admin/AdminQuestionsPage";
import AdminMockTestsPage   from "./pages/admin/AdminMockTestsPage";
import AdminFlashcardsPage  from "./pages/admin/AdminFlashcardsPage";
import AdminFormulasPage    from "./pages/admin/AdminFormulasPage";

// There is no local login here anymore — a session only ever starts via
// /bridge?token=... coming from the Raise Academy "YNeet" button.
function Guard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p style={{ color: "var(--text2)", fontSize: 14 }}>Loading YNeet...</p>
    </div>
  );
  if (!user) {
    const raiseUrl = import.meta.env.VITE_RAISE_ACADEMY_URL || "/";
    window.location.href = raiseUrl;
    return null;
  }
  return children;
}

// Paid content is further gated behind an active subscription (the backend
// also enforces this on every API call — this is just for a clean redirect).
// Admins skip this — they don't need a paid plan to manage content.
function RequireSubscription({ children }) {
  const { user } = useAuth();
  if (user?.role === "admin") return children;
  const sub = user?.subscription;
  const active = sub?.status === "active" && sub?.endDate && new Date(sub.endDate) > new Date();
  return active ? children : <Navigate to="/pricing" replace />;
}

// The /admin panel (content management + enrolled users) — role is synced
// from Raise Academy on every login, so it's granted/revoked over there.
function RequireAdmin({ children }) {
  const { user } = useAuth();
  return user?.role === "admin" ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/bridge" element={<BridgePage />} />
      <Route path="/pricing" element={<Guard><PricingPage /></Guard>} />

      <Route path="/admin" element={<Guard><RequireAdmin><AdminLayout /></RequireAdmin></Guard>}>
        <Route index                element={<AdminSummaryPage />} />
        <Route path="users"         element={<AdminUsersPage />} />
        <Route path="questions"     element={<AdminQuestionsPage />} />
        <Route path="mocktests"     element={<AdminMockTestsPage />} />
        <Route path="flashcards"    element={<AdminFlashcardsPage />} />
        <Route path="formulas"      element={<AdminFormulasPage />} />
      </Route>

      <Route path="/" element={<Guard><RequireSubscription><Layout /></RequireSubscription></Guard>}>
        <Route index                 element={<DashboardPage />} />
        <Route path="mock"           element={<MockPage />} />
        <Route path="mock/:attemptId/start"    element={<MockTestPage />} />
        <Route path="mock/:attemptId/analysis" element={<AnalysisPage />} />
        <Route path="quiz"           element={<QuizPage />} />
        <Route path="practice"       element={<PracticePage />} />
        <Route path="planner"        element={<PlannerPage />} />
        <Route path="biology"        element={<BiologyPage />} />
        <Route path="physics"        element={<PhysicsPage />} />
        <Route path="chemistry"      element={<ChemistryPage />} />
        <Route path="mistakes"       element={<MistakesPage />} />
        <Route path="profile"        element={<ProfilePage />} />
        <Route path="referral"       element={<ReferralPage />} />
      </Route>
    </Routes>
  );
}
