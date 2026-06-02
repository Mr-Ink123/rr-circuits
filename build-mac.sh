#!/bin/bash
echo ""
echo "====================================="
echo "  RR Circuits - Build macOS .dmg"
echo "====================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed."
    echo "Download it from: https://nodejs.org"
    exit 1
fi

echo "[1/3] Node.js found: $(node --version)"

# Install dependencies
echo ""
echo "[2/3] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: npm install failed."
    exit 1
fi

# Build
echo ""
echo "[3/3] Building macOS DMG (Intel + Apple Silicon)..."
echo "This may take a few minutes..."
echo ""
npm run build:mac
if [ $? -ne 0 ]; then
    echo "ERROR: Build failed. Check the output above."
    exit 1
fi

echo ""
echo "====================================="
echo "  BUILD COMPLETE!"
echo "====================================="
echo ""
echo "Your files are in the  dist/  folder:"
echo ""
ls dist/*.dmg 2>/dev/null && echo ""
echo "  - .dmg = drag RR Circuits to Applications folder"
echo "  - .zip = for Apple Silicon Macs (arm64)"
echo ""
echo "NOTE: macOS may show a security warning on first run."
echo "To open: right-click the app → Open → Open"
echo ""
