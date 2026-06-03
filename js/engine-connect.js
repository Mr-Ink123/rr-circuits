// engine-connect.js — Roblox / Unity / Unreal + Scene Builder

const EngineConnect = (() => {
  let currentEngine = 'roblox';
  let unityPath  = localStorage.getItem('ec_unity_path')  || '';
  let unrealPath = localStorage.getItem('ec_unreal_path') || '';
  let sceneObjects = loadSceneObjects(); // persisted list of scene objects
  let expandedRows = new Set();

  // ── Object type definitions ──────────────────────────────────────────────
  const OBJ_TYPES = {
    // World objects
    button:      { label: '🔘 Button',            category:'world', event:'btn_pressed',     defaults:{ pos:'0,1,0', size:'4,2,4', color:'0066FF', text:'Button', maxDist:'32' }},
    toggle_btn:  { label: '🔄 Toggle Button',      category:'world', event:'tbtn_on',         defaults:{ pos:'0,1,0', size:'4,2,4', color:'FF8800', text:'Toggle', maxDist:'32' }},
    trigger_vol: { label: '📦 Trigger Volume',     category:'world', event:'trig_enter',      defaults:{ pos:'0,4,0', size:'10,8,10', color:'FF6600', opacity:'0.7' }},
    interact_vol:{ label: '👆 Interaction Volume', category:'world', event:'ivol_interact',   defaults:{ pos:'0,2,0', size:'6,4,6', color:'00CCFF', promptText:'Interact', maxDist:'8' }},
    seat:        { label: '💺 Seat',               category:'world', event:'seat_sit',        defaults:{ pos:'0,1.5,0', size:'4,1,4', color:'888888' }},
    part:        { label: '🧱 Part',               category:'world', event:null,              defaults:{ pos:'0,2,0', size:'4,4,4', color:'AAAAAA', anchored:'true' }},
    // UI objects
    screen_gui:  { label: '🖥 ScreenGui',          category:'ui',    event:null,              defaults:{ name:'RRGui', resetOnSpawn:'false' }},
    ui_button:   { label: '🖱 UI Button',          category:'ui',    event:'sbtn_click',      defaults:{ text:'Click Me', size:'200,50', pos:'0.5,-100,0.9,0', bgColor:'0066FF', textColor:'FFFFFF', parent:'RRGui' }},
    ui_label:    { label: '📝 UI Label',           category:'ui',    event:null,              defaults:{ text:'Label', size:'200,30', pos:'0.5,-100,0.1,0', bgColor:'transparent', textColor:'FFFFFF', parent:'RRGui' }},
    ui_image:    { label: '🖼 UI Image',           category:'ui',    event:null,              defaults:{ assetId:'', size:'100,100', pos:'0,10,0,10', parent:'RRGui' }},
    ui_frame:    { label: '⬜ UI Frame',           category:'ui',    event:null,              defaults:{ size:'300,200', pos:'0.5,-150,0.5,-100', bgColor:'111827', parent:'RRGui' }},
    ui_toggle:   { label: '🔄 UI Toggle',          category:'ui',    event:'sbtn_click',      defaults:{ text:'Toggle', size:'200,50', pos:'0.5,-100,0.8,0', onColor:'00AA44', offColor:'AA0000', parent:'RRGui' }},
    ui_textbox:  { label: '⌨ UI TextBox',          category:'ui',    event:null,              defaults:{ placeholder:'Type here...', size:'200,40', pos:'0.5,-100,0.5,0', parent:'RRGui' }},
  };

  // ── Persistence ──────────────────────────────────────────────────────────
  function loadSceneObjects() {
    try { return JSON.parse(localStorage.getItem('ec_scene_objects') || '[]'); } catch { return []; }
  }
  function saveSceneObjects() {
    localStorage.setItem('ec_scene_objects', JSON.stringify(sceneObjects));
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('.ec-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.ec-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentEngine = tab.dataset.ec;
        document.querySelectorAll('.ec-panel').forEach(p => p.style.display = 'none');
        document.getElementById('ec-' + currentEngine).style.display = '';
      });
    });

    document.getElementById('engineConnectBtn')?.addEventListener('click', openModal);
    document.getElementById('closeEngine')?.addEventListener('click',   () => { document.getElementById('engineModal').style.display = 'none'; });
    document.getElementById('engineModal')?.addEventListener('click',   e  => { if (e.target === document.getElementById('engineModal')) document.getElementById('engineModal').style.display = 'none'; });

    // Scene object add dropdown
    document.getElementById('ecAddSceneType')?.addEventListener('change', e => {
      const t = e.target.value; if (!t) return;
      addSceneObject(t);
      e.target.value = '';
    });

    // Roblox
    document.getElementById('ecDownloadPlugin')?.addEventListener('click', downloadPlugin);
    document.getElementById('ecPushRoblox')?.addEventListener('click',     pushRoblox);

    // Unity
    document.getElementById('ecUnityBrowse')?.addEventListener('click', browseUnity);
    document.getElementById('ecPushUnity')?.addEventListener('click',   pushUnity);
    const unityInput = document.getElementById('ecUnityPath');
    if (unityInput) { unityInput.value = unityPath; unityInput.addEventListener('change', e => { unityPath = e.target.value.trim(); localStorage.setItem('ec_unity_path', unityPath); }); }

    // Unreal
    document.getElementById('ecUnrealBrowse')?.addEventListener('click', browseUnreal);
    document.getElementById('ecPushUnreal')?.addEventListener('click',   pushUnreal);
    const unrealInput = document.getElementById('ecUnrealPath');
    if (unrealInput) { unrealInput.value = unrealPath; unrealInput.addEventListener('change', e => { unrealPath = e.target.value.trim(); localStorage.setItem('ec_unreal_path', unrealPath); }); }

    renderSceneList();
  }

  // ── Open modal ────────────────────────────────────────────────────────────
  function openModal() {
    document.getElementById('engineModal').style.display = 'flex';
    checkServerStatus();
  }

  async function checkServerStatus() {
    const dot  = document.getElementById('ecDot');
    const text = document.getElementById('ecStatusText');
    if (typeof IS_ELECTRON !== 'undefined' && IS_ELECTRON) {
      try {
        const s = await window.electronAPI.engineStatus();
        dot.className  = 'ec-dot ok';
        text.textContent = `Engine server active — Roblox plugin can connect`;
        return;
      } catch {}
    }
    dot.className    = 'ec-dot err';
    text.textContent = 'Run as desktop app (npm start) to enable engine server';
  }

  // ── Scene Object Management ───────────────────────────────────────────────
  function addSceneObject(type) {
    const def  = OBJ_TYPES[type];
    if (!def) return;
    const id   = Date.now().toString(36);
    const name = type.replace('_','') + '_' + (sceneObjects.filter(o => o.type === type).length + 1);
    const obj  = { id, type, name, config: { ...def.defaults } };
    sceneObjects.push(obj);
    saveSceneObjects();
    renderSceneList();
  }

  function removeSceneObject(id) {
    sceneObjects = sceneObjects.filter(o => o.id !== id);
    expandedRows.delete(id);
    saveSceneObjects();
    renderSceneList();
  }

  function updateObjName(id, name) {
    const o = sceneObjects.find(x => x.id === id);
    if (o) { o.name = name.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,''); saveSceneObjects(); }
  }

  function updateObjConfig(id, key, value) {
    const o = sceneObjects.find(x => x.id === id);
    if (o) { o.config[key] = value; saveSceneObjects(); }
  }

  function renderSceneList() {
    const list = document.getElementById('ecSceneList');
    if (!list) return;
    list.innerHTML = '';

    if (!sceneObjects.length) {
      list.innerHTML = '<div class="ec-scene-empty">No scene objects — add some above, then Push</div>';
      return;
    }

    sceneObjects.forEach(obj => {
      const def = OBJ_TYPES[obj.type];
      const isExpanded = expandedRows.has(obj.id);

      const row = document.createElement('div');
      row.className = `ec-obj-row ${def.category === 'ui' ? 'ui-type' : 'world-type'}`;

      const badge = document.createElement('span');
      badge.className = `ec-obj-badge ${def.category}`;
      badge.textContent = def.label;

      const nameInput = document.createElement('input');
      nameInput.className = 'ec-obj-name';
      nameInput.value     = obj.name;
      nameInput.addEventListener('change', e => updateObjName(obj.id, e.target.value));
      nameInput.addEventListener('mousedown', e => e.stopPropagation());

      const cfgBtn = document.createElement('button');
      cfgBtn.className = 'ec-obj-cfg';
      cfgBtn.textContent = isExpanded ? '▲ Less' : '⚙ Configure';
      cfgBtn.addEventListener('click', () => {
        if (expandedRows.has(obj.id)) expandedRows.delete(obj.id);
        else expandedRows.add(obj.id);
        renderSceneList();
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'ec-obj-del';
      delBtn.textContent = '✕';
      delBtn.title = 'Remove';
      delBtn.addEventListener('click', () => removeSceneObject(obj.id));

      row.appendChild(badge);
      row.appendChild(nameInput);
      row.appendChild(cfgBtn);
      row.appendChild(delBtn);
      list.appendChild(row);

      // Config panel (expanded)
      if (isExpanded) {
        const panel = buildConfigPanel(obj, def);
        list.appendChild(panel);
      }
    });
  }

  function buildConfigPanel(obj, def) {
    const panel = document.createElement('div');
    panel.className = 'ec-obj-config-panel';

    const fields = getConfigFields(obj.type);
    fields.forEach(field => {
      const wrapper = document.createElement('div');
      const lbl = document.createElement('label');
      lbl.textContent = field.label;

      let input;
      if (field.type === 'color') {
        input = document.createElement('input');
        input.type  = 'color';
        input.value = '#' + (obj.config[field.key] || 'AAAAAA');
        input.addEventListener('change', e => updateObjConfig(obj.id, field.key, e.target.value.replace('#','')));
      } else if (field.type === 'select') {
        input = document.createElement('select');
        (field.options || []).forEach(opt => {
          const o = document.createElement('option');
          o.value = opt; o.textContent = opt;
          if ((obj.config[field.key] || field.default) === opt) o.selected = true;
          input.appendChild(o);
        });
        input.addEventListener('change', e => updateObjConfig(obj.id, field.key, e.target.value));
      } else {
        input = document.createElement('input');
        input.type  = field.type === 'number' ? 'number' : 'text';
        input.value = obj.config[field.key] ?? field.default ?? '';
        input.addEventListener('change', e => updateObjConfig(obj.id, field.key, e.target.value));
      }

      input.addEventListener('mousedown', e => e.stopPropagation());
      wrapper.appendChild(lbl);
      wrapper.appendChild(input);
      panel.appendChild(wrapper);
    });

    return panel;
  }

  function getConfigFields(type) {
    const world = [
      { key:'pos',  label:'Position (x,y,z)', type:'text', default:'0,2,0' },
      { key:'size', label:'Size (x,y,z)',      type:'text', default:'4,4,4' },
      { key:'color',label:'Color',             type:'color',default:'AAAAAA' },
    ];
    const extra = {
      button:      [{ key:'maxDist',    label:'Max Click Dist',  type:'number',default:'32' },
                    { key:'text',       label:'Label Text',       type:'text',  default:'Button' }],
      toggle_btn:  [{ key:'maxDist',    label:'Max Click Dist',  type:'number',default:'32' },
                    { key:'text',       label:'Label Text',       type:'text',  default:'Toggle' }],
      trigger_vol: [{ key:'opacity',    label:'Transparency',     type:'number',default:'0.7' }],
      interact_vol:[{ key:'promptText', label:'Prompt Text',      type:'text',  default:'Interact' },
                    { key:'maxDist',    label:'Max Distance',     type:'number',default:'8' }],
      screen_gui:  [{ key:'resetOnSpawn',label:'Reset On Spawn', type:'select',options:['false','true'],default:'false' }],
      ui_button:   [{ key:'text',       label:'Button Text',      type:'text',  default:'Click Me' },
                    { key:'size',       label:'Size (w,h px)',    type:'text',  default:'200,50' },
                    { key:'pos',        label:'Position',         type:'text',  default:'0.5,-100,0.9,0' },
                    { key:'bgColor',    label:'Background',       type:'color', default:'0066FF' },
                    { key:'textColor',  label:'Text Color',       type:'color', default:'FFFFFF' },
                    { key:'parent',     label:'Parent GUI',       type:'text',  default:'RRGui' }],
      ui_label:    [{ key:'text',       label:'Text',             type:'text',  default:'Label' },
                    { key:'size',       label:'Size (w,h px)',    type:'text',  default:'200,30' },
                    { key:'pos',        label:'Position',         type:'text',  default:'0.5,-100,0.1,0' },
                    { key:'textColor',  label:'Text Color',       type:'color', default:'FFFFFF' },
                    { key:'parent',     label:'Parent GUI',       type:'text',  default:'RRGui' }],
      ui_frame:    [{ key:'size',       label:'Size (w,h px)',    type:'text',  default:'300,200' },
                    { key:'pos',        label:'Position',         type:'text',  default:'0.5,-150,0.5,-100' },
                    { key:'bgColor',    label:'Background',       type:'color', default:'111827' },
                    { key:'parent',     label:'Parent GUI',       type:'text',  default:'RRGui' }],
      ui_image:    [{ key:'assetId',    label:'Asset ID',         type:'text',  default:'' },
                    { key:'size',       label:'Size (w,h px)',    type:'text',  default:'100,100' },
                    { key:'pos',        label:'Position',         type:'text',  default:'0,10,0,10' },
                    { key:'parent',     label:'Parent GUI',       type:'text',  default:'RRGui' }],
      ui_toggle:   [{ key:'text',       label:'Off Text',         type:'text',  default:'OFF' },
                    { key:'onText',     label:'On Text',          type:'text',  default:'ON' },
                    { key:'size',       label:'Size (w,h px)',    type:'text',  default:'200,50' },
                    { key:'pos',        label:'Position',         type:'text',  default:'0.5,-100,0.8,0' },
                    { key:'onColor',    label:'ON Color',         type:'color', default:'00AA44' },
                    { key:'offColor',   label:'OFF Color',        type:'color', default:'AA0000' },
                    { key:'parent',     label:'Parent GUI',       type:'text',  default:'RRGui' }],
      ui_textbox:  [{ key:'placeholder',label:'Placeholder',      type:'text',  default:'Type here...' },
                    { key:'size',       label:'Size (w,h px)',    type:'text',  default:'200,40' },
                    { key:'pos',        label:'Position',         type:'text',  default:'0.5,-100,0.5,0' },
                    { key:'parent',     label:'Parent GUI',       type:'text',  default:'RRGui' }],
    };
    const isWorld = ['button','toggle_btn','trigger_vol','interact_vol','seat','part'].includes(type);
    return [...(isWorld ? world : []), ...(extra[type] || [])];
  }

  // ── Code generation ───────────────────────────────────────────────────────
  function generateSceneCode() {
    if (!sceneObjects.length) return '';

    const lines = [];
    lines.push('\n-- ═══════════════════════════════════════════════════════════');
    lines.push('-- SCENE SETUP — Objects created automatically in your place');
    lines.push('-- ═══════════════════════════════════════════════════════════');
    lines.push('');
    lines.push('local Players = game:GetService("Players")');
    lines.push('');
    lines.push('local function RRSetupScene()');
    lines.push('    local created = {}');
    lines.push('');

    // Create world objects
    sceneObjects.filter(o => OBJ_TYPES[o.type]?.category === 'world').forEach(obj => {
      const c   = obj.config;
      const pos = (c.pos  || '0,2,0').split(',').map(v=>parseFloat(v)||0);
      const sz  = (c.size || '4,4,4').split(',').map(v=>parseFloat(v)||4);
      const col = '#' + (c.color || 'AAAAAA');

      if (obj.type === 'trigger_vol') {
        lines.push(`    -- 📦 Trigger Volume: ${obj.name}`);
        lines.push(`    local ${obj.name} = Instance.new("Part")`);
        lines.push(`    ${obj.name}.Name        = "${obj.name}"`);
        lines.push(`    ${obj.name}.Size        = Vector3.new(${sz[0]}, ${sz[1]}, ${sz[2]})`);
        lines.push(`    ${obj.name}.Position    = Vector3.new(${pos[0]}, ${pos[1]}, ${pos[2]})`);
        lines.push(`    ${obj.name}.Anchored    = true`);
        lines.push(`    ${obj.name}.CanCollide  = false`);
        lines.push(`    ${obj.name}.Transparency = ${parseFloat(c.opacity||0.7)}`);
        lines.push(`    ${obj.name}.Color       = Color3.fromHex("${col}")`);
        lines.push(`    ${obj.name}.Material    = Enum.Material.Neon`);
        lines.push(`    ${obj.name}.Parent      = workspace`);

      } else if (obj.type === 'interact_vol') {
        lines.push(`    -- 👆 Interaction Volume: ${obj.name}`);
        lines.push(`    local ${obj.name} = Instance.new("Part")`);
        lines.push(`    ${obj.name}.Name        = "${obj.name}"`);
        lines.push(`    ${obj.name}.Size        = Vector3.new(${sz[0]}, ${sz[1]}, ${sz[2]})`);
        lines.push(`    ${obj.name}.Position    = Vector3.new(${pos[0]}, ${pos[1]}, ${pos[2]})`);
        lines.push(`    ${obj.name}.Anchored    = true`);
        lines.push(`    ${obj.name}.Transparency = 0.5`);
        lines.push(`    ${obj.name}.CanCollide  = false`);
        lines.push(`    ${obj.name}.Color       = Color3.fromHex("${col}")`);
        lines.push(`    ${obj.name}.Parent      = workspace`);
        lines.push(`    local ${obj.name}_prompt = Instance.new("ProximityPrompt")`);
        lines.push(`    ${obj.name}_prompt.ActionText  = "${c.promptText||'Interact'}"`);
        lines.push(`    ${obj.name}_prompt.MaxActivationDistance = ${parseFloat(c.maxDist||8)}`);
        lines.push(`    ${obj.name}_prompt.Parent = ${obj.name}`);
        lines.push(`    created["${obj.name}_prompt"] = ${obj.name}_prompt`);

      } else if (obj.type === 'seat') {
        lines.push(`    -- 💺 Seat: ${obj.name}`);
        lines.push(`    local ${obj.name} = Instance.new("Seat")`);
        lines.push(`    ${obj.name}.Name     = "${obj.name}"`);
        lines.push(`    ${obj.name}.Size     = Vector3.new(${sz[0]}, ${sz[1]}, ${sz[2]})`);
        lines.push(`    ${obj.name}.Position = Vector3.new(${pos[0]}, ${pos[1]}, ${pos[2]})`);
        lines.push(`    ${obj.name}.Anchored = true`);
        lines.push(`    ${obj.name}.Color    = Color3.fromHex("${col}")`);
        lines.push(`    ${obj.name}.Parent   = workspace`);

      } else {
        // Button or Toggle Button
        const isToggle = obj.type === 'toggle_btn';
        lines.push(`    -- ${isToggle?'🔄 Toggle Button':'🔘 Button'}: ${obj.name}`);
        lines.push(`    local ${obj.name} = Instance.new("Part")`);
        lines.push(`    ${obj.name}.Name     = "${obj.name}"`);
        lines.push(`    ${obj.name}.Size     = Vector3.new(${sz[0]}, ${sz[1]}, ${sz[2]})`);
        lines.push(`    ${obj.name}.Position = Vector3.new(${pos[0]}, ${pos[1]}, ${pos[2]})`);
        lines.push(`    ${obj.name}.Anchored = true`);
        lines.push(`    ${obj.name}.Color    = Color3.fromHex("${col}")`);
        lines.push(`    ${obj.name}.Material = Enum.Material.SmoothPlastic`);
        lines.push(`    ${obj.name}.Parent   = workspace`);
        // Button label on top
        lines.push(`    local ${obj.name}_label = Instance.new("SurfaceGui")`);
        lines.push(`    ${obj.name}_label.Face = Enum.NormalId.Top`);
        lines.push(`    ${obj.name}_label.Parent = ${obj.name}`);
        lines.push(`    local ${obj.name}_text = Instance.new("TextLabel")`);
        lines.push(`    ${obj.name}_text.Size = UDim2.new(1,0,1,0)`);
        lines.push(`    ${obj.name}_text.BackgroundTransparency = 1`);
        lines.push(`    ${obj.name}_text.Text = "${c.text||obj.name}"`);
        lines.push(`    ${obj.name}_text.TextColor3 = Color3.new(1,1,1)`);
        lines.push(`    ${obj.name}_text.Font = Enum.Font.GothamBold`);
        lines.push(`    ${obj.name}_text.TextScaled = true`);
        lines.push(`    ${obj.name}_text.Parent = ${obj.name}_label`);
        // ClickDetector
        lines.push(`    local ${obj.name}_click = Instance.new("ClickDetector")`);
        lines.push(`    ${obj.name}_click.MaxActivationDistance = ${parseFloat(c.maxDist||32)}`);
        lines.push(`    ${obj.name}_click.Parent = ${obj.name}`);
        lines.push(`    created["${obj.name}_click"] = ${obj.name}_click`);
        if (isToggle) {
          lines.push(`    created["${obj.name}_state"] = false  -- toggle state`);
        }
      }

      lines.push(`    created["${obj.name}"] = ${obj.name}`);
      lines.push('');
    });

    // Create ScreenGuis first, then their children
    const guis = sceneObjects.filter(o => o.type === 'screen_gui');
    guis.forEach(gui => {
      lines.push(`    -- 🖥 ScreenGui: ${gui.name}`);
      lines.push(`    local ${gui.name} = Instance.new("ScreenGui")`);
      lines.push(`    ${gui.name}.Name = "${gui.name}"`);
      lines.push(`    ${gui.name}.ResetOnSpawn = ${gui.config.resetOnSpawn || 'false'}`);
      lines.push(`    ${gui.name}.IgnoreGuiInset = true`);
      lines.push(`    ${gui.name}.Parent = game.StarterGui`);
      lines.push(`    created["${gui.name}"] = ${gui.name}`);
      lines.push('');
    });

    // UI children
    const uiChildren = sceneObjects.filter(o => OBJ_TYPES[o.type]?.category === 'ui' && o.type !== 'screen_gui');
    uiChildren.forEach(obj => {
      const c = obj.config;
      const sz = (c.size || '200,50').split(',').map(v => parseFloat(v)||100);
      const pos = (c.pos  || '0,0,0,0').split(',').map(v => parseFloat(v)||0);
      const parent = c.parent || 'RRGui';

      if (obj.type === 'ui_button') {
        lines.push(`    -- 🖱 UI Button: ${obj.name}`);
        lines.push(`    local ${obj.name} = Instance.new("TextButton")`);
        lines.push(`    ${obj.name}.Name              = "${obj.name}"`);
        lines.push(`    ${obj.name}.Size              = UDim2.new(0, ${sz[0]}, 0, ${sz[1]})`);
        lines.push(`    ${obj.name}.Position          = UDim2.new(${pos[0]}, ${pos[1]}, ${pos[2]}, ${pos[3]})`);
        lines.push(`    ${obj.name}.BackgroundColor3  = Color3.fromHex("#${c.bgColor||'0066FF'}")`);
        lines.push(`    ${obj.name}.TextColor3        = Color3.fromHex("#${c.textColor||'FFFFFF'}")`);
        lines.push(`    ${obj.name}.Text              = "${c.text||'Click Me'}"`);
        lines.push(`    ${obj.name}.Font              = Enum.Font.GothamBold`);
        lines.push(`    ${obj.name}.TextSize          = 16`);
        lines.push(`    ${obj.name}.BorderSizePixel   = 0`);
        lines.push(`    local ${obj.name}_corner = Instance.new("UICorner")`);
        lines.push(`    ${obj.name}_corner.CornerRadius = UDim.new(0, 8)`);
        lines.push(`    ${obj.name}_corner.Parent = ${obj.name}`);
        lines.push(`    ${obj.name}.Parent = created["${parent}"] or game.StarterGui`);

      } else if (obj.type === 'ui_label') {
        lines.push(`    -- 📝 UI Label: ${obj.name}`);
        lines.push(`    local ${obj.name} = Instance.new("TextLabel")`);
        lines.push(`    ${obj.name}.Name              = "${obj.name}"`);
        lines.push(`    ${obj.name}.Size              = UDim2.new(0, ${sz[0]}, 0, ${sz[1]})`);
        lines.push(`    ${obj.name}.Position          = UDim2.new(${pos[0]}, ${pos[1]}, ${pos[2]}, ${pos[3]})`);
        lines.push(`    ${obj.name}.BackgroundTransparency = 1`);
        lines.push(`    ${obj.name}.TextColor3        = Color3.fromHex("#${c.textColor||'FFFFFF'}")`);
        lines.push(`    ${obj.name}.Text              = "${c.text||'Label'}"`);
        lines.push(`    ${obj.name}.Font              = Enum.Font.Gotham`);
        lines.push(`    ${obj.name}.TextSize          = 14`);
        lines.push(`    ${obj.name}.Parent = created["${parent}"] or game.StarterGui`);

      } else if (obj.type === 'ui_image') {
        lines.push(`    -- 🖼 UI Image: ${obj.name}`);
        lines.push(`    local ${obj.name} = Instance.new("ImageLabel")`);
        lines.push(`    ${obj.name}.Name     = "${obj.name}"`);
        lines.push(`    ${obj.name}.Size     = UDim2.new(0, ${sz[0]}, 0, ${sz[1]})`);
        lines.push(`    ${obj.name}.Position = UDim2.new(${pos[0]}, ${pos[1]}, ${pos[2]}, ${pos[3]})`);
        lines.push(`    ${obj.name}.BackgroundTransparency = 1`);
        lines.push(`    ${obj.name}.Image    = "rbxassetid://${c.assetId||''}"`);
        lines.push(`    ${obj.name}.Parent = created["${parent}"] or game.StarterGui`);

      } else if (obj.type === 'ui_frame') {
        lines.push(`    -- ⬜ UI Frame: ${obj.name}`);
        lines.push(`    local ${obj.name} = Instance.new("Frame")`);
        lines.push(`    ${obj.name}.Name              = "${obj.name}"`);
        lines.push(`    ${obj.name}.Size              = UDim2.new(0, ${sz[0]}, 0, ${sz[1]})`);
        lines.push(`    ${obj.name}.Position          = UDim2.new(${pos[0]}, ${pos[1]}, ${pos[2]}, ${pos[3]})`);
        lines.push(`    ${obj.name}.BackgroundColor3  = Color3.fromHex("#${c.bgColor||'111827'}")`);
        lines.push(`    ${obj.name}.BorderSizePixel   = 0`);
        lines.push(`    ${obj.name}.Parent = created["${parent}"] or game.StarterGui`);

      } else if (obj.type === 'ui_toggle') {
        lines.push(`    -- 🔄 UI Toggle: ${obj.name}`);
        lines.push(`    created["${obj.name}_on"] = false`);
        lines.push(`    local ${obj.name} = Instance.new("TextButton")`);
        lines.push(`    ${obj.name}.Name             = "${obj.name}"`);
        lines.push(`    ${obj.name}.Size             = UDim2.new(0, ${sz[0]}, 0, ${sz[1]})`);
        lines.push(`    ${obj.name}.Position         = UDim2.new(${pos[0]}, ${pos[1]}, ${pos[2]}, ${pos[3]})`);
        lines.push(`    ${obj.name}.BackgroundColor3 = Color3.fromHex("#${c.offColor||'AA0000'}")`);
        lines.push(`    ${obj.name}.TextColor3       = Color3.new(1,1,1)`);
        lines.push(`    ${obj.name}.Text             = "${c.text||'OFF'}"`);
        lines.push(`    ${obj.name}.Font             = Enum.Font.GothamBold`);
        lines.push(`    ${obj.name}.TextSize         = 16`);
        lines.push(`    ${obj.name}.BorderSizePixel  = 0`);
        lines.push(`    ${obj.name}.Parent = created["${parent}"] or game.StarterGui`);

      } else if (obj.type === 'ui_textbox') {
        lines.push(`    -- ⌨ UI TextBox: ${obj.name}`);
        lines.push(`    local ${obj.name} = Instance.new("TextBox")`);
        lines.push(`    ${obj.name}.Name              = "${obj.name}"`);
        lines.push(`    ${obj.name}.Size              = UDim2.new(0, ${sz[0]}, 0, ${sz[1]})`);
        lines.push(`    ${obj.name}.Position          = UDim2.new(${pos[0]}, ${pos[1]}, ${pos[2]}, ${pos[3]})`);
        lines.push(`    ${obj.name}.PlaceholderText   = "${c.placeholder||'Type here...'}"`);
        lines.push(`    ${obj.name}.BackgroundColor3  = Color3.fromRGB(15, 30, 55)`);
        lines.push(`    ${obj.name}.TextColor3        = Color3.new(1,1,1)`);
        lines.push(`    ${obj.name}.Font              = Enum.Font.Gotham`);
        lines.push(`    ${obj.name}.TextSize          = 14`);
        lines.push(`    ${obj.name}.BorderSizePixel   = 0`);
        lines.push(`    ${obj.name}.Parent = created["${parent}"] or game.StarterGui`);
      }

      lines.push(`    created["${obj.name}"] = ${obj.name}`);
      lines.push('');
    });

    lines.push('    print("[RR Circuits] Scene ready — ' + sceneObjects.length + ' object(s) created")');
    lines.push('    return created');
    lines.push('end');
    lines.push('');
    lines.push('local sceneObjects = RRSetupScene()');

    // Event connections
    lines.push('');
    lines.push('-- ═══ Event Connections ═══');

    sceneObjects.forEach(obj => {
      const def = OBJ_TYPES[obj.type];
      if (!def || !def.event) return;

      lines.push(`\n-- ${def.label}: ${obj.name}`);

      switch (obj.type) {
        case 'button':
          lines.push(`if sceneObjects["${obj.name}_click"] then`);
          lines.push(`    sceneObjects["${obj.name}_click"].MouseClick:Connect(function(player)`);
          lines.push(`        -- ▶ Circuit fires here: ${obj.name} clicked`);
          lines.push(`        onButtonPressed(player, "${obj.name}")`);
          lines.push(`    end)`);
          lines.push(`end`);
          break;
        case 'toggle_btn':
          lines.push(`if sceneObjects["${obj.name}_click"] then`);
          lines.push(`    sceneObjects["${obj.name}_click"].MouseClick:Connect(function(player)`);
          lines.push(`        sceneObjects["${obj.name}_state"] = not sceneObjects["${obj.name}_state"]`);
          lines.push(`        local isOn = sceneObjects["${obj.name}_state"]`);
          lines.push(`        sceneObjects["${obj.name}"].Color = isOn`);
          lines.push(`            and Color3.fromHex("#44DD88") or Color3.fromHex("#FF4455")`);
          lines.push(`        -- ▶ Circuit fires here`);
          lines.push(`        if isOn then onToggleOn(player, "${obj.name}")`);
          lines.push(`        else         onToggleOff(player, "${obj.name}") end`);
          lines.push(`    end)`);
          lines.push(`end`);
          break;
        case 'trigger_vol':
          lines.push(`if sceneObjects["${obj.name}"] then`);
          lines.push(`    sceneObjects["${obj.name}"].Touched:Connect(function(hit)`);
          lines.push(`        local player = Players:GetPlayerFromCharacter(hit.Parent)`);
          lines.push(`        if not player then return end`);
          lines.push(`        -- ▶ Circuit fires here: player entered ${obj.name}`);
          lines.push(`        onTriggerEntered(player, "${obj.name}")`);
          lines.push(`    end)`);
          lines.push(`    sceneObjects["${obj.name}"].TouchEnded:Connect(function(hit)`);
          lines.push(`        local player = Players:GetPlayerFromCharacter(hit.Parent)`);
          lines.push(`        if not player then return end`);
          lines.push(`        onTriggerExited(player, "${obj.name}")`);
          lines.push(`    end)`);
          lines.push(`end`);
          break;
        case 'interact_vol':
          lines.push(`if sceneObjects["${obj.name}_prompt"] then`);
          lines.push(`    sceneObjects["${obj.name}_prompt"].Triggered:Connect(function(player)`);
          lines.push(`        -- ▶ Circuit fires here: player interacted with ${obj.name}`);
          lines.push(`        onInteraction(player, "${obj.name}")`);
          lines.push(`    end)`);
          lines.push(`end`);
          break;
        case 'ui_button':
          lines.push(`-- Wire UI button to PlayerAdded (UI runs per-player)`);
          lines.push(`Players.PlayerAdded:Connect(function(player)`);
          lines.push(`    local char = player.Character or player.CharacterAdded:Wait()`);
          lines.push(`    local pGui = player.PlayerGui`);
          lines.push(`    local gui  = pGui:WaitForChild("${obj.config.parent||'RRGui'}", 10)`);
          lines.push(`    if not gui then return end`);
          lines.push(`    local btn = gui:WaitForChild("${obj.name}", 5)`);
          lines.push(`    if not btn then return end`);
          lines.push(`    btn.MouseButton1Click:Connect(function()`);
          lines.push(`        -- ▶ Circuit fires here: UI button ${obj.name} clicked`);
          lines.push(`        onUIButtonClicked(player, "${obj.name}")`);
          lines.push(`    end)`);
          lines.push(`end)`);
          break;
        case 'ui_toggle':
          lines.push(`Players.PlayerAdded:Connect(function(player)`);
          lines.push(`    local pGui = player.PlayerGui`);
          lines.push(`    local gui  = pGui:WaitForChild("${obj.config.parent||'RRGui'}", 10)`);
          lines.push(`    if not gui then return end`);
          lines.push(`    local btn = gui:WaitForChild("${obj.name}", 5)`);
          lines.push(`    if not btn then return end`);
          lines.push(`    local toggleState = false`);
          lines.push(`    btn.MouseButton1Click:Connect(function()`);
          lines.push(`        toggleState = not toggleState`);
          lines.push(`        btn.Text = toggleState and "${obj.config.onText||'ON'}" or "${obj.config.text||'OFF'}"`);
          lines.push(`        btn.BackgroundColor3 = toggleState`);
          lines.push(`            and Color3.fromHex("#${obj.config.onColor||'00AA44'}")`);
          lines.push(`            or  Color3.fromHex("#${obj.config.offColor||'AA0000'}")`);
          lines.push(`        if toggleState then onToggleOn(player, "${obj.name}")`);
          lines.push(`        else                onToggleOff(player, "${obj.name}") end`);
          lines.push(`    end)`);
          lines.push(`end)`);
          break;
      }
    });

    // Callback stubs that the circuit logic calls into
    lines.push('\n-- ═══ Circuit Callback Stubs (replace with your circuit logic) ═══');
    const eventsUsed = new Set(sceneObjects.map(o => OBJ_TYPES[o.type]?.event).filter(Boolean));
    if (eventsUsed.has('btn_pressed'))   lines.push('function onButtonPressed(player, name)\n    -- Your circuit here\nend');
    if (eventsUsed.has('tbtn_on'))       lines.push('function onToggleOn(player, name)\n    -- Your circuit here\nend\nfunction onToggleOff(player, name)\n    -- Your circuit here\nend');
    if (eventsUsed.has('trig_enter'))    lines.push('function onTriggerEntered(player, name)\n    -- Your circuit here\nend\nfunction onTriggerExited(player, name)\n    -- Your circuit here\nend');
    if (eventsUsed.has('ivol_interact')) lines.push('function onInteraction(player, name)\n    -- Your circuit here\nend');
    if (eventsUsed.has('sbtn_click'))    lines.push('function onUIButtonClicked(player, name)\n    -- Your circuit here\nend');

    return lines.join('\n');
  }

  function getSceneObjects() { return sceneObjects; }

  // ── Push functions ────────────────────────────────────────────────────────
  async function pushRoblox() {
    const circuitCode = Exporter.export('roblox');
    const sceneCode   = generateSceneCode();
    const combined    = circuitCode + sceneCode;

    if (typeof IS_ELECTRON !== 'undefined' && IS_ELECTRON) {
      await window.electronAPI.engineSetCode('roblox', combined);
      setLiveStatus('roblox', `✓ ${sceneObjects.length} scene object(s) + circuit pushed — plugin will apply in ~2s`, true);
      Canvas.showToast('📡 Pushed to Roblox Studio!');
    } else {
      const blob = new Blob([combined], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'RRCircuit.lua'; a.click();
      URL.revokeObjectURL(url);
      Canvas.showToast('Downloaded — place Script in ServerScriptService');
    }
  }

  // ── Download plugin ───────────────────────────────────────────────────────
  function downloadPlugin() {
    fetch('/plugins/RRCircuits.lua')
      .then(r => r.text())
      .then(text => {
        const blob = new Blob([text], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = 'RRCircuits.lua'; a.click();
        URL.revokeObjectURL(url);
        Canvas.showToast('Plugin downloaded!');
      });
  }

  // ── Unity ─────────────────────────────────────────────────────────────────
  async function browseUnity() {
    if (typeof IS_ELECTRON !== 'undefined' && IS_ELECTRON) {
      const result = await window.electronAPI.openFile({ properties: ['openDirectory'] });
      if (!result.canceled && result.filePath) {
        unityPath = result.filePath;
        document.getElementById('ecUnityPath').value = unityPath;
        localStorage.setItem('ec_unity_path', unityPath);
      }
    }
  }
  async function pushUnity() {
    const code     = Exporter.export('unity');
    const projName = (document.getElementById('projectName')?.textContent.trim()||'RRCircuit').replace(/\s+/g,'');
    const filename = projName + '.cs';
    if (typeof IS_ELECTRON !== 'undefined' && IS_ELECTRON) {
      const result = await window.electronAPI.writeToFolder({ suggestedFolder:'Assets/Scripts', filename, content:code });
      if (result.success) { setLiveStatus('unity', `✓ Written to ${result.filePath}`, true); Canvas.showToast(`✅ Written to Unity!`); }
      else if (!result.canceled) setLiveStatus('unity', 'Error: ' + (result.error||'unknown'), false);
    } else {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([code],{type:'text/plain'})), download: filename });
      a.click(); Canvas.showToast(`Downloaded ${filename}`);
    }
  }

  // ── Unreal ────────────────────────────────────────────────────────────────
  async function browseUnreal() {
    if (typeof IS_ELECTRON !== 'undefined' && IS_ELECTRON) {
      const result = await window.electronAPI.openFile({ properties: ['openDirectory'] });
      if (!result.canceled && result.filePath) {
        unrealPath = result.filePath;
        document.getElementById('ecUnrealPath').value = unrealPath;
        localStorage.setItem('ec_unreal_path', unrealPath);
      }
    }
  }
  async function pushUnreal() {
    const code     = Exporter.export('unreal');
    const projName = (document.getElementById('projectName')?.textContent.trim()||'RRCircuit').replace(/\s+/g,'');
    const filename = projName + '.cpp';
    if (typeof IS_ELECTRON !== 'undefined' && IS_ELECTRON) {
      const result = await window.electronAPI.writeToFolder({ suggestedFolder:'Source/YourProject', filename, content:code });
      if (result.success) { setLiveStatus('unreal', `✓ Written to ${result.filePath}`, true); Canvas.showToast(`✅ Written to Unreal!`); }
      else if (!result.canceled) setLiveStatus('unreal', 'Error: ' + (result.error||'unknown'), false);
    } else {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([code],{type:'text/plain'})), download: filename });
      a.click(); Canvas.showToast(`Downloaded ${filename}`);
    }
  }

  function setLiveStatus(engine, msg, isOk) {
    const id = 'ec' + engine.charAt(0).toUpperCase() + engine.slice(1) + 'Live';
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent  = msg;
    el.className    = 'ec-live-status' + (isOk === true ? ' ok' : isOk === false ? ' err' : '');
  }

  return { init, openModal, getSceneObjects, generateSceneCode };
})();
