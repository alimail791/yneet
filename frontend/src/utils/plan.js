// Mirrors backend/src/utils/pricing.js: Class 6–8 is a free tier (Daily Quiz,
// Shorts and daily puzzles). A junior who has a paid/trial plan still gets everything.
export const JUNIOR_CLASSES = ["6th", "7th", "8th"];
export const PUZZLES_URL = import.meta.env.VITE_PUZZLES_URL || "https://play.yneet.in";

export const hasActivePlan = (user) => {
  const sub = user?.subscription;
  return !!(sub?.status === "active" && sub?.endDate && new Date(sub.endDate) > new Date());
};
export const isJunior = (user) => JUNIOR_CLASSES.includes(user?.profile?.class);

// True when this student should see the limited free Class 6–8 app.
export const isJuniorFree = (user) => user?.role !== "admin" && isJunior(user) && !hasActivePlan(user);
