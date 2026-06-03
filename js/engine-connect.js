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

    // Scene object add dropdowns (Roblox / Unity / Unreal all share the same list)
    ['ecAddSceneType','ecAddSceneTypeUnity','ecAddSceneTypeUnreal'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', e => {
        const t = e.target.value; if (!t) return;
        addSceneObject(t);
        e.target.value = '';
      });
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
    // Render into all three panels (they share the same data)
    ['ecSceneList','ecSceneListUnity','ecSceneListUnreal'].forEach(listId => {
      _renderIntoList(document.getElementById(listId));
    });
  }

  function _renderIntoList(list) {
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

  // ── Unity Scene Code Generator ───────────────────────────────────────────
  function generateUnityScene() {
    if (!sceneObjects.length) return '';
    const L = [];
    const projName = (document.getElementById('projectName')?.textContent.trim()||'RRCircuit').replace(/\s+/g,'');

    L.push('');
    L.push('    // ════════════════════════════════════════════════════════════');
    L.push('    // SCENE SETUP — GameObjects created automatically on Start()');
    L.push('    // ════════════════════════════════════════════════════════════');
    L.push('');
    L.push('    private Dictionary<string, GameObject> _scene = new Dictionary<string, GameObject>();');
    L.push('    private Canvas _canvas;');
    L.push('');
    L.push('    private void SetupScene()');
    L.push('    {');
    L.push('        // Create Canvas for all UI elements');
    const hasUI = sceneObjects.some(o => OBJ_TYPES[o.type]?.category === 'ui');
    if (hasUI) {
      L.push('        var canvasGO = new GameObject("RRCanvas");');
      L.push('        _canvas = canvasGO.AddComponent<Canvas>();');
      L.push('        _canvas.renderMode = RenderMode.ScreenSpaceOverlay;');
      L.push('        canvasGO.AddComponent<CanvasScaler>();');
      L.push('        canvasGO.AddComponent<GraphicRaycaster>();');
    }
    L.push('');

    sceneObjects.forEach(obj => {
      const c   = obj.config;
      const pos = (c.pos  || '0,2,0').split(',').map(v=>parseFloat(v)||0);
      const sz  = (c.size || '4,4,4').split(',').map(v=>parseFloat(v)||4);
      const col = hexToUnityColor(c.color || c.bgColor || 'AAAAAA');

      if (obj.type === 'button' || obj.type === 'toggle_btn' || obj.type === 'part') {
        const isToggle = obj.type === 'toggle_btn';
        L.push(`        // ${isToggle ? '🔄 Toggle' : '🔘 Button'}: ${obj.name}`);
        L.push(`        var ${obj.name} = GameObject.CreatePrimitive(PrimitiveType.Cube);`);
        L.push(`        ${obj.name}.name = "${obj.name}";`);
        L.push(`        ${obj.name}.transform.position = new Vector3(${pos[0]}f, ${pos[1]}f, ${pos[2]}f);`);
        L.push(`        ${obj.name}.transform.localScale = new Vector3(${sz[0]}f, ${sz[1]}f, ${sz[2]}f);`);
        L.push(`        ${obj.name}.GetComponent<Renderer>().material.color = ${col};`);
        if (obj.type !== 'part') {
          L.push(`        var ${obj.name}_click = ${obj.name}.AddComponent<RRClickDetector>();`);
          L.push(`        ${obj.name}_click.objectName = "${obj.name}";`);
          if (isToggle) L.push(`        ${obj.name}_click.isToggle = true;`);
        }
        L.push(`        _scene["${obj.name}"] = ${obj.name};`);

      } else if (obj.type === 'trigger_vol') {
        L.push(`        // 📦 Trigger Volume: ${obj.name}`);
        L.push(`        var ${obj.name} = new GameObject("${obj.name}");`);
        L.push(`        ${obj.name}.transform.position = new Vector3(${pos[0]}f, ${pos[1]}f, ${pos[2]}f);`);
        L.push(`        var ${obj.name}_col = ${obj.name}.AddComponent<BoxCollider>();`);
        L.push(`        ${obj.name}_col.size = new Vector3(${sz[0]}f, ${sz[1]}f, ${sz[2]}f);`);
        L.push(`        ${obj.name}_col.isTrigger = true;`);
        L.push(`        var ${obj.name}_trigger = ${obj.name}.AddComponent<RRTriggerVolume>();`);
        L.push(`        ${obj.name}_trigger.objectName = "${obj.name}";`);
        L.push(`        _scene["${obj.name}"] = ${obj.name};`);

      } else if (obj.type === 'interact_vol') {
        L.push(`        // 👆 Interaction Zone: ${obj.name}`);
        L.push(`        var ${obj.name} = new GameObject("${obj.name}");`);
        L.push(`        ${obj.name}.transform.position = new Vector3(${pos[0]}f, ${pos[1]}f, ${pos[2]}f);`);
        L.push(`        var ${obj.name}_col = ${obj.name}.AddComponent<BoxCollider>();`);
        L.push(`        ${obj.name}_col.size = new Vector3(${sz[0]}f, ${sz[1]}f, ${sz[2]}f);`);
        L.push(`        ${obj.name}_col.isTrigger = true;`);
        L.push(`        var ${obj.name}_interact = ${obj.name}.AddComponent<RRInteractionZone>();`);
        L.push(`        ${obj.name}_interact.promptText = "${c.promptText||'Interact'}";`);
        L.push(`        ${obj.name}_interact.maxDistance = ${parseFloat(c.maxDist||8)}f;`);
        L.push(`        _scene["${obj.name}"] = ${obj.name};`);

      } else if (obj.type === 'ui_button') {
        const uiSz  = (c.size||'200,50').split(',').map(v=>parseFloat(v)||100);
        const uiPos = (c.pos||'0,0,0,0').split(',').map(v=>parseFloat(v)||0);
        L.push(`        // 🖱 UI Button: ${obj.name}`);
        L.push(`        var ${obj.name}GO = new GameObject("${obj.name}");`);
        L.push(`        ${obj.name}GO.transform.SetParent(_canvas.transform, false);`);
        L.push(`        var ${obj.name}_img = ${obj.name}GO.AddComponent<Image>();`);
        L.push(`        ${obj.name}_img.color = ${hexToUnityColor(c.bgColor||'0066FF')};`);
        L.push(`        var ${obj.name} = ${obj.name}GO.AddComponent<Button>();`);
        L.push(`        var ${obj.name}_rect = ${obj.name}GO.GetComponent<RectTransform>();`);
        L.push(`        ${obj.name}_rect.sizeDelta = new Vector2(${uiSz[0]}f, ${uiSz[1]}f);`);
        L.push(`        ${obj.name}_rect.anchoredPosition = new Vector2(${uiPos[1]}f, ${uiPos[3]}f);`);
        L.push(`        // Button text`);
        L.push(`        var ${obj.name}_textGO = new GameObject("Text");`);
        L.push(`        ${obj.name}_textGO.transform.SetParent(${obj.name}GO.transform, false);`);
        L.push(`        var ${obj.name}_text = ${obj.name}_textGO.AddComponent<TextMeshProUGUI>();`);
        L.push(`        ${obj.name}_text.text = "${c.text||'Click Me'}";`);
        L.push(`        ${obj.name}_text.alignment = TextAlignmentOptions.Center;`);
        L.push(`        ${obj.name}_text.color = ${hexToUnityColor(c.textColor||'FFFFFF')};`);
        L.push(`        ${obj.name}_text.GetComponent<RectTransform>().sizeDelta = ${obj.name}_rect.sizeDelta;`);
        L.push(`        _scene["${obj.name}"] = ${obj.name}GO;`);

      } else if (obj.type === 'ui_label') {
        const uiSz = (c.size||'200,30').split(',').map(v=>parseFloat(v)||100);
        L.push(`        // 📝 UI Label: ${obj.name}`);
        L.push(`        var ${obj.name}GO = new GameObject("${obj.name}");`);
        L.push(`        ${obj.name}GO.transform.SetParent(_canvas.transform, false);`);
        L.push(`        var ${obj.name} = ${obj.name}GO.AddComponent<TextMeshProUGUI>();`);
        L.push(`        ${obj.name}.text = "${c.text||'Label'}";`);
        L.push(`        ${obj.name}.color = ${hexToUnityColor(c.textColor||'FFFFFF')};`);
        L.push(`        ${obj.name}.GetComponent<RectTransform>().sizeDelta = new Vector2(${uiSz[0]}f, ${uiSz[1]}f);`);
        L.push(`        _scene["${obj.name}"] = ${obj.name}GO;`);

      } else if (obj.type === 'ui_toggle') {
        const uiSz = (c.size||'200,50').split(',').map(v=>parseFloat(v)||100);
        L.push(`        // 🔄 UI Toggle: ${obj.name}`);
        L.push(`        var ${obj.name}GO = new GameObject("${obj.name}");`);
        L.push(`        ${obj.name}GO.transform.SetParent(_canvas.transform, false);`);
        L.push(`        var ${obj.name} = ${obj.name}GO.AddComponent<Toggle>();`);
        L.push(`        ${obj.name}GO.GetComponent<RectTransform>().sizeDelta = new Vector2(${uiSz[0]}f, ${uiSz[1]}f);`);
        L.push(`        _scene["${obj.name}"] = ${obj.name}GO;`);

      } else if (obj.type === 'ui_textbox') {
        const uiSz = (c.size||'200,40').split(',').map(v=>parseFloat(v)||100);
        L.push(`        // ⌨ UI InputField: ${obj.name}`);
        L.push(`        var ${obj.name}GO = new GameObject("${obj.name}");`);
        L.push(`        ${obj.name}GO.transform.SetParent(_canvas.transform, false);`);
        L.push(`        var ${obj.name} = ${obj.name}GO.AddComponent<TMP_InputField>();`);
        L.push(`        ${obj.name}.placeholder.GetComponent<TextMeshProUGUI>().text = "${c.placeholder||'Type here...'}";`);
        L.push(`        ${obj.name}GO.GetComponent<RectTransform>().sizeDelta = new Vector2(${uiSz[0]}f, ${uiSz[1]}f);`);
        L.push(`        _scene["${obj.name}"] = ${obj.name}GO;`);
      }
      L.push('');
    });

    L.push('    }');
    L.push('');

    // Event wiring
    L.push('    // ═══ Event Callbacks ═══');
    L.push('    // These are called by the helper components above.');
    L.push('    // Connect your circuit logic here.');
    L.push('');
    const usedEvents = new Set(sceneObjects.map(o => OBJ_TYPES[o.type]?.event).filter(Boolean));

    if (usedEvents.has('btn_pressed')) {
      L.push('    public void OnButtonClicked(string name) {');
      L.push('        // ▶ Circuit: button clicked');
      L.push('        Debug.Log($"Button clicked: {name}");');
      L.push('    }');
    }
    if (usedEvents.has('tbtn_on')) {
      L.push('    public void OnToggleOn(string name)  { Debug.Log($"Toggle ON: {name}"); }');
      L.push('    public void OnToggleOff(string name) { Debug.Log($"Toggle OFF: {name}"); }');
    }
    if (usedEvents.has('trig_enter')) {
      L.push('    public void OnTriggerEntered(string name, Collider other) {');
      L.push('        Debug.Log($"Trigger entered: {name}");');
      L.push('    }');
      L.push('    public void OnTriggerExited(string name, Collider other) { }');
    }
    if (usedEvents.has('ivol_interact')) {
      L.push('    public void OnInteraction(string name) { Debug.Log($"Interaction: {name}"); }');
    }
    if (usedEvents.has('sbtn_click')) {
      L.push('    public void OnUIButtonClicked(string name) { Debug.Log($"UI Click: {name}"); }');
    }

    // Helper components code (appended as a comment guide)
    L.push('');
    L.push('    /* ── Add these helper MonoBehaviours to your project ──');
    L.push('    They call back into the generated circuit class above. ──');
    L.push('');
    L.push('    public class RRClickDetector : MonoBehaviour {');
    L.push('        public string objectName; public bool isToggle;');
    L.push('        private bool _state;');
    L.push('        void OnMouseDown() {');
    L.push('            var c = FindObjectOfType<' + projName + '>();');
    L.push('            if (!c) return;');
    L.push('            if (isToggle) { _state=!_state; if(_state) c.OnToggleOn(objectName); else c.OnToggleOff(objectName); }');
    L.push('            else c.OnButtonClicked(objectName);');
    L.push('        }');
    L.push('    }');
    L.push('');
    L.push('    public class RRTriggerVolume : MonoBehaviour {');
    L.push('        public string objectName;');
    L.push('        void OnTriggerEnter(Collider other) { FindObjectOfType<' + projName + '>()?.OnTriggerEntered(objectName, other); }');
    L.push('        void OnTriggerExit(Collider other)  { FindObjectOfType<' + projName + '>()?.OnTriggerExited(objectName, other); }');
    L.push('    }');
    L.push('    ── */');

    return '\n' + L.join('\n');
  }

  function hexToUnityColor(hex) {
    hex = hex.replace('#','');
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0,2),16)/255;
      const g = parseInt(hex.slice(2,4),16)/255;
      const b = parseInt(hex.slice(4,6),16)/255;
      return `new Color(${r.toFixed(3)}f, ${g.toFixed(3)}f, ${b.toFixed(3)}f)`;
    }
    return 'Color.white';
  }

  // ── Unreal Scene Code Generator ───────────────────────────────────────────
  function generateUnrealScene() {
    if (!sceneObjects.length) return '';
    const L = [];
    const projName = (document.getElementById('projectName')?.textContent.trim()||'RRCircuit').replace(/\s+/g,'');

    L.push('');
    L.push('// ════════════════════════════════════════════════════════════════');
    L.push('// SCENE SETUP — Actors/components spawned in BeginPlay()');
    L.push('// ════════════════════════════════════════════════════════════════');
    L.push('');
    L.push(`void A${projName}::SetupScene()`);
    L.push('{');
    L.push('    UWorld* World = GetWorld();');
    L.push('    if (!World) return;');
    L.push('    FActorSpawnParameters SP;');
    L.push('');

    sceneObjects.forEach(obj => {
      const c   = obj.config;
      const pos = (c.pos  || '0,2,0').split(',').map(v=>parseFloat(v)*100||0);  // cm in Unreal
      const sz  = (c.size || '4,4,4').split(',').map(v=>parseFloat(v)*50||200);

      if (obj.type === 'button' || obj.type === 'toggle_btn' || obj.type === 'part') {
        L.push(`    // ${obj.type==='toggle_btn'?'🔄 Toggle':'🔘 Button'}: ${obj.name}`);
        L.push(`    SP.Name = TEXT("${obj.name}");`);
        L.push(`    auto* ${obj.name} = World->SpawnActor<AStaticMeshActor>(`);
        L.push(`        AStaticMeshActor::StaticClass(),`);
        L.push(`        FVector(${pos[0]}f, ${pos[1]}f, ${pos[2]}f),`);
        L.push(`        FRotator::ZeroRotator, SP);`);
        L.push(`    if (${obj.name}) {`);
        L.push(`        ${obj.name}->GetStaticMeshComponent()->SetMobility(EComponentMobility::Movable);`);
        if (obj.type === 'button') {
          L.push(`        // Wire click: ${obj.name}->OnClicked.AddDynamic(this, &A${projName}::OnButtonClicked);`);
        }
        L.push(`        SceneActors.Add(TEXT("${obj.name}"), ${obj.name});`);
        L.push(`    }`);

      } else if (obj.type === 'trigger_vol') {
        L.push(`    // 📦 Trigger Volume: ${obj.name}`);
        L.push(`    SP.Name = TEXT("${obj.name}");`);
        L.push(`    auto* ${obj.name} = World->SpawnActor<ATriggerBox>(`);
        L.push(`        ATriggerBox::StaticClass(),`);
        L.push(`        FVector(${pos[0]}f, ${pos[1]}f, ${pos[2]}f),`);
        L.push(`        FRotator::ZeroRotator, SP);`);
        L.push(`    if (${obj.name}) {`);
        L.push(`        ${obj.name}->GetCollisionComponent()->SetBoxExtent(FVector(${sz[0]}f, ${sz[1]}f, ${sz[2]}f));`);
        L.push(`        ${obj.name}->OnActorBeginOverlap.AddDynamic(this, &A${projName}::On${obj.name}Enter);`);
        L.push(`        ${obj.name}->OnActorEndOverlap.AddDynamic(this, &A${projName}::On${obj.name}Exit);`);
        L.push(`        SceneActors.Add(TEXT("${obj.name}"), ${obj.name});`);
        L.push(`    }`);

      } else if (obj.type === 'interact_vol') {
        L.push(`    // 👆 Interaction Volume: ${obj.name}`);
        L.push(`    SP.Name = TEXT("${obj.name}");`);
        L.push(`    auto* ${obj.name} = World->SpawnActor<ATriggerBox>(`);
        L.push(`        ATriggerBox::StaticClass(),`);
        L.push(`        FVector(${pos[0]}f, ${pos[1]}f, ${pos[2]}f),`);
        L.push(`        FRotator::ZeroRotator, SP);`);
        L.push(`    if (${obj.name}) {`);
        L.push(`        // Add Interaction Prompt component (UInteractableComponent)`);
        L.push(`        ${obj.name}->OnActorBeginOverlap.AddDynamic(this, &A${projName}::On${obj.name}Interact);`);
        L.push(`        SceneActors.Add(TEXT("${obj.name}"), ${obj.name});`);
        L.push(`    }`);

      } else if (OBJ_TYPES[obj.type]?.category === 'ui') {
        const uiSz = (c.size||'200,50').split(',').map(v=>parseFloat(v)||100);
        L.push(`    // UI (UMG): ${obj.name} — create as Widget Blueprint or in CreateWidget<>`);
        L.push(`    // TSubclassOf<UUserWidget> ${obj.name}Class; // set in Editor`);
        L.push(`    // auto* ${obj.name} = CreateWidget<UUserWidget>(GetWorld(), ${obj.name}Class);`);
        L.push(`    // if (${obj.name}) ${obj.name}->AddToViewport();`);
        L.push(`    // For ${obj.type}: size hint (${uiSz[0]} x ${uiSz[1]})`);
      }
      L.push('');
    });

    L.push('}');
    L.push('');

    // Event callbacks
    L.push('// ═══ Event Callbacks ═══');
    const usedEvents = new Set(sceneObjects.map(o => OBJ_TYPES[o.type]?.event).filter(Boolean));
    const trigObjs   = sceneObjects.filter(o => o.type === 'trigger_vol' || o.type === 'interact_vol');

    if (usedEvents.has('btn_pressed')) {
      L.push(`void A${projName}::OnButtonClicked(AActor* ClickedActor, FKey ButtonPressed) {`);
      L.push('    UE_LOG(LogTemp, Log, TEXT("Button clicked"));');
      L.push('    // ▶ Circuit logic here');
      L.push('}');
    }
    trigObjs.forEach(obj => {
      L.push(`void A${projName}::On${obj.name}Enter(AActor* Ov, AActor* OtherActor) {`);
      L.push(`    UE_LOG(LogTemp, Log, TEXT("${obj.name} entered"));`);
      L.push('}');
      L.push(`void A${projName}::On${obj.name}Exit(AActor* Ov, AActor* OtherActor) { }`);
    });

    // Header additions hint
    L.push('');
    L.push('/* Add to your .h file:');
    L.push('    TMap<FName, AActor*> SceneActors;');
    L.push('    void SetupScene();');
    if (usedEvents.has('btn_pressed')) L.push(`    UFUNCTION() void OnButtonClicked(AActor* ClickedActor, FKey ButtonPressed);`);
    trigObjs.forEach(o => {
      L.push(`    UFUNCTION() void On${o.name}Enter(AActor* Ov, AActor* OtherActor);`);
      L.push(`    UFUNCTION() void On${o.name}Exit(AActor* Ov, AActor* OtherActor);`);
    });
    L.push('*/');

    return '\n' + L.join('\n');
  }

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
    // Inject scene code inside the class body (before final })
    const base     = Exporter.export('unity');
    const scene    = generateUnityScene();
    const combined = scene ? base.replace(/\n\}$/, '\n' + scene + '\n}') : base;
    const projName = (document.getElementById('projectName')?.textContent.trim()||'RRCircuit').replace(/\s+/g,'');
    const filename = projName + '.cs';

    if (typeof IS_ELECTRON !== 'undefined' && IS_ELECTRON) {
      const result = await window.electronAPI.writeToFolder({ suggestedFolder:'Assets/Scripts', filename, content:combined });
      if (result.success) {
        const count = sceneObjects.length;
        setLiveStatus('unity', `✓ Written to ${result.filePath}${count ? ` — ${count} scene object(s) included` : ''}`, true);
        Canvas.showToast(`✅ Written to Unity! (${count} scene objects)`);
      } else if (!result.canceled) { setLiveStatus('unity', 'Error: ' + (result.error||'unknown'), false); }
    } else {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([combined],{type:'text/plain'})), download: filename });
      a.click();
      Canvas.showToast(`Downloaded ${filename}`);
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
    const base     = Exporter.export('unreal');
    const scene    = generateUnrealScene();
    // Inject SetupScene() call in BeginPlay
    const combined = scene ? base.replace(
      'Super::BeginPlay();',
      'Super::BeginPlay();\n    SetupScene();'
    ) + scene : base;
    const projName = (document.getElementById('projectName')?.textContent.trim()||'RRCircuit').replace(/\s+/g,'');
    const filename = projName + '.cpp';

    if (typeof IS_ELECTRON !== 'undefined' && IS_ELECTRON) {
      const result = await window.electronAPI.writeToFolder({ suggestedFolder:'Source/YourProject', filename, content:combined });
      if (result.success) {
        const count = sceneObjects.length;
        setLiveStatus('unreal', `✓ Written to ${result.filePath}${count ? ` — ${count} scene object(s) included` : ''}`, true);
        Canvas.showToast(`✅ Written to Unreal! (${count} scene objects)`);
      } else if (!result.canceled) { setLiveStatus('unreal', 'Error: ' + (result.error||'unknown'), false); }
    } else {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([combined],{type:'text/plain'})), download: filename });
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
