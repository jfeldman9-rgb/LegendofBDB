// M0–M3 overworld: ALttP-style connected screens. No D1 interior.

export const W = 960;
export const H = 540;

export const ZONE_NAME = "BOULEVARD OF BAD DECISIONS";

export const DEATH_TITLES = ["PAPI HAS LEFT THE CHAT", "Tuxedo damaged. Ego intact."];

export const CHECKPOINT_TOAST = "CHECKPOINT: EGO INTACT";

/** Locked spoken lines — show as talk boxes. Do not invent extras. */
export const LINES = {
  elonAppear: [
    { who: "ELON", text: "Nice tux. Wrong century." },
    { who: "BDB", text: "It's the correct century. You're the recall." },
  ],
  elonDeath: [
    { who: "ELON", text: "I'll spawn. That's the bit." },
  ],
  velvetLock: [
    { who: "BDB", text: "Velvet lock. Of course it's velvet." },
  ],
  eve: [
    { who: "EVE", text: "Welcome to Papi's. No refunds. She's still in 3B." },
    { who: "BDB", text: "I know. I brought produce." },
    { who: "EVE", text: "The basement wants a man with poor judgment. That's you, baby." },
  ],
};

export const SCREEN_IDS = ["hub", "east", "palace"];

export const aabb = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function hitZone(box, zones) {
  for (const z of zones) {
    if (aabb(box, z)) return z;
  }
  return null;
}

function solid(x, y, w, h, kind = "wall", extra = {}) {
  return { x, y, w, h, kind, ...extra };
}

function zone(id, x, y, w, h, extra = {}) {
  return { id, x, y, w, h, ...extra };
}

export function buildScreen(id, flags = {}) {
  const doorUnlocked = !!flags.doorUnlocked;
  if (id === "east") return screenEast(doorUnlocked);
  if (id === "palace") return screenPalace();
  return screenHub();
}

function screenHub() {
  return {
    id: "hub",
    banner: "B-HUB",
    bgKey: "bg1",
    sky: ["#1a2740", "#0b1324"],
    accent: "#ffd56c",
    spawn: { x: 430, y: 360 },
    bounds: { x: 20, y: 248, w: 920, h: 250 },
    solids: [
      solid(8, 48, 318, 196, "palace"),
      solid(8, 244, 132, 36, "palace"),
      solid(248, 244, 78, 36, "palace"),
      solid(620, 268, 54, 40, "planter"),
      solid(760, 430, 70, 36, "planter"),
      solid(70, 430, 64, 34, "planter"),
    ],
    exits: [
      zone("to-east", 860, 270, 80, 200, { to: "east", spawn: { x: 80, y: 350 }, dir: "e" }),
      zone("to-palace", 140, 220, 108, 56, { to: "palace", spawn: { x: 470, y: 360 }, dir: "enter" }),
    ],
    door: null,
    eve: null,
    elon: false,
    shakes: [{ x: 690, y: 340, w: 28, h: 36, taken: false, bob: 0 }],
    signs: [
      { x: 36, y: 86, lines: ["PAPI'S PROTEIN", "PALACE", "NO REFUNDS"] },
      { x: 780, y: 200, lines: ["B-EAST →", "PRODUCE READY"] },
    ],
    notes: { palaceDoor: { x: 140, y: 218, w: 108, h: 62 } },
  };
}

function screenEast(doorUnlocked) {
  return {
    id: "east",
    banner: "B-EAST",
    bgKey: "bg1",
    sky: ["#182236", "#0a101c"],
    accent: "#e8a0ff",
    spawn: { x: 70, y: 350 },
    bounds: { x: 20, y: 250, w: 920, h: 248 },
    solids: [
      solid(200, 250, 52, 38, "planter"),
      solid(430, 436, 60, 34, "planter"),
      solid(640, 262, 48, 36, "planter"),
      solid(868, 210, 86, 48, "lintel"),
    ],
    exits: [
      zone("to-hub", 20, 260, 40, 220, { to: "hub", spawn: { x: 740, y: 350 }, dir: "w" }),
    ],
    door: {
      x: 878,
      y: 258,
      w: 70,
      h: 150,
      unlocked: doorUnlocked,
      label: "D1",
    },
    eve: null,
    elon: true,
    shakes: [],
    signs: [{ x: 300, y: 188, lines: ["BOULEVARD OF", "BAD DECISIONS"] }],
    notes: {},
  };
}

function screenPalace() {
  return {
    id: "palace",
    banner: "PROTEIN PALACE",
    bgKey: "bg3",
    sky: ["#2a1830", "#100818"],
    accent: "#7ef0c8",
    spawn: { x: 470, y: 360 },
    bounds: { x: 70, y: 200, w: 820, h: 320 },
    solids: [
      solid(80, 150, 800, 70, "backbar"),
      solid(160, 248, 640, 70, "bar"),
      solid(70, 200, 40, 280, "wall"),
      solid(850, 200, 40, 280, "wall"),
    ],
    exits: [
      zone("to-hub", 400, 450, 160, 70, { to: "hub", spawn: { x: 176, y: 300 }, dir: "s" }),
    ],
    door: null,
    eve: { x: 430, y: 168, w: 72, h: 96 },
    elon: false,
    shakes: [{ x: 240, y: 360, w: 28, h: 36, taken: false, bob: 1.2 }],
    signs: [{ x: 360, y: 92, lines: ["SCOOP EVE", "NO REFUNDS"] }],
    notes: {},
  };
}

export function makeElon(screen) {
  return {
    kind: "elon",
    x: 520,
    y: 318,
    w: 72,
    h: 78,
    hp: 1,
    alive: true,
    facing: -1,
    vx: -92,
    minX: 160,
    maxX: 780,
    t: 0,
    laughT: 0,
    announced: false,
    homeY: 318,
  };
}

export function defaultSave() {
  return {
    whey: 0,
    best: 0,
    palaceTalk: false,
    doorUnlocked: false,
    upgrades: { extraDash: false, ricochet: false, shakeHeal: false },
  };
}
