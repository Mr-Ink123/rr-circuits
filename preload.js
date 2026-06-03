// preload.js — Context bridge between renderer (web) and main (Node.js)
// Exposes safe APIs to the renderer without enabling full Node.js access

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── File I/O ───────────────────────────────────────────────────────
  saveFile: (opts)     => ipcRenderer.invoke('save-file', opts),
  openFile: (opts)     => ipcRenderer.invoke('open-file', opts),
  writeToFolder: (opts)=> ipcRenderer.invoke('write-to-folder', opts),
  readFilePath: (opts) => ipcRenderer.invoke('read-file-path', opts),

  // ── App info ───────────────────────────────────────────────────────
  getAppInfo:    ()    => ipcRenderer.invoke('get-app-info'),
  openExternal:  (url) => ipcRenderer.invoke('open-external', url),

  // ── Menu events (main → renderer) ──────────────────────────────────
  onMenuNew:       (cb) => ipcRenderer.on('menu-new',        () => cb()),
  onMenuSave:      (cb) => ipcRenderer.on('menu-save',       () => cb()),
  onMenuLoad:      (cb) => ipcRenderer.on('menu-load',       () => cb()),
  onMenuExport:    (cb) => ipcRenderer.on('menu-export',     () => cb()),
  onMenuUndo:      (cb) => ipcRenderer.on('menu-undo',       () => cb()),
  onMenuRedo:      (cb) => ipcRenderer.on('menu-redo',       () => cb()),
  onMenuDelete:    (cb) => ipcRenderer.on('menu-delete',     () => cb()),
  onMenuSelectAll: (cb) => ipcRenderer.on('menu-select-all', () => cb()),
  onMenuZoomIn:    (cb) => ipcRenderer.on('menu-zoom-in',    () => cb()),
  onMenuZoomOut:   (cb) => ipcRenderer.on('menu-zoom-out',   () => cb()),
  onMenuZoomReset: (cb) => ipcRenderer.on('menu-zoom-reset', () => cb()),
  onMenuFrameAll:  (cb) => ipcRenderer.on('menu-frame-all',  () => cb()),

  // ── Engine Connect ─────────────────────────────────────────────────
  engineSetCode: (engine, code) => ipcRenderer.invoke('engine-set-code', { engine, code }),
  engineStatus:  ()             => ipcRenderer.invoke('engine-status'),

  // ── Platform ───────────────────────────────────────────────────────
  platform: process.platform,
  isElectron: true,
});
