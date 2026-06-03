// app.js — Main application: login, boards, sidebar, settings, export

// Are we running inside Electron?
const IS_ELECTRON = !!(window.electronAPI?.isElectron);

const App = (() => {
  let currentLang = 'csharp';
  let activeCatFilter = null;
  let settings = {
    snap: true, gridSize: 16, wireStyle: 'bezier',
    showFps: true, theme: 'dark', gridStyle: 'dots',
    defaultLang: 'csharp',
  };

  // ── BOOT ─────────────────────────────────────────────────────────────────
  function boot() {
    // Try to restore session
    if (Auth.init()) {
      showApp();
    } else {
      showLogin();
    }
    bindLogin();
  }

  function showLogin() {
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('appRoot').style.display = 'none';
  }

  function showApp() {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('appRoot').style.display = 'flex';
    document.getElementById('userLabel').textContent = Auth.getUser() || 'User';

    Canvas.init();
    Boards.init();
    buildSidebar();
    loadCustomChips();
    bindHeader();
    bindSettings();
    bindExport();
    bindBoardActions();
    bindCustomChip();
    applySettings();
    tryRestoreSession();
    // Make sure simulate mode is always OFF when the app opens
    if (typeof Simulator !== 'undefined') Simulator.stop(true);
    // Init engine connect
    if (typeof EngineConnect !== 'undefined') EngineConnect.init();
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  function bindLogin() {
    const tabL = document.getElementById('tabLogin');
    const tabR = document.getElementById('tabRegister');
    const fmL  = document.getElementById('loginForm');
    const fmR  = document.getElementById('registerForm');

    tabL.addEventListener('click', () => {
      tabL.classList.add('active'); tabR.classList.remove('active');
      fmL.style.display=''; fmR.style.display='none';
      document.getElementById('loginError').textContent='';
    });
    tabR.addEventListener('click', () => {
      tabR.classList.add('active'); tabL.classList.remove('active');
      fmR.style.display=''; fmL.style.display='none';
      document.getElementById('regError').textContent='';
    });

    // Submit on Enter
    ['loginUser','loginPass'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('loginSubmit').click();
      });
    });
    ['regUser','regPass'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('registerSubmit').click();
      });
    });

    document.getElementById('loginSubmit').addEventListener('click', () => {
      const u = document.getElementById('loginUser').value;
      const p = document.getElementById('loginPass').value;
      const err = Auth.login(u, p);
      if (err) { document.getElementById('loginError').textContent = err; return; }
      showApp();
    });

    document.getElementById('registerSubmit').addEventListener('click', () => {
      const u = document.getElementById('regUser').value;
      const p = document.getElementById('regPass').value;
      const err = Auth.register(u, p);
      if (err) { document.getElementById('regError').textContent = err; return; }
      showApp();
    });
  }

  // ── SIDEBAR ───────────────────────────────────────────────────────────────
  function buildSidebar(filter = '', catFilter = null) {
    const list = document.getElementById('chipList');
    list.innerHTML = '';

    // Group chips by category
    const groups = {};
    for (const chip of getAllChips()) {
      const nameMatch = !filter || chip.name.toLowerCase().includes(filter.toLowerCase());
      const catMatch  = !catFilter || catFilter.has(chip.category);
      if (!nameMatch || !catMatch) continue;
      if (!groups[chip.category]) groups[chip.category] = [];
      groups[chip.category].push(chip);
    }

    // Sort by category order
    const cats = Object.keys(groups).sort((a, b) => {
      const oa = (CATEGORIES[a]?.order ?? 99);
      const ob = (CATEGORIES[b]?.order ?? 99);
      return oa - ob;
    });

    if (!cats.length) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3)">No chips found</div>';
    }

    cats.forEach(catName => {
      const cat = CATEGORIES[catName] || { color: '#778899', icon: '?' };
      const chips = groups[catName];

      const hdr = document.createElement('div');
      hdr.className = 'cat-header';
      hdr.innerHTML = `<span class="cat-dot" style="background:${cat.color}"></span>
        <span>${cat.icon} ${catName}</span>
        <span style="color:var(--text3);margin-left:4px;font-size:9px">(${chips.length})</span>
        <span class="cat-arrow">▾</span>`;

      const items = document.createElement('div');
      items.className = 'cat-items';

      hdr.addEventListener('click', () => {
        hdr.classList.toggle('collapsed');
        items.style.display = hdr.classList.contains('collapsed') ? 'none' : '';
      });

      chips.forEach(chip => {
        const row = document.createElement('div');
        row.className = 'sb-chip';
        row.draggable = true;
        row.title = `${chip.name}\n${chip.category}\nIn: ${chip.inputs.map(p=>p.name).join(', ')||'—'}\nOut: ${chip.outputs.map(p=>p.name).join(', ')||'—'}`;
        row.innerHTML = `
          <div class="sb-chip-icon" style="background:${cat.color}22;border:1px solid ${cat.color}44;color:${cat.color}">${cat.icon}</div>
          <span class="sb-chip-name">${chip.name}</span>
          <span class="sb-chip-ports">${chip.inputs.length}→${chip.outputs.length}</span>
        `;
        row.addEventListener('dragstart', e => {
          e.dataTransfer.setData('chipId', chip.id);
          e.dataTransfer.effectAllowed = 'copy';
        });
        row.addEventListener('dblclick', () => {
          const ca = document.getElementById('canvasArea');
          const r  = ca.getBoundingClientRect();
          // Place near center of canvas
          const cp = { x: (r.width/2 - 80), y: (r.height/2 - 40) };
          const node = Canvas.addNode(chip.id, Math.round(cp.x), Math.round(cp.y));
          if (node) Canvas.showToast(`Added ${chip.name}`);
        });
        items.appendChild(row);
      });

      list.appendChild(hdr);
      list.appendChild(items);
    });

    buildCatFilters(catFilter);
  }

  function buildCatFilters(active) {
    const el = document.getElementById('categoryFilters');
    if (!el) return;
    el.innerHTML = '';
    Object.entries(CATEGORIES).forEach(([name, info]) => {
      const btn = document.createElement('button');
      btn.className = 'cat-filter-chip' + (active && active.has(name) ? ' active' : '');
      btn.style.color = info.color;
      btn.style.borderColor = (active && active.has(name)) ? info.color : 'transparent';
      btn.style.background  = (active && active.has(name)) ? info.color + '22' : 'transparent';
      btn.textContent = name;
      btn.addEventListener('click', () => {
        if (!activeCatFilter) activeCatFilter = new Set();
        if (activeCatFilter.has(name)) { activeCatFilter.delete(name); if (!activeCatFilter.size) activeCatFilter = null; }
        else activeCatFilter.add(name);
        buildSidebar(document.getElementById('chipSearch').value, activeCatFilter);
      });
      el.appendChild(btn);
    });
  }

  function rebuildSidebar() { buildSidebar(document.getElementById('chipSearch').value, activeCatFilter); }

  document.getElementById('chipSearch')?.addEventListener('input', e => buildSidebar(e.target.value, activeCatFilter));
  document.getElementById('filterBtn')?.addEventListener('click', () => {
    const el = document.getElementById('categoryFilters');
    el.style.display = el.style.display === 'none' ? 'flex' : 'none';
    buildCatFilters(activeCatFilter);
  });

  function loadCustomChips() {
    Auth.getCustomChips().forEach(c => registerCustomChip(c));
    if (!CATEGORIES['Custom']) CATEGORIES['Custom'] = { color:'#FF44FF', icon:'★', order:99 };
  }

  // ── HEADER ────────────────────────────────────────────────────────────────
  function bindHeader() {
    document.getElementById('saveBtn').addEventListener('click', IS_ELECTRON ? nativeSave : openSaves);
    document.getElementById('loadBtn').addEventListener('click', IS_ELECTRON ? nativeLoad : openSaves);
    document.getElementById('exportBtn').addEventListener('click', openExport);
    document.getElementById('simulateBtn').addEventListener('click', () => Simulator.toggle());
    document.getElementById('settingsBtn').addEventListener('click', () => {
      document.getElementById('settingsModal').style.display = 'flex';
    });
    document.getElementById('logoutBtn').addEventListener('click', () => {
      if (confirm('Log out? Unsaved changes will be lost.')) {
        Auth.logout();
        location.reload();
      }
    });

    // Wire up Electron native menu commands
    if (IS_ELECTRON) {
      window.electronAPI.onMenuSave(nativeSave);
      window.electronAPI.onMenuLoad(nativeLoad);
      window.electronAPI.onMenuNew(() => {
        if (confirm('Start a new circuit? Unsaved changes will be lost.')) {
          Canvas.loadState({ nodes:[], wires:[], nextId:1, transform:{x:80,y:60,scale:1} });
          document.getElementById('projectName').textContent = 'Untitled Circuit';
        }
      });
      window.electronAPI.onMenuExport(openExport);
      window.electronAPI.onMenuUndo(()       => Canvas.undo?.());
      window.electronAPI.onMenuRedo(()       => Canvas.redo?.());
      window.electronAPI.onMenuDelete(()     => Canvas.deleteSelected?.());
      window.electronAPI.onMenuSelectAll(()  => Canvas.selectAll?.());
      window.electronAPI.onMenuZoomIn(()     => Canvas.zoom?.(1.2, null));
      window.electronAPI.onMenuZoomOut(()    => Canvas.zoom?.(0.8, null));
      window.electronAPI.onMenuZoomReset(()  => Canvas.resetView?.());
      window.electronAPI.onMenuFrameAll(()   => Canvas.frameNodes?.([]));

      // Show version in title bar
      window.electronAPI.getAppInfo().then(info => {
        document.title = `RR Circuits v${info.version}`;
      });
    }
  }

  // ── NATIVE FILE I/O (Electron only) ──────────────────────────────────────
  async function nativeSave() {
    Boards.syncActive();
    const name = document.getElementById('projectName').textContent.trim() || 'Untitled Circuit';
    const data = JSON.stringify({ project: Boards.getProjectData(), name, savedAt: Date.now() }, null, 2);
    const result = await window.electronAPI.saveFile({
      defaultPath: name.replace(/[^a-z0-9_\-\s]/gi, '') + '.rrc',
      content: data,
      filters: [
        { name: 'RR Circuits', extensions: ['rrc'] },
        { name: 'JSON',        extensions: ['json'] },
      ],
    });
    if (result.success) Canvas.showToast(`Saved to ${result.filePath.split(/[/\\]/).pop()}`);
    else if (result.error) Canvas.showToast('Save failed: ' + result.error);
  }

  async function nativeLoad() {
    const result = await window.electronAPI.openFile({
      filters: [
        { name: 'RR Circuits', extensions: ['rrc', 'json'] },
        { name: 'All Files',   extensions: ['*'] },
      ],
    });
    if (result.canceled) return;
    if (result.error)    { Canvas.showToast('Load failed: ' + result.error); return; }
    try {
      const data = JSON.parse(result.content);
      if (data.project) Boards.loadProjectData(data.project);
      else Canvas.loadSaveData(data);
      if (data.name) document.getElementById('projectName').textContent = data.name;
      Canvas.showToast(`Loaded ${result.filePath.split(/[/\\]/).pop()}`);
    } catch { Canvas.showToast('Invalid circuit file'); }
  }

  // ── SAVES ─────────────────────────────────────────────────────────────────
  function openSaves() {
    refreshSavesList();
    document.getElementById('saveNameInput').value =
      document.getElementById('projectName').textContent.trim() || 'Untitled Circuit';
    document.getElementById('savesModal').style.display = 'flex';
  }

  function refreshSavesList() {
    const el = document.getElementById('savesList');
    const saves = Auth.listCircuits();
    if (!saves.length) {
      el.innerHTML = '<div style="color:var(--text3);padding:12px">No saves yet — create one below.</div>';
      return;
    }
    el.innerHTML = '';
    saves.forEach(s => {
      const row = document.createElement('div');
      row.className = 'save-row';
      const date = s.savedAt ? new Date(s.savedAt).toLocaleString() : 'Unknown';
      row.innerHTML = `
        <div>
          <div class="save-row-name">${s.name}</div>
          <div class="save-row-meta">${date} · ${s.nodeCount} chip(s)</div>
        </div>
        <button class="save-row-del" data-name="${s.name}" title="Delete">🗑</button>
      `;
      row.addEventListener('click', e => {
        if (e.target.closest('.save-row-del')) {
          if (confirm(`Delete "${s.name}"?`)) {
            Auth.deleteCircuit(s.name);
            refreshSavesList();
          }
          return;
        }
        // Load this save
        const data = Auth.loadCircuit(s.name);
        if (data) {
          Boards.loadProjectData(data.project || { boards: [{ id:'b1', name:'Main', state: data }], activeBoard:'b1', nextBoardId:2 });
          document.getElementById('projectName').textContent = s.name;
          document.getElementById('savesModal').style.display = 'none';
          Canvas.showToast(`Loaded "${s.name}"`);
        }
      });
      el.appendChild(row);
    });
  }

  document.getElementById('saveToAccountBtn')?.addEventListener('click', () => {
    const name = document.getElementById('saveNameInput').value.trim() || 'Untitled Circuit';
    Boards.syncActive();
    const data = { project: Boards.getProjectData() };
    Auth.saveCircuit(name, data);
    document.getElementById('projectName').textContent = name;
    Canvas.showToast(`Saved "${name}"`);
    refreshSavesList();
  });

  document.getElementById('closeSaves')?.addEventListener('click', () => {
    document.getElementById('savesModal').style.display = 'none';
  });
  document.getElementById('savesModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('savesModal'))
      document.getElementById('savesModal').style.display = 'none';
  });

  function tryRestoreSession() {
    // Try auto-load last session from localStorage (guest fallback)
    try {
      const raw = localStorage.getItem(`rrc_session_state_${Auth.getUser()}`);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.project) Boards.loadProjectData(data.project);
        if (data.name) document.getElementById('projectName').textContent = data.name;
      }
    } catch {}
  }

  // Auto-save every 30s to localStorage
  setInterval(() => {
    if (!Auth.isLoggedIn()) return;
    Boards.syncActive();
    try {
      const name = document.getElementById('projectName').textContent.trim();
      const state = { name, project: Boards.getProjectData() };
      localStorage.setItem(`rrc_session_state_${Auth.getUser()}`, JSON.stringify(state));
    } catch {}
  }, 30000);

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  function bindSettings() {
    document.getElementById('closeSettings').addEventListener('click', () => {
      document.getElementById('settingsModal').style.display = 'none';
    });
    document.getElementById('settingsModal').addEventListener('click', e => {
      if (e.target === document.getElementById('settingsModal'))
        document.getElementById('settingsModal').style.display = 'none';
    });

    document.getElementById('themeSelect').addEventListener('change', e => applyTheme(e.target.value));
    document.getElementById('gridStyle').addEventListener('change', e => applyGrid(e.target.value));
    document.getElementById('wireStyle').addEventListener('change', e => Canvas.updateSettings({ wireStyle: e.target.value }));
    document.getElementById('snapGrid').addEventListener('change', e => Canvas.updateSettings({ snap: e.target.checked }));
    document.getElementById('gridSize').addEventListener('change', e => {
      const v = parseInt(e.target.value);
      Canvas.updateSettings({ gridSize: v });
      document.getElementById('canvasArea').style.backgroundSize = `${v}px ${v}px`;
    });
    document.getElementById('showFps').addEventListener('change', e => {
      Canvas.updateSettings({ showFps: e.target.checked });
      document.getElementById('fpsDisplay').style.display = e.target.checked ? '' : 'none';
    });
    document.getElementById('defaultLang').addEventListener('change', e => {
      currentLang = e.target.value;
    });
    document.getElementById('chipScale').addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      document.getElementById('chipScaleVal').textContent = v.toFixed(2) + '×';
      document.getElementById('chipsLayer').style.fontSize = v + 'em';
    });
    document.getElementById('clearCanvas').addEventListener('click', () => {
      if (confirm('Clear all chips on this board?')) {
        Canvas.loadState({ nodes:[], wires:[], nextId:1, transform:{x:80,y:60,scale:1} });
        document.getElementById('settingsModal').style.display = 'none';
        Canvas.showToast('Canvas cleared');
      }
    });
    document.getElementById('exportJsonBtn').addEventListener('click', () => {
      Boards.syncActive();
      download(JSON.stringify(Boards.getProjectData(), null, 2), 'circuit.json', 'application/json');
    });
    document.getElementById('importJsonBtn').addEventListener('click', () => {
      document.getElementById('importJsonFile').click();
    });
    document.getElementById('importJsonFile').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = ev => {
        try {
          const d = JSON.parse(ev.target.result);
          if (d.boards) Boards.loadProjectData(d);
          else Canvas.loadSaveData(d);
          Canvas.showToast('Imported!');
        } catch { Canvas.showToast('Import failed'); }
      };
      r.readAsText(f);
    });
  }

  function applySettings() { applyTheme('dark'); applyGrid('dots'); }

  function applyTheme(t) {
    const r = document.documentElement;
    if (t === 'darker') {
      r.style.setProperty('--bg','#040b12');
      r.style.setProperty('--bg2','#06101a');
      r.style.setProperty('--sidebar','#05090f');
      r.style.setProperty('--header','#030710');
    } else if (t === 'midnight') {
      r.style.setProperty('--bg','#050412');
      r.style.setProperty('--bg2','#070618');
      r.style.setProperty('--accent','#6060ff');
    } else {
      r.style.setProperty('--bg','#080F1A');
      r.style.setProperty('--bg2','#0A1220');
      r.style.setProperty('--sidebar','#0C1522');
      r.style.setProperty('--header','#060D16');
      r.style.setProperty('--accent','#FF8C00');
    }
  }

  function applyGrid(style) {
    const ca = document.getElementById('canvasArea');
    if (style === 'dots') {
      ca.style.backgroundImage = 'radial-gradient(circle,rgba(40,70,120,0.4) 1px,transparent 1px)';
      ca.style.backgroundSize = '24px 24px';
    } else if (style === 'lines') {
      ca.style.backgroundImage =
        'linear-gradient(rgba(40,70,120,0.15) 1px,transparent 1px),' +
        'linear-gradient(90deg,rgba(40,70,120,0.15) 1px,transparent 1px)';
      ca.style.backgroundSize = '24px 24px';
    } else {
      ca.style.backgroundImage = 'none';
    }
  }

  // ── EXPORT ────────────────────────────────────────────────────────────────
  function openExport() {
    updateExportTabs();
    generateCode();
    document.getElementById('exportModal').style.display = 'flex';
  }

  function updateExportTabs() {
    document.querySelectorAll('.etab').forEach(t => {
      const isActive = t.dataset.lang === currentLang;
      t.classList.toggle('active', isActive);
      // For engine tabs keep their color but dim if inactive
      if (t.classList.contains('engine-tab')) {
        t.style.opacity = isActive ? '1' : '0.55';
      }
    });
  }

  function generateCode() {
    const code = Exporter.export(currentLang);
    const el = document.getElementById('codeOutput');
    el.innerHTML = highlight(code, currentLang);
  }

  function highlight(code, lang) {
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    let c = esc(code);
    // Strings first
    c = c.replace(/(&quot;[^&]*&quot;|"[^"]*")/g, '<span class="code-str">$1</span>');
    // Comments
    c = c.replace(/(\/\/[^\n]*)/g, '<span class="code-cmt">$1</span>');
    c = c.replace(/(#[^\n]*)/g, '<span class="code-cmt">$1</span>');
    c = c.replace(/(--[^\n]*)/g, '<span class="code-cmt">$1</span>');
    // Numbers
    c = c.replace(/\b(\d+\.?\d*)\b/g, '<span class="code-num">$1</span>');
    // Keywords
    const kws = {
      csharp: 'using|public|private|class|void|float|bool|int|string|if|else|for|while|return|new|var|yield|null|true|false|out|foreach|in',
      lua: 'function|local|end|if|then|else|elseif|for|while|do|return|not|and|or|nil|true|false|repeat|until',
      python: 'def|if|else|elif|for|while|return|import|class|in|and|or|not|None|True|False|pass|global',
      javascript: 'function|let|const|var|if|else|for|while|return|new|null|true|false|typeof|class|forEach|in|of',
      gdscript: 'func|var|if|else|for|while|return|not|and|or|null|true|false|extends|class|pass|in',
      pseudocode: 'IF|THEN|ELSE|END|FOR|FROM|TO|STEP|WHILE|EVENT|OUTPUT|SEQUENCE|EACH|WAIT|SECONDS|SET|AND|OR|NOT|NAME|OF|SHOW|NOTIFICATION',
    }[lang] || '';
    if (kws) c = c.replace(new RegExp(`\\b(${kws})\\b`,'g'), '<span class="code-kw">$1</span>');
    // Functions
    c = c.replace(/\b([A-Za-z_]\w*)\s*(?=\()/g, '<span class="code-fn">$1</span>');
    return c;
  }

  function bindExport() {
    document.getElementById('closeExport').addEventListener('click', () => document.getElementById('exportModal').style.display = 'none');
    document.getElementById('exportModal').addEventListener('click', e => {
      if (e.target === document.getElementById('exportModal')) document.getElementById('exportModal').style.display = 'none';
    });

    document.querySelectorAll('.etab').forEach(tab => {
      tab.addEventListener('click', () => {
        currentLang = tab.dataset.lang;
        updateExportTabs();
        generateCode();
        // Show/hide auto-import bar for engine tabs
        const isEngine = ['roblox','unity','unreal'].includes(currentLang);
        const bar = document.getElementById('autoImportBar');
        bar.style.display = isEngine ? '' : 'none';
        if (isEngine) {
          const info = Exporter.engineInfo(currentLang);
          const names = { roblox:'🟦 Roblox Studio', unity:'⬜ Unity', unreal:'🔵 Unreal Engine' };
          document.getElementById('aiInfo').innerHTML =
            `<strong>${names[currentLang]}</strong> — Save as <code>${info.file}</code> in <code>${info.folder}/</code><br>
            <span style="color:var(--text3)">${info.hint}</span>`;
          document.getElementById('aiPathInput').placeholder = `Path to ${info.folder}/`;
        }
      });
    });

    document.getElementById('copyCode').addEventListener('click', () => {
      const code = document.getElementById('codeOutput').textContent;
      navigator.clipboard.writeText(code).then(() => Canvas.showToast('Copied to clipboard!'));
    });

    document.getElementById('downloadCode').addEventListener('click', () => {
      const code = document.getElementById('codeOutput').textContent;
      const ext  = Exporter.fileExtension(currentLang);
      const name = (document.getElementById('projectName').textContent.trim()||'circuit').replace(/[^a-z0-9_\-]/gi,'_');
      download(code, `${name}.${ext}`, 'text/plain');
      Canvas.showToast('File downloaded!');
    });

    document.getElementById('regenerateCode').addEventListener('click', generateCode);

    document.getElementById('autoImportBtn')?.addEventListener('click', () => autoImport());
  }

  async function autoImport() {
    const code     = document.getElementById('codeOutput').textContent;
    const info     = Exporter.engineInfo(currentLang);
    if (!info) return;
    const projName = (document.getElementById('projectName').textContent.trim()||'Circuit').replace(/\s+/g,'');
    const filename = `${projName}.${Exporter.fileExtension(currentLang)}`;

    // ── Electron: use native folder picker ─────────────────────────────
    if (IS_ELECTRON) {
      const result = await window.electronAPI.writeToFolder({
        suggestedFolder: info.folder,
        filename,
        content: code,
      });
      if (result.canceled) return;
      if (result.success)  Canvas.showToast(`✅ Saved to ${result.filePath.split(/[/\\]/).pop()}`);
      if (result.error)    Canvas.showToast('Error: ' + result.error);
      return;
    }

    // ── Browser: File System Access API (Chrome 86+) ───────────────────
    if (window.showDirectoryPicker) {
      try {
        Canvas.showToast('Pick your project folder…');
        const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
        const parts = info.folder.split('/').filter(Boolean);
        let cur = dirHandle;
        for (const part of parts) {
          try { cur = await cur.getDirectoryHandle(part, { create: true }); } catch {}
        }
        const fh  = await cur.getFileHandle(filename, { create: true });
        const writable = await fh.createWritable();
        await writable.write(code);
        await writable.close();
        Canvas.showToast(`✅ Saved ${filename} to ${info.folder}/`);
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }

    // ── Fallback: download ──────────────────────────────────────────────
    download(code, filename, 'text/plain');
    Canvas.showToast(`Downloaded ${filename} — move to ${info.folder}/`);
  }

  // ── BOARDS ────────────────────────────────────────────────────────────────
  function bindBoardActions() {
    document.getElementById('packageChipBtn')?.addEventListener('click', () => {
      const board = Boards.getActiveBoard();
      Boards.openCustomChipBuilder(board?.id);
    });
    document.getElementById('newChipBtn')?.addEventListener('click', () => {
      Boards.openCustomChipBuilder(null);
    });

    // Board context menu
    const bcm = document.getElementById('boardContextMenu');
    bcm?.addEventListener('click', e => {
      const action = e.target.dataset.baction;
      const id     = bcm.dataset.boardId;
      if (action === 'rename')    { const b = Boards.getBoards().find(x=>x.id===id); if(b){const n=prompt('Board name:',b.name); if(n) Boards.renameBoard(id,n);} }
      if (action === 'duplicate') Boards.duplicateBoard(id);
      if (action === 'package')   Boards.openCustomChipBuilder(id);
      if (action === 'delete')    { if(confirm('Delete board?')) Boards.deleteBoard(id); }
      bcm.style.display = 'none';
    });
  }

  // ── CUSTOM CHIP ──────────────────────────────────────────────────────────
  function bindCustomChip() {
    document.getElementById('closeCustomChip')?.addEventListener('click', () => document.getElementById('customChipModal').style.display = 'none');
    document.getElementById('cancelCustomChip')?.addEventListener('click', () => document.getElementById('customChipModal').style.display = 'none');
    document.getElementById('customChipModal')?.addEventListener('click', e => {
      if (e.target === document.getElementById('customChipModal')) document.getElementById('customChipModal').style.display = 'none';
    });
    document.getElementById('ccAddInput')?.addEventListener('click', () => Boards.addCCPort('input'));
    document.getElementById('ccAddOutput')?.addEventListener('click', () => Boards.addCCPort('output'));
    document.getElementById('saveCustomChipBtn')?.addEventListener('click', () => {
      Boards.saveCustomChip();
      rebuildSidebar();
    });

    // Populate category datalist
    const dl = document.getElementById('ccCatList');
    if (dl) Object.keys(CATEGORIES).forEach(c => { const o=document.createElement('option'); o.value=c; dl.appendChild(o); });
  }

  // ── UTILS ─────────────────────────────────────────────────────────────────
  function download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  return { boot, rebuildSidebar };
})();

window.addEventListener('DOMContentLoaded', App.boot);
