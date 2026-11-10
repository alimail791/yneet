# YNeet daily Shorts bot

Every morning `.github/workflows/daily-shorts.yml` picks 3 NEET questions (one each for Physics, Chemistry and Biology) from `GET /api/v1/public/questions/daily`, renders a ~23-second 1080×1920 quiz video for each, and uploads them to Raise Academy's YouTube channel. The videos go public at 08:00, 13:00 and 19:00 IST.

Each video runs: question → 5-second countdown → answer → short explanation → yneet.in end card. The sound is a generated tick and chime, with no music. The description links to the question's page on www.yneet.in.

- Try it locally: `npm install && node daily.mjs --sample --no-upload` (needs ffmpeg and Chrome). The videos land in `out/`.
- Run it by hand: GitHub → Actions → Daily NEET Shorts → Run workflow (you can choose a date, and switch off upload).
- Connect YouTube: add the `YT_CLIENT_ID`, `YT_CLIENT_SECRET` and `YT_REFRESH_TOKEN` repo secrets (OAuth client for the channel owner's Google account, scope `youtube.upload`).
