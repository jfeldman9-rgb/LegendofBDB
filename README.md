# The Legend of Claudia: BDB's Awakening

Private parody. Vertical slice **M0–M3** — a playable **third-person 3D** overworld. Eggplant gun. No sword. No Nintendo names on the title.

Hero credit: **Big Dick Bob**.

## Play

Open `index.html` in a modern browser, or the GitHub Pages site:

**https://jfeldman9-rgb.github.io/LegendofBDB/**

Static site at the repository root. No build step. No Node server. Keep `index.html` + `.nojekyll`. Three.js is vendored at `vendor/three.module.min.js` via importmap.

### How to play this slice

1. **M0 Title** — *THE LEGEND OF CLAUDIA / BDB'S AWAKENING*, starring **Big Dick Bob**. Tagline *PROTEIN. PRODUCE. POOR JUDGMENT.* Hit **START RESCUE**.
2. **Opening** — Existing `assets/video/opening.mp4` plays. **SKIP** is available. Then you spawn in the **Protein Palace plaza**.
3. **M2 Field look** — From the courtyard, look east at the gated Boulevard. BDB: *"Boulevard of Bad Decisions. Home court."*
4. **M3 Palace + Song of the Scoop** — Walk up to Scoop Eve, press **K**. After her lesson, **HOLD Papacito** (P / Enter) and play **Song of the Scoop** (`▼ ▲ ▼ ▲ ▶` with WASD or arrows). Atlas checkpoints. The **field gate opens**. Soft-save at the shake fountain.
5. **Boulevard field** — Open 3D ground, sky, buildings. One laughing Elon (1 HP). Lock-on, jump, shoot Street Produce. Locked velvet D1 door is visible — no dungeon interior.

Not in this slice: D1, Warthog, Celestial.

### Keyboard (primary)

| Action | Keys |
| --- | --- |
| Move (camera-relative) | WASD / arrows |
| Orbit camera | Mouse drag · Q / E · wheel zoom |
| Jump | Space |
| Z-target / lock-on | Shift or F |
| Street Produce (eggplant) | J or Ctrl |
| Interact / talk | K or E |
| Papacito (one button, two jobs) | **P or Enter** — **hold** = song menu · **tap** = protocol (stubbed without shakes) |
| Pause | Esc |

Touch/mobile pad is secondary.

### HUD / save

Big Dick Bob, hearts, protein, Papacito charges, Street Produce heat, score. Collectible glowing protein shakes in the field charge the Papacito protocol.

Death: **PAPI HAS LEFT THE CHAT** / **Tuxedo damaged. Ego intact.** — retry fountain checkpoint after the song.

`localStorage` key `bdb-awakening-oot-3d-v1` persists song learned / field open.

## Enhancements in this build
- **3D Particle System**: Footfall dust, jump impact poofs, eggplant produce smoke trails, fountain mystical whey motes, musical notes floating during song playing, and expanding shockwave rings on impacts.
- **Dynamic Camera Feel**: Screen shake on combat hits and Papacito blasts, smooth lerping on lock-on targeting, and ambient title orbiting.
- **Enhanced Character Rigging & Animation**: Tuxedo tail flapping, hurt invulnerability flash, head tracking, Scoop Eve idle animation, and laughing Elon scooter reactions.
- **Field Protein Pickups**: Floating, rotating 3D protein shake pickups scattered across the Boulevard field to charge Papacito Protocol.
- **Rich Audio Synthesis**: Upgraded harmonic ocarina note frequencies and chime chords for the Song of the Scoop.

## Assets

Reuses existing sprites, backgrounds, `assets/audio/bdb-rise.mp3`, `opening.mp4`, `closing.mp4`, and Elon/BDB art as 3D face textures. No paid downloads. No TTS. No Nintendo models, maps, music, or textures.
