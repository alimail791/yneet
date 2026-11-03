// Draws ready-to-post images (1080×1350) for the WhatsApp Channel / Instagram
// straight in the browser, and downloads them as PNG. No server, no design tool.
const INK = "#3b2fc9", AMBER = "#f5a623", DARK = "#0f172a", GREY = "#475569";
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function rr(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 4; ctx.stroke(); }
}

function wrap(ctx, text, maxW) {
  const words = String(text || "").split(/\s+/); const lines = []; let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function text(ctx, s, x, y, { size = 28, weight = 600, color = DARK, align = "left", maxW = 900, lh = 1.3 } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "top";
  const lines = wrap(ctx, s, maxW);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * lh));
  return lines.length * size * lh;
}

function footer(ctx, W, H) {
  rr(ctx, W - 300, H - 130, 230, 70, 35, INK);
  text(ctx, "yneet.in", W - 185, H - 112, { size: 32, weight: 800, color: "#fff", align: "center" });
}

function download(canvas, name) {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = name;
  a.click();
}

export function drawMapPost(map, subject, chapter) {
  const W = 1080, H = 1350, P = 70;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f8fafc"; ctx.fillRect(0, 0, W, H);
  text(ctx, `CONCEPT MAP MONDAY · ${String(subject || "").toUpperCase()}`, P, 64, { size: 26, weight: 800, color: INK });
  let y = 104 + text(ctx, map.title || chapter, P, 104, { size: 64, weight: 800, maxW: W - 2 * P, lh: 1.1 }) + 20;
  // Core idea
  ctx.font = `600 28px ${FONT}`;
  const detailLines = wrap(ctx, map.center?.detail || "", W - 2 * P - 80).length;
  const coreH = 90 + detailLines * 36;
  rr(ctx, P, y, W - 2 * P, coreH, 28, INK);
  text(ctx, map.center?.heading || "", W / 2, y + 26, { size: 36, weight: 800, color: "#fff", align: "center", maxW: W - 2 * P - 80 });
  text(ctx, map.center?.detail || "", W / 2, y + 78, { size: 28, weight: 600, color: "#e0e7ff", align: "center", maxW: W - 2 * P - 80, lh: 1.28 });
  y += coreH + 30;
  // Branches, two columns
  const colW = (W - 2 * P - 30) / 2;
  const items = map.branches.slice(0, 6);
  const avail = H - y - 170 - (map.remember ? 110 : 0);
  const rows = Math.ceil(items.length / 2);
  const cardH = Math.min(300, Math.floor((avail - (rows - 1) * 24) / rows));
  items.forEach((b, i) => {
    const x = P + (i % 2) * (colW + 30), yy = y + Math.floor(i / 2) * (cardH + 24);
    rr(ctx, x, yy, colW, cardH, 24, i % 2 ? "#fef3c7" : "#fff", i % 2 ? null : INK);
    let ty = yy + 22;
    ty += text(ctx, b.heading, x + 24, ty, { size: 30, weight: 800, color: i % 2 ? "#451a03" : INK, maxW: colW - 48 }) + 6;
    for (const p of b.points) {
      if (ty > yy + cardH - 34) break;
      ty += text(ctx, "• " + p, x + 24, ty, { size: 23, weight: 500, color: DARK, maxW: colW - 48, lh: 1.25 }) + 4;
    }
  });
  y += rows * (cardH + 24);
  if (map.remember) text(ctx, "Remember: " + map.remember, P, y + 6, { size: 25, weight: 600, color: "#065f46", maxW: W - 2 * P - 280 });
  footer(ctx, W, H);
  download(c, `concept-map-${(chapter || "map").replace(/\W+/g, "-").toLowerCase()}.png`);
}

export function drawTeaserPost(t) {
  const W = 1080, H = 1350, P = 84;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = AMBER; ctx.fillRect(0, 0, W, H);
  text(ctx, "BRAIN TEASER · CLASS 6–8", P, 84, { size: 28, weight: 800, color: "#1e1b4b" });
  text(ctx, t.title || "Who am I?", P, 140, { size: 84, weight: 800, color: "#1e1b4b", lh: 1.05 });
  let y = 270;
  ctx.font = `600 36px ${FONT}`;
  const clueH = t.clues.reduce((h, cl) => h + wrap(ctx, cl, W - 2 * P - 150).length * 46 + 22, 0);
  rr(ctx, P, y, W - 2 * P, clueH + 60, 36, "#fff");
  let cy = y + 36;
  t.clues.forEach((cl, i) => {
    text(ctx, String(i + 1), P + 44, cy, { size: 40, weight: 800, color: INK });
    cy += text(ctx, cl, P + 100, cy, { size: 36, weight: 600, color: "#1e1b4b", maxW: W - 2 * P - 150, lh: 1.28 }) + 22;
  });
  y += clueH + 100;
  t.options.forEach((o, i) => {
    const x = P + (i % 2) * ((W - 2 * P) / 2 + 10), yy = y + Math.floor(i / 2) * 110;
    rr(ctx, x, yy, (W - 2 * P) / 2 - 10, 90, 45, "#1e1b4b");
    text(ctx, `${"ABCD"[i]}. ${o}`, x + 34, yy + 26, { size: 32, weight: 700, color: "#fff", maxW: (W - 2 * P) / 2 - 70 });
  });
  text(ctx, "Answer in the YNeet app. Revealed Thursday 7 PM.", P, H - 112, { size: 30, weight: 700, color: "#1e1b4b", maxW: W - 2 * P - 280 });
  footer(ctx, W, H);
  download(c, `brain-teaser-${t.id || "post"}.png`);
}
