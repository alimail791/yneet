import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/layout/Layout";
import HelpPage from "./pages/HelpPage"; 
import BridgePage           from "./pages/BridgePage";
import PricingPage          from "./pages/PricingPage";
import VerifyPage           from "./pages/VerifyPage";
import VerifyEmailPage      from "./pages/VerifyEmailPage";
import DashboardPage        from "./pages/DashboardPage";
import MockPage             from "./pages/MockPage";
import MockTestPage         from "./pages/MockTestPage";
import AnalysisPage         from "./pages/AnalysisPage";
import QuizPage             from "./pages/QuizPage";
import PracticePage         from "./pages/PracticePage";
import PYQPage               from "./pages/PYQPage";
import PlannerPage          from "./pages/PlannerPage";
import LeaderboardPage      from "./pages/LeaderboardPage";
import BiologyPage          from "./pages/BiologyPage";
import PhysicsPage          from "./pages/PhysicsPage";
import ChemistryPage        from "./pages/ChemistryPage";
import MistakesPage         from "./pages/MistakesPage";
import ProfilePage          from "./pages/ProfilePage";
import ReferralPage         from "./pages/ReferralPage";
import ShortsPage           from "./pages/ShortsPage";
import JuniorHomePage       from "./pages/JuniorHomePage";
import ShareShortPage       from "./pages/ShareShortPage";
import CreatorAuthPage      from "./pages/creator/CreatorAuthPage";
import CreatorForgotPage      from "./pages/creator/CreatorForgotPage";
import CreatorDashboard     from "./pages/creator/CreatorDashboard";
import AdminCreatorsPage    from "./pages/admin/AdminCreatorsPage";
import { hasActivePlan, isJuniorFree } from "./utils/plan";
import AdminLayout          from "./components/admin/AdminLayout";
import AdminSummaryPage     from "./pages/admin/AdminSummaryPage";
import AdminUsersPage       from "./pages/admin/AdminUsersPage";
import AdminQuestionsPage   from "./pages/admin/AdminQuestionsPage";
import AdminMockTestsPage   from "./pages/admin/AdminMockTestsPage";
import AdminFlashcardsPage  from "./pages/admin/AdminFlashcardsPage";
import AdminFormulasPage    from "./pages/admin/AdminFormulasPage";
import AdminShortsPage      from "./pages/admin/AdminShortsPage";
import BulkGeneratorPage    from "./pages/admin/BulkGeneratorPage";
import MockTestBuilderPage  from "./pages/admin/MockTestBuilderPage";

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
// Class 6–8 students without a plan get in too, but only to the free pages
// (see <Paid> below and utils/plan.js).
function RequireSubscription({ children }) {
  const { user } = useAuth();
  if (user?.role === "admin") return children;
  // Free trial paused after 3 days until WhatsApp/email is confirmed (see backend utils/verification.js).
  if (user?.verification?.blocked) return <Navigate to="/verify" replace />;
  return hasActivePlan(user) || isJuniorFree(user) ? children : <Navigate to="/pricing" replace />;
}

// Pages that are not part of the free Class 6–8 tier send those students home.
function Paid({ children }) {
  const { user } = useAuth();
  return isJuniorFree(user) ? <Navigate to="/" replace /> : children;
}

function Home() {
  const { user } = useAuth();
  return isJuniorFree(user) ? <JuniorHomePage /> : <DashboardPage />;
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
      <Route path="help" element={<HelpPage />} />
      <Route path="/bridge" element={<BridgePage />} />
      {/* Public share page for featured Shorts, and the creator area (own login). */}
      <Route path="/s/:id" element={<ShareShortPage />} />
      <Route path="/creator/apply" element={<CreatorAuthPage mode="apply" />} />
      <Route path="/creator/login" element={<CreatorAuthPage mode="login" />} />
      <Route path="/creator/forgot" element={<CreatorForgotPage />} />
      <Route path="/creator" element={<CreatorDashboard />} />
      <Route path="/pricing" element={<Guard><PricingPage /></Guard>} />
      <Route path="/verify" element={<Guard><VerifyPage /></Guard>} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route path="/admin" element={<Guard><RequireAdmin><AdminLayout /></RequireAdmin></Guard>}>
        <Route index                element={<AdminSummaryPage />} />
        <Route path="users"         element={<AdminUsersPage />} />
        <Route path="questions"     element={<AdminQuestionsPage />} />
        <Route path="mocktests"     element={<AdminMockTestsPage />} />
        <Route path="flashcards"    element={<AdminFlashcardsPage />} />
        <Route path="formulas"      element={<AdminFormulasPage />} />
        <Route path="shorts"        element={<AdminShortsPage />} />
        <Route path="creators"      element={<AdminCreatorsPage />} />
        <Route path="bulk-generator" element={<BulkGeneratorPage />} />
        <Route path="mock-builder"  element={<MockTestBuilderPage />} />
      </Route>

      <Route path="/" element={<Guard><RequireSubscription><Layout /></RequireSubscription></Guard>}>
        <Route index                 element={<Home />} />
        <Route path="mock"           element={<MockPage />} />
        <Route path="mock/:attemptId/start"    element={<MockTestPage />} />
        <Route path="mock/:attemptId/analysis" element={<AnalysisPage />} />
        <Route path="shorts"         element={<ShortsPage />} />
        <Route path="quiz"           element={<QuizPage />} />
        <Route path="practice"       element={<Paid><PracticePage /></Paid>} />
        <Route path="pyq"            element={<Paid><PYQPage /></Paid>} />
        <Route path="pyq/:year"      element={<Paid><PYQPage /></Paid>} />
        <Route path="planner"        element={<Paid><PlannerPage /></Paid>} />
        <Route path="leaderboard"    element={<Paid><LeaderboardPage /></Paid>} />
        <Route path="biology"        element={<Paid><BiologyPage /></Paid>} />
        <Route path="physics"        element={<Paid><PhysicsPage /></Paid>} />
        <Route path="chemistry"      element={<Paid><ChemistryPage /></Paid>} />
        <Route path="mistakes"       element={<Paid><MistakesPage /></Paid>} />
        <Route path="profile"        element={<ProfilePage />} />
        <Route path="referral"       element={<Paid><ReferralPage /></Paid>} />
      </Route>
    </Routes>
  );
}
