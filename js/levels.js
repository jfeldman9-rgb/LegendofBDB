// Three spicy landscape chapters — HD scale (960×540 view)

const S = 3; // was Game-Gear scale; now HD

function plat(x, y, w, h, kind = "ground") {
  return { x: x * S, y: y * S, w: w * S, h: h * S, kind, broken: false, hp: kind === "crate" ? 2 : 99 };
}

function enemy(kind, x, y, extra = {}) {
  const sizes = {
    walker: [28, 32],
    hover: [30, 30],
    charger: [32, 32],
    choir: [30, 32],
    boss: [56, 56],
  };
  const hp = { walker: 2, hover: 2, charger: 3, choir: 2, boss: 20 };
  const [w, h] = sizes[kind];
  return {
    id: Math.random().toString(36).slice(2),
    kind,
    x: x * S,
    y: y * S,
    w: w * S,
    h: h * S,
    homeX: x * S,
    homeY: y * S,
    hp: hp[kind],
    maxHp: hp[kind],
    alive: true,
    facing: -1,
    vx: 0,
    vy: 0,
    cooldown: 0.6 + Math.random(),
    t: Math.random() * 10,
    alert: 0,
    state: "idle",
    stateT: 0,
    ...extra,
  };
}

function shake(x, y) {
  return { x: x * S, y: y * S, w: 14 * S, h: 18 * S, taken: false, bob: Math.random() * 5 };
}

export const CHAPTER_NAMES = {
  1: "BOULEVARD OF BAD DECISIONS",
  2: "CELESTIAL GAINZ INTERVENTION",
  3: "CLAUDIA'S MOONLIT KEEP",
};

export function buildChapter(n) {
  if (n === 1) return chapter1();
  if (n === 2) return chapter2();
  return chapter3();
}

function chapter1() {
  const platforms = [
    plat(0, 140, 220, 40),
    plat(240, 140, 180, 40),
    plat(100, 110, 40, 12, "cloud"),
    plat(200, 95, 50, 12, "cloud"),
    plat(300, 105, 36, 20, "crate"),
    plat(440, 140, 200, 40),
    plat(480, 100, 48, 12, "cloud"),
    plat(560, 80, 48, 12, "cloud"),
    plat(650, 140, 220, 40),
    plat(700, 110, 40, 20, "crate"),
    plat(780, 95, 50, 12, "cloud"),
    plat(900, 140, 260, 40),
    plat(940, 105, 48, 12, "cloud"),
    plat(1040, 85, 48, 12, "cloud"),
    plat(1180, 140, 300, 40),
    plat(1240, 100, 40, 20, "crate"),
    plat(1320, 90, 50, 12, "cloud"),
    plat(1500, 140, 400, 40),
  ];
  const enemies = [
    enemy("walker", 260, 108),
    enemy("hover", 520, 50),
    enemy("walker", 700, 108),
    enemy("charger", 820, 108),
    enemy("hover", 1000, 45),
    enemy("choir", 1100, 108),
    enemy("walker", 1280, 108),
    enemy("hover", 1400, 55),
    enemy("charger", 1550, 108),
  ];
  const shakes = [
    shake(110, 90),
    shake(310, 80),
    shake(500, 80),
    shake(710, 85),
    shake(950, 85),
    shake(1330, 70),
    shake(1600, 110),
  ];
  return {
    id: 1,
    name: CHAPTER_NAMES[1],
    width: 1900 * S,
    spawn: { x: 40 * S, y: 100 * S },
    goalX: 1750 * S,
    sky: ["#1a2740", "#0b1324"],
    accent: "#ffd56c",
    bgKey: "bg1",
    platforms,
    enemies,
    shakes,
    signs: [
      { x: 60 * S, y: 90 * S, lines: ["PAPI'S PROTEIN", "PALACE", "NO REFUNDS"] },
      { x: 860 * S, y: 70 * S, lines: ["CLAUDIA →", "SELF CONTROL ←"] },
    ],
  };
}

function chapter2() {
  const platforms = [
    plat(0, 140, 160, 40),
    plat(180, 120, 60, 12, "cloud"),
    plat(260, 100, 60, 12, "cloud"),
    plat(340, 140, 140, 40),
    plat(400, 100, 36, 20, "crate"),
    plat(520, 90, 70, 12, "cloud"),
    plat(620, 70, 70, 12, "cloud"),
    plat(720, 140, 180, 40),
    plat(780, 100, 50, 12, "cloud"),
    plat(900, 80, 60, 12, "cloud"),
    plat(1000, 140, 200, 40),
    plat(1080, 100, 40, 20, "crate"),
    plat(1180, 85, 60, 12, "cloud"),
    plat(1280, 65, 60, 12, "cloud"),
    plat(1400, 140, 220, 40),
    plat(1480, 100, 50, 12, "cloud"),
    plat(1650, 140, 350, 40),
  ];
  const enemies = [
    enemy("hover", 200, 60),
    enemy("choir", 360, 108),
    enemy("hover", 540, 40),
    enemy("charger", 760, 108),
    enemy("hover", 920, 35),
    enemy("walker", 1050, 108),
    enemy("choir", 1200, 108),
    enemy("hover", 1320, 30),
    enemy("charger", 1500, 108),
    enemy("hover", 1700, 50),
    enemy("walker", 1800, 108),
  ];
  const shakes = [
    shake(190, 95),
    shake(530, 65),
    shake(790, 75),
    shake(1090, 75),
    shake(1290, 45),
    shake(1490, 75),
    shake(1750, 110),
  ];
  return {
    id: 2,
    name: CHAPTER_NAMES[2],
    width: 2000 * S,
    spawn: { x: 30 * S, y: 100 * S },
    goalX: 1850 * S,
    sky: ["#2a2048", "#101028"],
    accent: "#a8c8ff",
    bgKey: "bg2",
    platforms,
    enemies,
    shakes,
    signs: [
      { x: 40 * S, y: 85 * S, lines: ["ANGELIC HR", "DEPT.", "TURN BACK"] },
      { x: 1100 * S, y: 55 * S, lines: ["PAPI, BE", "SERIOUS."] },
    ],
  };
}

function chapter3() {
  const platforms = [
    plat(0, 140, 200, 40),
    plat(220, 110, 50, 12, "cloud"),
    plat(300, 90, 50, 12, "cloud"),
    plat(400, 140, 160, 40),
    plat(450, 100, 36, 20, "crate"),
    plat(600, 100, 60, 12, "cloud"),
    plat(700, 80, 60, 12, "cloud"),
    plat(820, 140, 180, 40),
    plat(880, 100, 40, 20, "crate"),
    plat(980, 85, 55, 12, "cloud"),
    plat(1100, 140, 200, 40),
    plat(1180, 95, 50, 12, "cloud"),
    plat(1300, 75, 50, 12, "cloud"),
    plat(1420, 140, 180, 40),
    plat(1600, 140, 500, 40),
    plat(1680, 100, 50, 12, "velvet"),
    plat(1780, 85, 50, 12, "velvet"),
    plat(1880, 100, 50, 12, "velvet"),
  ];
  const enemies = [
    enemy("walker", 280, 108),
    enemy("hover", 450, 45),
    enemy("choir", 650, 108),
    enemy("charger", 860, 108),
    enemy("hover", 1000, 40),
    enemy("walker", 1150, 108),
    enemy("hover", 1320, 35),
    enemy("choir", 1480, 108),
    enemy("boss", 1750, 70, { role: 1 }),
  ];
  const shakes = [
    shake(230, 85),
    shake(460, 75),
    shake(710, 55),
    shake(890, 75),
    shake(1190, 70),
    shake(1310, 50),
    shake(1690, 75),
    shake(1890, 75),
  ];
  return {
    id: 3,
    name: CHAPTER_NAMES[3],
    width: 2100 * S,
    spawn: { x: 30 * S, y: 100 * S },
    goalX: 2000 * S,
    sky: ["#2a1830", "#100818"],
    accent: "#e8a0ff",
    bgKey: "bg3",
    platforms,
    enemies,
    shakes,
    signs: [
      { x: 50 * S, y: 90 * S, lines: ["KEEP AHEAD", "EGO OPTIONAL"] },
      { x: 1550 * S, y: 70 * S, lines: ["CLAUDIA", "CAGE 3B"] },
    ],
    hasBoss: true,
  };
}

export const SCALE = S;
