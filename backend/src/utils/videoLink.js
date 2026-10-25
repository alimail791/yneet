// Turns whatever video link an admin pastes into { provider, videoRef } that
// the student app knows how to embed. Supported:
//   YouTube  — watch?v=, youtu.be/, /shorts/, /embed/ links (unlisted works too)
//   Bunny    — iframe.mediadelivery.net/embed/<library>/<video> or .../play/<library>/<video>
//   MP4      — any https URL ending in .mp4 or .webm
// Returns null when the link isn't recognised.
function parseVideoLink(raw) {
  const link = String(raw || "").trim();
  if (!link) return null;

  // A bare 11-character YouTube id is accepted as-is.
  if (/^[A-Za-z0-9_-]{11}$/.test(link)) return { provider: "youtube", videoRef: link };

  let url;
  try { url = new URL(link); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/")[1];
    return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? { provider: "youtube", videoRef: id } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return { provider: "youtube", videoRef: v };
    const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
    return m ? { provider: "youtube", videoRef: m[1] } : null;
  }

  if (host === "iframe.mediadelivery.net" || host === "player.mediadelivery.net") {
    const m = url.pathname.match(/^\/(?:embed|play)\/(\d+)\/([0-9a-f-]{36})/i);
    return m ? { provider: "bunny", videoRef: `${m[1]}/${m[2]}` } : null;
  }

  if (url.protocol === "https:" && /\.(mp4|webm)$/i.test(url.pathname)) {
    return { provider: "mp4", videoRef: url.toString() };
  }
  return null;
}

module.exports = { parseVideoLink };
