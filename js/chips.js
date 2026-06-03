// chips.js — Complete Rec Room CV2-style chip registry

const PORT_TYPES = {
  exec:       { color: '#FF8C00', cls: 'pt-exec',    wireCls: 'wt-exec' },
  int:        { color: '#4A9EFF', cls: 'pt-int',     wireCls: 'wt-number' },
  float:      { color: '#33BBFF', cls: 'pt-float',   wireCls: 'wt-number' },
  number:     { color: '#4A9EFF', cls: 'pt-number',  wireCls: 'wt-number' },
  bool:       { color: '#FF4455', cls: 'pt-bool',    wireCls: 'wt-bool' },
  string:     { color: '#44DD88', cls: 'pt-string',  wireCls: 'wt-string' },
  player:     { color: '#00CCFF', cls: 'pt-player',  wireCls: 'wt-player' },
  vector3:    { color: '#AA66FF', cls: 'pt-vector3', wireCls: 'wt-vector3' },
  quaternion: { color: '#FF66DD', cls: 'pt-quat',    wireCls: 'wt-quat' },
  color_t:    { color: '#FFBB33', cls: 'pt-color',   wireCls: 'wt-color' },
  object:     { color: '#BBBBBB', cls: 'pt-object',  wireCls: 'wt-object' },
  list:       { color: '#FFAA33', cls: 'pt-list',    wireCls: 'wt-list' },
  any:        { color: '#778899', cls: 'pt-any',     wireCls: 'wt-any' },
};

const CATEGORIES = {
  'Control Flow':   { color: '#FF8C00', icon: '⤳', order: 0 },
  'Math':           { color: '#4A9EFF', icon: '∑', order: 1 },
  'Logic':          { color: '#AA66FF', icon: '⊼', order: 2 },
  'Variables':      { color: '#00CCAA', icon: '≡', order: 3 },
  'Lists':          { color: '#44CC44', icon: '☰', order: 4 },
  'Events':         { color: '#FF4444', icon: '◉', order: 5 },
  'Player':         { color: '#00CCFF', icon: '☺', order: 6 },
  'UI':             { color: '#FF66AA', icon: '🖥', order: 7 },
  'Objects':        { color: '#AAAAFF', icon: '◆', order: 8 },
  'Combatant':      { color: '#FF6633', icon: '⚔', order: 9 },
  'Volumes':        { color: '#66FFAA', icon: '⊡', order: 10 },
  'Gadgets':        { color: '#FFCC44', icon: '⚙', order: 11 },
  'Conversion':     { color: '#FF9944', icon: '↔', order: 12 },
  'Custom':         { color: '#FF44FF', icon: '★', order: 99 },
};

// Port shorthand helpers
const E  = (name)      => ({ name, type: 'exec' });
const N  = (name, def) => ({ name, type: 'number',     default: def ?? 0 });
const I  = (name, def) => ({ name, type: 'int',        default: def ?? 0 });
const F  = (name, def) => ({ name, type: 'float',      default: def ?? 0 });
const B  = (name, def) => ({ name, type: 'bool',       default: def ?? false });
const S  = (name, def) => ({ name, type: 'string',     default: def ?? '' });
const P  = (name)      => ({ name, type: 'player' });
const V  = (name)      => ({ name, type: 'vector3' });
const Q  = (name)      => ({ name, type: 'quaternion' });
const C  = (name)      => ({ name, type: 'color_t' });
const O  = (name)      => ({ name, type: 'object' });
const L  = (name)      => ({ name, type: 'list' });
const A  = (name)      => ({ name, type: 'any' });

function chip(id, name, category, inputs, outputs, meta = {}) {
  return { id, name, category, inputs, outputs, ...meta };
}

const CHIP_REGISTRY = [

  // ═══════════════════ CONTROL FLOW ═══════════════════
  chip('authority', 'If Local Player Is Authority', 'Control Flow',
    [],
    [E('True'), E('False'), B('Is Authority')]),

  chip('sequence', 'Sequence', 'Control Flow',
    [E('Run')],
    [E('0'), E('1'), E('2'), E('3'), E('4')]),

  chip('delay', 'Delay', 'Control Flow',
    [E('Run'), F('Seconds', 1)],
    [E('Out')]),

  chip('foreach', 'For Each', 'Control Flow',
    [E('Run'), L('List')],
    [E('Loop Body'), E('Completed'), A('Item'), I('Index')]),

  chip('loop', 'Loop', 'Control Flow',
    [E('Run'), E('Break')],
    [E('Loop Body'), E('Completed')]),

  chip('whileloop', 'While', 'Control Flow',
    [E('Run'), B('Condition', false)],
    [E('Loop Body'), E('Completed')]),

  chip('valswitch', 'Value Switch', 'Control Flow',
    [E('Run'), A('Value'), A('Case 0'), A('Case 1'), A('Case 2'), A('Default')],
    [E('Case 0'), E('Case 1'), E('Case 2'), E('Default')]),

  chip('forloop', 'For Loop', 'Control Flow',
    [E('Run'), I('First', 0), I('Last', 9), I('Step', 1)],
    [E('Loop Body'), E('Completed'), I('Index')]),

  chip('branch', 'Branch', 'Control Flow',
    [E('Run'), B('Condition', false)],
    [E('True'), E('False')]),

  chip('doonce', 'Do Once', 'Control Flow',
    [E('Run'), E('Reset')],
    [E('Out')]),

  chip('gate', 'Gate', 'Control Flow',
    [E('Run'), E('Open'), E('Close'), B('Start Open', true)],
    [E('Out')]),

  // ═══════════════════ MATH ═══════════════════
  chip('add',      'Add',            'Math', [N('A', 0), N('B', 0)], [N('Result')]),
  chip('subtract', 'Subtract',       'Math', [N('A', 0), N('B', 0)], [N('Result')]),
  chip('multiply', 'Multiply',       'Math', [N('A', 1), N('B', 1)], [N('Result')]),
  chip('divide',   'Divide',         'Math', [N('A', 0), N('B', 1)], [N('Result')]),
  chip('modulo',   'Modulo',         'Math', [N('A', 0), N('B', 1)], [N('Result')]),
  chip('abs',      'Absolute Value', 'Math', [N('Value', 0)],        [N('Result')]),
  chip('clamp',    'Clamp',          'Math', [N('Value', 0), N('Min', 0), N('Max', 1)], [N('Result')]),
  chip('lerp',     'Lerp',           'Math', [N('A', 0), N('B', 1), N('T', 0.5)],      [N('Result')]),
  chip('round',    'Round',          'Math', [N('Value', 0)], [N('Result')]),
  chip('ceil',     'Ceil',           'Math', [N('Value', 0)], [N('Result')]),
  chip('floor',    'Floor',          'Math', [N('Value', 0)], [N('Result')]),
  chip('sin',      'Sin',            'Math', [N('Radians', 0)], [N('Result')]),
  chip('cos',      'Cos',            'Math', [N('Radians', 0)], [N('Result')]),
  chip('tan',      'Tan',            'Math', [N('Radians', 0)], [N('Result')]),
  chip('asin',     'Asin',           'Math', [N('Value', 0)],   [N('Radians')]),
  chip('acos',     'Acos',           'Math', [N('Value', 0)],   [N('Radians')]),
  chip('atan2',    'Atan2',          'Math', [N('Y', 0), N('X', 0)], [N('Radians')]),
  chip('min',      'Min',            'Math', [N('A', 0), N('B', 0)], [N('Result')]),
  chip('max',      'Max',            'Math', [N('A', 0), N('B', 0)], [N('Result')]),
  chip('power',    'Power',          'Math', [N('Base', 2), N('Exp', 2)], [N('Result')]),
  chip('sqrt',     'Sqrt',           'Math', [N('Value', 0)], [N('Result')]),
  chip('log',      'Log',            'Math', [N('Value', 1), N('Base', 10)], [N('Result')]),
  chip('sign',     'Sign',           'Math', [N('Value', 0)], [N('Result')]),
  chip('negate',   'Negate',         'Math', [N('Value', 0)], [N('Result')]),
  chip('pi',       'Pi',             'Math', [], [N('Value')]),
  chip('randnum',  'Random Number',  'Math', [N('Min', 0), N('Max', 1)], [N('Result')]),
  chip('randint',  'Random Integer', 'Math', [I('Min', 0), I('Max', 10)], [I('Result')]),

  // ═══════════════════ LOGIC ═══════════════════
  chip('and',    'And',              'Logic', [B('A', false), B('B', false)], [B('Result')]),
  chip('or',     'Or',               'Logic', [B('A', false), B('B', false)], [B('Result')]),
  chip('not',    'Not',              'Logic', [B('Input', false)],            [B('Result')]),
  chip('nand',   'Nand',             'Logic', [B('A', false), B('B', false)], [B('Result')]),
  chip('nor',    'Nor',              'Logic', [B('A', false), B('B', false)], [B('Result')]),
  chip('xor',    'Xor',              'Logic', [B('A', false), B('B', false)], [B('Result')]),
  chip('eq',     'Equals',           'Logic', [A('A'), A('B')],               [B('Result')]),
  chip('gt',     'Greater Than',     'Logic', [N('A', 0), N('B', 0)],        [B('Result')]),
  chip('lt',     'Less Than',        'Logic', [N('A', 0), N('B', 0)],        [B('Result')]),
  chip('gte',    'Greater or Equal', 'Logic', [N('A', 0), N('B', 0)],        [B('Result')]),
  chip('lte',    'Less or Equal',    'Logic', [N('A', 0), N('B', 0)],        [B('Result')]),
  chip('notEq',  'Not Equal',        'Logic', [A('A'), A('B')],               [B('Result')]),

  // ═══════════════════ VARIABLES ═══════════════════
  chip('var_int',    'Int Variable',        'Variables',
    [E('Set'), I('Value', 0)],
    [E('Out'), I('Value'), E('Changed')],
    { isVariable: true, varType: 'int',        varDefault: 0 }),

  chip('var_float',  'Float Variable',      'Variables',
    [E('Set'), F('Value', 0)],
    [E('Out'), F('Value'), E('Changed')],
    { isVariable: true, varType: 'float',      varDefault: 0 }),

  chip('var_bool',   'Bool Variable',       'Variables',
    [E('Set'), B('Value', false)],
    [E('Out'), B('Value'), E('Changed')],
    { isVariable: true, varType: 'bool',       varDefault: false }),

  chip('var_string', 'String Variable',     'Variables',
    [E('Set'), S('Value', '')],
    [E('Out'), S('Value'), E('Changed')],
    { isVariable: true, varType: 'string',     varDefault: '' }),

  chip('var_player', 'Player Variable',     'Variables',
    [E('Set'), P('Value')],
    [E('Out'), P('Value'), E('Changed')],
    { isVariable: true, varType: 'player' }),

  chip('var_vec3',   'Vector3 Variable',    'Variables',
    [E('Set'), V('Value')],
    [E('Out'), V('Value'), E('Changed')],
    { isVariable: true, varType: 'vector3' }),

  chip('var_quat',   'Quaternion Variable', 'Variables',
    [E('Set'), Q('Value')],
    [E('Out'), Q('Value'), E('Changed')],
    { isVariable: true, varType: 'quaternion' }),

  chip('var_color',  'Color Variable',      'Variables',
    [E('Set'), C('Value')],
    [E('Out'), C('Value'), E('Changed')],
    { isVariable: true, varType: 'color_t' }),

  // ─ List Variables — same as regular but hold a list of the typed value ─
  chip('var_int_list',    'Int List',         'Variables',
    [E('Set'), L('Value')],
    [E('Out'), L('Value'), I('Count'), E('Changed')],
    { isVariable:true, varType:'list', listType:'int' }),

  chip('var_float_list',  'Float List',       'Variables',
    [E('Set'), L('Value')],
    [E('Out'), L('Value'), I('Count'), E('Changed')],
    { isVariable:true, varType:'list', listType:'float' }),

  chip('var_bool_list',   'Bool List',        'Variables',
    [E('Set'), L('Value')],
    [E('Out'), L('Value'), I('Count'), E('Changed')],
    { isVariable:true, varType:'list', listType:'bool' }),

  chip('var_string_list', 'String List',      'Variables',
    [E('Set'), L('Value')],
    [E('Out'), L('Value'), I('Count'), E('Changed')],
    { isVariable:true, varType:'list', listType:'string' }),

  chip('var_player_list', 'Player List',      'Variables',
    [E('Set'), L('Value')],
    [E('Out'), L('Value'), I('Count'), E('Changed')],
    { isVariable:true, varType:'list', listType:'player' }),

  chip('var_vec3_list',   'Vector3 List',     'Variables',
    [E('Set'), L('Value')],
    [E('Out'), L('Value'), I('Count'), E('Changed')],
    { isVariable:true, varType:'list', listType:'vector3' }),

  chip('var_color_list',  'Color List',       'Variables',
    [E('Set'), L('Value')],
    [E('Out'), L('Value'), I('Count'), E('Changed')],
    { isVariable:true, varType:'list', listType:'color_t' }),

  chip('var_obj_list',    'Object List',      'Variables',
    [E('Set'), L('Value')],
    [E('Out'), L('Value'), I('Count'), E('Changed')],
    { isVariable:true, varType:'list', listType:'object' }),

  // Cloud/Synced scope is now a radio toggle on EVERY variable chip above

  // ═══════════════════ LISTS ═══════════════════
  chip('list_add',      'List Add',         'Lists',
    [E('Run'), L('List'), A('Item')],
    [E('Out'), L('List')]),

  chip('list_remove',   'List Remove',      'Lists',
    [E('Run'), L('List'), I('Index', 0)],
    [E('Out'), L('List')]),

  chip('list_get',      'List Get Element', 'Lists',
    [L('List'), I('Index', 0)],
    [A('Item'), B('Success')]),

  chip('list_contains', 'List Contains',    'Lists',
    [L('List'), A('Item')],
    [B('Result'), I('Index')]),

  chip('list_count',    'List Get Count',   'Lists',
    [L('List')],
    [I('Count')]),

  chip('list_create',   'List Create',      'Lists',
    [],
    [L('List')]),

  chip('list_clear',    'List Clear',       'Lists',
    [E('Run'), L('List')],
    [E('Out'), L('List')]),

  // ═══════════════════ EVENTS ═══════════════════
  chip('evt_recv', 'Event Receiver', 'Events',
    [],
    [E('Out'), A('Arg 0'), A('Arg 1'), A('Arg 2')],
    { isEvent: true }),

  chip('evt_send', 'Event Sender', 'Events',
    [E('Run'), A('Arg 0'), A('Arg 1'), A('Arg 2')],
    [E('Out')],
    { isEvent: true }),

  chip('on_joined', 'Player Joined', 'Events',
    [],
    [E('Out'), P('Player')]),

  chip('on_left', 'Player Left', 'Events',
    [],
    [E('Out'), P('Player')]),

  chip('on_init',   'On Init',   'Events', [], [E('Out')]),
  chip('on_update', 'On Update', 'Events', [], [E('Out'), F('Delta Time')]),

  // ═══════════════════ PLAYER ═══════════════════
  chip('pl_name',       'Player Get Name',           'Player', [P('Player')], [S('Name')]),
  chip('pl_uid',        'Player Get Unique ID',       'Player', [P('Player')], [S('ID')]),
  chip('pl_platform',   'Player Get Platform',        'Player', [P('Player')], [S('Platform')]),
  chip('pl_isvr',       'Player Get Is VR',           'Player', [P('Player')], [B('Is VR')]),
  chip('pl_teleport',   'Player Request Teleport',    'Player',
    [E('Run'), P('Player'), V('Position'), Q('Rotation')],
    [E('Out')]),
  chip('pl_setvel',     'Player Set Velocity',        'Player',
    [E('Run'), P('Player'), V('Velocity')],
    [E('Out')]),
  chip('pl_getpos',     'Player Get Position',        'Player',
    [P('Player')],
    [V('Position')]),
  chip('pl_headori',    'Player Get Head Orientation','Player',
    [P('Player')],
    [V('Position'), Q('Rotation')]),
  chip('pl_inparty',    'Player Is In Party',         'Player',
    [P('Player')],
    [B('Result')]),
  chip('pl_ishost',     'Player Get Is Room Host',    'Player',
    [P('Player')],
    [B('Is Host')]),
  chip('pl_addrole',    'Player Add Role',            'Player',
    [E('Run'), P('Player'), S('Role', '')],
    [E('Out')]),
  chip('pl_remrole',    'Player Remove Role',         'Player',
    [E('Run'), P('Player'), S('Role', '')],
    [E('Out')]),
  chip('pl_local',      'Get Local Player',           'Player',
    [],
    [P('Player')]),
  chip('pl_all',        'Get All Players',            'Player',
    [],
    [L('Players'), I('Count')]),
  chip('pl_equip',      'Player Equip Object',        'Player',
    [E('Run'), P('Player'), O('Object')],
    [E('Out')]),
  chip('pl_detach',     'Player Detach Object',       'Player',
    [E('Run'), P('Player')],
    [E('Out'), O('Object')]),
  chip('pl_lastequip',  'Get Player Last Equipped Object', 'Player',
    [P('Player')],
    [O('Object')]),

  // ═══════════════════ UI ═══════════════════
  // ─ Text gadget ─
  chip('text_get',    'Text Get Text',         'UI',  [O('Text Object')], [S('Text')]),
  chip('text_color',  'Text Set Color',        'UI',  [E('Run'), O('Text Object'), C('Color')], [E('Out')]),
  chip('text_size',   'Text Set Font Size',    'UI',  [E('Run'), O('Text Object'), F('Size', 16)], [E('Out')]),
  chip('text_vis',    'Text Set Visible',      'UI',  [E('Run'), O('Text Object'), B('Visible', true)], [E('Out')]),

  // ─ Screen / Image / Screen Button ─
  chip('screen_show', 'Screen Show',           'UI',  [E('Run'), P('Player'), O('Screen')], [E('Out')]),
  chip('screen_hide', 'Screen Hide',           'UI',  [E('Run'), P('Player'), O('Screen')], [E('Out')]),
  chip('img_set',     'Image Set Sprite',      'UI',  [E('Run'), O('Image'), O('Sprite')], [E('Out')]),
  chip('img_color',   'Image Set Color',       'UI',  [E('Run'), O('Image'), C('Color')], [E('Out')]),
  chip('sbtn_click',  'Screen Button Clicked', 'UI',  [O('Screen Button')], [E('Out'), P('Player')],
    { isSceneObject:true, sceneObjectType:'ui_button',   sceneDefaults:{text:'Button',size:'200,50',pos:'0.5,-100,0.9,0',bgColor:'0066FF',textColor:'FFFFFF',parent:'RRGui'} }),
  chip('slider_get',  'Slider Get Value',      'UI',  [O('Slider')], [F('Value')]),
  chip('slider_chg',  'Slider Value Changed',  'UI',  [O('Slider')], [E('Out'), F('Value'), P('Player')]),

  chip('ui_notify',   'Show Notification',    'UI',
    [E('Run'), P('Player'), S('Message', ''), F('Duration', 3)],
    [E('Out')]),

  chip('ui_subtitle', 'Show Subtitle',        'UI',
    [E('Run'), P('Player'), S('Text', ''), F('Duration', 3)],
    [E('Out')]),

  chip('ui_dialogue', 'Open Dialogue Prompt', 'UI',
    [E('Run'), P('Player'), S('Prompt', ''), S('Option 0', ''), S('Option 1', ''), S('Option 2', '')],
    [E('Option 0'), E('Option 1'), E('Option 2'), E('Cancelled'), I('Choice')]),

  chip('ui_settext',  'Text Set Text',        'UI',
    [E('Run'), O('Text Object'), S('Text', '')],
    [E('Out')]),

  // ═══════════════════ OBJECTS ═══════════════════
  chip('obj_gettags',  'Rec Room Object Get Tags',      'Objects',
    [O('Object')],
    [L('Tags')]),

  chip('obj_addtags',  'Rec Room Object Add Tags',      'Objects',
    [E('Run'), O('Object'), S('Tag', '')],
    [E('Out')]),

  chip('obj_authority','Rec Room Object Get Authority', 'Objects',
    [O('Object')],
    [P('Authority Player')]),

  chip('obj_getpos',   'Get Object Position',           'Objects',
    [O('Object')],
    [V('Position'), Q('Rotation')]),

  chip('obj_setpos',   'Set Object Position',           'Objects',
    [E('Run'), O('Object'), V('Position'), Q('Rotation')],
    [E('Out')]),

  chip('obj_setactive','Set Object Active',             'Objects',
    [E('Run'), O('Object'), B('Active', true)],
    [E('Out')]),

  chip('obj_isactive', 'Get Object Is Active',          'Objects',
    [O('Object')],
    [B('Active')]),

  chip('obj_destroy',  'Destroy Object',                'Objects',
    [E('Run'), O('Object')],
    [E('Out')]),

  chip('obj_instantiate','Instantiate Object',          'Objects',
    [E('Run'), O('Prefab'), V('Position'), Q('Rotation')],
    [E('Out'), O('Instance')]),

  // ═══════════════════ COMBATANT ═══════════════════
  chip('cmb_gethealth',   'Combatant Get Health',   'Combatant',
    [O('Combatant')],
    [F('Health'), F('Max Health')]),

  chip('cmb_sethealth',   'Combatant Set Health',   'Combatant',
    [E('Run'), O('Combatant'), F('Health', 100)],
    [E('Out')]),

  chip('cmb_damage',      'Combatant Receive Damage','Combatant',
    [E('Run'), O('Combatant'), F('Damage', 10), O('Instigator'), S('Type', 'Default')],
    [E('Out'), E('Died')]),

  chip('cmb_isalive',     'Combatant Get Is Alive', 'Combatant',
    [O('Combatant')],
    [B('Is Alive')]),

  // ═══════════════════ VOLUMES ═══════════════════
  // — Trigger Volume (scene object: invisible zone that fires when players/objects enter) —
  chip('trig_enter',    'Trigger Volume Player Entered',        'Volumes', [O('Trigger')], [E('Out'), P('Player')],
    { isSceneObject:true, sceneObjectType:'trigger_vol',  sceneDefaults:{pos:'0,4,0',size:'10,8,10',color:'FF6600',opacity:'0.7'} }),
  chip('trig_exit',     'Trigger Volume Player Exited',         'Volumes', [O('Trigger')], [E('Out'), P('Player')],
    { isSceneObject:true, sceneObjectType:'trigger_vol',  sceneDefaults:{pos:'0,4,0',size:'10,8,10',color:'FF6600',opacity:'0.7'} }),
  chip('trig_players',  'Trigger Volume Get Players',           'Volumes', [O('Trigger')], [L('Players'), I('Count')]),
  chip('trig_objects',  'Trigger Volume Get Objects',           'Volumes', [O('Trigger')], [L('Objects')]),
  chip('trig_objcount', 'Trigger Volume Get Total Objects',     'Volumes', [O('Trigger')], [I('Count')]),
  chip('trig_setactive','Trigger Volume Set Active',            'Volumes', [E('Run'), O('Trigger'), B('Active', true)], [E('Out')]),

  // — Interaction Volume (scene object: ProximityPrompt zone) —
  chip('ivol_interact', 'Interaction Volume Player Interacted', 'Volumes', [O('Volume')], [E('Out'), P('Player')],
    { isSceneObject:true, sceneObjectType:'interact_vol', sceneDefaults:{pos:'0,2,0',size:'6,4,6',color:'00CCFF',promptText:'Interact',maxDist:'8'} }),
  chip('ivol_enter',    'Interaction Volume Player Entered',    'Volumes', [O('Volume')], [E('Out'), P('Player')],
    { isSceneObject:true, sceneObjectType:'interact_vol', sceneDefaults:{pos:'0,2,0',size:'6,4,6',color:'00CCFF',promptText:'Interact',maxDist:'8'} }),
  chip('ivol_exit',     'Interaction Volume Player Exited',     'Volumes', [O('Volume')], [E('Out'), P('Player')]),
  chip('ivol_players',  'Interaction Volume Get Players',       'Volumes', [O('Volume')], [L('Players'), I('Count')]),
  chip('ivol_total',    'Interaction Volume Get Total Objects', 'Volumes', [O('Volume')], [I('Count')]),
  chip('ivol_enable',   'Interaction Volume Set Enabled',       'Volumes', [E('Run'), O('Volume'), B('Enabled', true)], [E('Out')]),

  // — Handle Volume (scene object: grab/release detection) —
  chip('hvol_enter',    'Handle Volume Player Entered',         'Volumes', [O('Volume')], [E('Out'), P('Player')],
    { isSceneObject:true, sceneObjectType:'handle_vol',   sceneDefaults:{pos:'0,2,0',size:'4,4,4',color:'AA66FF'} }),
  chip('hvol_exit',     'Handle Volume Player Exited',          'Volumes', [O('Volume')], [E('Out'), P('Player')]),
  chip('hvol_grabbed',  'Handle Volume Object Grabbed',         'Volumes', [O('Volume')], [E('Out'), O('Object'), P('Player')]),
  chip('hvol_released', 'Handle Volume Object Released',        'Volumes', [O('Volume')], [E('Out'), O('Object'), P('Player')]),
  chip('hvol_setactive','Handle Volume Set Active',             'Volumes', [E('Run'), O('Volume'), B('Active', true)], [E('Out')]),

  // ─ Respawn Volume ─
  chip('rvol_enter',   'Respawn Volume Player Entered',        'Volumes', [O('Volume')], [E('Out'), P('Player')]),
  chip('rvol_setcp',   'Respawn Volume Set As Checkpoint',     'Volumes', [E('Run'), O('Volume'), P('Player')], [E('Out')]),

  // ─ Score Zone ─
  chip('score_enter',  'Score Zone Player Entered',            'Volumes', [O('Zone')], [E('Out'), P('Player'), I('Points')]),
  chip('score_set',    'Score Zone Set Points',                'Volumes', [E('Run'), O('Zone'), I('Points', 1)], [E('Out')]),

  // ═══════════════════ GADGETS ═══════════════════
  // — Button (scene object: creates a clickable button in the game world) —
  chip('btn_pressed',   'Button Pressed',              'Gadgets', [O('Button')], [E('Out'), P('Player')],
    { isSceneObject:true, sceneObjectType:'button',     sceneDefaults:{pos:'0,1,0',size:'4,2,4',color:'0066FF',text:'Button',maxDist:'32'} }),
  chip('btn_released',  'Button Released',             'Gadgets', [O('Button')], [E('Out'), P('Player')],
    { isSceneObject:true, sceneObjectType:'button',     sceneDefaults:{pos:'0,1,0',size:'4,2,4',color:'0066FF',text:'Button',maxDist:'32'} }),
  chip('btn_set_en',    'Button Set Enabled',          'Gadgets', [E('Run'), O('Button'), B('Enabled', true)], [E('Out')]),
  chip('btn_set_color', 'Button Set Color',            'Gadgets', [E('Run'), O('Button'), C('Color')], [E('Out')]),

  // — Toggle Button (scene object) —
  chip('tbtn_on',       'Toggle Button Turned On',     'Gadgets', [O('Toggle Button')], [E('Out'), P('Player')],
    { isSceneObject:true, sceneObjectType:'toggle_btn', sceneDefaults:{pos:'0,1,0',size:'4,2,4',color:'FF8800',text:'Toggle',maxDist:'32'} }),
  chip('tbtn_off',      'Toggle Button Turned Off',    'Gadgets', [O('Toggle Button')], [E('Out'), P('Player')],
    { isSceneObject:true, sceneObjectType:'toggle_btn', sceneDefaults:{pos:'0,1,0',size:'4,2,4',color:'FF8800',text:'Toggle',maxDist:'32'} }),
  chip('tbtn_getstate', 'Toggle Button Get State',     'Gadgets', [O('Toggle Button')], [B('Is On')]),
  chip('tbtn_setstate', 'Toggle Button Set State',     'Gadgets', [E('Run'), O('Toggle Button'), B('On', true)], [E('Out')]),

  // — Dial / Slider (scene object) —
  chip('dial_changed',  'Dial Value Changed',          'Gadgets', [O('Dial')], [E('Out'), F('Value')],
    { isSceneObject:true, sceneObjectType:'dial',       sceneDefaults:{pos:'0,1,0',size:'2,2,2',color:'888888'} }),
  chip('dial_get',      'Dial Get Value',              'Gadgets', [O('Dial')], [F('Value')]),
  chip('dial_set',      'Dial Set Value',              'Gadgets', [E('Run'), O('Dial'), F('Value', 0)], [E('Out')]),

  // ─ existing gadgets ─
  chip('piston_dist',   'Piston Set Target Distance',  'Gadgets',
    [E('Run'), O('Piston'), F('Distance', 1)],
    [E('Out')]),

  chip('rotator_spd',   'Rotator Set Speed',           'Gadgets',
    [E('Run'), O('Rotator'), F('Speed', 1)],
    [E('Out')]),

  chip('anim_play',     'Animation Play',              'Gadgets',
    [E('Run'), O('Animator'), S('Animation', '')],
    [E('Out'), E('Completed')]),

  chip('anim_stop',     'Animation Stop',              'Gadgets',
    [E('Run'), O('Animator')],
    [E('Out')]),

  chip('audio_play',    'Audio Player Play',           'Gadgets',
    [E('Run'), O('Audio Player')],
    [E('Out')]),

  chip('audio_vol',     'Audio Player Set Volume',     'Gadgets',
    [E('Run'), O('Audio Player'), F('Volume', 1)],
    [E('Out')]),

  chip('light_color',   'Light Set Color',             'Gadgets',
    [E('Run'), O('Light'), C('Color')],
    [E('Out')]),

  chip('light_int',     'Light Set Intensity',         'Gadgets',
    [E('Run'), O('Light'), F('Intensity', 1)],
    [E('Out')]),

  chip('emitter_start', 'Emitter Start',               'Gadgets',
    [E('Run'), O('Emitter')],
    [E('Out')]),

  chip('emitter_stop',  'Emitter Stop',                'Gadgets',
    [E('Run'), O('Emitter')],
    [E('Out')]),

  chip('emitter_color', 'Emitter Set Color',           'Gadgets',
    [E('Run'), O('Emitter'), C('Color')],
    [E('Out')]),

  // ═══════════════════ CONVERSION ═══════════════════
  chip('to_string',    'To String',     'Conversion', [A('Value')],        [S('Result')]),
  chip('parse_int',    'Parse Int',     'Conversion', [S('Value', '0')],   [I('Result'), B('Success')]),
  chip('parse_float',  'Parse Float',   'Conversion', [S('Value', '0')],   [F('Result'), B('Success')]),
  chip('vec3_make',    'Vector3 Make',  'Conversion', [F('X', 0), F('Y', 0), F('Z', 0)], [V('Vector3')]),
  chip('vec3_split',   'Vector3 Split', 'Conversion', [V('Vector3')],      [F('X'), F('Y'), F('Z')]),
  chip('quat_make',    'Quaternion Make','Conversion', [F('X',0),F('Y',0),F('Z',0),F('W',1)], [Q('Quaternion')]),
  chip('quat_euler',   'Quaternion From Euler','Conversion',[F('Pitch',0),F('Yaw',0),F('Roll',0)],[Q('Quaternion')]),
  chip('color_make',   'Color Make',    'Conversion', [F('R',1),F('G',1),F('B',1),F('A',1)], [C('Color')]),
  chip('bool_to_int',  'Bool to Int',   'Conversion', [B('Value', false)], [I('Result')]),
  chip('int_to_bool',  'Int to Bool',   'Conversion', [I('Value', 0)],     [B('Result')]),
  chip('int_to_float', 'Int to Float',  'Conversion', [I('Value', 0)],     [F('Result')]),
  chip('float_to_int', 'Float to Int',  'Conversion', [F('Value', 0)],     [I('Result')]),
];

// Build lookup map
const CHIP_MAP = {};
for (const c of CHIP_REGISTRY) CHIP_MAP[c.id] = c;

// Register a custom chip at runtime
function registerCustomChip(def) {
  if (!def || !def.id) return;
  if (!CHIP_MAP[def.id]) CHIP_REGISTRY.push(def);
  CHIP_MAP[def.id] = def;
}

function unregisterCustomChip(id) {
  const idx = CHIP_REGISTRY.findIndex(c => c.id === id);
  if (idx >= 0) CHIP_REGISTRY.splice(idx, 1);
  delete CHIP_MAP[id];
}

function getChipDef(id) { return CHIP_MAP[id] || null; }
function getAllChips()   { return CHIP_REGISTRY; }
function getCategories(){ return CATEGORIES; }
function getPortType(t) { return PORT_TYPES[t] || PORT_TYPES.any; }
