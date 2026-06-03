// engine-connect.js — Roblox / Unity / Unreal Engine integration

const EngineConnect = (() => {
  let currentEngine = 'roblox';
  let unityPath  = localStorage.getItem('ec_unity_path')  || '';
  let unrealPath = localStorage.getItem('ec_unreal_path') || '';

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    // Tabs
    document.querySelectorAll('.ec-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.ec-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentEngine = tab.dataset.ec;
        document.querySelectorAll('.ec-panel').forEach(p => p.style.display = 'none');
        document.getElementById('ec-' + currentEngine).style.display = '';
      });
    });

    // Open modal button
    document.getElementById('engineConnectBtn')?.addEventListener('click', openModal);
    document.getElementById('closeEngine')?.addEventListener('click', () => {
      document.getElementById('engineModal').style.display = 'none';
    });
    document.getElementById('engineModal')?.addEventListener('click', e => {
      if (e.target === document.getElementById('engineModal'))
        document.getElementById('engineModal').style.display = 'none';
    });

    // Roblox
    document.getElementById('ecDownloadPlugin')?.addEventListener('click', downloadPlugin);
    document.getElementById('ecPushRoblox')?.addEventListener('click', pushRoblox);

    // Unity
    document.getElementById('ecUnityBrowse')?.addEventListener('click', browseUnity);
    document.getElementById('ecPushUnity')?.addEventListener('click', pushUnity);
    const unityInput = document.getElementById('ecUnityPath');
    if (unityInput) {
      unityInput.value = unityPath;
      unityInput.addEventListener('change', e => {
        unityPath = e.target.value.trim();
        localStorage.setItem('ec_unity_path', unityPath);
      });
    }

    // Unreal
    document.getElementById('ecUnrealBrowse')?.addEventListener('click', browseUnreal);
    document.getElementById('ecPushUnreal')?.addEventListener('click', pushUnreal);
    const unrealInput = document.getElementById('ecUnrealPath');
    if (unrealInput) {
      unrealInput.value = unrealPath;
      unrealInput.addEventListener('change', e => {
        unrealPath = e.target.value.trim();
        localStorage.setItem('ec_unreal_path', unrealPath);
      });
    }
  }

  // ── Open modal & check server ──────────────────────────────────────────────
  function openModal() {
    document.getElementById('engineModal').style.display = 'flex';
    checkServerStatus();
  }

  async function checkServerStatus() {
    const dot  = document.getElementById('ecDot');
    const text = document.getElementById('ecStatusText');

    // In Electron: server always running
    if (IS_ELECTRON) {
      try {
        const status = await window.electronAPI.engineStatus();
        dot.className  = 'ec-dot ok';
        text.textContent = `Server running — Roblox plugin can connect`;
        return;
      } catch {}
    }

    // In browser: try to reach the server (won't work, but show helpful message)
    dot.className  = 'ec-dot err';
    text.textContent = 'Run as desktop app (npm start) to enable engine server';
  }

  // ── Roblox ─────────────────────────────────────────────────────────────────
  function downloadPlugin() {
    // Fetch the plugin file and trigger download
    fetch('/plugins/RRCircuits.lua')
      .then(r => r.text())
      .then(text => {
        const blob = new Blob([text], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'RRCircuits.lua';
        a.click();
        URL.revokeObjectURL(url);
        Canvas.showToast('Plugin downloaded! Install it into your Roblox Plugins folder.');
        setLiveStatus('roblox', 'Plugin downloaded — install it in Roblox Studio', false);
      })
      .catch(() => {
        // Fallback: direct link
        const a = document.createElement('a');
        a.href = '/plugins/RRCircuits.lua';
        a.download = 'RRCircuits.lua';
        a.click();
      });
  }

  async function pushRoblox() {
    const code = Exporter.export('roblox');
    if (!code) { Canvas.showToast('No code to push — add chips first'); return; }

    const scriptType = document.getElementById('ecRobloxType')?.value || 'Script';
    const parent     = document.getElementById('ecRobloxParent')?.value || 'ServerScriptService';

    // Push to engine server (Electron) so Roblox plugin can poll it
    if (IS_ELECTRON) {
      await window.electronAPI.engineSetCode('roblox', code);
      setLiveStatus('roblox', `✓ Code ready — Roblox plugin will pick it up automatically (polling localhost:9001)`, true);
      Canvas.showToast('📡 Code pushed to Roblox server!');
    } else {
      // Browser fallback: show the code
      setLiveStatus('roblox', '⚠ Run as desktop app to auto-push. Download the plugin and paste the code manually.', false);
      Canvas.showToast('Open as desktop app for auto-push');
    }
  }

  // ── Unity ──────────────────────────────────────────────────────────────────
  async function browseUnity() {
    if (IS_ELECTRON) {
      const result = await window.electronAPI.openFile({
        filters: [{ name: 'Unity Project', extensions: ['*'] }],
        properties: ['openDirectory'],
      });
      if (!result.canceled && result.filePath) {
        unityPath = result.filePath;
        document.getElementById('ecUnityPath').value = unityPath;
        localStorage.setItem('ec_unity_path', unityPath);
      }
    }
  }

  async function pushUnity() {
    const code     = Exporter.export('unity');
    const projName = (document.getElementById('projectName')?.textContent.trim() || 'RRCircuit').replace(/\s+/g,'');
    const filename = projName + '.cs';

    if (IS_ELECTRON) {
      const targetPath = unityPath || null;
      const result = await window.electronAPI.writeToFolder({
        suggestedFolder: 'Assets/Scripts',
        filename,
        content: code,
        startPath: targetPath,
      });
      if (result.success) {
        setLiveStatus('unity', `✓ Written to ${result.filePath}`, true);
        Canvas.showToast(`✅ ${filename} written to Unity project!`);
        if (unityPath !== result.filePath.replace('\\' + filename, '').replace('/' + filename, '')) {
          unityPath = result.filePath.replace('\\' + filename, '').replace('/' + filename, '');
          document.getElementById('ecUnityPath').value = unityPath;
          localStorage.setItem('ec_unity_path', unityPath);
        }
      } else if (!result.canceled) {
        setLiveStatus('unity', 'Error: ' + (result.error || 'unknown'), false);
      }
    } else {
      // Browser: download file
      const blob = new Blob([code], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setLiveStatus('unity', `Downloaded ${filename} — drag into your Assets/Scripts folder`, false);
      Canvas.showToast(`Downloaded ${filename}`);
    }
  }

  // ── Unreal ─────────────────────────────────────────────────────────────────
  async function browseUnreal() {
    if (IS_ELECTRON) {
      const result = await window.electronAPI.openFile({
        filters: [{ name: 'Unreal Source', extensions: ['*'] }],
        properties: ['openDirectory'],
      });
      if (!result.canceled && result.filePath) {
        unrealPath = result.filePath;
        document.getElementById('ecUnrealPath').value = unrealPath;
        localStorage.setItem('ec_unreal_path', unrealPath);
      }
    }
  }

  async function pushUnreal() {
    const code     = Exporter.export('unreal');
    const projName = (document.getElementById('projectName')?.textContent.trim() || 'RRCircuit').replace(/\s+/g,'');
    const filename = projName + '.cpp';

    if (IS_ELECTRON) {
      const result = await window.electronAPI.writeToFolder({
        suggestedFolder: 'Source/YourProject',
        filename,
        content: code,
        startPath: unrealPath || null,
      });
      if (result.success) {
        setLiveStatus('unreal', `✓ Written to ${result.filePath}`, true);
        Canvas.showToast(`✅ ${filename} written to Unreal project!`);
      } else if (!result.canceled) {
        setLiveStatus('unreal', 'Error: ' + (result.error || 'unknown'), false);
      }
    } else {
      const blob = new Blob([code], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setLiveStatus('unreal', `Downloaded ${filename} — add to your Source folder`, false);
      Canvas.showToast(`Downloaded ${filename}`);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function setLiveStatus(engine, msg, isOk) {
    const el = document.getElementById('ec' + engine.charAt(0).toUpperCase() + engine.slice(1) + 'Live');
    if (!el) return;
    el.textContent = msg;
    el.className   = 'ec-live-status' + (isOk ? ' ok' : isOk === false ? ' err' : '');
  }

  return { init, openModal };
})();
