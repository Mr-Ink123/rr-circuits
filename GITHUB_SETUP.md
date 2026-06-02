# How to put RR Circuits on GitHub and get auto-builds

## Step 1 — Install Node.js (one time)
Download from https://nodejs.org (LTS version)
This also installs `npm` and `git`.

## Step 2 — Install Git (one time)
Download from https://git-scm.com if not already installed.

## Step 3 — Create a GitHub repo
1. Go to https://github.com/new
2. Name it `rr-circuits` (or anything you want)
3. Leave it empty (no README, no .gitignore — we have our own)
4. Click **Create repository**
5. Copy the repo URL, e.g. `https://github.com/YOUR_NAME/rr-circuits.git`

## Step 4 — Set up the project locally
Open a terminal/command prompt in `C:\Users\miles\Documents\RRCode Program\` and run:

```bash
# Install Electron and electron-builder
npm install

# Initialize git
git init
git add .
git commit -m "Initial commit: RR Circuits v1.0.0"

# Connect to GitHub (replace with your repo URL)
git remote add origin https://github.com/YOUR_NAME/rr-circuits.git
git branch -M main
git push -u origin main
```

## Step 5 — Generate app icons (optional but recommended)
```bash
node build/generate-icons.js
```
Then convert `build/icon.png` to:
- `build/icon.ico` for Windows  →  https://icoconvert.com
- `build/icon.icns` for macOS   →  https://cloudconvert.com/png-to-icns

Add and commit the icons:
```bash
git add build/
git commit -m "Add app icons"
git push
```

## Step 6 — Release a new version

Whenever you want to publish a new release (GitHub will auto-build all platforms):

```bash
# Update version in package.json first, then:
git add .
git commit -m "Release v1.0.0"
git tag v1.0.0
git push
git push --tags
```

GitHub Actions will automatically:
1. Start 3 parallel build jobs (Windows, macOS, Linux)
2. Build the installers (takes ~5-10 minutes)
3. Create a GitHub Release with all files attached

## Step 7 — Download the builds
Go to your repo → **Releases** tab → latest release → download your platform's file.

---

## What each platform gets

| Platform | Files built |
|----------|-------------|
| Windows | `RR-Circuits-Setup-1.0.0.exe` (installer) + `RR-Circuits-1.0.0-Portable.exe` |
| macOS | `RR-Circuits-1.0.0.dmg` (drag to Applications) |
| Linux | `RR-Circuits-1.0.0.AppImage` + `.deb` + `.rpm` |

## Difficulty rating

| Platform | Difficulty | Notes |
|----------|------------|-------|
| Windows | ⭐ Very Easy | Just works, no signing needed |
| Linux | ⭐ Very Easy | AppImage runs on any distro |
| macOS | ⭐⭐ Easy | Works unsigned, Gatekeeper shows a one-time warning. For full notarization (no warning) you need an Apple Developer account ($99/year) — optional |

---

## Developing without building

To run the app in dev mode without packaging:
```bash
npm start        # Run as Electron app
npm run dev      # Run with DevTools open
```

The web version still works too — just open `index.html` in Chrome directly,
or run: `npx serve .` and visit `http://localhost:3000`

---

## Updating the app

```bash
git add .
git commit -m "Add new feature"
git push

# When ready for a new release:
# 1. Update "version" in package.json
# 2. git tag v1.1.0 && git push --tags
```
