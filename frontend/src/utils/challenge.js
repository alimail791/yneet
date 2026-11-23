// Challenge a friend: helpers shared by the challenge page, test page and analysis.
import api from "../lib/api";

const PENDING = "yneet_challenge";           // challenge opened before signing in
const forAttempt = (id) => `yneet_ch_${id}`;  // this attempt was taken as a challenge

const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

export const challengeUrl = (attemptId) => {
  const origin = /^https?:/.test(window.location.origin) ? window.location.origin : "https://app.yneet.in";
  return `${origin}/c/${attemptId}`;
};

export const savePendingChallenge = (id) => safe(() => localStorage.setItem(PENDING, id));
export const takePendingChallenge = () => safe(() => {
  const id = localStorage.getItem(PENDING);
  if (id) localStorage.removeItem(PENDING);
  return id;
});

export const challengeFor = (attemptId) => safe(() => localStorage.getItem(forAttempt(attemptId)));

// Starts the friend's exact test and remembers which challenge it answers.
export async function startChallenge(challenge, navigate) {
  const { data } = await api.post(`/mock/${challenge.test.id}/start`, { challenge: challenge.attemptId });
  safe(() => localStorage.setItem(forAttempt(data.attempt.id), challenge.attemptId));
  navigate(`/mock/${data.attempt.id}/start`, { state: { attempt: data.attempt, questions: data.questions, test: data.test } });
}

export function shareChallenge({ attemptId, score, totalMarks, title }) {
  const text = `I scored ${score}/${totalMarks} in "${title}" on YNeet. Can you beat me? Take the same NEET test here 👉 ${challengeUrl(attemptId)}`;
  safe(() => window.gtag?.("event", "challenge_share", { method: "whatsapp" }));
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}
