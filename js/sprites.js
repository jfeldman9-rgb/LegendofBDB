// HD asset loader + polished procedural VFX sprites (eggplants, shakes, particles, 4-way BDB, portraits)

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

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawEggplant(big = false) {
  const w = big ? 56 : 36;
  const h = big ? 34 : 22;
  const { c, g } = canvas(w, h);
  
  // Outer aura
  const aura = g.createRadialGradient(w * 0.55, h * 0.5, 4, w * 0.55, h * 0.5, w * 0.5);
  aura.addColorStop(0, "rgba(215, 120, 255, 0.4)");
  aura.addColorStop(1, "rgba(140, 40, 200, 0)");
  g.fillStyle = aura;
  g.fillRect(0, 0, w, h);

  // Eggplant body
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, "#2c0538");
  grd.addColorStop(0.3, "#7a22aa");
  grd.addColorStop(0.65, "#c467f5");
  grd.addColorStop(1, "#f3d0ff");
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(w * 0.55, h * 0.5, w * 0.4, h * 0.4, 0, 0, Math.PI * 2);
  g.fill();

  // Green stem & leaves (calyx)
  g.fillStyle = "#3d852a";
  g.beginPath();
  g.moveTo(w * 0.05, h * 0.5);
  g.lineTo(w * 0.22, h * 0.2);
  g.lineTo(w * 0.26, h * 0.4);
  g.lineTo(w * 0.3, h * 0.5);
  g.lineTo(w * 0.26, h * 0.6);
  g.lineTo(w * 0.22, h * 0.8);
  g.closePath();
  g.fill();

  g.fillStyle = "#5ebb42";
  g.beginPath();
  g.ellipse(w * 0.12, h * 0.5, w * 0.08, h * 0.16, 0, 0, Math.PI * 2);
  g.fill();

  // Glossy reflection highlight
  g.fillStyle = "rgba(255,255,255,0.6)";
  g.beginPath();
  g.ellipse(w * 0.62, h * 0.32, w * 0.14, h * 0.08, -0.35, 0, Math.PI * 2);
  g.fill();
  return c;
}

function drawShake() {
  const { c, g } = canvas(44, 62);
  // Pulsing glow aura
  const aura = g.createRadialGradient(22, 34, 6, 22, 34, 28);
  aura.addColorStop(0, "rgba(103, 255, 202, 0.45)");
  aura.addColorStop(1, "rgba(103, 255, 202, 0)");
  g.fillStyle = aura;
  g.fillRect(0, 0, 44, 62);

  // Bottle body
  const body = g.createLinearGradient(0, 12, 0, 58);
  body.addColorStop(0, "#e8fff6");
  body.addColorStop(0.3, "#67ffca");
  body.addColorStop(0.7, "#1ebb8e");
  body.addColorStop(1, "#0d5e46");
  g.fillStyle = body;
  roundRect(g, 8, 16, 28, 40, 8);
  g.fill();

  // Cap / Spout
  g.fillStyle = "#16202c";
  roundRect(g, 12, 6, 20, 12, 4);
  g.fill();
  g.fillStyle = "#67ffca";
  g.fillRect(18, 2, 8, 6);

  // Label band
  g.fillStyle = "#fff4bd";
  g.fillRect(12, 30, 20, 10);
  g.fillStyle = "#122c24";
  g.font = "bold 13px Trebuchet MS, sans-serif";
  g.textAlign = "center";
  g.fillText("P", 22, 39);

  // Shimmer
  g.strokeStyle = "rgba(255,255,255,0.7)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(11, 20);
  g.lineTo(11, 52);
  g.stroke();

  return c;
}

function drawEve() {
  const { c, g } = canvas(84, 120);
  // Drop shadow
  g.fillStyle = "rgba(10, 6, 14, 0.5)";
  g.beginPath();
  g.ellipse(42, 114, 24, 6, 0, 0, Math.PI * 2);
  g.fill();

  // Boots
  g.fillStyle = "#251a24";
  roundRect(g, 28, 86, 11, 24, 3);
  g.fill();
  roundRect(g, 45, 86, 11, 24, 3);
  g.fill();
  g.fillStyle = "#ffd56c";
  g.fillRect(28, 96, 11, 2);
  g.fillRect(45, 96, 11, 2);

  // Dress / Apron
  const dress = g.createLinearGradient(20, 48, 60, 90);
  dress.addColorStop(0, "#4a2a38");
  dress.addColorStop(1, "#20121a");
  g.fillStyle = dress;
  g.beginPath();
  g.moveTo(22, 50);
  g.lineTo(62, 50);
  g.lineTo(66, 88);
  g.lineTo(18, 88);
  g.closePath();
  g.fill();

  // Mint bar apron
  g.fillStyle = "#eafff7";
  g.beginPath();
  g.moveTo(26, 52);
  g.lineTo(58, 52);
  g.lineTo(60, 84);
  g.lineTo(24, 84);
  g.closePath();
  g.fill();

  // Mint brand belt
  g.fillStyle = "#148a68";
  g.fillRect(24, 66, 36, 7);
  g.fillStyle = "#ffd56c";
  g.font = "bold 10px Trebuchet MS, sans-serif";
  g.textAlign = "center";
  g.fillText("PAPI'S", 42, 73);

  // Torso / Vest
  g.fillStyle = "#5a2d3e";
  g.fillRect(30, 38, 24, 16);
  g.fillStyle = "#f3ccaa";
  g.fillRect(16, 42, 12, 24);
  g.fillRect(56, 38, 12, 18);

  // Scoop in hand
  g.fillStyle = "#d0d8e8";
  g.fillRect(62, 24, 4, 32);
  g.beginPath();
  g.arc(64, 20, 11, 0, Math.PI * 2);
  g.fill();
  // Whey inside scoop
  const wheyG = g.createRadialGradient(64, 20, 2, 64, 20, 9);
  wheyG.addColorStop(0, "#ffffff");
  wheyG.addColorStop(0.6, "#7dffc8");
  wheyG.addColorStop(1, "#18946e");
  g.fillStyle = wheyG;
  g.beginPath();
  g.arc(64, 20, 8, 0, Math.PI * 2);
  g.fill();

  // Head
  g.fillStyle = "#f3ccaa";
  g.beginPath();
  g.ellipse(42, 24, 14, 16, 0, 0, Math.PI * 2);
  g.fill();

  // Hair (stylish updo)
  g.fillStyle = "#1a0e14";
  g.beginPath();
  g.ellipse(42, 15, 16, 14, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(42, 6, 8, 0, Math.PI * 2);
  g.fill();

  // Mint headband
  g.fillStyle = "#67ffca";
  g.fillRect(28, 14, 28, 4);

  // Gold earrings
  g.fillStyle = "#ffd56c";
  g.beginPath();
  g.arc(27, 26, 3, 0, Math.PI * 2);
  g.arc(57, 26, 3, 0, Math.PI * 2);
  g.fill();

  // Eyes & smile
  g.fillStyle = "#2a151b";
  g.beginPath();
  g.arc(36, 24, 1.6, 0, Math.PI * 2);
  g.arc(48, 24, 1.6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#9c3b4f";
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(42, 30, 4.5, 0.1, Math.PI - 0.1);
  g.stroke();

  return c;
}

function createPortraitEve() {
  const { c, g } = canvas(128, 128);
  // Background circle
  g.fillStyle = "#141c2a";
  g.fillRect(0, 0, 128, 128);
  const bg = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  bg.addColorStop(0, "#2c1c38");
  bg.addColorStop(1, "#0d101a");
  g.fillStyle = bg;
  g.fillRect(0, 0, 128, 128);

  // Draw Eve bust
  const eve = drawEve();
  g.drawImage(eve, 24, 8, 80, 114);

  // Gold frame
  g.strokeStyle = "#ffd56c";
  g.lineWidth = 3;
  g.strokeRect(2, 2, 124, 124);
  g.strokeStyle = "rgba(255, 213, 108, 0.4)";
  g.strokeRect(6, 6, 116, 116);

  return c;
}

function createPortraitFromImg(img, sx, sy, sw, sh) {
  const { c, g } = canvas(128, 128);
  g.fillStyle = "#0c101c";
  g.fillRect(0, 0, 128, 128);
  const bg = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  bg.addColorStop(0, "#2a1a36");
  bg.addColorStop(1, "#070910");
  g.fillStyle = bg;
  g.fillRect(0, 0, 128, 128);

  if (img && img.complete) {
    g.drawImage(img, sx, sy, sw, sh, 8, 8, 112, 112);
  }

  g.strokeStyle = "#ffd56c";
  g.lineWidth = 3;
  g.strokeRect(2, 2, 124, 124);
  g.strokeStyle = "rgba(255, 213, 108, 0.4)";
  g.strokeRect(6, 6, 116, 116);
  return c;
}

export async function loadSheet() {
  const entries = await Promise.all(
    Object.entries(PATHS).map(async ([k, src]) => [k, await loadImage(src)])
  );
  const imgs = Object.fromEntries(entries);
  
  const eveImg = drawEve();
  const portraitEve = createPortraitEve();
  const portraitBob = createPortraitFromImg(imgs.bob, 420, 80, 560, 560);
  const portraitElon = createPortraitFromImg(imgs.elon, 280, 60, 640, 640);

  return {
    ...imgs,
    eggplant: drawEggplant(false),
    eggplantBig: drawEggplant(true),
    shake: drawShake(),
    eve: eveImg,
    portraits: {
      BDB: portraitBob,
      ELON: portraitElon,
      EVE: portraitEve,
    },
    ready: true,
  };
}
