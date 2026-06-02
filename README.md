# ⚡ RR Circuits

A **Rec Room CV2-style** visual block circuit editor — drag chips onto a canvas, wire them together, and export working code in multiple languages.

![RR Circuits Screenshot](docs/screenshot.png)

## ⬇️ Download

Go to [**Releases**](../../releases/latest) and grab your platform:

| Platform | Download | Notes |
|----------|----------|-------|
| 🪟 **Windows** | `RR-Circuits-Setup-x64.exe` | Installer with Start Menu shortcut |
| 🪟 **Windows** | `RR-Circuits-Portable.exe` | Single file, no install |
| 🍎 **macOS** | `RR-Circuits.dmg` | Intel + Apple Silicon (universal) |
| 🐧 **Linux** | `RR-Circuits.AppImage` | Works on any distro |
| 🐧 **Linux** | `rr-circuits.deb` | Debian / Ubuntu |
| 🐧 **Linux** | `rr-circuits.rpm` | Fedora / RHEL |

### First-Run Notes
- **macOS**: If Gatekeeper blocks it: right-click → **Open** → **Open** (only needed once)
- **Linux AppImage**: `chmod +x RR-Circuits-*.AppImage && ./RR-Circuits-*.AppImage`

---

## ✨ Features

- **156 chips** matching Rec Room CV2: Control Flow, Math, Logic, Variables, Lists, Events, Player, UI, Objects, Combatant, Trigger/Interaction/Handle Volumes, Gadgets, Conversion
- **Variable chips** with embedded name input + ☁ Cloud and 🔄 Synced toggles
- **Multi-board tabs** — multiple circuits per project, rename/duplicate boards
- **Custom chip builder** — define your own chips with any ports
- **Login system** — per-user saves stored locally
- **Code export** in 9 targets:
  - Generic: C#, Lua, Python, JavaScript, GDScript, Pseudocode
  - Engines: 🟦 Roblox Studio, ⬜ Unity, 🔵 Unreal Engine 5
- **Auto Import** — write code directly into your engine project folder
- Full undo/redo (Ctrl+Z/Y), copy/paste, selection box, snap to grid
- Native menu bar with keyboard shortcuts
- FPS counter, zoom controls, coordinate display

---

## 🛠️ Development

### Prerequisites
- [Node.js](https://nodejs.org) 18 or later
- npm (comes with Node.js)

### Run locally
```bash
git clone https://github.com/YOUR_USERNAME/rr-circuits.git
cd rr-circuits
npm install
npm start
```

### Dev mode (with DevTools open)
```bash
npm run dev
```

### Build for your current platform
```bash
npm run build
```

### Build for a specific platform
```bash
npm run build:win    # Windows (.exe installer + portable)
npm run build:mac    # macOS (.dmg, Intel + Apple Silicon)
npm run build:linux  # Linux (.AppImage, .deb, .rpm)
```

Build output goes to the `dist/` folder.

---

## 🚀 Releasing a new version

1. Update the version in `package.json`
2. Commit and tag:
   ```bash
   git add .
   git commit -m "Release v1.2.0"
   git tag v1.2.0
   git push && git push --tags
   ```
3. GitHub Actions automatically builds for all three platforms and creates a release with all files attached.

---

## 📁 Project Structure

```
rr-circuits/
├── index.html          — Main UI (login screen + app)
├── main.js             — Electron main process
├── preload.js          — Context bridge (web ↔ Node.js)
├── package.json        — Dependencies & build config
├── css/
│   └── style.css       — Dark Rec Room theme
├── js/
│   ├── chips.js        — All 156 chip definitions
│   ├── canvas.js       — Pan/zoom/drag/wire engine
│   ├── boards.js       — Multi-board & custom chip builder
│   ├── exporter.js     — Code generation (9 languages/engines)
│   ├── auth.js         — User accounts (localStorage)
│   └── app.js          — Main app logic & UI binding
├── build/
│   ├── icon.ico        — Windows icon
│   ├── icon.icns       — macOS icon
│   └── icons/          — Linux icons (16–512px PNGs)
└── .github/
    └── workflows/
        └── build.yml   — CI/CD: builds all platforms on tag push
```

---

## 🎨 App Icon

Place your icon files in `build/`:
- `build/icon.ico` — Windows (256×256 recommended)
- `build/icon.icns` — macOS
- `build/icon.png` — Linux / fallback (512×512)
- `build/icons/` — Linux sizes: `16x16.png` `32x32.png` `48x48.png` `64x64.png` `128x128.png` `256x256.png` `512x512.png`

Free converters: [icoconvert.com](https://icoconvert.com) (ICO), [cloudconvert.com](https://cloudconvert.com) (ICNS)

---

## 🗺️ Chip Categories

| Category | Count | Examples |
|----------|-------|---------|
| Control Flow | 11 | If Local Player Is Authority, Sequence, Delay, For Each, While, Value Switch |
| Math | 27 | Add, Subtract, Lerp, Sin/Cos/Tan, Atan2, Clamp, Sqrt |
| Logic | 12 | And, Or, Not, Nand, Xor, Equals, Greater Than |
| Variables | 10 | Int, Float, Bool, String, Player, Vector3, Quaternion, Color (all with ☁/🔄) |
| Lists | 7 | Add, Remove, Get, Contains, Count |
| Events | 6 | Event Receiver/Sender, Player Joined/Left, On Init, On Update |
| Player | 17 | Get Name/UID/Platform/IsVR, Teleport, Set Velocity, Head Orientation |
| UI | 4 | Show Notification, Show Subtitle, Dialogue Prompt, Set Text |
| Objects | 9 | Get/Set Position, Get Tags, Instantiate, Destroy |
| Combatant | 4 | Get/Set Health, Receive Damage, Is Alive |
| Volumes | 17 | Trigger Volume, Interaction Volume, Handle Volume (enter/exit/grab/release) |
| Gadgets | 22 | Button, Toggle Button, Dial, Piston, Rotator, Animation, Audio, Light, Emitter |
| Conversion | 12 | To String, Parse Int/Float, Vector3 Make/Split, Color Make |

---

## 📜 License

MIT — do whatever you want with it.
