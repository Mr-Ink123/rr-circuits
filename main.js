// main.js — Electron main process for RR Circuits

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path  = require('path');
const fs    = require('fs');
const os    = require('os');

// Keep a global reference so the window isn't garbage collected
let mainWindow;

// ── Window creation ────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:     1440,
    height:    900,
    minWidth:  960,
    minHeight: 600,
    show:      false,
    backgroundColor: '#080F1A',
    title:     'RR Circuits',
    icon:      path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      nodeIntegration:  false,
      contextIsolation: true,
      sandbox:          false,
    },
    // macOS-specific
    titleBarStyle:    process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 14 },
  });

  // Load the app
  mainWindow.loadFile('index.html');

  // Show when ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC — Native file dialogs ─────────────────────────────────────────────
ipcMain.handle('save-file', async (_, { defaultPath, content, filters }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath || 'circuit',
    filters:     filters || [
      { name: 'RR Circuits', extensions: ['rrc', 'json'] },
      { name: 'All Files',   extensions: ['*'] },
    ],
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  try {
    fs.writeFileSync(result.filePath, content, 'utf8');
    return { success: true, filePath: result.filePath };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('open-file', async (_, { filters }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: filters || [
      { name: 'RR Circuits', extensions: ['rrc', 'json'] },
      { name: 'All Files',   extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  try {
    const content = fs.readFileSync(result.filePaths[0], 'utf8');
    return { success: true, content, filePath: result.filePaths[0] };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('write-to-folder', async (_, { suggestedFolder, filename, content }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title:       `Choose destination folder (${suggestedFolder})`,
    properties:  ['openDirectory', 'createDirectory'],
    defaultPath: os.homedir(),
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  const dest = path.join(result.filePaths[0], filename);
  try {
    fs.writeFileSync(dest, content, 'utf8');
    shell.showItemInFolder(dest);
    return { success: true, filePath: dest };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('read-file-path', async (_, { filePath }) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('get-app-info', () => ({
  version:  app.getVersion(),
  platform: process.platform,
  userData: app.getPath('userData'),
}));

ipcMain.handle('open-external', (_, url) => {
  shell.openExternal(url);
});

// ── App Menu ───────────────────────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Circuit',    accelerator: 'CmdOrCtrl+N', click: () => send('menu-new') },
        { label: 'Save',           accelerator: 'CmdOrCtrl+S', click: () => send('menu-save') },
        { label: 'Load…',          accelerator: 'CmdOrCtrl+O', click: () => send('menu-load') },
        { type: 'separator' },
        { label: 'Export Code…',   accelerator: 'CmdOrCtrl+E', click: () => send('menu-export') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo',       accelerator: 'CmdOrCtrl+Z',       click: () => send('menu-undo') },
        { label: 'Redo',       accelerator: 'CmdOrCtrl+Shift+Z', click: () => send('menu-redo') },
        { type: 'separator' },
        { label: 'Cut',        role: 'cut' },
        { label: 'Copy',       role: 'copy' },
        { label: 'Paste',      role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => send('menu-select-all') },
        { type: 'separator' },
        { label: 'Delete Selected', accelerator: 'Delete', click: () => send('menu-delete') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In',    accelerator: 'CmdOrCtrl+=', click: () => send('menu-zoom-in') },
        { label: 'Zoom Out',   accelerator: 'CmdOrCtrl+-', click: () => send('menu-zoom-out') },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: () => send('menu-zoom-reset') },
        { label: 'Frame All',  accelerator: 'CmdOrCtrl+Shift+A', click: () => send('menu-frame-all') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'GitHub Repository', click: () => shell.openExternal('https://github.com/miles/rr-circuits') },
        { label: 'About RR Circuits', click: () => {
          dialog.showMessageBox(mainWindow, {
            type:    'info',
            title:   'RR Circuits',
            message: 'RR Circuits',
            detail:  `Version ${app.getVersion()}\nRec Room-style visual circuit editor\nBuilt with Electron`,
            buttons: ['OK'],
            icon:    path.join(__dirname, 'build', 'icon.png'),
          });
        }},
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function send(channel) {
  if (mainWindow) mainWindow.webContents.send(channel);
}
