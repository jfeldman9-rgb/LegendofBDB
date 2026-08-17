// HD asset loader + polished procedural VFX sprites (eggplants, shakes, particles)

const PATHS = {
  bg1: "assets/bg/chapter1-boulevard.webp",
  bg2: "assets/bg/chapter2-clouds.webp",
  bg3: "assets/bg/chapter3-castle.webp",
  bob: "assets/chars/bdb-console.webp",
  yeti: "assets/chars/yeti-console.webp",
  claudia: "assets/chars/claudia-console.webp",
  elon: "assets/chars/elon-console.webp",
};

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  return { c, g };
}

function drawEggplant(big = false) {
  const w = big ? 56 : 36;
  const h = big ? 34 : 22;
  const { c, g } = canvas(w, h);
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, "#3a0a4a");
  grd.addColorStop(0.35, "#8b2fc0");
  grd.addColorStop(0.7, "#d07aff");
  grd.addColorStop(1, "#f3d0ff");
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(w * 0.55, h * 0.5, w * 0.42, h * 0.42, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#5db845";
  g.beginPath();
  g.ellipse(w * 0.12, h * 0.5, w * 0.12, h * 0.22, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.beginPath();
  g.ellipse(w * 0.62, h * 0.32, w * 0.12, h * 0.1, -0.4, 0, Math.PI * 2);
  g.fill();
  return c;
}

function drawShake() {
  const { c, g } = canvas(40, 58);
  // bottle body
  const body = g.createLinearGradient(0, 10, 0, 58);
  body.addColorStop(0, "#e8fff6");
  body.addColorStop(0.25, "#7dffc8");
  body.addColorStop(1, "#148a68");
  g.fillStyle = body;
  roundRect(g, 6, 14, 28, 40, 8);
  g.fill();
  g.fillStyle = "#1a2230";
  roundRect(g, 10, 4, 20, 12, 4);
  g.fill();
  g.fillStyle = "#fff3b0";
  g.fillRect(10, 28, 20, 8);
  g.fillStyle = "#17352f";
  g.font = "bold 14px Trebuchet MS, sans-serif";
  g.textAlign = "center";
  g.fillText("P", 20, 39);
  g.shadowColor = "#67ffca";
  g.shadowBlur = 12;
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.stroke();
  return c;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawCrate() {
  const { c, g } = canvas(72, 72);
  const grd = g.createLinearGradient(0, 0, 72, 72);
  grd.addColorStop(0, "#d4924a");
  grd.addColorStop(0.5, "#8a4a22");
  grd.addColorStop(1, "#3e2418");
  g.fillStyle = grd;
  roundRect(g, 2, 2, 68, 68, 6);
  g.fill();
  g.strokeStyle = "#f0c07a";
  g.lineWidth = 4;
  g.strokeRect(8, 8, 56, 56);
  g.beginPath();
  g.moveTo(12, 12);
  g.lineTo(60, 60);
  g.moveTo(60, 12);
  g.lineTo(12, 60);
  g.stroke();
  return c;
}

export async function loadSheet() {
  const entries = await Promise.all(
    Object.entries(PATHS).map(async ([k, src]) => [k, await loadImage(src)])
  );
  const imgs = Object.fromEntries(entries);
  return {
    ...imgs,
    eggplant: drawEggplant(false),
    eggplantBig: drawEggplant(true),
    shake: drawShake(),
    crate: drawCrate(),
    ready: true,
  };
}

export function drawTitleArt(ctx, w, h, sheet) {
  if (sheet.bg1) {
    ctx.drawImage(sheet.bg1, 0, 0, w, h);
    const veil = ctx.createLinearGradient(0, 0, 0, h);
    veil.addColorStop(0, "rgba(2,6,16,0.25)");
    veil.addColorStop(0.45, "rgba(2,6,16,0.35)");
    veil.addColorStop(1, "rgba(2,4,10,0.78)");
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, w, h);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#152038");
    g.addColorStop(1, "#0b1020");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  if (sheet.yeti) {
    ctx.save();
    ctx.shadowColor = "#9ad8ff";
    ctx.shadowBlur = 40;
    ctx.drawImage(sheet.yeti, -40, h * 0.28, w * 0.42, h * 0.55);
    ctx.restore();
  }
  if (sheet.bob) {
    ctx.save();
    ctx.shadowColor = "#ffd165";
    ctx.shadowBlur = 36;
    ctx.drawImage(sheet.bob, w * 0.58, h * 0.32, w * 0.4, h * 0.58);
    ctx.restore();
  }
}
