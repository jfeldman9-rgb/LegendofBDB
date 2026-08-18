import { readFileSync } from "node:fs";
import {
  LINES,
  ZONE_NAME,
  PLAZA_NAME,
  FIELD_NAME,
  DEATH_TITLES,
  CHECKPOINT_TOAST,
  TITLE,
  SUBTITLE,
  HERO_CREDIT,
  TAGLINE,
  LAYOUT,
  defaultSave,
} from "../js/oot/lines.js";
import { clampToWalkable, zoneAt, canWalkPlazaToField, resolveWorld } from "../js/oot/physics.js";
import { SONG_OF_THE_SCOOP, feedNote, NOTE_GLYPH } from "../js/oot/song.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(TITLE === "THE LEGEND OF CLAUDIA", "title");
assert(SUBTITLE === "BDB'S AWAKENING", "subtitle");
assert(HERO_CREDIT === "Big Dick Bob", "hero credit");
assert(TAGLINE === "PROTEIN. PRODUCE. POOR JUDGMENT.", "tagline");
assert(ZONE_NAME === "BOULEVARD OF BAD DECISIONS", "zone name locked");
assert(PLAZA_NAME === "PROTEIN PALACE PLAZA", "plaza name");
assert(FIELD_NAME === "BOULEVARD OF BAD DECISIONS", "field name");
assert(CHECKPOINT_TOAST === "CHECKPOINT: EGO INTACT", "checkpoint toast locked");
assert(DEATH_TITLES.includes("PAPI HAS LEFT THE CHAT"), "death title");
assert(DEATH_TITLES.includes("Tuxedo damaged. Ego intact."), "death title 2");

assert(LINES.elonAppear[0].text === "Nice tux. Wrong century.", "elon appear 1");
assert(LINES.elonAppear[1].text === "It's the correct century. You're the recall.", "elon appear 2");
assert(LINES.elonDeath[0].text === "I'll spawn. That's the bit.", "elon death");
assert(LINES.fieldLook[0].who === "BDB", "field look speaker");
assert(LINES.fieldLook[0].text === "Boulevard of Bad Decisions. Home court.", "field look");
assert(LINES.eveTeach[0].text === "Welcome to Papi's. No refunds. She's still in 3B.", "eve 1");
assert(LINES.eveTeach[1].text === "I know. I brought produce.", "eve 2");
assert(LINES.eveTeach[2].text === "Hold Papacito. Not the nuke. The song. Scoop first, apocalypse later.", "eve 3");
assert(LINES.eveTeach[3].text === "Song of the Scoop. Opens the field. Soft-saves at my fountain.", "eve 4");
assert(LINES.eveTeach[4].who === "ATLAS" && LINES.eveTeach[4].text === "Song learned.", "atlas learned");
assert(LINES.eveAfterSong[0].who === "ATLAS" && LINES.eveAfterSong[0].text === "CHECKPOINT: EGO INTACT.", "atlas checkpoint");
assert(LINES.eveAfterSong[1].text === "Go get her, Big Dick Bob. Try not to die famous.", "eve sendoff");

assert(zoneAt(LAYOUT.spawn.x, LAYOUT.spawn.z) === "plaza", "spawn in plaza");
assert(zoneAt(LAYOUT.elon.x, LAYOUT.elon.z) === "field", "elon in field");
assert(zoneAt(LAYOUT.velvet.x, LAYOUT.velvet.z) === "field", "velvet door in field");
assert(zoneAt(LAYOUT.eve.x, LAYOUT.eve.z) === "plaza", "eve in plaza");
assert(LAYOUT.plaza.maxX === LAYOUT.field.minX, "plaza connects to field pocket");
assert(canWalkPlazaToField(false), "gate blocks until song");
assert(canWalkPlazaToField(true), "field walkable after song");

const blocked = clampToWalkable(LAYOUT.elon.x, LAYOUT.elon.z, false);
assert(blocked.x < LAYOUT.gate.x, "closed gate cannot reach Elon");
const open = clampToWalkable(LAYOUT.elon.x, LAYOUT.elon.z, true);
assert(Math.abs(open.x - LAYOUT.elon.x) < 0.01, "open field reaches Elon");

const hit = resolveWorld(LAYOUT.gate.x, 0, 0.42, [{ minX: 13.5, maxX: 14.5, minZ: -5, maxZ: 5 }], false);
assert(hit.x < LAYOUT.gate.x, "resolve stays west of closed gate");

assert(SONG_OF_THE_SCOOP.name === "SONG OF THE SCOOP", "song name");
assert(SONG_OF_THE_SCOOP.notes.join(",") === "down,up,down,up,right", "scoop sequence");
assert(NOTE_GLYPH.down === "▼" && NOTE_GLYPH.up === "▲" && NOTE_GLYPH.right === "▶", "glyphs");
let seq = { played: [] };
for (const n of SONG_OF_THE_SCOOP.notes) {
  seq = feedNote(seq.played, SONG_OF_THE_SCOOP.notes, n);
}
assert(seq.complete, "correct scoop completes");
const bad = feedNote(["down"], SONG_OF_THE_SCOOP.notes, "left");
assert(bad.reset && !bad.complete, "wrong note resets");

const save = defaultSave();
assert(save.songLearned === false && save.fieldOpen === false, "save starts gated");

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert(html.includes("./js/oot/game.js"), "index boots 3D oot entry");
assert(html.includes("three"), "importmap three");
assert(html.includes("START RESCUE"), "start rescue");
assert(html.includes("Big Dick Bob"), "title credits hero");
assert(html.includes("PROTEIN. PRODUCE. POOR JUDGMENT."), "tagline on title");
assert(!/Zelda|Ocarina of Time/i.test(html.replace(/Nintendo/g, "")), "no Nintendo product title");
assert(html.includes("HOLD") && html.includes("song"), "papacito hold documented");
assert(html.includes("Shift") && html.includes("WASD"), "keyboard how-to");
assert(!html.includes('from "./js/game.js"'), "old 2D loop is not index entry");

const old2d = readFileSync(new URL("../js/game.js", import.meta.url), "utf8");
assert(old2d.includes("canvas"), "legacy 2D file may remain unused");

console.log("slice contract tests: ok");
