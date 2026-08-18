// Locked spoken lines and slice constants. Do not invent extra spoken lines.

export const TITLE = "THE LEGEND OF CLAUDIA";
export const SUBTITLE = "BDB'S AWAKENING";
export const HERO_CREDIT = "Big Dick Bob";
export const TAGLINE = "PROTEIN. PRODUCE. POOR JUDGMENT.";

export const ZONE_NAME = "BOULEVARD OF BAD DECISIONS";
export const PLAZA_NAME = "PROTEIN PALACE PLAZA";
export const FIELD_NAME = "BOULEVARD OF BAD DECISIONS";

export const DEATH_TITLES = ["PAPI HAS LEFT THE CHAT", "Tuxedo damaged. Ego intact."];
export const CHECKPOINT_TOAST = "CHECKPOINT: EGO INTACT";

/** Locked spoken lines — show as talk boxes. Do not invent extras. */
export const LINES = {
  elonAppear: [
    { who: "ELON", text: "Nice tux. Wrong century." },
    { who: "BDB", text: "It's the correct century. You're the recall." },
  ],
  elonDeath: [{ who: "ELON", text: "I'll spawn. That's the bit." }],
  velvetLock: [{ who: "BDB", text: "Velvet lock. Of course it's velvet." }],
  fieldLook: [{ who: "BDB", text: "Boulevard of Bad Decisions. Home court." }],
  eveTeach: [
    { who: "EVE", text: "Welcome to Papi's. No refunds. She's still in 3B." },
    { who: "BDB", text: "I know. I brought produce." },
    { who: "EVE", text: "Hold Papacito. Not the nuke. The song. Scoop first, apocalypse later." },
    { who: "EVE", text: "Song of the Scoop. Opens the field. Soft-saves at my fountain." },
    { who: "ATLAS", text: "Song learned." },
  ],
  eveAfterSong: [
    { who: "ATLAS", text: "CHECKPOINT: EGO INTACT." },
    { who: "EVE", text: "Go get her, Big Dick Bob. Try not to die famous." },
  ],
};

export const SAVE_KEY = "bdb-awakening-oot-3d-v1";

export function defaultSave() {
  return {
    whey: 0,
    best: 0,
    palaceTalk: false,
    songLearned: false,
    fieldOpen: false,
    doorUnlocked: false,
  };
}

/** World layout in meters. Y is up. Plaza (west) gated from the Boulevard field (east). */
export const LAYOUT = {
  spawn: { x: -6, y: 0, z: 5 },
  fountain: { x: -6, z: -2 },
  palaceDoor: { x: -18.2, z: 0 },
  eve: { x: -16.6, z: 2.1 },
  velvet: { x: 78, z: 0 },
  elon: { x: 46, z: -6 },
  gate: { x: 14, z: 0, halfW: 5 },
  plaza: { minX: -28, maxX: 14, minZ: -20, maxZ: 20 },
  field: { minX: 14, maxX: 88, minZ: -40, maxZ: 40 },
};
