import {
  LINES,
  ZONE_NAME,
  DEATH_TITLES,
  CHECKPOINT_TOAST,
  aabb,
  hitZone,
  buildScreen,
  makeElon,
  defaultSave,
} from "../js/world.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(ZONE_NAME === "BOULEVARD OF BAD DECISIONS", "zone name locked");
assert(CHECKPOINT_TOAST === "CHECKPOINT: EGO INTACT", "checkpoint toast locked");
assert(DEATH_TITLES.includes("PAPI HAS LEFT THE CHAT"), "death title");
assert(DEATH_TITLES.includes("Tuxedo damaged. Ego intact."), "death title 2");

assert(LINES.elonAppear[0].text === "Nice tux. Wrong century.", "elon appear 1");
assert(LINES.elonAppear[1].text === "It's the correct century. You're the recall.", "elon appear 2");
assert(LINES.elonDeath[0].text === "I'll spawn. That's the bit.", "elon death");
assert(LINES.velvetLock[0].text === "Velvet lock. Of course it's velvet.", "velvet");
assert(LINES.eve[0].text === "Welcome to Papi's. No refunds. She's still in 3B.", "eve 1");
assert(LINES.eve[1].text === "I know. I brought produce.", "eve 2");
assert(LINES.eve[2].text === "The basement wants a man with poor judgment. That's you, baby.", "eve 3");

const hub = buildScreen("hub");
const eastLocked = buildScreen("east", { doorUnlocked: false });
const eastOpen = buildScreen("east", { doorUnlocked: true });
const palace = buildScreen("palace");

assert(hub.exits.some((e) => e.to === "east"), "hub east exit");
assert(hub.exits.some((e) => e.to === "palace"), "hub palace exit");
assert(eastLocked.exits.some((e) => e.to === "hub"), "east back to hub");
assert(eastLocked.door && eastLocked.door.unlocked === false, "door starts locked");
assert(eastOpen.door.unlocked === true, "door unlocks after save flag");
assert(palace.eve && palace.exits[0].to === "hub", "palace eve + exit");
assert(!hub.elon && eastLocked.elon, "elon only on B-EAST");

const player = { x: 870, y: 340, w: 42, h: 52 };
assert(hitZone(player, hub.exits)?.to === "east", "player can reach B-EAST exit");

const fromEast = { x: 25, y: 340, w: 42, h: 52 };
assert(hitZone(fromEast, eastLocked.exits)?.to === "hub", "player can reach B-HUB exit");

const atPalace = { x: 160, y: 250, w: 42, h: 52 };
assert(hitZone(atPalace, hub.exits)?.to === "palace", "player can enter palace door");

const south = { x: 470, y: 460, w: 42, h: 52 };
assert(hitZone(south, palace.exits)?.to === "hub", "player can leave palace");

const elon = makeElon(eastLocked);
assert(elon.hp === 1 && elon.alive, "elon 1 HP");

const save = defaultSave();
assert(save.palaceTalk === false && save.doorUnlocked === false, "save flags");

assert(!aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 0, w: 10, h: 10 }), "aabb miss");
assert(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 0, w: 10, h: 10 }), "aabb hit");

console.log("slice contract tests: ok");
