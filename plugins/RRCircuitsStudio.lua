--[[
  RR Circuits Studio — Full Circuit Editor Plugin for Roblox Studio
  ==================================================================
  The complete RR Circuits editor, embedded inside Roblox Studio.
  No external app needed.

  INSTALL:
   1. Copy this file to  %LOCALAPPDATA%\Roblox\Plugins\RRCircuitsStudio.lua
   2. Reopen Roblox Studio — "RR Circuits" toolbar button appears
   3. Click it to open the editor panel

  FEATURES:
   • 100+ chips (Control Flow, Math, Logic, Variables, Events, Player, Volumes, UI…)
   • Visual canvas: drag chips, click ports to wire
   • Variable chips with editable names + Local/Cloud/Synced scope
   • Scene object chips (Button, Trigger Volume, etc.) created directly in Workspace
   • Simulate mode: click exec outputs to fire signals
   • Export: generates a ready-to-run Script/LocalScript
   • Save/Load per place via plugin settings
--]]

-- ═══════════════════════════════════════════════════════════════════════
-- SERVICES
-- ═══════════════════════════════════════════════════════════════════════
local HttpService     = game:GetService("HttpService")
local RunService      = game:GetService("RunService")
local UserInputService= game:GetService("UserInputService")
local StarterGui      = game:GetService("StarterGui")

-- ═══════════════════════════════════════════════════════════════════════
-- COLOURS
-- ═══════════════════════════════════════════════════════════════════════
local C = {
    bg      = Color3.fromRGB(8,  18,  34),
    bg2     = Color3.fromRGB(10, 22,  40),
    sidebar = Color3.fromRGB(11, 20,  36),
    chip    = Color3.fromRGB(18, 40,  68),
    chipH   = Color3.fromRGB(13, 29,  52),
    border  = Color3.fromRGB(30, 56,  90),
    accent  = Color3.fromRGB(255,140, 0),
    blue    = Color3.fromRGB(74, 158, 255),
    green   = Color3.fromRGB(68, 221, 136),
    red     = Color3.fromRGB(255, 68,  85),
    yellow  = Color3.fromRGB(255,204,  68),
    purple  = Color3.fromRGB(170,102, 255),
    cyan    = Color3.fromRGB(0,  204, 255),
    white   = Color3.new(1,1,1),
    text    = Color3.fromRGB(216,232, 255),
    text2   = Color3.fromRGB(112,144, 176),
    text3   = Color3.fromRGB(58,  80, 112),
    black   = Color3.fromRGB(5,   10,  20),
}

local PORT_COLOR = {
    exec    = C.accent,
    int     = C.blue,
    float   = Color3.fromRGB(51,187,255),
    number  = C.blue,
    bool    = C.red,
    string  = C.green,
    player  = C.cyan,
    vector3 = C.purple,
    object  = Color3.fromRGB(187,187,187),
    list    = Color3.fromRGB(255,170, 51),
    any     = Color3.fromRGB(120,136,153),
}

local CAT_COLOR = {
    ["Control Flow"] = C.accent,
    ["Math"]         = C.blue,
    ["Logic"]        = C.purple,
    ["Variables"]    = Color3.fromRGB(0,204,170),
    ["Lists"]        = Color3.fromRGB(68,204,68),
    ["Events"]       = C.red,
    ["Player"]       = C.cyan,
    ["UI"]           = Color3.fromRGB(255,102,170),
    ["Objects"]      = Color3.fromRGB(170,170,255),
    ["Combatant"]    = Color3.fromRGB(255,102,51),
    ["Volumes"]      = Color3.fromRGB(102,255,170),
    ["Gadgets"]      = C.yellow,
    ["Conversion"]   = Color3.fromRGB(255,153,68),
    ["String"]       = Color3.fromRGB(102,255,153),
    ["Random"]       = Color3.fromRGB(85,204,255),
    ["Debug"]        = Color3.fromRGB(204,68,68),
    ["Custom"]       = Color3.fromRGB(255,68,255),
}

-- ═══════════════════════════════════════════════════════════════════════
-- CHIP DEFINITIONS
-- ═══════════════════════════════════════════════════════════════════════
-- Format: { id, name, cat, inputs={{name,type,default},...}, outputs={{name,type},...}, meta }
-- meta keys: isVariable, varType, isSceneObject, sceneType, isEvent

local function e(n)      return {n,"exec"} end
local function n(n,d)    return {n,"number",d or 0} end
local function i(n,d)    return {n,"int",  d or 0} end
local function f(n,d)    return {n,"float",d or 0} end
local function b(n,d)    return {n,"bool",  d} end
local function s(n,d)    return {n,"string",d or ""} end
local function p(n)      return {n,"player"} end
local function v(n)      return {n,"vector3"} end
local function o(n)      return {n,"object"} end
local function l(n)      return {n,"list"} end
local function a(n)      return {n,"any"} end

local CHIPS = {
-- ── Control Flow ────────────────────────────────────────────────────────
{id="branch",   name="Branch",      cat="Control Flow", inp={e"Run",b("Condition",false)}, out={e"True",e"False"}},
{id="sequence", name="Sequence",    cat="Control Flow", inp={e"Run"}, out={e"0",e"1",e"2",e"3",e"4"}},
{id="delay",    name="Delay",       cat="Control Flow", inp={e"Run",f("Seconds",1)}, out={e"Out"}},
{id="forloop",  name="For Loop",    cat="Control Flow", inp={e"Run",i("First",0),i("Last",9),i("Step",1)}, out={e"Loop Body",e"Completed",i"Index"}},
{id="whileloop",name="While Loop",  cat="Control Flow", inp={e"Run",b("Condition",false)}, out={e"Loop Body",e"Completed"}},
{id="foreach",  name="For Each",    cat="Control Flow", inp={e"Run",l"List"}, out={e"Loop Body",e"Completed",a"Item",i"Index"}},
{id="doonce",   name="Do Once",     cat="Control Flow", inp={e"Run",e"Reset"}, out={e"Out"}},
{id="authority",name="Is Authority",cat="Control Flow", inp={}, out={e"True",e"False",b"Result"}},
{id="gate",     name="Gate",        cat="Control Flow", inp={e"Run",e"Open",e"Close",b("Start Open",true)}, out={e"Out"}},
{id="valswitch",name="Value Switch", cat="Control Flow", inp={e"Run",a"Value",a"Case 0",a"Case 1",a"Case 2"}, out={e"Case 0",e"Case 1",e"Case 2",e"Default"}},
-- ── Math ────────────────────────────────────────────────────────────────
{id="add",     name="Add",          cat="Math", inp={n("A",0),n("B",0)}, out={n"Result"}},
{id="subtract",name="Subtract",     cat="Math", inp={n("A",0),n("B",0)}, out={n"Result"}},
{id="multiply",name="Multiply",     cat="Math", inp={n("A",1),n("B",1)}, out={n"Result"}},
{id="divide",  name="Divide",       cat="Math", inp={n("A",0),n("B",1)}, out={n"Result"}},
{id="modulo",  name="Modulo",       cat="Math", inp={n("A",0),n("B",1)}, out={n"Result"}},
{id="power",   name="Power",        cat="Math", inp={n("Base",2),n("Exp",2)}, out={n"Result"}},
{id="sqrt",    name="Sqrt",         cat="Math", inp={n("Value",0)}, out={n"Result"}},
{id="abs",     name="Abs",          cat="Math", inp={n("Value",0)}, out={n"Result"}},
{id="clamp",   name="Clamp",        cat="Math", inp={n("Value",0),n("Min",0),n("Max",1)}, out={n"Result"}},
{id="lerp",    name="Lerp",         cat="Math", inp={n("A",0),n("B",1),n("T",0.5)}, out={n"Result"}},
{id="round",   name="Round",        cat="Math", inp={n("Value",0)}, out={n"Result"}},
{id="floor",   name="Floor",        cat="Math", inp={n("Value",0)}, out={n"Result"}},
{id="ceil",    name="Ceil",         cat="Math", inp={n("Value",0)}, out={n"Result"}},
{id="min",     name="Min",          cat="Math", inp={n("A",0),n("B",0)}, out={n"Result"}},
{id="max",     name="Max",          cat="Math", inp={n("A",0),n("B",0)}, out={n"Result"}},
{id="sin",     name="Sin",          cat="Math", inp={n("Rad",0)}, out={n"Result"}},
{id="cos",     name="Cos",          cat="Math", inp={n("Rad",0)}, out={n"Result"}},
{id="tan",     name="Tan",          cat="Math", inp={n("Rad",0)}, out={n"Result"}},
{id="atan2",   name="Atan2",        cat="Math", inp={n("Y",0),n("X",0)}, out={n"Radians"}},
{id="sign",    name="Sign",         cat="Math", inp={n("Value",0)}, out={n"Result"}},
{id="randnum", name="Random Number",cat="Math", inp={n("Min",0),n("Max",1)}, out={n"Result"}},
{id="randint", name="Random Int",   cat="Math", inp={i("Min",0),i("Max",10)}, out={i"Result"}},
-- ── Logic ───────────────────────────────────────────────────────────────
{id="and",    name="And",           cat="Logic", inp={b("A",false),b("B",false)}, out={b"Result"}},
{id="or",     name="Or",            cat="Logic", inp={b("A",false),b("B",false)}, out={b"Result"}},
{id="not",    name="Not",           cat="Logic", inp={b("In",false)}, out={b"Result"}},
{id="nand",   name="Nand",          cat="Logic", inp={b("A",false),b("B",false)}, out={b"Result"}},
{id="nor",    name="Nor",           cat="Logic", inp={b("A",false),b("B",false)}, out={b"Result"}},
{id="xor",    name="Xor",           cat="Logic", inp={b("A",false),b("B",false)}, out={b"Result"}},
{id="eq",     name="Equals",        cat="Logic", inp={a"A",a"B"}, out={b"Result"}},
{id="noteq",  name="Not Equal",     cat="Logic", inp={a"A",a"B"}, out={b"Result"}},
{id="gt",     name="Greater Than",  cat="Logic", inp={n("A",0),n("B",0)}, out={b"Result"}},
{id="lt",     name="Less Than",     cat="Logic", inp={n("A",0),n("B",0)}, out={b"Result"}},
{id="gte",    name="Greater or Equal",cat="Logic",inp={n("A",0),n("B",0)}, out={b"Result"}},
{id="lte",    name="Less or Equal", cat="Logic", inp={n("A",0),n("B",0)}, out={b"Result"}},
-- ── Variables ───────────────────────────────────────────────────────────
{id="var_int",  name="Int Variable",   cat="Variables",inp={e"Set",i("Value",0)},   out={e"Out",i"Value",e"Changed"},meta={isVariable=true,varType="int"}},
{id="var_float",name="Float Variable", cat="Variables",inp={e"Set",f("Value",0)},   out={e"Out",f"Value",e"Changed"},meta={isVariable=true,varType="float"}},
{id="var_bool", name="Bool Variable",  cat="Variables",inp={e"Set",b("Value",false)},out={e"Out",b"Value",e"Changed"},meta={isVariable=true,varType="bool"}},
{id="var_str",  name="String Variable",cat="Variables",inp={e"Set",s("Value","")},  out={e"Out",s"Value",e"Changed"},meta={isVariable=true,varType="string"}},
{id="var_player",name="Player Variable",cat="Variables",inp={e"Set",p"Value"},      out={e"Out",p"Value",e"Changed"},meta={isVariable=true,varType="player"}},
{id="var_vec3", name="Vector3 Variable",cat="Variables",inp={e"Set",v"Value"},      out={e"Out",v"Value",e"Changed"},meta={isVariable=true,varType="vector3"}},
{id="var_intL", name="Int List",       cat="Variables",inp={e"Set",l"Value"},       out={e"Out",l"Value",i"Count",e"Changed"},meta={isVariable=true,varType="list"}},
{id="var_strL", name="String List",    cat="Variables",inp={e"Set",l"Value"},       out={e"Out",l"Value",i"Count",e"Changed"},meta={isVariable=true,varType="list"}},
-- ── Lists ────────────────────────────────────────────────────────────────
{id="list_add", name="List Add",       cat="Lists", inp={e"Run",l"List",a"Item"},    out={e"Out",l"List"}},
{id="list_rem", name="List Remove",    cat="Lists", inp={e"Run",l"List",i"Index"},   out={e"Out",l"List"}},
{id="list_get", name="List Get",       cat="Lists", inp={l"List",i"Index"},          out={a"Item",b"Success"}},
{id="list_cnt", name="List Count",     cat="Lists", inp={l"List"},                   out={i"Count"}},
{id="list_has", name="List Contains",  cat="Lists", inp={l"List",a"Item"},           out={b"Result",i"Index"}},
{id="list_clr", name="List Clear",     cat="Lists", inp={e"Run",l"List"},            out={e"Out",l"List"}},
{id="list_create",name="List Create",  cat="Lists", inp={},                          out={l"List"}},
-- ── Events ──────────────────────────────────────────────────────────────
{id="evt_recv", name="Event Receiver", cat="Events",inp={},                          out={e"Out",a"Arg 0",a"Arg 1"},meta={isEvent=true}},
{id="evt_send", name="Event Sender",   cat="Events",inp={e"Run",a"Arg 0",a"Arg 1"}, out={e"Out"},               meta={isEvent=true}},
{id="on_joined",name="Player Joined",  cat="Events",inp={},                          out={e"Out",p"Player"}},
{id="on_left",  name="Player Left",    cat="Events",inp={},                          out={e"Out",p"Player"}},
{id="on_init",  name="On Init",        cat="Events",inp={},                          out={e"Out"}},
{id="on_update",name="On Update",      cat="Events",inp={},                          out={e"Out",f"Delta"}},
-- ── Player ──────────────────────────────────────────────────────────────
{id="pl_local", name="Get Local Player",cat="Player",inp={},                         out={p"Player"}},
{id="pl_all",   name="Get All Players", cat="Player",inp={},                         out={l"Players",i"Count"}},
{id="pl_name",  name="Player Get Name", cat="Player",inp={p"Player"},               out={s"Name"}},
{id="pl_uid",   name="Player Get ID",   cat="Player",inp={p"Player"},               out={s"ID"}},
{id="pl_isvr",  name="Player Is VR",    cat="Player",inp={p"Player"},               out={b"Is VR"}},
{id="pl_pos",   name="Player Position", cat="Player",inp={p"Player"},               out={v"Position"}},
{id="pl_teleport",name="Player Teleport",cat="Player",inp={e"Run",p"Player",v"Position"}, out={e"Out"}},
{id="pl_kill",  name="Kill Player",     cat="Player",inp={e"Run",p"Player"},        out={e"Out"}},
{id="pl_ishost",name="Is Room Host",    cat="Player",inp={p"Player"},               out={b"Is Host"}},
{id="pl_score", name="Get Score",       cat="Player",inp={p"Player"},               out={n"Score"}},
{id="pl_setscr",name="Set Score",       cat="Player",inp={e"Run",p"Player",n("Score",0)},out={e"Out"}},
-- ── Scene Objects (Volumes + Gadgets) ───────────────────────────────────
{id="btn_press",name="Button",          cat="Volumes",inp={o"Button"},               out={e"Out",p"Player"},      meta={isSceneObject=true,sceneType="button",sceneDefaults={pos="0,1,0",size="4,2,4",color="0066FF",text="Button"}}},
{id="tbtn",     name="Toggle Button",   cat="Volumes",inp={o"Toggle"},               out={e"On",e"Off",p"Player"},meta={isSceneObject=true,sceneType="toggle_btn",sceneDefaults={pos="0,1,0",size="4,2,4",color="FF8800",text="Toggle"}}},
{id="trig_vol", name="Trigger Volume",  cat="Volumes",inp={o"Volume"},               out={e"Enter",e"Exit",p"Player"},meta={isSceneObject=true,sceneType="trigger_vol",sceneDefaults={pos="0,4,0",size="10,8,10",color="FF6600",opacity="0.7"}}},
{id="int_vol",  name="Interaction Volume",cat="Volumes",inp={o"Volume"},             out={e"Out",p"Player"},      meta={isSceneObject=true,sceneType="interact_vol",sceneDefaults={pos="0,2,0",size="6,4,6",color="00CCFF",promptText="Interact",maxDist="8"}}},
{id="hvol",     name="Handle Volume",   cat="Volumes",inp={o"Volume"},               out={e"Enter",e"Grabbed",o"Object",p"Player"},meta={isSceneObject=true,sceneType="handle_vol",sceneDefaults={pos="0,2,0",size="4,4,4",color="AA66FF"}}},
-- ── UI ───────────────────────────────────────────────────────────────────
{id="ui_notify",name="Show Notification",cat="UI",inp={e"Run",p"Player",s("Msg",""),f("Dur",3)},out={e"Out"}},
{id="ui_subtitle",name="Show Subtitle", cat="UI",inp={e"Run",p"Player",s("Text",""),f("Dur",3)},out={e"Out"}},
{id="ui_settext",name="Set Text",       cat="UI",inp={e"Run",o"TextLabel",s"Text"},  out={e"Out"}},
{id="sbtn_click",name="UI Button Click",cat="UI",inp={o"Button"},                    out={e"Out",p"Player"},     meta={isSceneObject=true,sceneType="ui_button",sceneDefaults={text="Button",size="200,50",pos="0.5,-100,0.9,0",bgColor="0066FF"}}},
{id="ui_label", name="UI Label",        cat="UI",inp={},                             out={},                     meta={isSceneObject=true,sceneType="ui_label",sceneDefaults={text="Label",size="200,30",pos="0.5,-100,0.1,0"}}},
{id="ui_toggle",name="UI Toggle",       cat="UI",inp={},                             out={e"On",e"Off"},         meta={isSceneObject=true,sceneType="ui_toggle",sceneDefaults={text="OFF",onText="ON",size="200,50",pos="0.5,-100,0.8,0"}}},
-- ── Objects ──────────────────────────────────────────────────────────────
{id="obj_pos",  name="Get Position",    cat="Objects",inp={o"Object"},               out={v"Position"}},
{id="obj_setpos",name="Set Position",   cat="Objects",inp={e"Run",o"Object",v"Position"},out={e"Out"}},
{id="obj_destroy",name="Destroy",       cat="Objects",inp={e"Run",o"Object"},        out={e"Out"}},
{id="obj_active",name="Set Active",     cat="Objects",inp={e"Run",o"Object",b("Active",true)},out={e"Out"}},
{id="obj_spawn",name="Spawn Object",    cat="Objects",inp={e"Run",o"Prefab",v"Position"},out={e"Out",o"Instance"}},
-- ── Combatant ────────────────────────────────────────────────────────────
{id="cmb_hp",   name="Get Health",      cat="Combatant",inp={o"Combatant"},          out={f"Health",f"Max"}},
{id="cmb_sethp",name="Set Health",      cat="Combatant",inp={e"Run",o"Combatant",f("HP",100)},out={e"Out"}},
{id="cmb_dmg",  name="Deal Damage",     cat="Combatant",inp={e"Run",o"Combatant",f("Dmg",10)},out={e"Out",e"Died"}},
{id="cmb_alive",name="Is Alive",        cat="Combatant",inp={o"Combatant"},          out={b"Alive"}},
-- ── String ───────────────────────────────────────────────────────────────
{id="str_cat",  name="String Combine",  cat="String",inp={s("A",""),s("B","")},      out={s"Result"}},
{id="str_len",  name="String Length",   cat="String",inp={s"String"},                out={i"Length"}},
{id="str_has",  name="String Contains", cat="String",inp={s"String",s"Search"},      out={b"Result",i"Index"}},
{id="str_sub",  name="Substring",       cat="String",inp={s"String",i("Start",0),i("Len",1)},out={s"Result"}},
{id="str_rep",  name="Replace",         cat="String",inp={s"String",s"Old",s"New"},  out={s"Result"}},
{id="str_up",   name="To Upper",        cat="String",inp={s"String"},                out={s"Result"}},
{id="str_low",  name="To Lower",        cat="String",inp={s"String"},                out={s"Result"}},
-- ── Conversion ──────────────────────────────────────────────────────────
{id="to_str",   name="To String",       cat="Conversion",inp={a"Value"},             out={s"Result"}},
{id="to_int",   name="Parse Int",       cat="Conversion",inp={s("Value","0")},       out={i"Result",b"OK"}},
{id="to_float", name="Parse Float",     cat="Conversion",inp={s("Value","0")},       out={f"Result",b"OK"}},
{id="v3_make",  name="Vector3 Make",    cat="Conversion",inp={f("X",0),f("Y",0),f("Z",0)},out={v"Vector3"}},
{id="v3_split", name="Vector3 Split",   cat="Conversion",inp={v"Vector3"},           out={f"X",f"Y",f"Z"}},
{id="b2i",      name="Bool to Int",     cat="Conversion",inp={b("Value",false)},     out={i"Result"}},
{id="i2b",      name="Int to Bool",     cat="Conversion",inp={i"Value"},             out={b"Result"}},
-- ── Random ──────────────────────────────────────────────────────────────
{id="rand",     name="Random",          cat="Random",inp={n("Min",0),n("Max",1)},    out={n"Result"}},
{id="randi",    name="Random Int",      cat="Random",inp={i("Min",0),i("Max",10)},   out={i"Result"}},
{id="randb",    name="Random Bool",     cat="Random",inp={f("Chance",0.5)},          out={b"Result"}},
-- ── Debug ────────────────────────────────────────────────────────────────
{id="print",    name="Print",           cat="Debug",inp={e"Run",a"Value"},            out={e"Out"}},
{id="warn",     name="Warn",            cat="Debug",inp={e"Run",s"Message"},          out={e"Out"}},
}

-- Build lookup
local CHIP_MAP = {}
for _, ch in ipairs(CHIPS) do CHIP_MAP[ch.id] = ch end

-- ═══════════════════════════════════════════════════════════════════════
-- PLUGIN SETUP
-- ═══════════════════════════════════════════════════════════════════════
local toolbar = plugin:CreateToolbar("RR Circuits")
local mainBtn = toolbar:CreateButton(
    "RR Circuits", "Open RR Circuits Circuit Editor", "rbxassetid://14978048121")

local wi = DockWidgetPluginGuiInfo.new(
    Enum.InitialDockState.Float, false, false, 1100, 700, 800, 500)
local widget = plugin:CreateDockWidgetPluginGui("RRCircuitsEditor", wi)
widget.Title = "RR Circuits — Circuit Editor"
widget.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

-- ═══════════════════════════════════════════════════════════════════════
-- UI HELPERS
-- ═══════════════════════════════════════════════════════════════════════
local function frame(parent, size, pos, color, border, lo)
    local f = Instance.new("Frame", parent)
    f.Size            = size or UDim2.new(1,0,1,0)
    f.Position        = pos  or UDim2.new(0,0,0,0)
    f.BackgroundColor3= color or C.bg
    f.BorderSizePixel = border or 0
    if lo then f.LayoutOrder = lo end
    return f
end

local function corner(parent, radius)
    local c = Instance.new("UICorner", parent)
    c.CornerRadius = UDim.new(0, radius or 6)
    return c
end

local function stroke(parent, color, thickness)
    local s = Instance.new("UIStroke", parent)
    s.Color     = color or C.border
    s.Thickness = thickness or 1
    return s
end

local function label(parent, txt, size, color, align, lo)
    local l = Instance.new("TextLabel", parent)
    l.Size               = size or UDim2.new(1,0,1,0)
    l.BackgroundTransparency = 1
    l.Text               = txt or ""
    l.TextColor3         = color or C.text
    l.Font               = Enum.Font.GothamBold
    l.TextSize           = 12
    l.TextXAlignment     = align or Enum.TextXAlignment.Left
    l.TextTruncate       = Enum.TextTruncate.AtEnd
    if lo then l.LayoutOrder = lo end
    return l
end

local function textbtn(parent, txt, size, pos, bgColor, lo)
    local b = Instance.new("TextButton", parent)
    b.Size             = size or UDim2.new(0,80,0,28)
    b.Position         = pos  or UDim2.new(0,0,0,0)
    b.BackgroundColor3 = bgColor or C.bg2
    b.BorderSizePixel  = 0
    b.Text             = txt or "Button"
    b.TextColor3       = C.text
    b.Font             = Enum.Font.GothamBold
    b.TextSize         = 11
    if lo then b.LayoutOrder = lo end
    corner(b, 5)
    return b
end

local function input(parent, placeholder, size, lo)
    local box = Instance.new("TextBox", parent)
    box.Size               = size or UDim2.new(1,0,0,26)
    box.BackgroundColor3   = C.black
    box.BorderSizePixel    = 0
    box.Text               = ""
    box.PlaceholderText    = placeholder or ""
    box.TextColor3         = C.text
    box.PlaceholderColor3  = C.text3
    box.Font               = Enum.Font.Gotham
    box.TextSize           = 11
    box.ClearTextOnFocus   = false
    if lo then box.LayoutOrder = lo end
    corner(box, 4)
    stroke(box, C.border)
    return box
end

local function listLayout(parent, dir, pad)
    local ul = Instance.new("UIListLayout", parent)
    ul.FillDirection = dir or Enum.FillDirection.Vertical
    ul.SortOrder     = Enum.SortOrder.LayoutOrder
    ul.Padding       = UDim.new(0, pad or 0)
    return ul
end

-- ═══════════════════════════════════════════════════════════════════════
-- MAIN LAYOUT
-- ═══════════════════════════════════════════════════════════════════════
local root = frame(widget, UDim2.new(1,0,1,0), nil, C.bg)
root.ClipsDescendants = true

-- Header
local header = frame(root, UDim2.new(1,0,0,40), nil, C.black)
header.ZIndex = 10

-- Logo
local logo = label(header, "⚡ RR Circuits", UDim2.new(0,140,1,0), C.accent)
logo.Position = UDim2.new(0,10,0,0)
logo.TextSize = 14

-- Header buttons
local function hBtn(txt, xOff, col)
    local b = textbtn(header, txt, UDim2.new(0,100,0,28),
        UDim2.new(0, xOff, 0, 6), col or C.bg2)
    return b
end

local btnSave     = hBtn("💾 Save",      155, Color3.fromRGB(14,50,28))
local btnLoad     = hBtn("📂 Load",      263, C.bg2)
local btnSimulate = hBtn("▶ Simulate",   371, Color3.fromRGB(40,20,0))
local btnExport   = hBtn("⬆ Export",     479, Color3.fromRGB(26,14,42))
local btnScene    = hBtn("🏗 To Scene",   587, Color3.fromRGB(5,36,36))
local btnClear    = hBtn("🗑 Clear",      695, Color3.fromRGB(40,10,10))

-- Body (below header)
local body = frame(root, UDim2.new(1,0,1,-40), UDim2.new(0,0,0,40), C.bg)

-- Sidebar
local SIDEBAR_W = 220
local sidebar = frame(body, UDim2.new(0,SIDEBAR_W,1,0), nil, C.sidebar)

-- Search bar
local searchBar = frame(sidebar, UDim2.new(1,0,0,36), nil, C.black)
local searchBox = input(searchBar, "🔍  SEARCH CHIPS", UDim2.new(1,-16,0,28))
searchBox.Position = UDim2.new(0,8,0,4)
searchBox.BackgroundColor3 = C.bg2

-- Chip list (scrolling)
local chipScroll = Instance.new("ScrollingFrame", sidebar)
chipScroll.Size               = UDim2.new(1,0,1,-36)
chipScroll.Position           = UDim2.new(0,0,0,36)
chipScroll.BackgroundTransparency = 1
chipScroll.BorderSizePixel    = 0
chipScroll.ScrollBarThickness = 4
chipScroll.ScrollBarImageColor3 = C.border
chipScroll.CanvasSize         = UDim2.new(0,0,0,0)
chipScroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
listLayout(chipScroll, nil, 1)

-- Canvas area
local CANVAS_X = SIDEBAR_W
local canvasFrame = frame(body,
    UDim2.new(1,-CANVAS_X,1,0),
    UDim2.new(0,CANVAS_X,0,0), C.bg2)
canvasFrame.ClipsDescendants = true

-- Canvas grid background (simulated with frame)
local gridBg = frame(canvasFrame, UDim2.new(1,0,1,0), nil, C.bg2)

-- Pan container (all chips live here)
local canvasContainer = frame(canvasFrame, UDim2.new(0,8000,0,8000),
    UDim2.new(0,-2000,0,-2000), Color3.new(0,0,0))
canvasContainer.BackgroundTransparency = 1
canvasContainer.ZIndex = 2

-- Wire layer (behind chips)
local wireLayer = frame(canvasContainer, UDim2.new(1,0,1,0), nil, Color3.new(0,0,0))
wireLayer.BackgroundTransparency = 1
wireLayer.ZIndex = 2

-- Chip layer (above wires)
local chipLayer = frame(canvasContainer, UDim2.new(1,0,1,0), nil, Color3.new(0,0,0))
chipLayer.BackgroundTransparency = 1
chipLayer.ZIndex = 3

-- Status bar
local statusBar = frame(body, UDim2.new(1,-CANVAS_X,0,22),
    UDim2.new(0,CANVAS_X,1,-22), C.black)
statusBar.ZIndex = 10
local statusLbl = label(statusBar, "  Ready — drag chips from sidebar • click port→port to wire • simulate with ▶",
    UDim2.new(1,-120,1,0), C.text3, Enum.TextXAlignment.Left)
statusLbl.TextSize = 10
local zoomLbl = label(statusBar, "100%",
    UDim2.new(0,60,1,0), C.text2, Enum.TextXAlignment.Center)
zoomLbl.Position = UDim2.new(1,-70,0,0)
zoomLbl.TextSize = 10

-- ═══════════════════════════════════════════════════════════════════════
-- CANVAS STATE
-- ═══════════════════════════════════════════════════════════════════════
local state = {
    nodes = {},        -- { id, chipId, x, y, varName, sceneName, sceneConfig, sceneScope, eventName, eventScope }
    wires = {},        -- { id, fromNode, fromPort, toNode, toPort, type, el }
    nextId = 1,
    panX = 0, panY = 0,
    scale = 1,
    selectedNodes = {},
    selWire = nil,
    simMode = false,
    simVars = {},
    simPortVals = {},
    undoStack = {},
    redoStack = {},
}

local CANVAS_OX = 2000   -- canvas container offset (canvasContainer starts at -2000)
local wireStart = nil    -- { nodeId, portIdx, isOutput, dotEl, portType }
local isDragging = false
local dragNode   = nil
local dragOffX, dragOffY = 0, 0
local isPanning  = false
local panStartX, panStartY = 0, 0
local panStartContX, panStartContY = 0, 0

-- ═══════════════════════════════════════════════════════════════════════
-- UTILITY
-- ═══════════════════════════════════════════════════════════════════════
local function getPortColor(t)
    return PORT_COLOR[t] or PORT_COLOR.any
end

local function compatible(a, b)
    if a == "any" or b == "any" then return true end
    if (a=="int" or a=="float" or a=="number") and (b=="int" or b=="float" or b=="number") then return true end
    return a == b
end

local function status(msg)
    statusLbl.Text = "  "..tostring(msg)
end

local function newId()
    local id = "n"..state.nextId
    state.nextId = state.nextId + 1
    return id
end

local function wId()
    local id = "w"..state.nextId
    state.nextId = state.nextId + 1
    return id
end

-- Convert canvas-container local position to canvasFrame position
local function containerToFrame(cx, cy)
    return cx - CANVAS_OX, cy - CANVAS_OX
end

local function frameToContainer(fx, fy)
    return fx + CANVAS_OX, fy + CANVAS_OX
end

-- ═══════════════════════════════════════════════════════════════════════
-- WIRE RENDERING (rotated Frame line)
-- ═══════════════════════════════════════════════════════════════════════
local function drawWireLine(x1, y1, x2, y2, color, parent)
    local dx = x2 - x1
    local dy = y2 - y1
    local len = math.sqrt(dx*dx + dy*dy)
    if len < 1 then return nil end
    local angle = math.deg(math.atan2(dy, dx))

    local wf = Instance.new("Frame", parent or wireLayer)
    wf.Size             = UDim2.new(0, len, 0, 2.5)
    wf.Position         = UDim2.new(0, x1, 0, y1 - 1.25)
    wf.Rotation         = angle
    wf.AnchorPoint      = Vector2.new(0, 0.5)
    wf.BackgroundColor3 = color or C.accent
    wf.BorderSizePixel  = 0
    wf.ZIndex           = 2
    return wf
end

local function getPortScreenPos(nodeId, portIdx, isOutput)
    -- Port positions relative to chipLayer (= container)
    local node = state.nodes[nodeId]
    if not node then return nil, nil end
    local def  = CHIP_MAP[node.chipId]
    if not def then return nil, nil end

    local el = chipLayer:FindFirstChild("chip_"..nodeId)
    if not el then return nil, nil end

    -- Chip position in container space
    local cx = el.Position.X.Offset
    local cy = el.Position.Y.Offset
    local cw = el.Size.X.Offset
    local ch = el.Size.Y.Offset

    local portY
    local HDR_H = 26
    local VAR_H = (def.meta and def.meta.isVariable) and 24 or 0
    local EVT_H = (def.meta and def.meta.isEvent)    and 46 or 0
    local SCN_H = (def.meta and def.meta.isSceneObject) and 24 or 0
    local contentOffsetY = HDR_H + VAR_H + EVT_H + SCN_H + 4

    if isOutput then
        local idx = portIdx + 1
        portY = cy + contentOffsetY + (idx - 1) * 22 + 11
        return cx + cw + 1, portY
    else
        local idx = portIdx + 1
        portY = cy + contentOffsetY + (idx - 1) * 22 + 11
        return cx - 1, portY
    end
end

local function redrawWire(w)
    if w.el then w.el:Destroy(); w.el = nil end
    local x1, y1 = getPortScreenPos(w.fromNode, w.fromPort, true)
    local x2, y2 = getPortScreenPos(w.toNode,   w.toPort,   false)
    if not x1 or not x2 then return end
    local col = getPortColor(w.type)
    w.el = drawWireLine(x1, y1, x2, y2, col, wireLayer)
    if w.el then
        w.el.Name = "wire_"..w.id
        -- Click to select/delete
        local btn = Instance.new("TextButton", w.el)
        btn.Size = UDim2.new(1,0,1,10)
        btn.Position = UDim2.new(0,0,0,-4)
        btn.BackgroundTransparency = 1
        btn.Text = ""
        btn.ZIndex = w.el.ZIndex + 1
        btn.MouseButton1Click:Connect(function()
            if state.simMode then return end
            -- Remove wire
            pushUndo()
            w.el:Destroy()
            for i, ww in ipairs(state.wires) do
                if ww.id == w.id then table.remove(state.wires, i); break end
            end
            status("Wire deleted")
        end)
    end
end

local function redrawAllWires()
    for _, w in ipairs(state.wires) do
        redrawWire(w)
    end
end

-- ═══════════════════════════════════════════════════════════════════════
-- UNDO / REDO
-- ═══════════════════════════════════════════════════════════════════════
local function getStateSnapshot()
    local snap = { nodes={}, wires={}, nextId=state.nextId }
    for id, node in pairs(state.nodes) do
        snap.nodes[id] = {
            id=node.id, chipId=node.chipId, x=node.x, y=node.y,
            varName=node.varName, sceneName=node.sceneName,
            sceneConfig=node.sceneConfig and (function()
                local t={} for k,v in pairs(node.sceneConfig) do t[k]=v end return t
            end)() or nil,
            sceneScope=node.sceneScope, eventName=node.eventName, eventScope=node.eventScope,
        }
    end
    for _, w in ipairs(state.wires) do
        table.insert(snap.wires, {
            id=w.id,fromNode=w.fromNode,fromPort=w.fromPort,
            toNode=w.toNode,toPort=w.toPort,type=w.type
        })
    end
    return snap
end

function pushUndo()
    table.insert(state.undoStack, getStateSnapshot())
    if #state.undoStack > 50 then table.remove(state.undoStack, 1) end
    state.redoStack = {}
end

local function loadSnapshot(snap)
    -- Clear canvas
    for _, ch in ipairs(chipLayer:GetChildren()) do ch:Destroy() end
    for _, wf in ipairs(wireLayer:GetChildren()) do wf:Destroy() end
    state.nodes = {}; state.wires = {}; state.nextId = snap.nextId
    for id, nd in pairs(snap.nodes) do
        state.nodes[id] = nd
        renderChip(nd)
    end
    for _, w in ipairs(snap.wires) do
        table.insert(state.wires, w)
    end
    redrawAllWires()
end

-- ═══════════════════════════════════════════════════════════════════════
-- CHIP RENDERING
-- ═══════════════════════════════════════════════════════════════════════
local PORT_W  = 12
local PORT_H  = 12
local ROW_H   = 22
local CHIP_W  = 180
local HDR_H   = 26
local PAD     = 6

function renderChip(node)
    local def = CHIP_MAP[node.chipId]
    if not def then return end
    local meta = def.meta or {}

    local numInputs  = #def.inp
    local numOutputs = #def.out
    local rows = math.max(numInputs, numOutputs)

    local varH  = meta.isVariable and 24 or 0
    local evtH  = meta.isEvent and 46 or 0
    local scnH  = meta.isSceneObject and 24 or 0
    local totalH = HDR_H + varH + evtH + scnH + rows * ROW_H + 8

    local catColor = CAT_COLOR[def.cat] or C.text2

    -- Main chip frame
    local chipEl = Instance.new("Frame", chipLayer)
    chipEl.Name             = "chip_"..node.id
    chipEl.Size             = UDim2.new(0, CHIP_W, 0, totalH)
    chipEl.Position         = UDim2.new(0, node.x, 0, node.y)
    chipEl.BackgroundColor3 = C.chip
    chipEl.BorderSizePixel  = 0
    chipEl.ZIndex           = 4
    corner(chipEl, 6)
    stroke(chipEl, C.border, 1.5)

    -- Left color bar
    local bar = frame(chipEl, UDim2.new(0,3,1,-12), UDim2.new(0,0,0,6), catColor)
    bar.ZIndex = 5
    corner(bar, 2)

    -- Header
    local hdr = frame(chipEl, UDim2.new(1,0,0,HDR_H), nil, C.chipH)
    hdr.ZIndex = 5
    -- Round only top corners
    corner(hdr, 6)
    -- Cover bottom corners
    local hdrCover = frame(chipEl, UDim2.new(1,0,0,6), UDim2.new(0,0,0,HDR_H-6), C.chipH)
    hdrCover.ZIndex = 5

    local hdrLbl = label(hdr, def.name,
        UDim2.new(1,-24,1,0), C.text, Enum.TextXAlignment.Left)
    hdrLbl.Position = UDim2.new(0,12,0,0)
    hdrLbl.ZIndex   = 6
    hdrLbl.Font     = Enum.Font.GothamBold
    hdrLbl.TextSize = 12

    -- Category dot
    local dot = frame(hdr, UDim2.new(0,6,0,6),
        UDim2.new(1,-14,0.5,-3), catColor)
    dot.ZIndex = 6
    corner(dot, 3)

    -- Drag via header
    hdr.ZIndex = 5
    local dragging_this = false
    local dStartX, dStartY = 0, 0
    local dNodeX, dNodeY  = 0, 0

    hdr.InputBegan:Connect(function(inp)
        if inp.UserInputType == Enum.UserInputType.MouseButton1 then
            if wireStart then return end
            if state.simMode then return end
            pushUndo()
            dragging_this = true
            dStartX = inp.Position.X
            dStartY = inp.Position.Y
            dNodeX  = node.x
            dNodeY  = node.y
            chipEl.ZIndex = 10
        end
    end)

    local connInputChanged = UserInputService.InputChanged:Connect(function(inp)
        if not dragging_this then return end
        if inp.UserInputType == Enum.UserInputType.MouseMovement then
            local dx = inp.Position.X - dStartX
            local dy = inp.Position.Y - dStartY
            node.x = dNodeX + dx / state.scale
            node.y = dNodeY + dy / state.scale
            chipEl.Position = UDim2.new(0, node.x, 0, node.y)
            redrawAllWires()
        end
    end)

    local connInputEnded = UserInputService.InputEnded:Connect(function(inp)
        if inp.UserInputType == Enum.UserInputType.MouseButton1 then
            dragging_this = false
            chipEl.ZIndex = 4
            connInputChanged:Disconnect()
            connInputEnded:Disconnect()
        end
    end)

    -- Click chip to select
    chipEl.InputBegan:Connect(function(inp)
        if inp.UserInputType == Enum.UserInputType.MouseButton1 then
            state.selectedNodes = {node.id}
            status("Selected: "..def.name)
        end
    end)

    -- Right click to delete
    chipEl.InputBegan:Connect(function(inp)
        if inp.UserInputType == Enum.UserInputType.MouseButton2 then
            pushUndo()
            deleteNode(node.id)
        end
    end)

    local yOffset = HDR_H

    -- Variable name row
    if meta.isVariable then
        if not node.varName then node.varName = def.name:match("^(%a+)") or "MyVar" end
        local vrow = frame(chipEl, UDim2.new(1,-6,0,20), UDim2.new(0,3,0,yOffset+2), C.black)
        vrow.ZIndex = 5; corner(vrow, 3)
        local vlbl = label(vrow, "✎", UDim2.new(0,14,1,0), C.text3)
        vlbl.Position = UDim2.new(0,3,0,0); vlbl.ZIndex = 6; vlbl.TextSize = 10
        local vinput = Instance.new("TextBox", vrow)
        vinput.Size = UDim2.new(1,-18,1,-2); vinput.Position = UDim2.new(0,16,0,1)
        vinput.BackgroundTransparency = 1
        vinput.Text = node.varName; vinput.TextColor3 = C.text
        vinput.Font = Enum.Font.GothamBold; vinput.TextSize = 11
        vinput.ZIndex = 6; vinput.ClearTextOnFocus = false
        vinput.FocusLost:Connect(function()
            node.varName = vinput.Text:gsub("%s","_"):gsub("[^%w_]","") or node.varName
            vinput.Text = node.varName
        end)
        -- Scope selector
        local scopes = {"Local","☁ Cloud","🔄 30Hz"}
        if not node.sceneScope then node.sceneScope = "Local" end
        local scopeBtn = textbtn(chipEl, node.sceneScope,
            UDim2.new(1,-6,0,16), UDim2.new(0,3,0,yOffset+22),
            Color3.fromRGB(8,20,38))
        scopeBtn.TextSize = 9; scopeBtn.ZIndex = 6
        local si = 1
        for idx, sc in ipairs(scopes) do
            if sc:match(node.sceneScope) then si = idx; break end
        end
        scopeBtn.MouseButton1Click:Connect(function()
            si = (si % #scopes) + 1
            node.sceneScope = scopes[si]
            scopeBtn.Text   = scopes[si]
        end)
        yOffset = yOffset + varH
    end

    -- Event name + scope row
    if meta.isEvent then
        if not node.eventName  then node.eventName  = "MyEvent" end
        if not node.eventScope then node.eventScope = "Local" end
        local erow = frame(chipEl, UDim2.new(1,-6,0,20), UDim2.new(0,3,0,yOffset+2), C.black)
        erow.ZIndex = 5; corner(erow, 3)
        local elbl = label(erow, "◉", UDim2.new(0,14,1,0), C.red)
        elbl.Position = UDim2.new(0,3,0,0); elbl.ZIndex = 6; elbl.TextSize = 10
        local einput = Instance.new("TextBox", erow)
        einput.Size = UDim2.new(1,-18,1,-2); einput.Position = UDim2.new(0,16,0,1)
        einput.BackgroundTransparency = 1
        einput.Text = node.eventName; einput.TextColor3 = C.text
        einput.Font = Enum.Font.GothamBold; einput.TextSize = 11
        einput.ZIndex = 6; einput.ClearTextOnFocus = false
        einput.FocusLost:Connect(function()
            node.eventName = einput.Text or node.eventName
        end)
        -- Scope
        local escopes = {"📍 Local","👥 Everyone"}
        local esi = (node.eventScope=="Everyone") and 2 or 1
        local esBtn = textbtn(chipEl, escopes[esi],
            UDim2.new(1,-6,0,18), UDim2.new(0,3,0,yOffset+23),
            Color3.fromRGB(8,20,38))
        esBtn.TextSize = 9; esBtn.ZIndex = 6
        esBtn.MouseButton1Click:Connect(function()
            esi = (esi % #escopes) + 1
            node.eventScope = esi == 2 and "Everyone" or "Local"
            esBtn.Text = escopes[esi]
        end)
        yOffset = yOffset + evtH
    end

    -- Scene object name row
    if meta.isSceneObject then
        if not node.sceneName   then
            node.sceneName   = (def.id:gsub("_",""))
                              .."_"..(string.sub(node.id,2))
        end
        if not node.sceneConfig then
            node.sceneConfig = {}
            if meta.sceneDefaults then
                for k,vv in pairs(meta.sceneDefaults) do
                    node.sceneConfig[k] = vv
                end
            end
        end
        local srow = frame(chipEl, UDim2.new(1,-6,0,20), UDim2.new(0,3,0,yOffset+2), C.black)
        srow.ZIndex = 5; corner(srow, 3)
        local slbl = label(srow, "📍", UDim2.new(0,14,1,0), C.text3)
        slbl.Position = UDim2.new(0,3,0,0); slbl.ZIndex = 6; slbl.TextSize = 10
        local sinput = Instance.new("TextBox", srow)
        sinput.Size = UDim2.new(1,-18,1,-2); sinput.Position = UDim2.new(0,16,0,1)
        sinput.BackgroundTransparency = 1
        sinput.Text = node.sceneName; sinput.TextColor3 = C.green
        sinput.Font = Enum.Font.GothamBold; sinput.TextSize = 11
        sinput.ZIndex = 6; sinput.ClearTextOnFocus = false
        sinput.FocusLost:Connect(function()
            node.sceneName = sinput.Text:gsub("[^%w_]","") or node.sceneName
            sinput.Text = node.sceneName
        end)
        yOffset = yOffset + scnH
    end

    -- Port rows
    local maxRows = math.max(numInputs, numOutputs)
    for row = 1, maxRows do
        local rowY = yOffset + (row-1)*ROW_H + 4

        -- Input port
        if row <= numInputs then
            local portDef = def.inp[row]
            local pname, ptype = portDef[1], portDef[2]
            local pcolor = getPortColor(ptype)

            -- Port dot (clickable)
            local dot = frame(chipEl, UDim2.new(0,PORT_W,0,PORT_H),
                UDim2.new(0,-PORT_W/2, 0, rowY+5), pcolor)
            dot.ZIndex = 7
            if ptype == "exec" then
                dot.Rotation = 45
                corner(dot, 0)
            else
                corner(dot, PORT_H/2)
            end
            -- Inner fill (shows if connected)
            local inner = frame(dot, UDim2.new(0,6,0,6), UDim2.new(0.5,-3,0.5,-3), C.chip)
            inner.ZIndex = 8
            corner(inner, 3)
            dot.Name = "iport_"..node.id.."_"..(row-1)

            -- Port label
            local lbl_p = label(chipEl, pname,
                UDim2.new(0, CHIP_W/2-12, 0, ROW_H-2),
                C.text2, Enum.TextXAlignment.Left)
            lbl_p.Position = UDim2.new(0, 10, 0, rowY)
            lbl_p.ZIndex   = 6; lbl_p.TextSize = 10

            -- Default value (number/bool/string only)
            if ptype == "bool" then
                local dval = portDef[3]
                local boolBtn = textbtn(chipEl,
                    (dval and "TRUE" or "FALSE"),
                    UDim2.new(0,44,0,14),
                    UDim2.new(0, CHIP_W/2+2, 0, rowY+4),
                    dval and Color3.fromRGB(10,40,20) or Color3.fromRGB(40,10,10))
                boolBtn.TextSize = 9; boolBtn.ZIndex = 6
                boolBtn.TextColor3 = dval and C.green or C.red
                local curVal = dval or false
                boolBtn.MouseButton1Click:Connect(function()
                    curVal = not curVal
                    boolBtn.Text = curVal and "TRUE" or "FALSE"
                    boolBtn.TextColor3 = curVal and C.green or C.red
                    boolBtn.BackgroundColor3 = curVal and Color3.fromRGB(10,40,20) or Color3.fromRGB(40,10,10)
                    if not node.defaults then node.defaults = {} end
                    node.defaults["i"..(row-1)] = curVal
                end)
            elseif ptype == "number" or ptype == "int" or ptype == "float" then
                local dbox = Instance.new("TextBox", chipEl)
                dbox.Size = UDim2.new(0,48,0,14)
                dbox.Position = UDim2.new(0,CHIP_W/2+2,0,rowY+4)
                dbox.BackgroundColor3 = C.black
                dbox.BorderSizePixel = 0
                dbox.Text = tostring(portDef[3] or 0)
                dbox.TextColor3 = C.text; dbox.Font = Enum.Font.Gotham
                dbox.TextSize = 10; dbox.ZIndex = 6
                dbox.ClearTextOnFocus = false
                corner(dbox, 3)
                dbox.FocusLost:Connect(function()
                    if not node.defaults then node.defaults = {} end
                    node.defaults["i"..(row-1)] = tonumber(dbox.Text) or 0
                end)
            elseif ptype == "string" then
                local dbox = Instance.new("TextBox", chipEl)
                dbox.Size = UDim2.new(0,56,0,14)
                dbox.Position = UDim2.new(0,CHIP_W/2+2,0,rowY+4)
                dbox.BackgroundColor3 = C.black; dbox.BorderSizePixel = 0
                dbox.Text = tostring(portDef[3] or "")
                dbox.TextColor3 = C.green; dbox.Font = Enum.Font.Gotham
                dbox.TextSize = 10; dbox.ZIndex = 6
                dbox.ClearTextOnFocus = false; corner(dbox, 3)
                dbox.FocusLost:Connect(function()
                    if not node.defaults then node.defaults = {} end
                    node.defaults["i"..(row-1)] = dbox.Text
                end)
            end

            -- Click to start/complete wire
            dot.InputBegan:Connect(function(inp)
                if inp.UserInputType ~= Enum.UserInputType.MouseButton1 then return end
                if wireStart and wireStart.isOutput then
                    -- Complete wire
                    local from = wireStart
                    if compatible(from.portType, ptype) then
                        pushUndo()
                        local w = {
                            id       = wId(),
                            fromNode = from.nodeId,
                            fromPort = from.portIdx,
                            toNode   = node.id,
                            toPort   = row - 1,
                            type     = (from.portType == "any" and ptype ~= "any") and ptype or from.portType,
                        }
                        -- Remove existing wire on this input
                        if ptype ~= "exec" then
                            for i = #state.wires, 1, -1 do
                                local ww = state.wires[i]
                                if ww.toNode == node.id and ww.toPort == row-1 then
                                    if ww.el then ww.el:Destroy() end
                                    table.remove(state.wires, i)
                                end
                            end
                        end
                        table.insert(state.wires, w)
                        redrawWire(w)
                        inner.BackgroundColor3 = pcolor
                        from.dotEl.BackgroundColor3 = Color3.new(0,0,0)
                        from.dotEl.BackgroundTransparency = 0.5
                        wireStart = nil
                        status("Connected "..from.portType.." wire")
                    else
                        wireStart = nil
                        status("Incompatible port types: "..from.portType.." → "..ptype)
                    end
                else
                    -- Start wire from input (reverse)
                    if state.simMode then return end
                    wireStart = { nodeId=node.id, portIdx=row-1, isOutput=false, dotEl=dot, portType=ptype }
                    status("Drawing wire from input port — click an output port")
                end
            end)
        end

        -- Output port
        if row <= numOutputs then
            local portDef = def.out[row]
            local pname, ptype = portDef[1], portDef[2]
            local pcolor = getPortColor(ptype)

            local dot = frame(chipEl, UDim2.new(0,PORT_W,0,PORT_H),
                UDim2.new(1,-PORT_W/2, 0, rowY+5), pcolor)
            dot.ZIndex = 7
            if ptype == "exec" then dot.Rotation = 45; corner(dot, 0)
            else corner(dot, PORT_H/2) end
            local inner = frame(dot, UDim2.new(0,6,0,6), UDim2.new(0.5,-3,0.5,-3), C.chip)
            inner.ZIndex = 8; corner(inner, 3)
            dot.Name = "oport_"..node.id.."_"..(row-1)

            local lbl_p = label(chipEl, pname,
                UDim2.new(0,CHIP_W/2-12,0,ROW_H-2),
                C.text2, Enum.TextXAlignment.Right)
            lbl_p.Position = UDim2.new(0.5,2,0,rowY)
            lbl_p.ZIndex   = 6; lbl_p.TextSize = 10

            dot.InputBegan:Connect(function(inp)
                if inp.UserInputType ~= Enum.UserInputType.MouseButton1 then return end
                -- Simulate mode: fire exec
                if state.simMode and ptype == "exec" then
                    simFire(node.id, row-1, 0)
                    return
                end
                if wireStart and not wireStart.isOutput then
                    -- Complete from input→output
                    local from = wireStart
                    if compatible(ptype, from.portType) then
                        pushUndo()
                        local w = {
                            id       = wId(),
                            fromNode = node.id,
                            fromPort = row - 1,
                            toNode   = from.nodeId,
                            toPort   = from.portIdx,
                            type     = ptype,
                        }
                        table.insert(state.wires, w)
                        redrawWire(w)
                        wireStart = nil
                        status("Connected "..ptype.." wire")
                    else
                        wireStart = nil
                        status("Incompatible types")
                    end
                else
                    -- Start wire from output
                    if state.simMode then return end
                    wireStart = { nodeId=node.id, portIdx=row-1, isOutput=true, dotEl=dot, portType=ptype }
                    status("Drawing wire — click an input port to connect  |  right-click to cancel")
                end
            end)
        end
    end

    return chipEl
end

-- ═══════════════════════════════════════════════════════════════════════
-- NODE MANAGEMENT
-- ═══════════════════════════════════════════════════════════════════════
local function addNode(chipId, x, y)
    local def = CHIP_MAP[chipId]
    if not def then return end
    local id = newId()
    local node = { id=id, chipId=chipId, x=x or 400, y=y or 300 }
    state.nodes[id] = node
    renderChip(node)
    return node
end

function deleteNode(nodeId)
    -- Remove connected wires
    for i = #state.wires, 1, -1 do
        local w = state.wires[i]
        if w.fromNode == nodeId or w.toNode == nodeId then
            if w.el then w.el:Destroy() end
            table.remove(state.wires, i)
        end
    end
    -- Remove chip element
    local el = chipLayer:FindFirstChild("chip_"..nodeId)
    if el then el:Destroy() end
    state.nodes[nodeId] = nil
    status("Chip deleted")
end

-- ═══════════════════════════════════════════════════════════════════════
-- SIMULATION
-- ═══════════════════════════════════════════════════════════════════════
function simFire(nodeId, outPortIdx, depth)
    if depth > 30 then return end
    local def = CHIP_MAP[state.nodes[nodeId] and state.nodes[nodeId].chipId]
    if not def then return end

    -- Flash chip
    local el = chipLayer:FindFirstChild("chip_"..nodeId)
    if el then
        local orig = el.BackgroundColor3
        el.BackgroundColor3 = Color3.fromRGB(80,120,40)
        task.delay(0.4, function() if el and el.Parent then el.BackgroundColor3 = orig end end)
    end

    -- Follow exec wires from this output
    for _, w in ipairs(state.wires) do
        if w.fromNode == nodeId and w.fromPort == outPortIdx and w.type == "exec" then
            -- Flash wire
            if w.el then
                local wc = w.el.BackgroundColor3
                w.el.BackgroundColor3 = Color3.new(1,1,1)
                task.delay(0.25, function() if w.el and w.el.Parent then w.el.BackgroundColor3 = wc end end)
            end
            task.delay(0.2, function() simExecute(w.toNode, w.toPort, depth+1) end)
        end
    end
end

function simExecute(nodeId, inPortIdx, depth)
    local node = state.nodes[nodeId]
    if not node then return end
    local def = CHIP_MAP[node.chipId]
    if not def then return end

    -- Compute output values for math/logic chips
    local function inp(i)
        local src = getWireSource(nodeId, i)
        if src then return state.simPortVals[src.fromNode.."."..src.fromPort] or 0 end
        local pd = def.inp[i+1]
        local stored = node.defaults and node.defaults["i"..i]
        return stored or (pd and pd[3]) or 0
    end
    local function setOut(i, v)
        state.simPortVals[nodeId.."."..i] = v
    end

    local id = node.chipId
    if id=="add"    then setOut(0, inp(0)+inp(1))
    elseif id=="subtract" then setOut(0, inp(0)-inp(1))
    elseif id=="multiply" then setOut(0, inp(0)*inp(1))
    elseif id=="divide"   then local b2=inp(1); setOut(0, b2~=0 and inp(0)/b2 or 0)
    elseif id=="modulo"   then setOut(0, inp(0)%inp(1))
    elseif id=="abs"      then setOut(0, math.abs(inp(0)))
    elseif id=="round"    then setOut(0, math.round(inp(0)))
    elseif id=="floor"    then setOut(0, math.floor(inp(0)))
    elseif id=="ceil"     then setOut(0, math.ceil(inp(0)))
    elseif id=="min"      then setOut(0, math.min(inp(0),inp(1)))
    elseif id=="max"      then setOut(0, math.max(inp(0),inp(1)))
    elseif id=="sqrt"     then setOut(0, math.sqrt(math.max(0,inp(0))))
    elseif id=="sin"      then setOut(0, math.sin(inp(0)))
    elseif id=="cos"      then setOut(0, math.cos(inp(0)))
    elseif id=="and"      then setOut(0, inp(0) and inp(1))
    elseif id=="or"       then setOut(0, inp(0) or  inp(1))
    elseif id=="not"      then setOut(0, not inp(0))
    elseif id=="eq"       then setOut(0, inp(0)==inp(1))
    elseif id=="gt"       then setOut(0, inp(0)>inp(1))
    elseif id=="lt"       then setOut(0, inp(0)<inp(1))
    elseif id=="to_str"   then setOut(0, tostring(inp(0)))
    elseif id=="print"    then
        print("[RR Sim] "..tostring(inp(1)))
        status("▶ Print: "..tostring(inp(1)))
    elseif id=="rand"     then setOut(0, inp(0)+(inp(1)-inp(0))*math.random())
    elseif id=="randint"  then setOut(0, math.random(inp(0),math.max(inp(0),inp(1))))
    elseif id=="str_cat"  then setOut(0, tostring(inp(0))..tostring(inp(1)))
    end

    -- Branch
    if id == "branch" then
        local cond = inp(1)
        if cond then simFire(nodeId,0,depth+1) else simFire(nodeId,1,depth+1) end
        return
    end

    -- Sequence
    if id == "sequence" then
        for i=0, 4 do task.delay(i*0.2, function() simFire(nodeId,i,depth+1) end) end
        return
    end

    -- Delay
    if id == "delay" then
        local secs = math.min(inp(1), 3)
        status("⏱ Delay "..secs.."s...")
        task.delay(secs, function() simFire(nodeId,0,depth+1) end)
        return
    end

    -- Variable set
    if def.meta and def.meta.isVariable and inPortIdx == 0 then
        local newVal = inp(1)
        state.simVars[node.varName or "?"] = newVal
        state.simPortVals[nodeId..".1"] = newVal
        status("► "..tostring(node.varName).." = "..tostring(newVal))
    end

    -- Event sender → find matching receivers
    if id == "evt_send" then
        local evName = node.eventName or "MyEvent"
        local found = 0
        for rid, rnode in pairs(state.nodes) do
            if rnode.chipId == "evt_recv" and rnode.eventName == evName then
                found = found + 1
                task.delay(0.2, function() simFire(rid, 0, depth+1) end)
            end
        end
        status("📡 Event '"..evName.."' → "..found.." receiver(s)")
    end

    -- Follow all exec outputs
    for i, port in ipairs(def.out) do
        if port[2] == "exec" then
            task.delay(0.15, function() simFire(nodeId, i-1, depth+1) end)
        end
    end
end

function getWireSource(nodeId, portIdx)
    for _, w in ipairs(state.wires) do
        if w.toNode == nodeId and w.toPort == portIdx then
            return w
        end
    end
    return nil
end

-- ═══════════════════════════════════════════════════════════════════════
-- EXPORT TO LUA SCRIPT
-- ═══════════════════════════════════════════════════════════════════════
local function exportToScript()
    local lines = {}
    local function o(s) table.insert(lines, s) end

    o("-- Generated by RR Circuits Studio Plugin")
    o("-- " .. os.date("%Y-%m-%d %H:%M"))
    o("")
    o("local Players = game:GetService('Players')")
    o("")

    -- Variables
    local hasVars = false
    for _, node in pairs(state.nodes) do
        local def = CHIP_MAP[node.chipId]
        if def and def.meta and def.meta.isVariable then
            hasVars = true
            local scope = node.sceneScope or "Local"
            if scope == "☁ Cloud" then
                o("-- ☁ Cloud Variable: " .. (node.varName or "var"))
                o("local DataStore = game:GetService('DataStoreService'):GetDataStore('RRCircuits')")
            elseif scope == "🔄 30Hz" then
                o("-- 🔄 Synced Variable: " .. (node.varName or "var"))
            end
            local default = "nil"
            if def.meta.varType == "int" or def.meta.varType == "float" or def.meta.varType == "number" then default = "0" end
            if def.meta.varType == "bool" then default = "false" end
            if def.meta.varType == "string" then default = '""' end
            if def.meta.varType == "list" then default = "{}" end
            o("local " .. (node.varName or "myVar") .. " = " .. default)
        end
    end
    if hasVars then o("") end

    -- Scene object references (objects placed in scene)
    local hasScene = false
    for _, node in pairs(state.nodes) do
        local def = CHIP_MAP[node.chipId]
        if def and def.meta and def.meta.isSceneObject then
            hasScene = true
            local sname = node.sceneName or "SceneObj"
            local stype = def.meta.sceneType or "part"
            if stype == "ui_button" or stype == "ui_label" or stype == "ui_toggle" then
                -- UI references done in PlayerAdded
            else
                o("local " .. sname .. " = workspace:WaitForChild('" .. sname .. "', 10)")
                if stype == "button" or stype == "toggle_btn" then
                    o("local " .. sname .. "_click = " .. sname .. " and " .. sname .. ":WaitForChild('ClickDetector', 5)")
                elseif stype == "interact_vol" then
                    o("local " .. sname .. "_prompt = " .. sname .. " and " .. sname .. ":WaitForChild('ProximityPrompt', 5)")
                end
            end
        end
    end
    if hasScene then o("") end

    -- Entry points (event/init chips)
    local entries = {}
    for _, node in pairs(state.nodes) do
        local def = CHIP_MAP[node.chipId]
        if def and #def.inp == 0 then
            table.insert(entries, node)
        end
    end

    -- Build code for each entry
    local function emitNode(nodeId, indent, depth)
        if depth > 20 then return end
        local node = state.nodes[nodeId]
        if not node then return end
        local def  = CHIP_MAP[node.chipId]
        if not def then return end
        local ind  = string.rep("    ", indent)

        local function follow(outPort)
            for _, w in ipairs(state.wires) do
                if w.fromNode == nodeId and w.fromPort == outPort and w.type == "exec" then
                    emitNode(w.toNode, indent, depth+1)
                end
            end
        end

        local function inputVal(portIdx)
            for _, w in ipairs(state.wires) do
                if w.toNode == nodeId and w.toPort == portIdx and w.type ~= "exec" then
                    local srcNode = state.nodes[w.fromNode]
                    local srcDef  = srcNode and CHIP_MAP[srcNode.chipId]
                    if srcDef and srcDef.meta and srcDef.meta.isVariable then
                        return srcNode.varName or "var"
                    end
                    return "_o_"..w.fromNode.."_"..w.fromPort
                end
            end
            -- Default
            local pd = def.inp[portIdx+1]
            if not pd then return "nil" end
            local stored = node.defaults and node.defaults["i"..portIdx]
            local val = stored or pd[3]
            if pd[2] == "string" then return '"'..(val or "")..'"' end
            if pd[2] == "bool" then return val and "true" or "false" end
            return tostring(val or 0)
        end

        local id = node.chipId
        -- Math
        if id=="add"      then o(ind.."local _o_"..nodeId.."_0 = "..inputVal(0).." + "..inputVal(1))
        elseif id=="subtract" then o(ind.."local _o_"..nodeId.."_0 = "..inputVal(0).." - "..inputVal(1))
        elseif id=="multiply" then o(ind.."local _o_"..nodeId.."_0 = "..inputVal(0).." * "..inputVal(1))
        elseif id=="divide"   then o(ind.."local _o_"..nodeId.."_0 = "..inputVal(1).." ~= 0 and ("..inputVal(0).."/"..inputVal(1)..") or 0")
        elseif id=="modulo"   then o(ind.."local _o_"..nodeId.."_0 = "..inputVal(0).." % "..inputVal(1))
        elseif id=="abs"      then o(ind.."local _o_"..nodeId.."_0 = math.abs("..inputVal(0)..")")
        elseif id=="round"    then o(ind.."local _o_"..nodeId.."_0 = math.round("..inputVal(0)..")")
        elseif id=="floor"    then o(ind.."local _o_"..nodeId.."_0 = math.floor("..inputVal(0)..")")
        elseif id=="ceil"     then o(ind.."local _o_"..nodeId.."_0 = math.ceil("..inputVal(0)..")")
        elseif id=="sqrt"     then o(ind.."local _o_"..nodeId.."_0 = math.sqrt("..inputVal(0)..")")
        elseif id=="min"      then o(ind.."local _o_"..nodeId.."_0 = math.min("..inputVal(0)..","..inputVal(1)..")")
        elseif id=="max"      then o(ind.."local _o_"..nodeId.."_0 = math.max("..inputVal(0)..","..inputVal(1)..")")
        elseif id=="sin"      then o(ind.."local _o_"..nodeId.."_0 = math.sin("..inputVal(0)..")")
        elseif id=="cos"      then o(ind.."local _o_"..nodeId.."_0 = math.cos("..inputVal(0)..")")
        elseif id=="rand"     then o(ind.."local _o_"..nodeId.."_0 = math.random()*(("..inputVal(1).."-"..inputVal(0).."))+"..inputVal(0))
        elseif id=="randint"  then o(ind.."local _o_"..nodeId.."_0 = math.random("..inputVal(0)..","..inputVal(1)..")")
        -- Logic
        elseif id=="and"   then o(ind.."local _o_"..nodeId.."_0 = "..inputVal(0).." and "..inputVal(1))
        elseif id=="or"    then o(ind.."local _o_"..nodeId.."_0 = "..inputVal(0).." or  "..inputVal(1))
        elseif id=="not"   then o(ind.."local _o_"..nodeId.."_0 = not "..inputVal(0))
        elseif id=="eq"    then o(ind.."local _o_"..nodeId.."_0 = "..inputVal(0).." == "..inputVal(1))
        elseif id=="gt"    then o(ind.."local _o_"..nodeId.."_0 = "..inputVal(0).." > "..inputVal(1))
        elseif id=="lt"    then o(ind.."local _o_"..nodeId.."_0 = "..inputVal(0).." < "..inputVal(1))
        elseif id=="gte"   then o(ind.."local _o_"..nodeId.."_0 = "..inputVal(0).." >= "..inputVal(1))
        elseif id=="lte"   then o(ind.."local _o_"..nodeId.."_0 = "..inputVal(0).." <= "..inputVal(1))
        -- Branch
        elseif id=="branch" then
            o(ind.."if "..inputVal(1).." then")
            follow(0)
            o(ind.."else")
            follow(1)
            o(ind.."end")
            return
        -- Sequence
        elseif id=="sequence" then
            for pi=0,4 do follow(pi) end
            return
        -- Delay
        elseif id=="delay" then
            o(ind.."task.wait("..inputVal(1)..")")
            follow(0); return
        -- Variable Set
        elseif id:sub(1,4)=="var_" and def.meta and def.meta.isVariable then
            local vn = node.varName or "myVar"
            o(ind..vn.." = "..inputVal(1))
            follow(0); return
        -- Events
        elseif id=="evt_send" then
            o(ind.."-- Fire event: "..(node.eventName or "MyEvent"))
            o(ind.."fireEvent('"..( node.eventName or "MyEvent").."', "..inputVal(1)..", "..inputVal(2)..")")
            follow(0); return
        -- Player
        elseif id=="pl_teleport" then
            o(ind.."if "..inputVal(1).." then")
            o(ind.."    local char = "..inputVal(1)..".Character")
            o(ind.."    if char then char:SetPrimaryPartCFrame(CFrame.new("..inputVal(2)..")) end")
            o(ind.."end")
            follow(0); return
        elseif id=="pl_kill" then
            o(ind.."if "..inputVal(1)..".Character then")
            o(ind.."    "..inputVal(1)..".Character:FindFirstChildWhichIsA('Humanoid').Health = 0")
            o(ind.."end")
            follow(0); return
        -- UI
        elseif id=="ui_notify" then
            o(ind.."-- Notify: "..inputVal(2))
            follow(0); return
        -- Print
        elseif id=="print" then
            o(ind.."print("..inputVal(1)..")")
            follow(0); return
        -- Scene objects — Button
        elseif id=="btn_press" then
            local sn = node.sceneName or "btn"
            o(ind.."-- Button '"..sn.."' pressed (event already wired above)")
            follow(0); return
        elseif id=="trig_vol" then
            local sn = node.sceneName or "trig"
            o(ind.."-- Trigger '"..sn.."' entered (event already wired above)")
            follow(0); return
        -- Default: follow exec outs
        else
            o(ind.."-- ["..def.name.."]")
            for pi, port in ipairs(def.out) do
                if port[2] == "exec" then follow(pi-1) end
            end
            return
        end
        -- Follow default exec outs
        for pi, port in ipairs(def.out) do
            if port[2] == "exec" then follow(pi-1) end
        end
    end

    -- Scene object event connections
    o("-- ═══ Event Connections ═══")
    for _, node in pairs(state.nodes) do
        local def = CHIP_MAP[node.chipId]
        if def and def.meta and def.meta.isSceneObject then
            local sn   = node.sceneName or "SceneObj"
            local stype= def.meta.sceneType or ""
            if stype == "button" or stype == "toggle_btn" then
                o("if "..sn.."_click then")
                o("    "..sn.."_click.MouseClick:Connect(function(player)")
                emitNode(node.id, 2, 0)
                o("    end)")
                o("end")
                o("")
            elseif stype == "trigger_vol" then
                o("if "..sn.." then")
                o("    "..sn..".Touched:Connect(function(hit)")
                o("        local player = Players:GetPlayerFromCharacter(hit.Parent)")
                o("        if not player then return end")
                emitNode(node.id, 2, 0)
                o("    end)")
                o("end")
                o("")
            elseif stype == "interact_vol" then
                o("if "..sn.."_prompt then")
                o("    "..sn.."_prompt.Triggered:Connect(function(player)")
                emitNode(node.id, 2, 0)
                o("    end)")
                o("end")
                o("")
            end
        end
    end

    -- Entry point handlers
    for _, node in pairs(entries) do
        local def = CHIP_MAP[node.chipId]
        if not def or (def.meta and def.meta.isSceneObject) then goto continue end
        local id = node.chipId
        if id == "on_init" then
            o("-- On Init"); o("do")
            emitNode(node.id, 1, 0)
            o("end")
        elseif id == "on_update" then
            o("game:GetService('RunService').Heartbeat:Connect(function(dt)")
            emitNode(node.id, 1, 0)
            o("end)")
        elseif id == "on_joined" then
            o("Players.PlayerAdded:Connect(function(player)")
            emitNode(node.id, 1, 0)
            o("end)")
        elseif id == "on_left" then
            o("Players.PlayerRemoving:Connect(function(player)")
            emitNode(node.id, 1, 0)
            o("end)")
        elseif id == "evt_recv" then
            o("-- Event Receiver: "..(node.eventName or "MyEvent"))
        end
        ::continue::
    end

    return table.concat(lines, "\n")
end

-- ═══════════════════════════════════════════════════════════════════════
-- SCENE CREATION (same as main plugin)
-- ═══════════════════════════════════════════════════════════════════════
local function hexToColor3(hex)
    hex = tostring(hex):gsub("#","")
    if #hex < 6 then return Color3.new(0.7,0.7,0.7) end
    return Color3.fromRGB(
        tonumber(hex:sub(1,2),16) or 180,
        tonumber(hex:sub(3,4),16) or 180,
        tonumber(hex:sub(5,6),16) or 180)
end

local function parseVec(s, dx,dy,dz)
    local t={}
    for v in (tostring(s or "")):gmatch("[%-%.%d]+") do t[#t+1]=tonumber(v) or 0 end
    return Vector3.new(t[1] or dx or 0, t[2] or dy or 2, t[3] or dz or 0)
end

local function createSceneObjects()
    local count = 0
    for _, node in pairs(state.nodes) do
        local def = CHIP_MAP[node.chipId]
        if def and def.meta and def.meta.isSceneObject then
            local sn   = node.sceneName or "SceneObj"
            local sc   = node.sceneConfig or {}
            local stype= def.meta.sceneType or "part"
            local col  = hexToColor3(sc.color or "AAAAAA")

            -- Remove existing
            local ex = workspace:FindFirstChild(sn)
            if ex then ex:Destroy() end

            if stype == "button" or stype == "toggle_btn" then
                local p = Instance.new("Part")
                p.Name=sn; p.Size=parseVec(sc.size,4,2,4)
                p.Position=parseVec(sc.pos,0,1,0); p.Anchored=true
                p.Color=col; p.Material=Enum.Material.SmoothPlastic
                p.Parent=workspace
                local sg=Instance.new("SurfaceGui"); sg.Face=Enum.NormalId.Top; sg.Parent=p
                local tl=Instance.new("TextLabel",sg)
                tl.Size=UDim2.new(1,0,1,0); tl.BackgroundTransparency=1
                tl.Text=sc.text or sn; tl.TextColor3=Color3.new(1,1,1)
                tl.Font=Enum.Font.GothamBold; tl.TextScaled=true
                local cd=Instance.new("ClickDetector"); cd.MaxActivationDistance=tonumber(sc.maxDist) or 32; cd.Parent=p
                count=count+1

            elseif stype == "trigger_vol" then
                local p=Instance.new("Part"); p.Name=sn
                p.Size=parseVec(sc.size,10,8,10); p.Position=parseVec(sc.pos,0,4,0)
                p.Anchored=true; p.CanCollide=false
                p.Transparency=tonumber(sc.opacity) or 0.7
                p.Color=col; p.Material=Enum.Material.Neon; p.Parent=workspace
                local sel=Instance.new("SelectionBox"); sel.Adornee=p; sel.Color3=col
                sel.LineThickness=0.04; sel.Parent=workspace
                count=count+1

            elseif stype == "interact_vol" then
                local p=Instance.new("Part"); p.Name=sn
                p.Size=parseVec(sc.size,6,4,6); p.Position=parseVec(sc.pos,0,2,0)
                p.Anchored=true; p.CanCollide=false; p.Transparency=0.6
                p.Color=col; p.Material=Enum.Material.Neon; p.Parent=workspace
                local pp=Instance.new("ProximityPrompt")
                pp.ActionText=sc.promptText or "Interact"
                pp.MaxActivationDistance=tonumber(sc.maxDist) or 8
                pp.RequiresLineOfSight=false; pp.Parent=p
                count=count+1

            elseif stype == "ui_button" or stype == "ui_toggle" then
                local guiName = sc.parent or "RRGui"
                local gui = StarterGui:FindFirstChild(guiName)
                if not gui then
                    gui=Instance.new("ScreenGui"); gui.Name=guiName
                    gui.ResetOnSpawn=false; gui.IgnoreGuiInset=true; gui.Parent=StarterGui
                end
                local btn = Instance.new("TextButton"); btn.Name=sn
                local sz = parseVec(sc.size and sc.size..",0" or "200,50,0",200,50,0)
                btn.Size=UDim2.new(0,sz.X,0,sz.Y)
                btn.BackgroundColor3=hexToColor3(sc.bgColor or sc.color or "0066FF")
                btn.TextColor3=Color3.new(1,1,1); btn.Text=sc.text or "Button"
                btn.Font=Enum.Font.GothamBold; btn.TextSize=16; btn.BorderSizePixel=0
                btn.Parent=gui
                Instance.new("UICorner",btn).CornerRadius=UDim.new(0,8)
                count=count+1
            end
        end
    end
    status("🏗 Created "..count.." scene object(s) in Workspace/StarterGui")
end

-- ═══════════════════════════════════════════════════════════════════════
-- SAVE / LOAD (plugin settings)
-- ═══════════════════════════════════════════════════════════════════════
local SAVE_KEY = "RRCircuits_Save_v1"

local function saveCircuit()
    local data = { nodes={}, wires={}, nextId=state.nextId }
    for id, node in pairs(state.nodes) do
        data.nodes[id] = {
            id=node.id, chipId=node.chipId, x=node.x, y=node.y,
            varName=node.varName, sceneName=node.sceneName,
            sceneConfig=node.sceneConfig, sceneScope=node.sceneScope,
            eventName=node.eventName, eventScope=node.eventScope,
        }
    end
    for _, w in ipairs(state.wires) do
        table.insert(data.wires, {
            id=w.id, fromNode=w.fromNode, fromPort=w.fromPort,
            toNode=w.toNode, toPort=w.toPort, type=w.type
        })
    end
    local ok, encoded = pcall(HttpService.JSONEncode, HttpService, data)
    if ok then
        plugin:SetSetting(SAVE_KEY, encoded)
        status("💾 Saved ("..#state.nodes.." nodes, "..#state.wires.." wires)")
    else
        status("Save failed: "..tostring(encoded))
    end
end

local function loadCircuit()
    local encoded = plugin:GetSetting(SAVE_KEY)
    if not encoded or encoded == "" then status("No saved circuit found"); return end
    local ok, data = pcall(HttpService.JSONDecode, HttpService, encoded)
    if not ok then status("Load failed"); return end

    -- Clear canvas
    for _, ch in ipairs(chipLayer:GetChildren()) do ch:Destroy() end
    for _, wf in ipairs(wireLayer:GetChildren()) do wf:Destroy() end
    state.nodes = {}; state.wires = {}

    state.nextId = data.nextId or 1
    for id, nd in pairs(data.nodes or {}) do
        state.nodes[id] = nd
        renderChip(nd)
    end
    for _, w in ipairs(data.wires or {}) do
        table.insert(state.wires, w)
    end
    task.wait(0.05)
    redrawAllWires()
    status("📂 Loaded ("..#data.wires.." wires)")
end

-- ═══════════════════════════════════════════════════════════════════════
-- SIDEBAR CHIP LIST
-- ═══════════════════════════════════════════════════════════════════════
local sidebarChips = {}  -- flattened list of visible chip buttons

local function buildSidebar(filter)
    filter = filter and filter:lower() or ""
    for _, ch in ipairs(chipScroll:GetChildren()) do
        if ch:IsA("Frame") or ch:IsA("TextButton") then ch:Destroy() end
    end
    sidebarChips = {}

    local byCategory = {}
    for _, ch in ipairs(CHIPS) do
        local matches = filter == "" or
            ch.name:lower():find(filter, 1, true) or
            ch.cat:lower():find(filter, 1, true)
        if matches then
            if not byCategory[ch.cat] then byCategory[ch.cat] = {} end
            table.insert(byCategory[ch.cat], ch)
        end
    end

    local order = {"Control Flow","Math","Logic","Variables","Lists",
                   "Events","Player","Volumes","UI","Objects","Combatant",
                   "String","Conversion","Random","Debug","Custom"}

    local lo = 1
    for _, catName in ipairs(order) do
        local chips = byCategory[catName]
        if chips and #chips > 0 then
            local catCol = CAT_COLOR[catName] or C.text2

            -- Category header
            local hdrF = frame(chipScroll, UDim2.new(1,0,0,22), nil, Color3.fromRGB(6,14,28))
            hdrF.LayoutOrder = lo; lo = lo + 1
            local catLbl = label(hdrF, catName,
                UDim2.new(1,-26,1,0), catCol, Enum.TextXAlignment.Left)
            catLbl.Position = UDim2.new(0,10,0,0); catLbl.TextSize = 10; catLbl.Font = Enum.Font.GothamBold
            local countLbl = label(hdrF, "("..#chips..")",
                UDim2.new(0,24,1,0), C.text3, Enum.TextXAlignment.Right)
            countLbl.Position = UDim2.new(1,-26,0,0); countLbl.TextSize = 9

            for _, ch in ipairs(chips) do
                local chipBtn = frame(chipScroll, UDim2.new(1,0,0,26), nil, Color3.new(0,0,0))
                chipBtn.BackgroundTransparency = 1
                chipBtn.LayoutOrder = lo; lo = lo + 1

                local iconF = frame(chipBtn, UDim2.new(0,18,0,18),
                    UDim2.new(0,8,0,4), Color3.fromRGB(catCol.R*255*0.15,catCol.G*255*0.15,catCol.B*255*0.15))
                iconF.BackgroundColor3 = Color3.new(catCol.R*0.12, catCol.G*0.12, catCol.B*0.12)
                corner(iconF, 4)
                local iconLbl = label(iconF, "∑", UDim2.new(1,0,1,0), catCol,
                    Enum.TextXAlignment.Center); iconLbl.TextSize = 10

                local nameLbl = label(chipBtn, ch.name,
                    UDim2.new(1,-55,1,0), C.text, Enum.TextXAlignment.Left)
                nameLbl.Position = UDim2.new(0,30,0,0); nameLbl.TextSize = 11

                local portLbl = label(chipBtn, #ch.inp.."→"..#ch.out,
                    UDim2.new(0,28,1,0), C.text3, Enum.TextXAlignment.Right)
                portLbl.Position = UDim2.new(1,-30,0,0); portLbl.TextSize = 9

                -- Click to place chip at canvas center
                chipBtn.InputBegan:Connect(function(inp)
                    if inp.UserInputType == Enum.UserInputType.MouseButton1 then
                        -- Place at visible center of canvas
                        local px = canvasFrame.AbsoluteSize.X / 2 / state.scale - state.panX / state.scale
                        local py = canvasFrame.AbsoluteSize.Y / 2 / state.scale - state.panY / state.scale
                        addNode(ch.id, px, py)
                        status("Added: "..ch.name)
                    end
                end)

                -- Hover
                chipBtn.MouseEnter:Connect(function()
                    chipBtn.BackgroundTransparency = 0
                    chipBtn.BackgroundColor3 = Color3.fromRGB(15,30,55)
                end)
                chipBtn.MouseLeave:Connect(function()
                    chipBtn.BackgroundTransparency = 1
                end)

                table.insert(sidebarChips, {btn=chipBtn, chip=ch})
            end

            -- Separator
            local sep = frame(chipScroll, UDim2.new(1,0,0,1), nil, C.border)
            sep.LayoutOrder = lo; lo = lo + 1
        end
    end
end

-- ═══════════════════════════════════════════════════════════════════════
-- CANVAS PAN (middle mouse or alt+drag)
-- ═══════════════════════════════════════════════════════════════════════
local function applyPan()
    canvasContainer.Position = UDim2.new(0, -CANVAS_OX + state.panX, 0, -CANVAS_OX + state.panY)
end

canvasFrame.InputBegan:Connect(function(inp)
    if inp.UserInputType == Enum.UserInputType.MouseButton3 or
       (inp.UserInputType == Enum.UserInputType.MouseButton1 and
        UserInputService:IsKeyDown(Enum.KeyCode.LeftAlt)) then
        isPanning   = true
        panStartX   = inp.Position.X
        panStartY   = inp.Position.Y
        panStartContX = state.panX
        panStartContY = state.panY
    end
    if inp.UserInputType == Enum.UserInputType.MouseButton2 then
        -- Cancel wire on right click
        if wireStart then
            wireStart = nil
            status("Wire cancelled")
        end
    end
end)

UserInputService.InputChanged:Connect(function(inp)
    if not isPanning then return end
    if inp.UserInputType == Enum.UserInputType.MouseMovement then
        state.panX = panStartContX + (inp.Position.X - panStartX)
        state.panY = panStartContY + (inp.Position.Y - panStartY)
        applyPan()
    end
end)

UserInputService.InputEnded:Connect(function(inp)
    if inp.UserInputType == Enum.UserInputType.MouseButton3 then
        isPanning = false
    end
    if inp.UserInputType == Enum.UserInputType.MouseButton1 then
        isPanning = false
    end
end)

-- Zoom with scroll wheel
canvasFrame.InputChanged:Connect(function(inp)
    if inp.UserInputType == Enum.UserInputType.MouseWheel then
        local factor = inp.Position.Z > 0 and 1.1 or 0.9
        state.scale  = math.clamp(state.scale * factor, 0.2, 3)
        canvasContainer.Size = UDim2.new(0, 8000*state.scale, 0, 8000*state.scale)
        canvasContainer.Position = UDim2.new(0, -CANVAS_OX*state.scale + state.panX,
                                              0, -CANVAS_OX*state.scale + state.panY)
        zoomLbl.Text = math.round(state.scale*100).."%"
    end
end)

-- ═══════════════════════════════════════════════════════════════════════
-- HEADER BUTTONS
-- ═══════════════════════════════════════════════════════════════════════
btnSave.MouseButton1Click:Connect(saveCircuit)
btnLoad.MouseButton1Click:Connect(loadCircuit)

btnSimulate.MouseButton1Click:Connect(function()
    state.simMode = not state.simMode
    state.simVars = {}; state.simPortVals = {}
    if state.simMode then
        btnSimulate.Text = "⏹ Stop"
        btnSimulate.BackgroundColor3 = Color3.fromRGB(120,30,0)
        status("▶ SIMULATE — click any orange exec output port to fire")
    else
        btnSimulate.Text = "▶ Simulate"
        btnSimulate.BackgroundColor3 = Color3.fromRGB(40,20,0)
        status("Simulation stopped")
    end
end)

btnExport.MouseButton1Click:Connect(function()
    local code = exportToScript()
    -- Insert script into ServerScriptService
    local existing = game:GetService("ServerScriptService"):FindFirstChild("RRCircuit")
    if existing then existing:Destroy() end
    local s = Instance.new("Script")
    s.Name   = "RRCircuit"
    s.Source = code
    s.Parent = game:GetService("ServerScriptService")
    status("⬆ Exported → Script 'RRCircuit' in ServerScriptService ("..#code.." chars)")
end)

btnScene.MouseButton1Click:Connect(function()
    createSceneObjects()
end)

btnClear.MouseButton1Click:Connect(function()
    pushUndo()
    for _, ch in ipairs(chipLayer:GetChildren()) do ch:Destroy() end
    for _, wf in ipairs(wireLayer:GetChildren()) do wf:Destroy() end
    state.nodes = {}; state.wires = {}
    wireStart = nil
    status("Canvas cleared")
end)

-- ═══════════════════════════════════════════════════════════════════════
-- SEARCH
-- ═══════════════════════════════════════════════════════════════════════
searchBox:GetPropertyChangedSignal("Text"):Connect(function()
    buildSidebar(searchBox.Text)
end)

-- ═══════════════════════════════════════════════════════════════════════
-- TOOLBAR BUTTON TOGGLE
-- ═══════════════════════════════════════════════════════════════════════
mainBtn.Click:Connect(function()
    widget.Enabled = not widget.Enabled
end)

-- ═══════════════════════════════════════════════════════════════════════
-- INIT
-- ═══════════════════════════════════════════════════════════════════════
buildSidebar()
applyPan()

-- Try to restore last save
task.delay(0.5, function()
    local saved = plugin:GetSetting(SAVE_KEY)
    if saved and saved ~= "" then
        local ok, _ = pcall(loadCircuit)
        if not ok then status("Could not restore last session") end
    else
        status("RR Circuits Studio — drag chips from sidebar, click ports to wire  |  middle-click to pan  |  scroll to zoom")
    end
end)

print("[RR Circuits Studio Plugin] Loaded — click 'RR Circuits' in toolbar to open")
