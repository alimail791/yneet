require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const app = express();
// Railway (like most PaaS platforms) sits behind a reverse proxy that adds an
// X-Forwarded-For header. Without telling Express to trust it, express-rate-limit
// throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on every request and the endpoint
// crashes — this happened to be surfacing as an SSO bridge failure. `1` means
// trust exactly one hop of proxy (Railway's own edge), which is correct here.
app.set("trust proxy", 1);
app.use(helmet());
const allowedOrigins = [process.env.FRONTEND_URL, process.env.RAISE_ACADEMY_FRONTEND_URL].filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use("/api", limiter);

app.use("/api/v1/public",    require("./routes/public"));
app.use("/api/v1/auth",      require("./routes/auth"));
app.use("/api/v1/user",      require("./routes/user"));
app.use("/api/v1/mock",      require("./routes/mock"));
app.use("/api/v1/quiz",      require("./routes/quiz"));
app.use("/api/v1/practice",  require("./routes/practice"));
app.use("/api/v1/dashboard", require("./routes/dashboard"));
app.use("/api/v1/mistakes",  require("./routes/mistakes"));
app.use("/api/v1/planner",   require("./routes/planner"));
app.use("/api/v1/subscription", require("./routes/subscription"));
app.use("/api/v1/content",   require("./routes/content"));
app.use("/api/v1/ai",        require("./routes/ai"));
app.use("/api/v1/admin",     require("./routes/admin"));

app.get("/health", (_, res) => res.json({ status: "ok", app: "YNeet" }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || "Server Error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 YNeet API running on port ${PORT}`));
