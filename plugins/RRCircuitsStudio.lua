--[[
  RR Circuits Studio — Full Circuit Editor  v2.0
  ================================================
  Copy to: %LOCALAPPDATA%\Roblox\Plugins\RRCircuitsStudio.lua
  Reopen Studio → click "RR Circuits" in toolbar
--]]

-- ── Toolbar button appears FIRST so it always shows even if later code errors ──
local toolbar = plugin:CreateToolbar("RR Circuits")
local openBtn = toolbar:CreateButton(
    "RR Circuits",
    "Open the RR Circuits circuit editor",
    "rbxassetid://14978048121"
)

print("[RR Circuits Studio v2.0] Loaded")

-- ── Services ──────────────────────────────────────────────────────────────────
local UIS    = game:GetService("UserInputService")
local SSS    = game:GetService("ServerScriptService")
local SG     = game:GetService("StarterGui")
local RS     = game:GetService("RunService")
local HS     = game:GetService("HttpService")

-- ── Colours ───────────────────────────────────────────────────────────────────
local BG    = Color3.fromRGB(8,  18,  34)
local BG2   = Color3.fromRGB(12, 24,  44)
local PANEL = Color3.fromRGB(10, 20,  38)
local CHIP  = Color3.fromRGB(18, 40,  68)
local CHIPH = Color3.fromRGB(13, 29,  52)
local BORD  = Color3.fromRGB(30, 56,  90)
local WHITE = Color3.new(1,1,1)
local TEXT  = Color3.fromRGB(216,232,255)
local TEXT2 = Color3.fromRGB(112,144,176)
local TEXT3 = Color3.fromRGB(58, 80, 112)

local PORT_COL = {
    exec    = Color3.fromRGB(255,140,0),
    int     = Color3.fromRGB(74,158,255),
    float   = Color3.fromRGB(51,187,255),
    number  = Color3.fromRGB(74,158,255),
    bool    = Color3.fromRGB(255,68,85),
    string  = Color3.fromRGB(68,221,136),
    player  = Color3.fromRGB(0,204,255),
    vector3 = Color3.fromRGB(170,102,255),
    object  = Color3.fromRGB(187,187,187),
    list    = Color3.fromRGB(255,170,51),
    any     = Color3.fromRGB(120,136,153),
}

local CAT_COL = {
    ["Control Flow"] = Color3.fromRGB(255,140,0),
    ["Math"]         = Color3.fromRGB(74,158,255),
    ["Logic"]        = Color3.fromRGB(170,102,255),
    ["Variables"]    = Color3.fromRGB(0,204,170),
    ["Lists"]        = Color3.fromRGB(68,204,68),
    ["Events"]       = Color3.fromRGB(255,68,85),
    ["Player"]       = Color3.fromRGB(0,204,255),
    ["Volumes"]      = Color3.fromRGB(102,255,170),
    ["UI"]           = Color3.fromRGB(255,102,170),
    ["Objects"]      = Color3.fromRGB(170,170,255),
    ["Combatant"]    = Color3.fromRGB(255,102,51),
    ["Conversion"]   = Color3.fromRGB(255,153,68),
    ["Debug"]        = Color3.fromRGB(204,68,68),
}

-- ── Chip definitions ──────────────────────────────────────────────────────────
-- Each chip: { id, name, cat, inp, out, meta }
-- Each port: { "Name", "type", default_value }
local CHIPS = {
    -- Control Flow
    {id="branch",   name="Branch",          cat="Control Flow",
     inp={{"Run","exec"},{"Condition","bool",false}},
     out={{"True","exec"},{"False","exec"}}},
    {id="sequence", name="Sequence",         cat="Control Flow",
     inp={{"Run","exec"}},
     out={{"0","exec"},{"1","exec"},{"2","exec"},{"3","exec"},{"4","exec"}}},
    {id="delay",    name="Delay",            cat="Control Flow",
     inp={{"Run","exec"},{"Seconds","float",1}},
     out={{"Out","exec"}}},
    {id="forloop",  name="For Loop",         cat="Control Flow",
     inp={{"Run","exec"},{"First","int",0},{"Last","int",9},{"Step","int",1}},
     out={{"Loop Body","exec"},{"Completed","exec"},{"Index","int"}}},
    {id="whileloop",name="While Loop",       cat="Control Flow",
     inp={{"Run","exec"},{"Condition","bool",false}},
     out={{"Loop Body","exec"},{"Completed","exec"}}},
    {id="foreach",  name="For Each",         cat="Control Flow",
     inp={{"Run","exec"},{"List","list"}},
     out={{"Loop Body","exec"},{"Completed","exec"},{"Item","any"},{"Index","int"}}},
    {id="doonce",   name="Do Once",          cat="Control Flow",
     inp={{"Run","exec"},{"Reset","exec"}},
     out={{"Out","exec"}}},
    {id="authority",name="Is Authority",     cat="Control Flow",
     inp={}, out={{"True","exec"},{"False","exec"},{"Result","bool"}}},
    -- Math
    {id="add",     name="Add",               cat="Math",
     inp={{"A","number",0},{"B","number",0}}, out={{"Result","number"}}},
    {id="subtract",name="Subtract",          cat="Math",
     inp={{"A","number",0},{"B","number",0}}, out={{"Result","number"}}},
    {id="multiply",name="Multiply",          cat="Math",
     inp={{"A","number",1},{"B","number",1}}, out={{"Result","number"}}},
    {id="divide",  name="Divide",            cat="Math",
     inp={{"A","number",0},{"B","number",1}}, out={{"Result","number"}}},
    {id="modulo",  name="Modulo",            cat="Math",
     inp={{"A","number",0},{"B","number",1}}, out={{"Result","number"}}},
    {id="abs",     name="Abs",               cat="Math",
     inp={{"Value","number",0}}, out={{"Result","number"}}},
    {id="clamp",   name="Clamp",             cat="Math",
     inp={{"Value","number",0},{"Min","number",0},{"Max","number",1}}, out={{"Result","number"}}},
    {id="lerp",    name="Lerp",              cat="Math",
     inp={{"A","number",0},{"B","number",1},{"T","number",0.5}}, out={{"Result","number"}}},
    {id="round",   name="Round",             cat="Math",
     inp={{"Value","number",0}}, out={{"Result","number"}}},
    {id="floor",   name="Floor",             cat="Math",
     inp={{"Value","number",0}}, out={{"Result","number"}}},
    {id="ceil",    name="Ceil",              cat="Math",
     inp={{"Value","number",0}}, out={{"Result","number"}}},
    {id="min",     name="Min",               cat="Math",
     inp={{"A","number",0},{"B","number",0}}, out={{"Result","number"}}},
    {id="max",     name="Max",               cat="Math",
     inp={{"A","number",0},{"B","number",0}}, out={{"Result","number"}}},
    {id="sqrt",    name="Sqrt",              cat="Math",
     inp={{"Value","number",0}}, out={{"Result","number"}}},
    {id="sin",     name="Sin",               cat="Math",
     inp={{"Radians","number",0}}, out={{"Result","number"}}},
    {id="cos",     name="Cos",               cat="Math",
     inp={{"Radians","number",0}}, out={{"Result","number"}}},
    {id="rand",    name="Random Number",     cat="Math",
     inp={{"Min","number",0},{"Max","number",1}}, out={{"Result","number"}}},
    {id="randint", name="Random Integer",    cat="Math",
     inp={{"Min","int",0},{"Max","int",10}}, out={{"Result","int"}}},
    -- Logic
    {id="and",    name="And",                cat="Logic",
     inp={{"A","bool",false},{"B","bool",false}}, out={{"Result","bool"}}},
    {id="or",     name="Or",                 cat="Logic",
     inp={{"A","bool",false},{"B","bool",false}}, out={{"Result","bool"}}},
    {id="not",    name="Not",                cat="Logic",
     inp={{"Input","bool",false}}, out={{"Result","bool"}}},
    {id="eq",     name="Equals",             cat="Logic",
     inp={{"A","any"},{"B","any"}}, out={{"Result","bool"}}},
    {id="gt",     name="Greater Than",       cat="Logic",
     inp={{"A","number",0},{"B","number",0}}, out={{"Result","bool"}}},
    {id="lt",     name="Less Than",          cat="Logic",
     inp={{"A","number",0},{"B","number",0}}, out={{"Result","bool"}}},
    {id="gte",    name="Greater or Equal",   cat="Logic",
     inp={{"A","number",0},{"B","number",0}}, out={{"Result","bool"}}},
    {id="lte",    name="Less or Equal",      cat="Logic",
     inp={{"A","number",0},{"B","number",0}}, out={{"Result","bool"}}},
    -- Variables
    {id="var_int",  name="Int Variable",     cat="Variables",
     inp={{"Set","exec"},{"Value","int",0}},
     out={{"Out","exec"},{"Value","int"},{"Changed","exec"}},
     meta={isVariable=true, varType="int"}},
    {id="var_float",name="Float Variable",   cat="Variables",
     inp={{"Set","exec"},{"Value","float",0}},
     out={{"Out","exec"},{"Value","float"},{"Changed","exec"}},
     meta={isVariable=true, varType="float"}},
    {id="var_bool", name="Bool Variable",    cat="Variables",
     inp={{"Set","exec"},{"Value","bool",false}},
     out={{"Out","exec"},{"Value","bool"},{"Changed","exec"}},
     meta={isVariable=true, varType="bool"}},
    {id="var_str",  name="String Variable",  cat="Variables",
     inp={{"Set","exec"},{"Value","string",""}},
     out={{"Out","exec"},{"Value","string"},{"Changed","exec"}},
     meta={isVariable=true, varType="string"}},
    {id="var_player",name="Player Variable", cat="Variables",
     inp={{"Set","exec"},{"Value","player"}},
     out={{"Out","exec"},{"Value","player"},{"Changed","exec"}},
     meta={isVariable=true, varType="player"}},
    {id="var_vec3", name="Vector3 Variable", cat="Variables",
     inp={{"Set","exec"},{"Value","vector3"}},
     out={{"Out","exec"},{"Value","vector3"},{"Changed","exec"}},
     meta={isVariable=true, varType="vector3"}},
    -- Lists
    {id="list_add",  name="List Add",        cat="Lists",
     inp={{"Run","exec"},{"List","list"},{"Item","any"}},
     out={{"Out","exec"},{"List","list"}}},
    {id="list_rem",  name="List Remove",     cat="Lists",
     inp={{"Run","exec"},{"List","list"},{"Index","int",0}},
     out={{"Out","exec"},{"List","list"}}},
    {id="list_get",  name="List Get",        cat="Lists",
     inp={{"List","list"},{"Index","int",0}},
     out={{"Item","any"},{"Success","bool"}}},
    {id="list_cnt",  name="List Count",      cat="Lists",
     inp={{"List","list"}}, out={{"Count","int"}}},
    {id="list_has",  name="List Contains",   cat="Lists",
     inp={{"List","list"},{"Item","any"}},
     out={{"Result","bool"},{"Index","int"}}},
    {id="list_mk",   name="List Create",     cat="Lists",
     inp={}, out={{"List","list"}}},
    -- Events
    {id="evt_recv", name="Event Receiver",   cat="Events",
     inp={}, out={{"Out","exec"},{"Arg 0","any"},{"Arg 1","any"}},
     meta={isEvent=true}},
    {id="evt_send", name="Event Sender",     cat="Events",
     inp={{"Run","exec"},{"Arg 0","any"},{"Arg 1","any"}},
     out={{"Out","exec"}},
     meta={isEvent=true}},
    {id="on_joined",name="Player Joined",    cat="Events",
     inp={}, out={{"Out","exec"},{"Player","player"}}},
    {id="on_left",  name="Player Left",      cat="Events",
     inp={}, out={{"Out","exec"},{"Player","player"}}},
    {id="on_init",  name="On Init",          cat="Events",
     inp={}, out={{"Out","exec"}}},
    {id="on_update",name="On Update",        cat="Events",
     inp={}, out={{"Out","exec"},{"Delta","float"}}},
    -- Player
    {id="pl_local", name="Get Local Player", cat="Player",
     inp={}, out={{"Player","player"}}},
    {id="pl_all",   name="Get All Players",  cat="Player",
     inp={}, out={{"Players","list"},{"Count","int"}}},
    {id="pl_name",  name="Get Name",         cat="Player",
     inp={{"Player","player"}}, out={{"Name","string"}}},
    {id="pl_pos",   name="Get Position",     cat="Player",
     inp={{"Player","player"}}, out={{"Position","vector3"}}},
    {id="pl_teleport",name="Teleport",       cat="Player",
     inp={{"Run","exec"},{"Player","player"},{"Position","vector3"}},
     out={{"Out","exec"}}},
    {id="pl_kill",  name="Kill Player",      cat="Player",
     inp={{"Run","exec"},{"Player","player"}},
     out={{"Out","exec"}}},
    {id="pl_ishost",name="Is Room Host",     cat="Player",
     inp={{"Player","player"}}, out={{"Result","bool"}}},
    -- Volumes (scene objects)
    {id="s_button", name="Button",           cat="Volumes",
     inp={{"Object","object"}}, out={{"Pressed","exec"},{"Player","player"}},
     meta={isScene=true, sceneType="button",
           sDef={pos="0,1,0",size="4,2,4",color="0066FF",text="Button",maxDist="32"}}},
    {id="s_toggle", name="Toggle Button",    cat="Volumes",
     inp={{"Object","object"}}, out={{"On","exec"},{"Off","exec"},{"Player","player"}},
     meta={isScene=true, sceneType="toggle",
           sDef={pos="0,1,0",size="4,2,4",color="FF8800",text="Toggle",maxDist="32"}}},
    {id="s_trigger",name="Trigger Volume",   cat="Volumes",
     inp={{"Volume","object"}}, out={{"Enter","exec"},{"Exit","exec"},{"Player","player"}},
     meta={isScene=true, sceneType="trigger",
           sDef={pos="0,4,0",size="10,8,10",color="FF6600",opacity="0.7"}}},
    {id="s_interact",name="Interaction Volume",cat="Volumes",
     inp={{"Volume","object"}}, out={{"Interact","exec"},{"Player","player"}},
     meta={isScene=true, sceneType="interact",
           sDef={pos="0,2,0",size="6,4,6",color="00CCFF",promptText="Interact",maxDist="8"}}},
    -- UI
    {id="ui_notify",name="Show Notification",cat="UI",
     inp={{"Run","exec"},{"Player","player"},{"Message","string",""},{"Duration","float",3}},
     out={{"Out","exec"}}},
    {id="ui_subtitle",name="Show Subtitle",  cat="UI",
     inp={{"Run","exec"},{"Player","player"},{"Text","string",""},{"Duration","float",3}},
     out={{"Out","exec"}}},
    {id="ui_settext",name="Set Text",        cat="UI",
     inp={{"Run","exec"},{"Object","object"},{"Text","string",""}},
     out={{"Out","exec"}}},
    {id="s_uibtn",  name="UI Button",        cat="UI",
     inp={{"Object","object"}}, out={{"Clicked","exec"},{"Player","player"}},
     meta={isScene=true, sceneType="ui_button",
           sDef={text="Button",size="200,50",pos="0.5,-100,0.9,0",bgColor="0066FF"}}},
    -- Objects
    {id="obj_getpos",name="Get Position",    cat="Objects",
     inp={{"Object","object"}}, out={{"Position","vector3"}}},
    {id="obj_setpos",name="Set Position",    cat="Objects",
     inp={{"Run","exec"},{"Object","object"},{"Position","vector3"}},
     out={{"Out","exec"}}},
    {id="obj_destroy",name="Destroy",        cat="Objects",
     inp={{"Run","exec"},{"Object","object"}},
     out={{"Out","exec"}}},
    -- Combatant
    {id="cmb_hp",   name="Get Health",       cat="Combatant",
     inp={{"Combatant","object"}}, out={{"Health","float"},{"Max","float"}}},
    {id="cmb_sethp",name="Set Health",       cat="Combatant",
     inp={{"Run","exec"},{"Combatant","object"},{"HP","float",100}},
     out={{"Out","exec"}}},
    {id="cmb_dmg",  name="Deal Damage",      cat="Combatant",
     inp={{"Run","exec"},{"Combatant","object"},{"Damage","float",10}},
     out={{"Out","exec"},{"Died","exec"}}},
    {id="cmb_alive",name="Is Alive",         cat="Combatant",
     inp={{"Combatant","object"}}, out={{"Alive","bool"}}},
    -- Conversion
    {id="to_str",   name="To String",        cat="Conversion",
     inp={{"Value","any"}}, out={{"Result","string"}}},
    {id="to_int",   name="Parse Int",        cat="Conversion",
     inp={{"Value","string","0"}}, out={{"Result","int"},{"OK","bool"}}},
    {id="v3_make",  name="Vector3 Make",     cat="Conversion",
     inp={{"X","float",0},{"Y","float",0},{"Z","float",0}},
     out={{"Vector3","vector3"}}},
    {id="v3_split", name="Vector3 Split",    cat="Conversion",
     inp={{"Vector3","vector3"}}, out={{"X","float"},{"Y","float"},{"Z","float"}}},
    -- Debug
    {id="print",    name="Print",            cat="Debug",
     inp={{"Run","exec"},{"Value","any"}}, out={{"Out","exec"}}},
    {id="warn",     name="Warn",             cat="Debug",
     inp={{"Run","exec"},{"Message","string",""}}, out={{"Out","exec"}}},
}

-- Build lookup map
local CHIP_MAP = {}
for _, ch in ipairs(CHIPS) do CHIP_MAP[ch.id] = ch end

-- ── Create DockWidget ─────────────────────────────────────────────────────────
local wi = DockWidgetPluginGuiInfo.new(
    Enum.InitialDockState.Float, false, false, 1100, 700, 800, 500)
local widget = plugin:CreateDockWidgetPluginGui("RRCircuitsEditorV2", wi)
widget.Title = "RR Circuits"

openBtn.Click:Connect(function()
    widget.Enabled = not widget.Enabled
end)

-- ── UI helpers ────────────────────────────────────────────────────────────────
local function mk(class, parent, props)
    local el = Instance.new(class)
    if props then for k,v in pairs(props) do el[k] = v end end
    el.Parent = parent
    return el
end

local function frm(parent, sx,sy, px,py, col)
    local f = mk("Frame", parent, {
        Size = UDim2.new(0,sx,0,sy),
        Position = UDim2.new(0,px,0,py),
        BackgroundColor3 = col or BG,
        BorderSizePixel = 0,
    })
    return f
end

local function pct(parent, sw,sh, pw,ph, col)
    local f = mk("Frame", parent, {
        Size = UDim2.new(sw,sh,pw,ph),
        BackgroundColor3 = col or BG,
        BorderSizePixel = 0,
    })
    return f
end

local function lbl(parent, txt, sx,sy, px,py, col, tsz, font, xa)
    local l = mk("TextLabel", parent, {
        Size = UDim2.new(sx or 1, 0, sy or 1, 0),
        Position = UDim2.new(px or 0, 0, py or 0, 0),
        BackgroundTransparency = 1,
        Text = txt or "",
        TextColor3 = col or TEXT,
        Font = font or Enum.Font.GothamBold,
        TextSize = tsz or 12,
        TextXAlignment = xa or Enum.TextXAlignment.Left,
        TextTruncate = Enum.TextTruncate.AtEnd,
    })
    return l
end

local function btn(parent, txt, sx,sy, px,py, col, tsz)
    local b = mk("TextButton", parent, {
        Size = UDim2.new(0,sx,0,sy),
        Position = UDim2.new(0,px,0,py),
        BackgroundColor3 = col or BG2,
        BorderSizePixel = 0,
        Text = txt,
        TextColor3 = WHITE,
        Font = Enum.Font.GothamBold,
        TextSize = tsz or 11,
    })
    mk("UICorner", b, {CornerRadius = UDim.new(0,5)})
    return b
end

local function corner(parent, r)
    mk("UICorner", parent, {CornerRadius = UDim.new(0, r or 6)})
end

local function stroke(parent, col, thick)
    mk("UIStroke", parent, {Color = col or BORD, Thickness = thick or 1})
end

local function vlist(parent, pad)
    mk("UIListLayout", parent, {
        FillDirection = Enum.FillDirection.Vertical,
        SortOrder = Enum.SortOrder.LayoutOrder,
        Padding = UDim.new(0, pad or 0),
    })
end

-- ── Main layout ───────────────────────────────────────────────────────────────
local root = pct(widget, 1,0, 1,0, BG)
root.ClipsDescendants = true

-- Header bar
local header = pct(root, 1,0, 0,44, Color3.fromRGB(5,12,24))
lbl(header, "⚡ RR Circuits", 0,140, 0,0, Color3.fromRGB(255,140,0), 14)
    .Position = UDim2.new(0,10,0,0)

local hbtns = {
    save     = btn(header, "💾 Save",      96,28, 155,8, Color3.fromRGB(12,44,22), 11),
    load     = btn(header, "📂 Load",      96,28, 257,8, BG2, 11),
    simulate = btn(header, "▶ Simulate",  100,28, 359,8, Color3.fromRGB(36,18,0), 11),
    export   = btn(header, "⬆ Export",    96,28,  465,8, Color3.fromRGB(22,12,40), 11),
    scene    = btn(header, "🏗 To Scene",  96,28,  567,8, Color3.fromRGB(5,32,32), 11),
    clear    = btn(header, "🗑 Clear",      80,28,  669,8, Color3.fromRGB(36,10,10), 11),
}

-- Body
local body = pct(root, 1,0, 0,0, BG)
body.Position = UDim2.new(0,0,0,44)
body.Size     = UDim2.new(1,0,1,-66)

-- Sidebar (220px wide)
local SW = 220
local sidebar = frm(body, SW, 0, 0, 0, PANEL)
sidebar.Size = UDim2.new(0,SW,1,0)

-- Search box
local searchHolder = frm(sidebar, SW, 36, 0, 0, Color3.fromRGB(6,14,26))
local searchBox = mk("TextBox", searchHolder, {
    Size = UDim2.new(1,-16,0,28),
    Position = UDim2.new(0,8,0,4),
    BackgroundColor3 = BG2,
    BorderSizePixel = 0,
    Text = "",
    PlaceholderText = "🔍  Search chips...",
    TextColor3 = TEXT,
    PlaceholderColor3 = TEXT3,
    Font = Enum.Font.Gotham,
    TextSize = 11,
    ClearTextOnFocus = false,
})
corner(searchBox, 5)

-- Chip scroll list
local chipScroll = mk("ScrollingFrame", sidebar, {
    Size = UDim2.new(1,0,1,-36),
    Position = UDim2.new(0,0,0,36),
    BackgroundTransparency = 1,
    BorderSizePixel = 0,
    ScrollBarThickness = 4,
    ScrollBarImageColor3 = BORD,
    CanvasSize = UDim2.new(0,0,0,0),
    AutomaticCanvasSize = Enum.AutomaticSize.Y,
})
vlist(chipScroll, 1)

-- Canvas area
local canvasFrame = frm(body, 0, 0, SW, 0, Color3.fromRGB(10,18,32))
canvasFrame.Size = UDim2.new(1,-SW, 1, 0)
canvasFrame.Position = UDim2.new(0,SW,0,0)
canvasFrame.ClipsDescendants = true

-- Pan container (chips live here)
local container = frm(canvasFrame, 8000, 8000, -2000, -2000, Color3.new(0,0,0))
container.BackgroundTransparency = 1

-- Wire layer (under chips)
local wireLayer = pct(container, 1,0, 1,0, Color3.new(0,0,0))
wireLayer.BackgroundTransparency = 1
wireLayer.ZIndex = 2

-- Chip layer (over wires)
local chipLayer = pct(container, 1,0, 1,0, Color3.new(0,0,0))
chipLayer.BackgroundTransparency = 1
chipLayer.ZIndex = 3

-- Empty canvas hint (hidden once chips are placed)
local canvasHint = Instance.new("TextLabel")
canvasHint.Size = UDim2.new(0,340,0,80)
canvasHint.Position = UDim2.new(0.5,-170,0.5,-40)
canvasHint.BackgroundTransparency = 1
canvasHint.Text = "← Click any chip in the sidebar to add it\n\nMiddle-click drag to pan  •  Scroll to zoom\nClick a port → click another port to wire"
canvasHint.TextColor3 = Color3.fromRGB(40,70,110)
canvasHint.Font = Enum.Font.Gotham
canvasHint.TextSize = 13
canvasHint.TextXAlignment = Enum.TextXAlignment.Center
canvasHint.TextWrapped = true
canvasHint.ZIndex = 1
canvasHint.Parent = canvasFrame

-- Status bar
local statusBar = frm(body, 0, 22, SW, 0, Color3.fromRGB(5,12,24))
statusBar.Size = UDim2.new(1,-SW, 0, 22)
statusBar.Position = UDim2.new(0,SW, 1, -22)
statusBar.ZIndex = 10
local statusLbl = lbl(statusBar, "  Ready — click chips to place • click port to start wire • click port to complete",
    1,0, 0,0, TEXT3, 10, Enum.Font.Gotham)
local zoomLbl = lbl(statusBar, "100%", 0,60, 1,0, TEXT2, 10, Enum.Font.GothamBold, Enum.TextXAlignment.Center)
zoomLbl.Position = UDim2.new(1,-62,0,0)

-- ── Canvas state ──────────────────────────────────────────────────────────────
local S = {
    nodes = {},
    wires = {},
    nextId = 1,
    panX = 0, panY = 0,
    scale = 1,
    simMode = false,
    simVars = {},
    undoStack = {},
    redoStack = {},
}

local wireStart = nil  -- { nodeId, portIdx, isOutput, portEl, portType }
local isPanning = false
local panSX, panSY, panSCX, panSCY = 0, 0, 0, 0

local function newId()
    local id = "n"..S.nextId; S.nextId = S.nextId + 1; return id
end
local function wId()
    local id = "w"..S.nextId; S.nextId = S.nextId + 1; return id
end
local function portColor(t)
    return PORT_COL[t] or PORT_COL.any
end
local function compat(a, b)
    if a=="any" or b=="any" then return true end
    if (a=="int" or a=="float" or a=="number") and
       (b=="int" or b=="float" or b=="number") then return true end
    return a == b
end
local function setStatus(msg)
    statusLbl.Text = "  "..tostring(msg)
end

-- ── Wire rendering ─────────────────────────────────────────────────────────────
-- Chips are positioned in container space (offset 2000,2000 from canvasFrame)
-- We store x,y in container coords (relative to container top-left)

local CHIP_W = 186
local HDR_H  = 26
local ROW_H  = 22
local PORT_SZ = 11

local function getPortContainerPos(nodeId, portIdx, isOutput)
    local node = S.nodes[nodeId]; if not node then return nil, nil end
    local def  = CHIP_MAP[node.chipId]; if not def then return nil, nil end
    local el   = chipLayer:FindFirstChild("chip_"..nodeId); if not el then return nil, nil end

    local cx = el.Position.X.Offset
    local cy = el.Position.Y.Offset
    local cw = el.Size.X.Offset

    local meta = def.meta or {}
    local extraH = 0
    if meta.isVariable then extraH = extraH + 48 end
    if meta.isEvent    then extraH = extraH + 48 end
    if meta.isScene    then extraH = extraH + 24 end
    local baseY = cy + HDR_H + extraH + 4

    local idx = portIdx + 1
    local portY = baseY + (idx - 1) * ROW_H + ROW_H / 2

    if isOutput then
        return cx + cw + 1, portY
    else
        return cx - 1, portY
    end
end

local function makeWireLine(x1, y1, x2, y2, col)
    local dx = x2 - x1
    local dy = y2 - y1
    local len = math.sqrt(dx*dx + dy*dy)
    if len < 2 then return nil end
    local angle = math.deg(math.atan2(dy, dx))
    local wf = mk("Frame", wireLayer, {
        Size = UDim2.new(0, len, 0, 2.5),
        Position = UDim2.new(0, x1, 0, y1),
        Rotation = angle,
        AnchorPoint = Vector2.new(0, 0.5),
        BackgroundColor3 = col,
        BorderSizePixel = 0,
        ZIndex = 2,
    })
    return wf
end

local function redrawWire(w)
    if w.el and w.el.Parent then w.el:Destroy(); w.el = nil end
    local x1,y1 = getPortContainerPos(w.fromNode, w.fromPort, true)
    local x2,y2 = getPortContainerPos(w.toNode,   w.toPort,   false)
    if not x1 or not x2 then return end
    local col = portColor(w.type)
    w.el = makeWireLine(x1,y1, x2,y2, col)
    if w.el then
        w.el.Name = "wire_"..w.id
        -- Click-through button for deletion
        local db = mk("TextButton", w.el, {
            Size = UDim2.new(1,0,1,12),
            Position = UDim2.new(0,0,0,-5),
            BackgroundTransparency = 1,
            Text = "",
            ZIndex = w.el.ZIndex + 1,
        })
        db.MouseButton1Click:Connect(function()
            if S.simMode then return end
            if w.el and w.el.Parent then w.el:Destroy() end
            for i = #S.wires, 1, -1 do
                if S.wires[i].id == w.id then
                    table.remove(S.wires, i); break
                end
            end
            setStatus("Wire deleted (click to delete wires)")
        end)
    end
end

local function redrawAllWires()
    for _, w in ipairs(S.wires) do
        pcall(redrawWire, w)
    end
end

-- ── Undo ──────────────────────────────────────────────────────────────────────
local function snapshot()
    local snap = {nodes={}, wires={}, nextId=S.nextId}
    for id, nd in pairs(S.nodes) do
        local copy = {}
        for k,v in pairs(nd) do
            if type(v) == "table" then
                local t2 = {}
                for k2,v2 in pairs(v) do t2[k2]=v2 end
                copy[k] = t2
            else
                copy[k] = v
            end
        end
        snap.nodes[id] = copy
    end
    for _, w in ipairs(S.wires) do
        table.insert(snap.wires, {
            id=w.id, fromNode=w.fromNode, fromPort=w.fromPort,
            toNode=w.toNode, toPort=w.toPort, type=w.type
        })
    end
    return snap
end

local function pushUndo()
    table.insert(S.undoStack, snapshot())
    if #S.undoStack > 40 then table.remove(S.undoStack, 1) end
    S.redoStack = {}
end

local function restoreSnapshot(snap)
    for _, ch in ipairs(chipLayer:GetChildren()) do ch:Destroy() end
    for _, wf in ipairs(wireLayer:GetChildren()) do wf:Destroy() end
    S.nodes = {}; S.wires = {}; S.nextId = snap.nextId or 1
    for id, nd in pairs(snap.nodes) do
        S.nodes[id] = nd
        pcall(renderChip, nd)
    end
    for _, w in ipairs(snap.wires) do
        table.insert(S.wires, w)
    end
    task.delay(0.05, redrawAllWires)
end

-- ── Chip rendering ────────────────────────────────────────────────────────────
function renderChip(node)
    local def = CHIP_MAP[node.chipId]; if not def then return end
    local meta = def.meta or {}
    local catCol = CAT_COL[def.cat] or TEXT2

    local numIn  = #def.inp
    local numOut = #def.out
    local rows   = math.max(numIn, numOut)
    local extraH = 0
    if meta.isVariable then extraH = extraH + 48 end
    if meta.isEvent    then extraH = extraH + 48 end
    if meta.isScene    then extraH = extraH + 24 end
    local totalH = HDR_H + extraH + rows * ROW_H + 8

    -- Main frame
    local chipEl = mk("Frame", chipLayer, {
        Name = "chip_"..node.id,
        Size = UDim2.new(0, CHIP_W, 0, totalH),
        Position = UDim2.new(0, node.x, 0, node.y),
        BackgroundColor3 = CHIP,
        BorderSizePixel = 0,
        ZIndex = 4,
    })
    corner(chipEl, 6)
    stroke(chipEl, BORD, 1.5)

    -- Colour bar (left edge)
    local cbar = mk("Frame", chipEl, {
        Size = UDim2.new(0,3,1,-12),
        Position = UDim2.new(0,0,0,6),
        BackgroundColor3 = catCol,
        BorderSizePixel = 0,
        ZIndex = 5,
    })
    corner(cbar, 2)

    -- Header
    local hdr = mk("Frame", chipEl, {
        Size = UDim2.new(1,0,0,HDR_H),
        BackgroundColor3 = CHIPH,
        BorderSizePixel = 0,
        ZIndex = 5,
    })
    corner(hdr, 6)
    -- Cover bottom corners of header
    mk("Frame", chipEl, {
        Size = UDim2.new(1,0,0,6),
        Position = UDim2.new(0,0,0,HDR_H-6),
        BackgroundColor3 = CHIPH,
        BorderSizePixel = 0,
        ZIndex = 5,
    })
    lbl(hdr, def.name, 1,-24, 0,0, TEXT, 12, Enum.Font.GothamBold)
        .Position = UDim2.new(0,12,0,0)

    -- Drag via header
    local dragging = false
    local dSX, dSY, dNX, dNY = 0, 0, 0, 0
    local connM, connE

    hdr.InputBegan:Connect(function(inp)
        if inp.UserInputType ~= Enum.UserInputType.MouseButton1 then return end
        if wireStart then return end
        if S.simMode then return end
        pushUndo()
        dragging = true
        dSX = inp.Position.X; dSY = inp.Position.Y
        dNX = node.x;         dNY = node.y
        chipEl.ZIndex = 10

        connM = UIS.InputChanged:Connect(function(i2)
            if not dragging then return end
            if i2.UserInputType ~= Enum.UserInputType.MouseMovement then return end
            node.x = dNX + (i2.Position.X - dSX) / S.scale
            node.y = dNY + (i2.Position.Y - dSY) / S.scale
            chipEl.Position = UDim2.new(0, node.x, 0, node.y)
            redrawAllWires()
        end)

        connE = UIS.InputEnded:Connect(function(i2)
            if i2.UserInputType ~= Enum.UserInputType.MouseButton1 then return end
            dragging = false; chipEl.ZIndex = 4
            if connM then connM:Disconnect() end
            if connE then connE:Disconnect() end
        end)
    end)

    -- Right-click to delete
    chipEl.InputBegan:Connect(function(inp)
        if inp.UserInputType == Enum.UserInputType.MouseButton2 then
            pushUndo(); deleteNode(node.id)
        end
    end)

    local yOff = HDR_H

    -- Variable name + scope
    if meta.isVariable then
        if not node.varName  then node.varName  = "MyVar" end
        if not node.varScope then node.varScope = "Local" end

        local vrow = mk("Frame", chipEl, {
            Size = UDim2.new(1,-8,0,20),
            Position = UDim2.new(0,4,0,yOff+2),
            BackgroundColor3 = Color3.fromRGB(5,12,24),
            BorderSizePixel = 0,
            ZIndex = 5,
        })
        corner(vrow, 3)
        lbl(vrow, "✎", 0,14, 0,0, TEXT3, 10).Position = UDim2.new(0,3,0,0)
        local vi = mk("TextBox", vrow, {
            Size = UDim2.new(1,-18,1,-2),
            Position = UDim2.new(0,16,0,1),
            BackgroundTransparency = 1,
            Text = node.varName,
            TextColor3 = TEXT,
            Font = Enum.Font.GothamBold,
            TextSize = 11,
            ZIndex = 6,
            ClearTextOnFocus = false,
        })
        vi.FocusLost:Connect(function()
            if vi.Text ~= "" then node.varName = vi.Text:gsub("[^%w_]","") end
            vi.Text = node.varName
        end)

        local scopes = {"Local", "Cloud", "30Hz"}
        local si = 1
        for idx, sc in ipairs(scopes) do if sc == node.varScope then si = idx end end
        local scopeBtn = btn(chipEl, node.varScope, CHIP_W-8, 16, 4, yOff+24,
            Color3.fromRGB(6,16,32), 9)
        scopeBtn.ZIndex = 6
        scopeBtn.MouseButton1Click:Connect(function()
            si = (si % #scopes) + 1
            node.varScope = scopes[si]; scopeBtn.Text = scopes[si]
        end)
        yOff = yOff + 48
    end

    -- Event name + scope
    if meta.isEvent then
        if not node.evtName  then node.evtName  = "MyEvent" end
        if not node.evtScope then node.evtScope = "Local" end

        local erow = mk("Frame", chipEl, {
            Size = UDim2.new(1,-8,0,20),
            Position = UDim2.new(0,4,0,yOff+2),
            BackgroundColor3 = Color3.fromRGB(5,12,24),
            BorderSizePixel = 0, ZIndex = 5,
        })
        corner(erow, 3)
        lbl(erow, "◉", 0,14, 0,0, Color3.fromRGB(255,68,85), 10).Position = UDim2.new(0,3,0,0)
        local ei = mk("TextBox", erow, {
            Size = UDim2.new(1,-18,1,-2),
            Position = UDim2.new(0,16,0,1),
            BackgroundTransparency = 1,
            Text = node.evtName, TextColor3 = TEXT,
            Font = Enum.Font.GothamBold, TextSize = 11, ZIndex = 6,
            ClearTextOnFocus = false,
        })
        ei.FocusLost:Connect(function()
            if ei.Text ~= "" then node.evtName = ei.Text end
        end)

        local escopes = {"Local", "Everyone"}
        local esi = 1
        for idx, sc in ipairs(escopes) do if sc == node.evtScope then esi = idx end end
        local escBtn = btn(chipEl, node.evtScope, CHIP_W-8, 16, 4, yOff+24,
            Color3.fromRGB(6,16,32), 9)
        escBtn.ZIndex = 6
        escBtn.MouseButton1Click:Connect(function()
            esi = (esi % #escopes) + 1
            node.evtScope = escopes[esi]; escBtn.Text = escopes[esi]
        end)
        yOff = yOff + 48
    end

    -- Scene object name
    if meta.isScene then
        if not node.sceneName   then node.sceneName   = def.id.."_1" end
        if not node.sceneCfg    then
            node.sceneCfg = {}
            if meta.sDef then
                for k,v in pairs(meta.sDef) do node.sceneCfg[k] = v end
            end
        end
        local srow = mk("Frame", chipEl, {
            Size = UDim2.new(1,-8,0,20),
            Position = UDim2.new(0,4,0,yOff+2),
            BackgroundColor3 = Color3.fromRGB(5,12,24),
            BorderSizePixel = 0, ZIndex = 5,
        })
        corner(srow, 3)
        lbl(srow, "📍", 0,14, 0,0, Color3.fromRGB(68,221,136), 10).Position = UDim2.new(0,3,0,0)
        local si2 = mk("TextBox", srow, {
            Size = UDim2.new(1,-18,1,-2),
            Position = UDim2.new(0,16,0,1),
            BackgroundTransparency = 1,
            Text = node.sceneName, TextColor3 = Color3.fromRGB(68,221,136),
            Font = Enum.Font.GothamBold, TextSize = 11, ZIndex = 6,
            ClearTextOnFocus = false,
        })
        si2.FocusLost:Connect(function()
            if si2.Text ~= "" then node.sceneName = si2.Text:gsub("[^%w_]","") end
            si2.Text = node.sceneName
        end)
        yOff = yOff + 24
    end

    -- Port rows
    for row = 1, math.max(numIn, numOut) do
        local ry = yOff + (row-1)*ROW_H + 4

        -- Input port
        if row <= numIn then
            local pd    = def.inp[row]
            local pname = pd[1]; local ptype = pd[2]; local pdef = pd[3]
            local pcol  = portColor(ptype)

            local dot = mk("Frame", chipEl, {
                Name = "ip_"..node.id.."_"..(row-1),
                Size = UDim2.new(0,PORT_SZ,0,PORT_SZ),
                Position = UDim2.new(0,-PORT_SZ/2-1, 0, ry+5),
                BackgroundColor3 = pcol,
                BorderSizePixel = 0,
                ZIndex = 7,
            })
            if ptype == "exec" then dot.Rotation = 45; corner(dot, 0) else corner(dot, PORT_SZ/2) end
            mk("Frame", dot, {
                Size = UDim2.new(0,5,0,5),
                Position = UDim2.new(0.5,-2.5,0.5,-2.5),
                BackgroundColor3 = CHIP,
                BorderSizePixel = 0,
                ZIndex = 8,
            }).AnchorPoint = Vector2.new(0.5,0.5)

            lbl(chipEl, pname, 0, CHIP_W/2-14, 0, ry, TEXT2, 10, Enum.Font.Gotham)
                .Position = UDim2.new(0,10,0,ry)

            -- Default value widgets
            if ptype == "bool" and pdef ~= nil then
                local curVal = pdef
                local bBtn = btn(chipEl, curVal and "TRUE" or "FALSE", 46, 14,
                    CHIP_W/2+4, ry+4,
                    curVal and Color3.fromRGB(8,36,16) or Color3.fromRGB(36,8,10), 9)
                bBtn.TextColor3 = curVal and Color3.fromRGB(68,221,136) or Color3.fromRGB(255,68,85)
                bBtn.ZIndex = 6
                bBtn.MouseButton1Click:Connect(function()
                    curVal = not curVal
                    if not node.defaults then node.defaults = {} end
                    node.defaults["i"..(row-1)] = curVal
                    bBtn.Text = curVal and "TRUE" or "FALSE"
                    bBtn.BackgroundColor3 = curVal and Color3.fromRGB(8,36,16) or Color3.fromRGB(36,8,10)
                    bBtn.TextColor3 = curVal and Color3.fromRGB(68,221,136) or Color3.fromRGB(255,68,85)
                end)
            elseif (ptype == "number" or ptype == "int" or ptype == "float") and pdef ~= nil then
                local tb = mk("TextBox", chipEl, {
                    Size = UDim2.new(0,50,0,14),
                    Position = UDim2.new(0,CHIP_W/2+4,0,ry+4),
                    BackgroundColor3 = Color3.fromRGB(5,12,24),
                    BorderSizePixel = 0,
                    Text = tostring(pdef),
                    TextColor3 = TEXT, Font = Enum.Font.Gotham,
                    TextSize = 10, ZIndex = 6,
                    ClearTextOnFocus = false,
                })
                corner(tb, 3)
                tb.FocusLost:Connect(function()
                    if not node.defaults then node.defaults = {} end
                    node.defaults["i"..(row-1)] = tonumber(tb.Text) or pdef
                end)
            elseif ptype == "string" and pdef ~= nil then
                local tb = mk("TextBox", chipEl, {
                    Size = UDim2.new(0,56,0,14),
                    Position = UDim2.new(0,CHIP_W/2+4,0,ry+4),
                    BackgroundColor3 = Color3.fromRGB(5,12,24),
                    BorderSizePixel = 0,
                    Text = tostring(pdef),
                    TextColor3 = Color3.fromRGB(68,221,136),
                    Font = Enum.Font.Gotham, TextSize = 10, ZIndex = 6,
                    ClearTextOnFocus = false,
                })
                corner(tb, 3)
                tb.FocusLost:Connect(function()
                    if not node.defaults then node.defaults = {} end
                    node.defaults["i"..(row-1)] = tb.Text
                end)
            end

            -- Port click: start or complete wire
            dot.InputBegan:Connect(function(inp)
                if inp.UserInputType ~= Enum.UserInputType.MouseButton1 then return end
                if wireStart and wireStart.isOutput then
                    if compat(wireStart.portType, ptype) then
                        pushUndo()
                        if ptype ~= "exec" then
                            for i = #S.wires, 1, -1 do
                                local ww = S.wires[i]
                                if ww.toNode == node.id and ww.toPort == row-1 then
                                    if ww.el and ww.el.Parent then ww.el:Destroy() end
                                    table.remove(S.wires, i)
                                end
                            end
                        end
                        local w = {
                            id = wId(),
                            fromNode = wireStart.nodeId, fromPort = wireStart.portIdx,
                            toNode   = node.id,          toPort   = row - 1,
                            type     = wireStart.portType == "any" and ptype or wireStart.portType,
                        }
                        table.insert(S.wires, w)
                        redrawWire(w)
                        wireStart = nil
                        setStatus("✓ Connected "..w.type.." wire  |  right-click to cancel")
                    else
                        wireStart = nil
                        setStatus("✗ Incompatible types: "..wireStart.portType.." → "..ptype)
                    end
                elseif not S.simMode then
                    wireStart = {nodeId=node.id, portIdx=row-1, isOutput=false, portEl=dot, portType=ptype}
                    setStatus("Wire started from input — click an output port")
                end
            end)
        end

        -- Output port
        if row <= numOut then
            local pd    = def.out[row]
            local pname = pd[1]; local ptype = pd[2]
            local pcol  = portColor(ptype)

            local dot = mk("Frame", chipEl, {
                Name = "op_"..node.id.."_"..(row-1),
                Size = UDim2.new(0,PORT_SZ,0,PORT_SZ),
                Position = UDim2.new(1,-PORT_SZ/2+1, 0, ry+5),
                BackgroundColor3 = pcol,
                BorderSizePixel = 0,
                ZIndex = 7,
            })
            if ptype == "exec" then dot.Rotation = 45; corner(dot, 0) else corner(dot, PORT_SZ/2) end

            local rl = lbl(chipEl, pname, 0, CHIP_W/2-14, 0.5, ry,
                TEXT2, 10, Enum.Font.Gotham, Enum.TextXAlignment.Right)
            rl.Position = UDim2.new(0.5,4,0,ry)

            dot.InputBegan:Connect(function(inp)
                if inp.UserInputType ~= Enum.UserInputType.MouseButton1 then return end
                -- Simulate mode: fire exec
                if S.simMode and ptype == "exec" then
                    task.spawn(simFire, node.id, row-1, 0)
                    return
                end
                if wireStart and not wireStart.isOutput then
                    if compat(ptype, wireStart.portType) then
                        pushUndo()
                        local w = {
                            id       = wId(),
                            fromNode = node.id,          fromPort = row-1,
                            toNode   = wireStart.nodeId, toPort   = wireStart.portIdx,
                            type     = ptype,
                        }
                        table.insert(S.wires, w)
                        redrawWire(w)
                        wireStart = nil
                        setStatus("✓ Connected "..ptype.." wire")
                    else
                        wireStart = nil
                        setStatus("✗ Incompatible types")
                    end
                elseif not S.simMode then
                    wireStart = {nodeId=node.id, portIdx=row-1, isOutput=true, portEl=dot, portType=ptype}
                    setStatus("Wire started — click an input port  |  right-click canvas to cancel")
                end
            end)
        end
    end
end

-- ── Node management ───────────────────────────────────────────────────────────
local function addNode(chipId, x, y)
    local def = CHIP_MAP[chipId]; if not def then return end
    local id  = newId()
    local nd  = { id=id, chipId=chipId, x=x or 300, y=y or 200 }
    S.nodes[id] = nd
    renderChip(nd)
    canvasHint.Visible = false  -- hide hint once first chip placed
    return nd
end

function deleteNode(nodeId)
    for i = #S.wires, 1, -1 do
        local w = S.wires[i]
        if w.fromNode == nodeId or w.toNode == nodeId then
            if w.el and w.el.Parent then w.el:Destroy() end
            table.remove(S.wires, i)
        end
    end
    local el = chipLayer:FindFirstChild("chip_"..nodeId)
    if el and el.Parent then el:Destroy() end
    S.nodes[nodeId] = nil
    setStatus("Chip deleted")
end

-- ── Simulation ────────────────────────────────────────────────────────────────
function simFire(nodeId, outPortIdx, depth)
    if depth > 25 then return end
    local el = chipLayer:FindFirstChild("chip_"..nodeId)
    if el then
        local oc = el.BackgroundColor3
        el.BackgroundColor3 = Color3.fromRGB(80,140,40)
        task.delay(0.5, function() if el and el.Parent then el.BackgroundColor3 = oc end end)
    end
    for _, w in ipairs(S.wires) do
        if w.fromNode == nodeId and w.fromPort == outPortIdx and w.type == "exec" then
            if w.el and w.el.Parent then
                local wc = w.el.BackgroundColor3
                w.el.BackgroundColor3 = WHITE
                task.delay(0.3, function() if w.el and w.el.Parent then w.el.BackgroundColor3 = wc end end)
            end
            task.delay(0.25, function() simExecute(w.toNode, depth+1) end)
        end
    end
end

function simExecute(nodeId, depth)
    local node = S.nodes[nodeId]; if not node then return end
    local def  = CHIP_MAP[node.chipId]; if not def then return end

    local function getInputVal(i)
        for _, w in ipairs(S.wires) do
            if w.toNode == nodeId and w.toPort == i and w.type ~= "exec" then
                return S.simVars["__p_"..w.fromNode.."_"..w.fromPort] or 0
            end
        end
        local pd = def.inp[i+1]
        if node.defaults and node.defaults["i"..i] ~= nil then return node.defaults["i"..i] end
        return pd and pd[3] or 0
    end
    local function setOut(i, v) S.simVars["__p_"..nodeId.."_"..i] = v end

    local id = node.chipId
    if     id=="add"      then setOut(0, getInputVal(0) + getInputVal(1))
    elseif id=="subtract" then setOut(0, getInputVal(0) - getInputVal(1))
    elseif id=="multiply" then setOut(0, getInputVal(0) * getInputVal(1))
    elseif id=="divide"   then
        local b2 = getInputVal(1)
        setOut(0, b2 ~= 0 and getInputVal(0)/b2 or 0)
    elseif id=="modulo"   then setOut(0, getInputVal(0) % getInputVal(1))
    elseif id=="abs"      then setOut(0, math.abs(getInputVal(0)))
    elseif id=="round"    then setOut(0, math.round(getInputVal(0)))
    elseif id=="floor"    then setOut(0, math.floor(getInputVal(0)))
    elseif id=="ceil"     then setOut(0, math.ceil(getInputVal(0)))
    elseif id=="min"      then setOut(0, math.min(getInputVal(0), getInputVal(1)))
    elseif id=="max"      then setOut(0, math.max(getInputVal(0), getInputVal(1)))
    elseif id=="sqrt"     then setOut(0, math.sqrt(math.abs(getInputVal(0))))
    elseif id=="and"      then setOut(0, getInputVal(0) and getInputVal(1))
    elseif id=="or"       then setOut(0, getInputVal(0) or  getInputVal(1))
    elseif id=="not"      then setOut(0, not getInputVal(0))
    elseif id=="eq"       then setOut(0, getInputVal(0) == getInputVal(1))
    elseif id=="gt"       then setOut(0, getInputVal(0) >  getInputVal(1))
    elseif id=="lt"       then setOut(0, getInputVal(0) <  getInputVal(1))
    elseif id=="print"    then
        print("[RR Sim] "..tostring(getInputVal(1)))
        setStatus("▶ Print: "..tostring(getInputVal(1)))
    elseif id=="rand"     then
        setOut(0, getInputVal(0) + (getInputVal(1)-getInputVal(0))*math.random())
    elseif id=="randint"  then
        local a2, b2 = math.floor(getInputVal(0)), math.floor(getInputVal(1))
        setOut(0, a2 <= b2 and math.random(a2,b2) or a2)
    end

    if id == "branch" then
        if getInputVal(1) then simFire(nodeId,0,depth+1) else simFire(nodeId,1,depth+1) end
        return
    end
    if id == "sequence" then
        for i = 0, 4 do task.delay(i*0.2, function() simFire(nodeId,i,depth+1) end) end
        return
    end
    if id == "delay" then
        local secs = math.min(getInputVal(1), 3)
        setStatus("⏱ Delay "..secs.."s...")
        task.delay(secs, function() simFire(nodeId,0,depth+1) end)
        return
    end

    if def.meta and def.meta.isVariable and node.defaults and node.defaults["i0"] ~= nil then
        -- Set exec (input 0)
        local vn  = node.varName or "v"
        local val = getInputVal(1)
        S.simVars[vn] = val
        setOut(1, val)
        setStatus("► "..vn.." = "..tostring(val))
    end

    if id == "evt_send" then
        local ename = node.evtName or "MyEvent"
        local found = 0
        for rid, rnd in pairs(S.nodes) do
            if rnd.chipId == "evt_recv" and rnd.evtName == ename then
                found = found + 1
                task.delay(0.2, function() simFire(rid, 0, depth+1) end)
            end
        end
        setStatus("📡 Event '"..ename.."' → "..found.." receiver(s)")
    end

    -- Follow all exec outputs
    for pi, port in ipairs(def.out) do
        if port[2] == "exec" then
            task.delay(0.1, function() simFire(nodeId, pi-1, depth+1) end)
        end
    end
end

-- ── Scene object creation ─────────────────────────────────────────────────────
local function hexToC3(h)
    h = tostring(h):gsub("#","")
    if #h < 6 then return Color3.new(0.7,0.7,0.7) end
    return Color3.fromRGB(
        tonumber(h:sub(1,2),16) or 180,
        tonumber(h:sub(3,4),16) or 180,
        tonumber(h:sub(5,6),16) or 180)
end
local function pv(s, dx,dy,dz)
    local t={}
    for v in (tostring(s or "")):gmatch("[%-%.%d]+") do t[#t+1]=tonumber(v) end
    return Vector3.new(t[1] or dx or 0, t[2] or dy or 0, t[3] or dz or 0)
end

local function createSceneObjects()
    local n = 0
    for _, node in pairs(S.nodes) do
        local def = CHIP_MAP[node.chipId]
        if def and def.meta and def.meta.isScene then
            local sn  = node.sceneName or "SceneObj"
            local sc  = node.sceneCfg or {}
            local st  = def.meta.sceneType or "part"
            local col = hexToC3(sc.color or "AAAAAA")

            local ex = workspace:FindFirstChild(sn)
            if ex then ex:Destroy() end

            if st == "button" or st == "toggle" then
                local p = Instance.new("Part")
                p.Name=sn; p.Size=pv(sc.size,4,2,4); p.Position=pv(sc.pos,0,1,0)
                p.Anchored=true; p.Color=col; p.Material=Enum.Material.SmoothPlastic
                p.Parent=workspace
                local sg=Instance.new("SurfaceGui"); sg.Face=Enum.NormalId.Top; sg.Parent=p
                local tl=Instance.new("TextLabel",sg)
                tl.Size=UDim2.new(1,0,1,0); tl.BackgroundTransparency=1
                tl.Text=sc.text or sn; tl.TextColor3=Color3.new(1,1,1)
                tl.Font=Enum.Font.GothamBold; tl.TextScaled=true
                local cd=Instance.new("ClickDetector")
                cd.MaxActivationDistance=tonumber(sc.maxDist) or 32; cd.Parent=p
                n=n+1

            elseif st == "trigger" then
                local p=Instance.new("Part"); p.Name=sn
                p.Size=pv(sc.size,10,8,10); p.Position=pv(sc.pos,0,4,0)
                p.Anchored=true; p.CanCollide=false
                p.Transparency=tonumber(sc.opacity) or 0.7
                p.Color=col; p.Material=Enum.Material.Neon; p.Parent=workspace
                local sel=Instance.new("SelectionBox")
                sel.Adornee=p; sel.Color3=col; sel.LineThickness=0.04; sel.Parent=workspace
                n=n+1

            elseif st == "interact" then
                local p=Instance.new("Part"); p.Name=sn
                p.Size=pv(sc.size,6,4,6); p.Position=pv(sc.pos,0,2,0)
                p.Anchored=true; p.CanCollide=false; p.Transparency=0.6
                p.Color=col; p.Material=Enum.Material.Neon; p.Parent=workspace
                local pp=Instance.new("ProximityPrompt")
                pp.ActionText=sc.promptText or "Interact"
                pp.MaxActivationDistance=tonumber(sc.maxDist) or 8
                pp.RequiresLineOfSight=false; pp.Parent=p
                n=n+1

            elseif st == "ui_button" then
                local guiName = sc.parent or "RRGui"
                local gui = SG:FindFirstChild(guiName)
                if not gui then
                    gui=Instance.new("ScreenGui"); gui.Name=guiName
                    gui.ResetOnSpawn=false; gui.IgnoreGuiInset=true; gui.Parent=SG
                end
                local ex2=gui:FindFirstChild(sn); if ex2 then ex2:Destroy() end
                local sb=Instance.new("TextButton"); sb.Name=sn
                local sw,sh=200,50
                if sc.size then
                    local w2,h2=sc.size:match("([%d]+)[,%s]+([%d]+)")
                    sw=tonumber(w2) or 200; sh=tonumber(h2) or 50
                end
                sb.Size=UDim2.new(0,sw,0,sh)
                sb.BackgroundColor3=hexToC3(sc.bgColor or "0066FF")
                sb.TextColor3=WHITE; sb.Text=sc.text or "Button"
                sb.Font=Enum.Font.GothamBold; sb.TextSize=16; sb.BorderSizePixel=0
                sb.Parent=gui
                Instance.new("UICorner",sb).CornerRadius=UDim.new(0,8)
                n=n+1
            end
        end
    end
    setStatus("🏗 Created "..n.." object(s) in Workspace/StarterGui")
end

-- ── Export ────────────────────────────────────────────────────────────────────
local function exportCircuit()
    local lines = {}
    local function o(s) table.insert(lines, s) end

    o("-- Generated by RR Circuits Studio")
    o("local Players = game:GetService('Players')")
    o("")

    -- Variables
    for _, node in pairs(S.nodes) do
        local def = CHIP_MAP[node.chipId]
        if def and def.meta and def.meta.isVariable then
            local t = def.meta.varType or "any"
            local dv = (t=="int" or t=="float" or t=="number") and "0"
                    or t=="bool" and "false"
                    or t=="string" and '""'
                    or t=="list"  and "{}"
                    or "nil"
            o("local "..(node.varName or "myVar").." = "..dv..
              "  -- "..(node.varScope or "Local"))
        end
    end

    -- Scene references
    for _, node in pairs(S.nodes) do
        local def = CHIP_MAP[node.chipId]
        if def and def.meta and def.meta.isScene then
            local sn = node.sceneName or "SceneObj"
            local st = def.meta.sceneType or ""
            if st ~= "ui_button" then
                o("local "..sn.." = workspace:WaitForChild('"..sn.."', 10)")
                if st == "button" or st == "toggle" then
                    o("local "..sn.."_cd = "..sn.." and "..sn..":WaitForChild('ClickDetector',5)")
                elseif st == "interact" then
                    o("local "..sn.."_pp = "..sn.." and "..sn..":WaitForChild('ProximityPrompt',5)")
                end
            end
        end
    end
    o("")

    -- Entry points (use a helper to avoid goto/continue scoping issues)
    local function emitEntry(node)
        local def = CHIP_MAP[node.chipId]
        if not def then return end
        if def.meta and def.meta.isScene then return end

        local function follow(outPort)
            for _, w in ipairs(S.wires) do
                if w.fromNode == node.id and w.fromPort == outPort and w.type == "exec" then
                    local dn = S.nodes[w.toNode]
                    local dname = dn and CHIP_MAP[dn.chipId] and CHIP_MAP[dn.chipId].name or "?"
                    o("    -- → "..w.toNode.." ("..dname..")")
                end
            end
        end

        if node.chipId == "on_init" then
            o("-- On Init"); o("do"); follow(0); o("end")
        elseif node.chipId == "on_joined" then
            o("Players.PlayerAdded:Connect(function(player)"); follow(0); o("end)")
        elseif node.chipId == "on_left" then
            o("Players.PlayerRemoving:Connect(function(player)"); follow(0); o("end)")
        elseif node.chipId == "on_update" then
            o("game:GetService('RunService').Heartbeat:Connect(function(dt)"); follow(0); o("end)")
        elseif node.chipId == "s_button" then
            local sn = node.sceneName or "btn"
            o("if "..sn.."_cd then")
            o("    "..sn.."_cd.MouseClick:Connect(function(player)")
            follow(0); o("    end)"); o("end")
        elseif node.chipId == "s_trigger" then
            local sn = node.sceneName or "trig"
            o("if "..sn.." then")
            o("    "..sn..".Touched:Connect(function(hit)")
            o("        local player = Players:GetPlayerFromCharacter(hit.Parent)")
            o("        if not player then return end")
            follow(0); o("    end)"); o("end")
        elseif node.chipId == "s_interact" then
            local sn = node.sceneName or "inter"
            o("if "..sn.."_pp then")
            o("    "..sn.."_pp.Triggered:Connect(function(player)")
            follow(0); o("    end)"); o("end")
        end
    end

    for _, node in pairs(S.nodes) do
        emitEntry(node)
    end

    local code = table.concat(lines, "\n")
    -- Insert into ServerScriptService
    local ex = SSS:FindFirstChild("RRCircuit")
    if ex then ex:Destroy() end
    local sc2 = Instance.new("Script")
    sc2.Name="RRCircuit"; sc2.Source=code; sc2.Parent=SSS
    setStatus("⬆ Exported → 'RRCircuit' in ServerScriptService ("..#lines.." lines)")
end

-- ── Pan and zoom ──────────────────────────────────────────────────────────────
local function applyView()
    container.Position = UDim2.new(0, -2000*S.scale + S.panX, 0, -2000*S.scale + S.panY)
    container.Size     = UDim2.new(0, 8000*S.scale, 0, 8000*S.scale)
    zoomLbl.Text       = math.round(S.scale*100).."%"
end

canvasFrame.InputBegan:Connect(function(inp)
    local t = inp.UserInputType
    -- Middle-click or Alt+Left to pan
    if t == Enum.UserInputType.MouseButton3 or
       (t == Enum.UserInputType.MouseButton1 and UIS:IsKeyDown(Enum.KeyCode.LeftAlt)) then
        isPanning = true
        panSX = inp.Position.X; panSY = inp.Position.Y
        panSCX = S.panX;        panSCY = S.panY
    end
    -- Right-click cancels wire
    if t == Enum.UserInputType.MouseButton2 then
        if wireStart then wireStart = nil; setStatus("Wire cancelled") end
    end
end)

UIS.InputChanged:Connect(function(inp)
    if not isPanning then return end
    if inp.UserInputType == Enum.UserInputType.MouseMovement then
        S.panX = panSCX + (inp.Position.X - panSX)
        S.panY = panSCY + (inp.Position.Y - panSY)
        applyView()
    end
end)

UIS.InputEnded:Connect(function(inp)
    if inp.UserInputType == Enum.UserInputType.MouseButton3 or
       inp.UserInputType == Enum.UserInputType.MouseButton1 then
        isPanning = false
    end
end)

canvasFrame.InputChanged:Connect(function(inp)
    if inp.UserInputType == Enum.UserInputType.MouseWheel then
        local f = inp.Position.Z > 0 and 1.12 or 0.88
        S.scale = math.clamp(S.scale * f, 0.15, 4)
        applyView()
    end
end)

-- ── Header button actions ─────────────────────────────────────────────────────
hbtns.save.MouseButton1Click:Connect(function()
    local snap = snapshot()
    snap.nextId = S.nextId
    local ok, encoded = pcall(HS.JSONEncode, HS, snap)
    if ok then
        plugin:SetSetting("RRC_Save_v2", encoded)
        setStatus("💾 Saved ("..#S.wires.." wires)")
    else
        setStatus("Save failed: "..tostring(encoded))
    end
end)

hbtns.load.MouseButton1Click:Connect(function()
    local encoded = plugin:GetSetting("RRC_Save_v2")
    if not encoded or encoded == "" then setStatus("No save found"); return end
    local ok, snap = pcall(HS.JSONDecode, HS, encoded)
    if not ok then setStatus("Load failed"); return end
    restoreSnapshot(snap)
    setStatus("📂 Loaded")
end)

hbtns.simulate.MouseButton1Click:Connect(function()
    S.simMode = not S.simMode
    S.simVars = {}
    if S.simMode then
        hbtns.simulate.Text = "⏹ Stop"
        hbtns.simulate.BackgroundColor3 = Color3.fromRGB(120,30,0)
        setStatus("▶ SIMULATE MODE — click orange exec outputs to fire signals")
    else
        hbtns.simulate.Text = "▶ Simulate"
        hbtns.simulate.BackgroundColor3 = Color3.fromRGB(36,18,0)
        setStatus("Simulation stopped")
    end
end)

hbtns.export.MouseButton1Click:Connect(function()
    pcall(exportCircuit)
end)

hbtns.scene.MouseButton1Click:Connect(function()
    pcall(createSceneObjects)
end)

hbtns.clear.MouseButton1Click:Connect(function()
    pushUndo()
    for _, ch in ipairs(chipLayer:GetChildren()) do ch:Destroy() end
    for _, wf in ipairs(wireLayer:GetChildren()) do wf:Destroy() end
    S.nodes = {}; S.wires = {}
    wireStart = nil
    setStatus("Canvas cleared")
end)

-- ── Sidebar chip list ─────────────────────────────────────────────────────────
-- Placement counter so chips spread out on canvas
local placementIdx = 0

local function buildSidebar(filter)
    filter = filter and filter:lower() or ""
    for _, ch2 in ipairs(chipScroll:GetChildren()) do
        if ch2:IsA("Frame") or ch2:IsA("UIListLayout") then ch2:Destroy() end
    end
    vlist(chipScroll, 1)   -- recreate layout after clearing

    local catOrder = {
        "Control Flow","Math","Logic","Variables","Lists",
        "Events","Player","Volumes","UI","Objects","Combatant",
        "Conversion","Debug",
    }
    local bycat = {}
    for _, ch2 in ipairs(CHIPS) do
        local matches = filter == "" or
            ch2.name:lower():find(filter,1,true) or
            ch2.cat:lower():find(filter,1,true)
        if matches then
            if not bycat[ch2.cat] then bycat[ch2.cat] = {} end
            table.insert(bycat[ch2.cat], ch2)
        end
    end

    local lo = 1
    for _, catName in ipairs(catOrder) do
        local chips = bycat[catName]
        if not chips or #chips == 0 then continue end
        local cc = CAT_COL[catName] or TEXT2

        -- Category header (explicit, no broken helper)
        local catHdr = Instance.new("Frame")
        catHdr.Size = UDim2.new(1,0,0,22)
        catHdr.BackgroundColor3 = Color3.fromRGB(6,14,28)
        catHdr.BorderSizePixel = 0
        catHdr.LayoutOrder = lo
        catHdr.Parent = chipScroll
        lo = lo + 1

        local catNameLbl = Instance.new("TextLabel")
        catNameLbl.Size = UDim2.new(1,-50,1,0)
        catNameLbl.Position = UDim2.new(0,8,0,0)
        catNameLbl.BackgroundTransparency = 1
        catNameLbl.Text = catName
        catNameLbl.TextColor3 = cc
        catNameLbl.Font = Enum.Font.GothamBold
        catNameLbl.TextSize = 10
        catNameLbl.TextXAlignment = Enum.TextXAlignment.Left
        catNameLbl.Parent = catHdr

        local catCntLbl = Instance.new("TextLabel")
        catCntLbl.Size = UDim2.new(0,40,1,0)
        catCntLbl.Position = UDim2.new(1,-44,0,0)
        catCntLbl.BackgroundTransparency = 1
        catCntLbl.Text = "("..#chips..")"
        catCntLbl.TextColor3 = TEXT3
        catCntLbl.Font = Enum.Font.Gotham
        catCntLbl.TextSize = 9
        catCntLbl.TextXAlignment = Enum.TextXAlignment.Right
        catCntLbl.Parent = catHdr

        for _, chip2 in ipairs(chips) do
            -- Chip row (explicit sizes)
            local row = Instance.new("Frame")
            row.Size = UDim2.new(1,0,0,28)
            row.BackgroundTransparency = 1
            row.BorderSizePixel = 0
            row.LayoutOrder = lo
            row.Parent = chipScroll
            lo = lo + 1

            -- Colour dot (4px wide bar on left)
            local dot = Instance.new("Frame")
            dot.Size = UDim2.new(0,3,1,-8)
            dot.Position = UDim2.new(0,0,0,4)
            dot.BackgroundColor3 = cc
            dot.BorderSizePixel = 0
            dot.Parent = row
            Instance.new("UICorner",dot).CornerRadius = UDim.new(0,2)

            -- Chip name
            local nameLbl = Instance.new("TextLabel")
            nameLbl.Size = UDim2.new(1,-50,1,0)
            nameLbl.Position = UDim2.new(0,10,0,0)
            nameLbl.BackgroundTransparency = 1
            nameLbl.Text = chip2.name
            nameLbl.TextColor3 = TEXT
            nameLbl.Font = Enum.Font.Gotham
            nameLbl.TextSize = 11
            nameLbl.TextXAlignment = Enum.TextXAlignment.Left
            nameLbl.TextTruncate = Enum.TextTruncate.AtEnd
            nameLbl.Parent = row

            -- Port count badge
            local portLbl = Instance.new("TextLabel")
            portLbl.Size = UDim2.new(0,38,0,16)
            portLbl.Position = UDim2.new(1,-40,0.5,-8)
            portLbl.BackgroundColor3 = Color3.fromRGB(6,14,28)
            portLbl.BorderSizePixel = 0
            portLbl.Text = #chip2.inp.."→"..#chip2.out
            portLbl.TextColor3 = TEXT3
            portLbl.Font = Enum.Font.Gotham
            portLbl.TextSize = 9
            portLbl.TextXAlignment = Enum.TextXAlignment.Center
            portLbl.Parent = row
            Instance.new("UICorner",portLbl).CornerRadius = UDim.new(0,4)

            -- Click to add chip to canvas
            row.InputBegan:Connect(function(inp)
                if inp.UserInputType ~= Enum.UserInputType.MouseButton1 then return end
                -- Stagger placement so chips don't all stack
                placementIdx = placementIdx + 1
                local col = (placementIdx - 1) % 4
                local rowN = math.floor((placementIdx - 1) / 4)
                local px = 60  + col * (CHIP_W + 30)
                local py = 60  + rowN * 120
                addNode(chip2.id, px, py)
                setStatus("Added '"..chip2.name.."'  |  drag the chip header to move it  |  click a port to wire")
            end)

            row.MouseEnter:Connect(function()
                row.BackgroundTransparency = 0
                row.BackgroundColor3 = Color3.fromRGB(18,36,60)
            end)
            row.MouseLeave:Connect(function()
                row.BackgroundTransparency = 1
            end)
        end

        -- Divider
        local div = Instance.new("Frame")
        div.Size = UDim2.new(1,0,0,1)
        div.BackgroundColor3 = BORD
        div.BorderSizePixel = 0
        div.LayoutOrder = lo
        div.Parent = chipScroll
        lo = lo + 1
        -- (no extra end here — the if block was replaced with continue above)
    end  -- closes: for _, catName in ipairs(catOrder)
end  -- closes: buildSidebar function

searchBox:GetPropertyChangedSignal("Text"):Connect(function()
    buildSidebar(searchBox.Text)
end)

-- ── Init ──────────────────────────────────────────────────────────────────────
buildSidebar()
applyView()

-- Try to restore last session
task.delay(0.3, function()
    local saved = plugin:GetSetting("RRC_Save_v2")
    if saved and saved ~= "" then
        local ok, snap = pcall(HS.JSONDecode, HS, saved)
        if ok and snap then
            pcall(restoreSnapshot, snap)
        end
    end
    setStatus("RR Circuits Studio — click a chip to place it  |  middle-click to pan  |  scroll to zoom")
end)

print("[RR Circuits Studio v2.0] Ready — click the toolbar button to open the editor")
