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

GitHub’s API and Actions tokens on this repo cannot create the Pages site (`403 Resource not accessible by integration`). Enable it once in the GitHub UI:

1. Make the repository **public** (private Pages needs a paid plan)
2. Settings → Pages → Build and deployment
3. Source: **GitHub Actions**
4. Re-run the **Deploy GitHub Pages** workflow, or push any commit on `main`

The live URL is:

**https://jfeldman9-rgb.github.io/LegendofBDB/**
