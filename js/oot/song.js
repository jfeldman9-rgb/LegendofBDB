/** Song of the Scoop — the only song in this slice. Notes are gameplay, not spoken lines. */

export const NOTE_FREQ = {
  down: 262,
  left: 330,
  a: 392,
  right: 440,
  up: 523,
};

export const NOTE_GLYPH = {
  down: "▼",
  left: "◀",
  a: "●",
  right: "▶",
  up: "▲",
};

export const SONG_OF_THE_SCOOP = {
  id: "scoop",
  name: "SONG OF THE SCOOP",
  notes: ["down", "up", "down", "up", "right"],
};

export function feedNote(played, target, note) {
  const next = played.concat(note);
  const want = target.slice(0, next.length);
  const ok = want.every((n, i) => n === next[i]);
  if (!ok) return { played: [], matched: 0, complete: false, reset: true };
  const complete = next.length === target.length;
  return { played: complete ? [] : next, matched: next.length, complete, reset: false };
}
