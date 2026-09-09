# YNeet — Your Personal NEET Mentor
### Full-Stack AI NEET Preparation Platform

---

## Quick Start (Step by Step)

### Step 1 — Setup Backend

```bash
cd yneet/backend

# Copy env file
copy .env.example .env        # Windows
# cp .env.example .env        # Mac/Linux

# Open .env in VS Code and fill in:
# DATABASE_URL = your Supabase connection string
# DIRECT_URL   = same as DATABASE_URL
# JWT_SECRET   = any random string (run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
# JWT_REFRESH_SECRET = another random string
# SMTP_USER    = your Gmail
# SMTP_PASS    = your 16-char Gmail App Password

npm install
npx prisma db push        # creates all tables in Supabase
npm run db:seed           # seeds 70 questions + 30 mock tests + badges
npm run dev               # starts API on http://localhost:5000
```

### Step 2 — Setup Frontend

```bash
# Open NEW terminal in VS Code (click + in terminal panel)
cd yneet/frontend
npm install
npm run dev               # starts app on http://localhost:5173
```

### Step 3 — Open Browser

Go to: **http://localhost:5173**

Register → Login → Start using YNeet! 🎯

---

## Project Structure

```
yneet/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          16 database tables
│   ├── src/
│   │   ├── index.js               Express server (port 5000)
│   │   ├── middleware/
│   │   │   └── auth.js            JWT authentication
│   │   ├── controllers/
│   │   │   ├── authController.js  Register, Login, Forgot/Reset Password
│   │   │   ├── mockController.js  30 mock tests, scoring, analysis
│   │   │   ├── quizController.js  50-question daily quiz
│   │   │   ├── practiceController.js  PYQs, mark solved, problem counter
│   │   │   ├── dashboardController.js All stats in one API call
│   │   │   ├── mistakeController.js   Mistakes from mock/quiz/practice
│   │   │   └── userController.js  Profile update
│   │   ├── routes/                One file per feature
│   │   └── utils/
│   │       ├── seed.js            70 questions + 30 mocks + badges
│   │       ├── jwt.js             Token generation
│   │       ├── mailer.js          Email verification + password reset
│   │       └── xp.js             XP and level system
│   └── .env.example               Copy to .env and fill in values
│
└── frontend/
    ├── index.html
    ├── vite.config.js             Proxies /api to backend
    └── src/
        ├── main.jsx
        ├── App.jsx                All routes
        ├── index.css              Global styles
        ├── lib/api.js             Axios with JWT interceptor
        ├── context/AuthContext.jsx Auth state management
        ├── hooks/useCountdown.js  Live countdown timer
        ├── components/
        │   └── layout/Layout.jsx  Nav + mobile bottom nav
        └── pages/
            ├── LoginPage.jsx
            ├── RegisterPage.jsx    Phone, Gender, Place, NEET Date
            ├── ForgotPasswordPage  Send email reset link
            ├── ResetPasswordPage   Set new password
            ├── VerifyEmailPage     Email verification
            ├── DashboardPage.jsx   Full stats + countdown + charts
            ├── MockPage.jsx        30 tests (20 full + 5 per subject)
            ├── MockTestPage.jsx    OMR interface + timer + navigator
            ├── AnalysisPage.jsx    Score + chapter breakdown
            ├── QuizPage.jsx        50 Qs daily (30 Bio + 10 Phy + 10 Chem)
            ├── PracticePage.jsx    PYQs + show answer + problem counter
            ├── BiologyPage.jsx     Flashcards with flip animation
            ├── PhysicsPage.jsx     28 formulas with search
            ├── ChemistryPage.jsx   Named reactions + equations
            ├── MistakesPage.jsx    Mock + Quiz + Practice mistakes
            └── ProfilePage.jsx     Full profile with subject selection
```

---

## Features

| Feature | Details |
|---|---|
| Authentication | Register, Login, Forgot/Reset Password, Email Verification |
| Register Fields | Name, Email, Password, Class, NEET Date, Target Score, Study Hours, Phone (opt), Gender (opt), Place (opt) |
| Mock Tests | 30 total: 20 Full + 5 Biology + 5 Physics + 5 Chemistry |
| Mock Test | OMR interface, timer, question navigator, auto-save, +4/-1 marking |
| Test Analysis | Score, accuracy, subject breakdown, chapter-wise analysis |
| Daily Quiz | 50 questions: 30 Biology + 10 Physics + 10 Chemistry |
| Practice | PYQ filter, Repeated filter, Subject/Chapter filter, Show Answer, Mark Solved |
| Problem Counter | Tracks total solved, correct, accuracy in practice |
| Biology Hub | 20 NCERT flashcards with flip animation, mark known |
| Physics Hub | 28 formulas, search, bookmark |
| Chemistry Hub | Named reactions + equations + conditions |
| Mistake Notebook | Separate tracking for Mock, Quiz, Practice mistakes |
| Dashboard | Countdown, KPIs, rank predictor, subject accuracy, score chart, XP |
| XP System | Points for quiz, mock, practice, streaks |
| Streaks | Daily login streak tracking |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/v1/auth/register | Register with all fields |
| POST | /api/v1/auth/login | Login → JWT token |
| POST | /api/v1/auth/forgot-password | Send reset email |
| POST | /api/v1/auth/reset-password | Set new password |
| GET  | /api/v1/auth/verify-email?token=X | Verify email |
| GET  | /api/v1/auth/me | Get current user |
| PUT  | /api/v1/user/profile | Update profile |
| GET  | /api/v1/dashboard | All dashboard stats |
| GET  | /api/v1/mock | List all 30 tests |
| POST | /api/v1/mock/:id/start | Start test (creates attempt) |
| POST | /api/v1/mock/:id/response | Auto-save answer |
| POST | /api/v1/mock/:id/submit | Submit + calculate score |
| GET  | /api/v1/mock/:id/analysis | Detailed analysis |
| GET  | /api/v1/quiz/daily | Get 50 daily questions |
| POST | /api/v1/quiz/submit | Submit quiz answers |
| GET  | /api/v1/practice/questions | Filtered questions |
| GET  | /api/v1/practice/chapters | Chapter list by subject |
| GET  | /api/v1/practice/stats | Practice problem count |
| POST | /api/v1/practice/solve | Mark question solved |
| GET  | /api/v1/mistakes | Get mistakes (filterable) |
| GET  | /api/v1/planner | Get study plan |
| POST | /api/v1/planner/save | Save study plan |
