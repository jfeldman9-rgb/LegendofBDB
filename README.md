# HD Claudia — Legend of BDB

A high-definition browser adventure starring Claudia. Gather five memory stars in Duskwind Vale, slip past the shadow wisps, and open the BDB gate.

## Play

Open `index.html` in a modern browser, or use the GitHub Pages site after it is enabled:

**https://jfeldman9-rgb.github.io/LegendofBDB/**

Controls:

- Desktop: WASD to move, mouse or Q/E to turn the camera, Space to dash, M to mute
- Phone: on-screen joystick and Dash button

The game is a single static page (Three.js from a CDN). No build step.

## GitHub Pages

This repo is set up as a static site from the repository root:

- `index.html` is the game
- `.nojekyll` keeps GitHub from running Jekyll
- `.github/workflows/pages.yml` deploys Pages from `main`

If Pages is not live yet, enable it in the repo settings:

1. Settings → Pages
2. Source: GitHub Actions, or Deploy from a branch (`main` / root)
3. Make the repository public if the account does not include private Pages
