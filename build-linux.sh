#!/bin/bash
echo ""
echo "====================================="
echo "  RR Circuits - Build Linux"
echo "====================================="
echo ""

if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not installed. Run: sudo apt install nodejs npm"
    exit 1
fi

echo "[1/3] Node.js: $(node --version)"

echo ""
echo "[2/3] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then echo "ERROR: npm install failed."; exit 1; fi

echo ""
echo "[3/3] Building Linux packages..."
npm run build:linux

echo ""
echo "====================================="
echo "  BUILD COMPLETE!  →  dist/ folder"
echo "====================================="
echo ""
ls dist/*.AppImage dist/*.deb dist/*.rpm 2>/dev/null
echo ""
echo "  .AppImage = universal, works on any distro"
echo "    chmod +x dist/*.AppImage && ./dist/*.AppImage"
echo ""
echo "  .deb = Ubuntu / Debian:  sudo dpkg -i dist/*.deb"
echo "  .rpm = Fedora / RHEL:    sudo rpm -i dist/*.rpm"
echo ""
