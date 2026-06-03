--[[
  RR Circuits — Roblox Studio Plugin  v1.1
  ==========================================
  Connects to RR Circuits on your PC and:
    1. Creates buttons / trigger volumes / UI directly in the WORKSPACE & StarterGui
    2. Inserts the generated Script that references those objects

  SETUP:
  1. Save this file to:  %LOCALAPPDATA%\Roblox\Plugins\RRCircuits.lua
  2. Enable HTTP:  Studio → File → Studio Settings → Security → Allow HTTP Requests ✓
  3. Open RR Circuits → 🔌 Engine Connect → push your circuit
  4. Click the RR Circuits toolbar button in Studio → Start Listening
--]]

local HttpService  = game:GetService("HttpService")
local RunService   = game:GetService("RunService")
local StarterGui   = game:GetService("StarterGui")
local Players      = game:GetService("Players")

local HOST = "http://localhost:9001"
local POLL = 1.5   -- seconds between polls

-- ── Toolbar + Panel ───────────────────────────────────────────────────────────
local toolbar = plugin:CreateToolbar("RR Circuits")
local mainBtn = toolbar:CreateButton(
    "RR Circuits",
    "Connect to RR Circuits editor on your PC\n(run 'npm start' in the project folder)",
    "rbxassetid://14978048121"
)

local widgetInfo = DockWidgetPluginGuiInfo.new(
    Enum.InitialDockState.Right, false, false, 260, 440, 220, 320)
local widget = plugin:CreateDockWidgetPluginGui("RRCPanel", widgetInfo)
widget.Title  = "RR Circuits"
widget.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

-- ── Build UI ─────────────────────────────────────────────────────────────────
local root = Instance.new("Frame", widget)
root.Size  = UDim2.new(1,0,1,0)
root.BackgroundColor3 = Color3.fromRGB(8,18,34)
root.BorderSizePixel  = 0

local uil = Instance.new("UIListLayout", root)
uil.FillDirection = Enum.FillDirection.Vertical
uil.SortOrder     = Enum.SortOrder.LayoutOrder
uil.Padding       = UDim.new(0,5)

local pad = Instance.new("UIPadding", root)
pad.PaddingLeft   = UDim.new(0,10)
pad.PaddingRight  = UDim.new(0,10)
pad.PaddingTop    = UDim.new(0,10)
pad.PaddingBottom = UDim.new(0,6)

local function label(txt, size, color, lo)
    local l = Instance.new("TextLabel", root)
    l.Size  = UDim2.new(1,0,0, size or 18)
    l.BackgroundTransparency = 1
    l.Font  = Enum.Font.Gotham
    l.TextSize = size or 12
    l.TextColor3 = color or Color3.fromRGB(160,200,240)
    l.TextXAlignment = Enum.TextXAlignment.Left
    l.Text  = txt
    l.TextWrapped = true
    l.LayoutOrder = lo or 0
    return l
end

local function button(txt, bgColor, lo)
    local b = Instance.new("TextButton", root)
    b.Size  = UDim2.new(1,0,0,34)
    b.BackgroundColor3 = bgColor or Color3.fromRGB(30,60,100)
    b.BorderSizePixel  = 0
    b.Font  = Enum.Font.GothamBold
    b.TextSize = 13
    b.TextColor3 = Color3.new(1,1,1)
    b.Text  = txt
    b.LayoutOrder = lo or 0
    Instance.new("UICorner",b).CornerRadius = UDim.new(0,6)
    return b
end

local function sep(lo)
    local f = Instance.new("Frame",root)
    f.Size  = UDim2.new(1,0,0,1)
    f.BackgroundColor3 = Color3.fromRGB(25,45,75)
    f.BorderSizePixel  = 0
    f.LayoutOrder = lo or 0
end

label("⚡ RR Circuits", 15, Color3.fromRGB(255,140,0), 1)
label("Auto-import from your circuit editor.", 11, Color3.fromRGB(100,140,180), 2)
sep(3)

local statusLbl  = label("● Disconnected", 12, Color3.fromRGB(200,60,60), 4)
local infoLbl    = label("", 10, Color3.fromRGB(80,110,150), 5)
sep(6)

-- Script type / parent
local function makeDD(opts, lo)
    local b = Instance.new("TextButton", root)
    b.Size = UDim2.new(1,0,0,28)
    b.BackgroundColor3 = Color3.fromRGB(12,26,48)
    b.BorderColor3 = Color3.fromRGB(40,70,110)
    b.BorderSizePixel = 1
    b.Font = Enum.Font.Gotham; b.TextSize = 11
    b.TextColor3 = Color3.fromRGB(180,220,255)
    b.TextXAlignment = Enum.TextXAlignment.Left
    b.Text = "  "..opts[1]
    b.LayoutOrder = lo or 0
    local idx = 1
    b.MouseButton1Click:Connect(function()
        idx = (idx % #opts) + 1
        b.Text = "  "..opts[idx]
    end)
    return b, function() return opts[idx] end
end

label("Script Type:", 10, Color3.fromRGB(100,130,160), 7)
local typeDD, getType = makeDD({"Script","LocalScript","ModuleScript"}, 8)
label("Insert Into:", 10, Color3.fromRGB(100,130,160), 9)
local parentDD, getParent = makeDD({
    "ServerScriptService","ReplicatedStorage",
    "StarterPlayerScripts","StarterGui","Workspace"
}, 10)
sep(11)

local connectBtn = button("▶ Start Listening", Color3.fromRGB(15,110,55), 12)
local pushBtn    = button("⬆ Push Now",        Color3.fromRGB(15,55,130), 13)
local clearBtn   = button("🗑 Clear Scene Objects", Color3.fromRGB(90,25,25), 14)
sep(15)
label("Need: Studio Settings → Security\n→ Allow HTTP Requests ✓", 10, Color3.fromRGB(80,110,145), 16)

-- ── State ─────────────────────────────────────────────────────────────────────
local listening   = false
local lastCode    = ""
local insertedScript = nil

-- ── Parent map ────────────────────────────────────────────────────────────────
local function resolveParent(name)
    local map = {
        ServerScriptService    = game:GetService("ServerScriptService"),
        ReplicatedStorage      = game:GetService("ReplicatedStorage"),
        StarterPlayerScripts   = game:GetService("StarterPlayer").StarterPlayerScripts,
        StarterGui             = game:GetService("StarterGui"),
        Workspace              = workspace,
    }
    return map[name] or game:GetService("ServerScriptService")
end

-- ── Create scene objects in the ACTUAL Studio scene ───────────────────────────
local function hexToColor3(hex)
    hex = hex:gsub("#","")
    if #hex < 6 then return Color3.new(0.7,0.7,0.7) end
    local r = tonumber(hex:sub(1,2),16) / 255
    local g = tonumber(hex:sub(3,4),16) / 255
    local b = tonumber(hex:sub(5,6),16) / 255
    return Color3.new(r,g,b)
end

local function parseVec(s, default)
    default = default or {0,2,0}
    local parts = {}
    for v in (s or ""):gmatch("[%-%.%d]+") do
        table.insert(parts, tonumber(v) or 0)
    end
    return {
        parts[1] or default[1],
        parts[2] or default[2],
        parts[3] or default[3],
    }
end

local function parseUDim2(s)
    -- format: "scaleX,offsetX,scaleY,offsetY"  e.g. "0.5,-100,0.9,0"
    local p = {}
    for v in (s or ""):gmatch("[%-%.%d]+") do table.insert(p, tonumber(v) or 0) end
    return UDim2.new(p[1] or 0.5, p[2] or -100, p[3] or 0.9, p[4] or 0)
end

local createdObjects = {}  -- tracks objects we created so Clear works

local function ensureGui(guiName)
    guiName = guiName or "RRGui"
    local existing = StarterGui:FindFirstChild(guiName)
    if existing then return existing end
    local gui = Instance.new("ScreenGui")
    gui.Name          = guiName
    gui.ResetOnSpawn  = false
    gui.IgnoreGuiInset = true
    gui.Parent        = StarterGui
    table.insert(createdObjects, gui)
    return gui
end

local function createObject(obj)
    -- obj has: type, name, config (pos, size, color, text, promptText, maxDist, opacity, parent, bgColor, textColor, size2d)
    local c    = obj.config or {}
    local name = obj.name or ("RRObj_"..tostring(math.random(1000,9999)))
    local t    = obj.type or "part"

    -- ── Buttons ──────────────────────────────────────────────────────────────
    if t == "button" or t == "toggle_btn" then
        -- Remove old if exists
        if workspace:FindFirstChild(name) then
            workspace:FindFirstChild(name):Destroy()
        end
        local pos = parseVec(c.pos, {0,1,0})
        local sz  = parseVec(c.size, {4,2,4})

        local part = Instance.new("Part")
        part.Name       = name
        part.Size       = Vector3.new(sz[1], sz[2], sz[3])
        part.Position   = Vector3.new(pos[1], pos[2], pos[3])
        part.Anchored   = true
        part.Color      = hexToColor3(c.color or "0066FF")
        part.Material   = Enum.Material.SmoothPlastic
        part.CastShadow = true
        part.Parent     = workspace

        -- Surface label
        local sg = Instance.new("SurfaceGui")
        sg.Face   = Enum.NormalId.Top
        sg.Parent = part
        local tl = Instance.new("TextLabel", sg)
        tl.Size  = UDim2.new(1,0,1,0)
        tl.BackgroundTransparency = 1
        tl.Text  = c.text or name
        tl.TextColor3 = Color3.new(1,1,1)
        tl.Font  = Enum.Font.GothamBold
        tl.TextScaled = true

        -- ClickDetector
        local cd = Instance.new("ClickDetector")
        cd.MaxActivationDistance = tonumber(c.maxDist) or 32
        cd.Parent = part

        table.insert(createdObjects, part)
        print("[RR Circuits] Created "..(t=="toggle_btn" and "Toggle Button" or "Button")..": "..name)

    -- ── Trigger Volume ────────────────────────────────────────────────────────
    elseif t == "trigger_vol" then
        if workspace:FindFirstChild(name) then workspace:FindFirstChild(name):Destroy() end
        local pos = parseVec(c.pos, {0,4,0})
        local sz  = parseVec(c.size, {10,8,10})

        local part = Instance.new("Part")
        part.Name         = name
        part.Size         = Vector3.new(sz[1], sz[2], sz[3])
        part.Position     = Vector3.new(pos[1], pos[2], pos[3])
        part.Anchored     = true
        part.Transparency = tonumber(c.opacity) or 0.7
        part.CanCollide   = false
        part.Color        = hexToColor3(c.color or "FF6600")
        part.Material     = Enum.Material.Neon
        part.CastShadow   = false
        part.Parent       = workspace

        -- Visual selection box hint
        local sel = Instance.new("SelectionBox")
        sel.Adornee = part
        sel.Color3  = hexToColor3(c.color or "FF6600")
        sel.LineThickness = 0.03
        sel.Parent  = part

        table.insert(createdObjects, part)
        print("[RR Circuits] Created Trigger Volume: "..name)

    -- ── Interaction Volume (ProximityPrompt) ──────────────────────────────────
    elseif t == "interact_vol" then
        if workspace:FindFirstChild(name) then workspace:FindFirstChild(name):Destroy() end
        local pos = parseVec(c.pos, {0,2,0})
        local sz  = parseVec(c.size, {6,4,6})

        local part = Instance.new("Part")
        part.Name         = name
        part.Size         = Vector3.new(sz[1], sz[2], sz[3])
        part.Position     = Vector3.new(pos[1], pos[2], pos[3])
        part.Anchored     = true
        part.Transparency = 0.6
        part.CanCollide   = false
        part.Color        = hexToColor3(c.color or "00CCFF")
        part.Material     = Enum.Material.Neon
        part.Parent       = workspace

        local prompt = Instance.new("ProximityPrompt")
        prompt.ActionText              = c.promptText or "Interact"
        prompt.ObjectText              = name
        prompt.MaxActivationDistance   = tonumber(c.maxDist) or 8
        prompt.RequiresLineOfSight     = false
        prompt.Parent = part

        table.insert(createdObjects, part)
        print("[RR Circuits] Created Interaction Volume: "..name)

    -- ── Handle Volume ─────────────────────────────────────────────────────────
    elseif t == "handle_vol" then
        if workspace:FindFirstChild(name) then workspace:FindFirstChild(name):Destroy() end
        local pos = parseVec(c.pos, {0,2,0})
        local sz  = parseVec(c.size, {4,4,4})

        local part = Instance.new("Part")
        part.Name         = name
        part.Size         = Vector3.new(sz[1], sz[2], sz[3])
        part.Position     = Vector3.new(pos[1], pos[2], pos[3])
        part.Anchored     = true
        part.Transparency = 0.5
        part.CanCollide   = false
        part.Color        = hexToColor3(c.color or "AA66FF")
        part.Material     = Enum.Material.Neon
        part.Parent       = workspace

        table.insert(createdObjects, part)
        print("[RR Circuits] Created Handle Volume: "..name)

    -- ── ScreenGui ─────────────────────────────────────────────────────────────
    elseif t == "screen_gui" then
        if StarterGui:FindFirstChild(name) then StarterGui:FindFirstChild(name):Destroy() end
        local gui = Instance.new("ScreenGui")
        gui.Name          = name
        gui.ResetOnSpawn  = (c.resetOnSpawn == "true")
        gui.IgnoreGuiInset = true
        gui.Parent        = StarterGui
        table.insert(createdObjects, gui)
        print("[RR Circuits] Created ScreenGui: "..name)

    -- ── UI Button ─────────────────────────────────────────────────────────────
    elseif t == "ui_button" then
        local gui = ensureGui(c.parent)
        if gui:FindFirstChild(name) then gui:FindFirstChild(name):Destroy() end
        local sz  = parseVec(c.size or "200,50,0", {200,50,0})
        local pos = parseUDim2(c.pos)

        local btn = Instance.new("TextButton")
        btn.Name            = name
        btn.Size            = UDim2.new(0, sz[1], 0, sz[2])
        btn.Position        = pos
        btn.BackgroundColor3 = hexToColor3(c.bgColor or "0066FF")
        btn.TextColor3      = hexToColor3(c.textColor or "FFFFFF")
        btn.Text            = c.text or "Button"
        btn.Font            = Enum.Font.GothamBold
        btn.TextSize        = 16
        btn.BorderSizePixel = 0
        btn.Parent          = gui
        Instance.new("UICorner",btn).CornerRadius = UDim.new(0,8)
        table.insert(createdObjects, btn)
        print("[RR Circuits] Created UI Button: "..name)

    -- ── UI Label ──────────────────────────────────────────────────────────────
    elseif t == "ui_label" then
        local gui = ensureGui(c.parent)
        if gui:FindFirstChild(name) then gui:FindFirstChild(name):Destroy() end
        local sz  = parseVec(c.size or "200,30,0", {200,30,0})
        local pos = parseUDim2(c.pos)

        local lbl = Instance.new("TextLabel")
        lbl.Name            = name
        lbl.Size            = UDim2.new(0, sz[1], 0, sz[2])
        lbl.Position        = pos
        lbl.BackgroundTransparency = 1
        lbl.TextColor3      = hexToColor3(c.textColor or "FFFFFF")
        lbl.Text            = c.text or "Label"
        lbl.Font            = Enum.Font.Gotham
        lbl.TextSize        = 14
        lbl.Parent          = gui
        table.insert(createdObjects, lbl)

    -- ── UI Frame ──────────────────────────────────────────────────────────────
    elseif t == "ui_frame" then
        local gui = ensureGui(c.parent)
        if gui:FindFirstChild(name) then gui:FindFirstChild(name):Destroy() end
        local sz  = parseVec(c.size or "300,200,0", {300,200,0})
        local pos = parseUDim2(c.pos)

        local frame = Instance.new("Frame")
        frame.Name            = name
        frame.Size            = UDim2.new(0, sz[1], 0, sz[2])
        frame.Position        = pos
        frame.BackgroundColor3 = hexToColor3(c.bgColor or "111827")
        frame.BorderSizePixel  = 0
        frame.Parent           = gui
        Instance.new("UICorner",frame).CornerRadius = UDim.new(0,8)
        table.insert(createdObjects, frame)

    -- ── UI Toggle ─────────────────────────────────────────────────────────────
    elseif t == "ui_toggle" then
        local gui = ensureGui(c.parent)
        if gui:FindFirstChild(name) then gui:FindFirstChild(name):Destroy() end
        local sz  = parseVec(c.size or "200,50,0", {200,50,0})
        local pos = parseUDim2(c.pos)

        local btn = Instance.new("TextButton")
        btn.Name            = name
        btn.Size            = UDim2.new(0, sz[1], 0, sz[2])
        btn.Position        = pos
        btn.BackgroundColor3 = hexToColor3(c.offColor or "AA0000")
        btn.TextColor3      = Color3.new(1,1,1)
        btn.Text            = c.text or "OFF"
        btn.Font            = Enum.Font.GothamBold
        btn.TextSize        = 16
        btn.BorderSizePixel = 0
        btn.Parent          = gui
        -- Store on/off colors as attributes for the script to read
        btn:SetAttribute("OnColor",  c.onColor  or "00AA44")
        btn:SetAttribute("OffColor", c.offColor or "AA0000")
        btn:SetAttribute("OnText",   c.onText   or "ON")
        btn:SetAttribute("OffText",  c.text     or "OFF")
        Instance.new("UICorner",btn).CornerRadius = UDim.new(0,8)
        table.insert(createdObjects, btn)
        print("[RR Circuits] Created UI Toggle: "..name)

    -- ── UI TextBox ────────────────────────────────────────────────────────────
    elseif t == "ui_textbox" then
        local gui = ensureGui(c.parent)
        if gui:FindFirstChild(name) then gui:FindFirstChild(name):Destroy() end
        local sz  = parseVec(c.size or "200,40,0", {200,40,0})
        local pos = parseUDim2(c.pos)

        local tb = Instance.new("TextBox")
        tb.Name              = name
        tb.Size              = UDim2.new(0, sz[1], 0, sz[2])
        tb.Position          = pos
        tb.PlaceholderText   = c.placeholder or "Type here..."
        tb.BackgroundColor3  = Color3.fromRGB(15,30,55)
        tb.TextColor3        = Color3.new(1,1,1)
        tb.Font              = Enum.Font.Gotham
        tb.TextSize          = 14
        tb.BorderSizePixel   = 0
        tb.Parent            = gui
        table.insert(createdObjects, tb)

    -- ── Generic Part ──────────────────────────────────────────────────────────
    elseif t == "part" then
        if workspace:FindFirstChild(name) then workspace:FindFirstChild(name):Destroy() end
        local pos = parseVec(c.pos, {0,2,0})
        local sz  = parseVec(c.size, {4,4,4})

        local part = Instance.new("Part")
        part.Name     = name
        part.Size     = Vector3.new(sz[1], sz[2], sz[3])
        part.Position = Vector3.new(pos[1], pos[2], pos[3])
        part.Anchored = (c.anchored ~= "false")
        part.Color    = hexToColor3(c.color or "AAAAAA")
        part.Parent   = workspace
        table.insert(createdObjects, part)
    end
end

-- ── Upsert Script in chosen location ─────────────────────────────────────────
local function upsertScript(code)
    local typeName  = getType()
    local parentInst = resolveParent(getParent())

    -- Reuse existing
    if insertedScript and insertedScript.Parent then
        insertedScript.Source = code
        return
    end

    -- Remove stale
    local ex = parentInst:FindFirstChild("RRCircuit")
    if ex then ex:Destroy() end

    local s
    if typeName == "LocalScript" then s = Instance.new("LocalScript")
    elseif typeName == "ModuleScript" then s = Instance.new("ModuleScript")
    else s = Instance.new("Script") end
    s.Name   = "RRCircuit"
    s.Source = code
    s.Parent = parentInst
    insertedScript = s
    print("[RR Circuits] Script inserted → "..typeName.." in "..getParent())
end

-- ── Main fetch + apply ────────────────────────────────────────────────────────
local function fetchAndApply()
    local ok, result = pcall(function()
        return HttpService:GetAsync(HOST.."/api/code/roblox", true)
    end)

    if not ok then
        statusLbl.Text      = "● Cannot reach localhost:9001"
        statusLbl.TextColor3 = Color3.fromRGB(200,60,60)
        infoLbl.Text        = "Is RR Circuits running? (npm start)"
        return false
    end

    local data
    ok, data = pcall(function() return HttpService:JSONDecode(result) end)
    if not ok or not data then
        statusLbl.Text = "● Invalid response"; return false
    end

    -- Create/update scene objects in Workspace / StarterGui
    if data.objects and #data.objects > 0 then
        for _, obj in ipairs(data.objects) do
            pcall(createObject, obj)
        end
        infoLbl.Text = "Scene: "..#data.objects.." object(s) created"
    end

    -- Update script
    if data.code and data.code ~= lastCode then
        lastCode = data.code
        upsertScript(data.code)
        statusLbl.Text       = "● Updated ✓  "..os.date("%H:%M:%S")
        statusLbl.TextColor3 = Color3.fromRGB(60,220,100)
    elseif data.code then
        statusLbl.Text       = "● Up to date"
        statusLbl.TextColor3 = Color3.fromRGB(60,220,100)
    end

    return true
end

-- ── Polling loop ──────────────────────────────────────────────────────────────
local elapsed = 0
RunService.Heartbeat:Connect(function(dt)
    if not listening then return end
    elapsed = elapsed + dt
    if elapsed < POLL then return end
    elapsed = 0
    fetchAndApply()
end)

-- ── Button handlers ───────────────────────────────────────────────────────────
connectBtn.MouseButton1Click:Connect(function()
    listening = not listening
    if listening then
        connectBtn.Text = "⏹ Stop Listening"
        connectBtn.BackgroundColor3 = Color3.fromRGB(140,30,30)
        fetchAndApply()
    else
        connectBtn.Text = "▶ Start Listening"
        connectBtn.BackgroundColor3 = Color3.fromRGB(15,110,55)
        statusLbl.Text       = "● Stopped"
        statusLbl.TextColor3 = Color3.fromRGB(200,60,60)
    end
end)

pushBtn.MouseButton1Click:Connect(function() fetchAndApply() end)

clearBtn.MouseButton1Click:Connect(function()
    -- Remove all objects we created
    for _, obj in ipairs(createdObjects) do
        pcall(function() if obj and obj.Parent then obj:Destroy() end end)
    end
    createdObjects = {}
    if insertedScript and insertedScript.Parent then
        insertedScript:Destroy(); insertedScript = nil
    end
    lastCode = ""
    statusLbl.Text       = "● Cleared"
    statusLbl.TextColor3 = Color3.fromRGB(200,160,60)
    infoLbl.Text = ""
    print("[RR Circuits] Scene cleared")
end)

mainBtn.Click:Connect(function() widget.Enabled = not widget.Enabled end)

print("[RR Circuits Plugin v1.1] Loaded — click the toolbar button to open")
