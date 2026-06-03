--[[
  RR Circuits - Roblox Studio Plugin
  ====================================
  Connects to the RR Circuits editor running on your PC and
  auto-inserts your circuit as a Script, LocalScript, or ModuleScript.

  SETUP:
  1. Open Roblox Studio → Plugins tab → Plugins Folder
  2. Copy this file into that folder
  3. Enable HTTP Requests: Studio Settings → Security → Allow HTTP Requests ✓
  4. Open RR Circuits on your PC and go to Export → Engine Connect
  5. Click the "RR Circuits" button in Studio toolbar
--]]

local HttpService     = game:GetService("HttpService")
local RunService      = game:GetService("RunService")
local ServerStorage   = game:GetService("ServerStorage")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local StarterPlayer   = game:GetService("StarterPlayer")
local ServerScriptService = game:GetService("ServerScriptService")

-- ── Config ──────────────────────────────────────────────────────────────────
local HOST    = "http://localhost:9001"
local POLL_HZ = 1.5   -- seconds between polls

-- ── Toolbar button ───────────────────────────────────────────────────────────
local toolbar = plugin:CreateToolbar("RR Circuits")
local mainBtn = toolbar:CreateButton(
    "RR Circuits",
    "Connect to RR Circuits Editor\n(must be running on your PC)",
    "rbxassetid://14978048121"   -- circuit icon; replace with your own asset ID
)

-- ── Dock widget (panel) ───────────────────────────────────────────────────────
local widgetInfo = DockWidgetPluginGuiInfo.new(
    Enum.InitialDockState.Right,
    false,   -- initially hidden
    false,
    280, 420,
    240, 300
)
local widget = plugin:CreateDockWidgetPluginGui("RRCircuitsPanel", widgetInfo)
widget.Title = "RR Circuits"
widget.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

-- ── UI (simple, readable) ────────────────────────────────────────────────────
local frame = Instance.new("Frame")
frame.Size = UDim2.new(1,0,1,0)
frame.BackgroundColor3 = Color3.fromRGB(10, 18, 34)
frame.BorderSizePixel = 0
frame.Parent = widget

local layout = Instance.new("UIListLayout")
layout.FillDirection = Enum.FillDirection.Vertical
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Padding = UDim.new(0, 6)
layout.Parent = frame

local padding = Instance.new("UIPadding")
padding.PaddingLeft   = UDim.new(0, 10)
padding.PaddingRight  = UDim.new(0, 10)
padding.PaddingTop    = UDim.new(0, 10)
padding.PaddingBottom = UDim.new(0, 10)
padding.Parent = frame

local function makeLabel(text, size, color, order)
    local l = Instance.new("TextLabel")
    l.Size = UDim2.new(1,0,0, size or 20)
    l.BackgroundTransparency = 1
    l.Font = Enum.Font.GothamBold
    l.TextSize = size or 14
    l.TextColor3 = color or Color3.fromRGB(180,210,255)
    l.TextXAlignment = Enum.TextXAlignment.Left
    l.Text = text
    l.TextWrapped = true
    l.LayoutOrder = order or 0
    l.Parent = frame
    return l
end

local function makeButton(text, color, order)
    local b = Instance.new("TextButton")
    b.Size = UDim2.new(1,0,0,34)
    b.BackgroundColor3 = color or Color3.fromRGB(30,60,100)
    b.BorderSizePixel = 0
    b.Font = Enum.Font.GothamBold
    b.TextSize = 13
    b.TextColor3 = Color3.new(1,1,1)
    b.Text = text
    b.LayoutOrder = order or 0
    b.Parent = frame
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0,6)
    corner.Parent = b
    return b
end

local function makeSep(order)
    local s = Instance.new("Frame")
    s.Size = UDim2.new(1,0,0,1)
    s.BackgroundColor3 = Color3.fromRGB(30,50,80)
    s.BorderSizePixel = 0
    s.LayoutOrder = order or 0
    s.Parent = frame
    return s
end

local function makeDropdown(label, options, order)
    local container = Instance.new("Frame")
    container.Size = UDim2.new(1,0,0,48)
    container.BackgroundTransparency = 1
    container.LayoutOrder = order or 0
    container.Parent = frame
    local l = Instance.new("TextLabel")
    l.Size = UDim2.new(1,0,0,18)
    l.Position = UDim2.new(0,0,0,0)
    l.BackgroundTransparency = 1
    l.Font = Enum.Font.Gotham
    l.TextSize = 11
    l.TextColor3 = Color3.fromRGB(100,140,180)
    l.TextXAlignment = Enum.TextXAlignment.Left
    l.Text = label
    l.Parent = container
    local dd = Instance.new("TextButton")
    dd.Size = UDim2.new(1,0,0,28)
    dd.Position = UDim2.new(0,0,0,20)
    dd.BackgroundColor3 = Color3.fromRGB(15,30,55)
    dd.BorderSizePixel = 0
    dd.Font = Enum.Font.Gotham
    dd.TextSize = 12
    dd.TextColor3 = Color3.fromRGB(200,220,255)
    dd.TextXAlignment = Enum.TextXAlignment.Left
    dd.Text = "  " .. options[1]
    dd.Parent = container
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0,5)
    corner.Parent = dd
    local current = 1
    dd.MouseButton1Click:Connect(function()
        current = (current % #options) + 1
        dd.Text = "  " .. options[current]
    end)
    return container, function() return options[current] end
end

-- Build the UI
makeLabel("⚡ RR Circuits", 16, Color3.fromRGB(255,140,0), 1)
makeLabel("Auto-import from your circuit editor.", 12, Color3.fromRGB(120,160,200), 2)
makeSep(3)

local statusLabel = makeLabel("● Disconnected", 13, Color3.fromRGB(200,60,60), 4)
local lastLabel   = makeLabel("Last update: never", 11, Color3.fromRGB(80,100,130), 5)
makeSep(6)

local scriptTypeContainer, getScriptType = makeDropdown(
    "Script Type",
    {"Script", "LocalScript", "ModuleScript"},
    7
)

local parentContainer, getParentName = makeDropdown(
    "Insert into",
    {
        "ServerScriptService",
        "ReplicatedStorage",
        "StarterPlayerScripts",
        "StarterCharacterScripts",
        "StarterGui",
        "Workspace",
    },
    8
)

makeSep(9)
local connectBtn = makeButton("▶ Start Listening", Color3.fromRGB(20,120,60), 10)
local pushBtn    = makeButton("⬆ Push Now", Color3.fromRGB(20,60,140), 11)
local clearBtn   = makeButton("🗑 Remove Script", Color3.fromRGB(100,30,30), 12)
makeSep(13)
makeLabel("HTTP Requests must be enabled:\nStudio Settings → Security →\nAllow HTTP Requests ✓", 11, Color3.fromRGB(100,130,160), 14)

-- ── State ────────────────────────────────────────────────────────────────────
local listening   = false
local lastCode    = ""
local lastUpdate  = 0
local insertedScript = nil

-- ── Helpers ──────────────────────────────────────────────────────────────────
local parentMap = {
    ServerScriptService    = game:GetService("ServerScriptService"),
    ReplicatedStorage      = game:GetService("ReplicatedStorage"),
    StarterPlayerScripts   = game:GetService("StarterPlayer").StarterPlayerScripts,
    StarterCharacterScripts= game:GetService("StarterPlayer").StarterCharacterScripts,
    StarterGui             = game:GetService("StarterGui"),
    Workspace              = game.Workspace,
}

local function getParentInstance()
    return parentMap[getParentName()] or game:GetService("ServerScriptService")
end

local function upsertScript(code)
    local typeName = getScriptType()
    local parent   = getParentInstance()

    -- Reuse existing script if possible
    if insertedScript and insertedScript.Parent then
        insertedScript.Source = code
        return insertedScript
    end

    -- Remove stale one
    local existing = parent:FindFirstChild("RRCircuit")
    if existing then existing:Destroy() end

    local s
    if typeName == "LocalScript" then
        s = Instance.new("LocalScript")
    elseif typeName == "ModuleScript" then
        s = Instance.new("ModuleScript")
    else
        s = Instance.new("Script")
    end
    s.Name   = "RRCircuit"
    s.Source = code
    s.Parent = parent
    insertedScript = s
    print("[RR Circuits] Inserted " .. typeName .. " into " .. tostring(parent))
    return s
end

local function removeScript()
    if insertedScript and insertedScript.Parent then
        insertedScript:Destroy()
        insertedScript = nil
    end
    local parent = getParentInstance()
    local ex = parent:FindFirstChild("RRCircuit")
    if ex then ex:Destroy() end
end

local function setStatus(connected, msg)
    if connected then
        statusLabel.Text      = "● Connected — " .. (msg or "")
        statusLabel.TextColor3 = Color3.fromRGB(60, 220, 100)
    else
        statusLabel.Text      = "● " .. (msg or "Disconnected")
        statusLabel.TextColor3 = Color3.fromRGB(200, 60, 60)
    end
end

local function fetchAndApply()
    local ok, result = pcall(function()
        return HttpService:GetAsync(HOST .. "/api/code/roblox", true)
    end)
    if not ok then
        setStatus(false, "Cannot reach localhost:9001")
        return false
    end

    local data
    ok, data = pcall(function()
        return HttpService:JSONDecode(result)
    end)
    if not ok or not data or not data.code then
        setStatus(false, "Waiting for code…")
        return false
    end

    if data.code == lastCode then
        setStatus(true, "Up to date")
        return true
    end

    lastCode   = data.code
    lastUpdate = os.time()
    lastLabel.Text = "Last update: just now"

    upsertScript(data.code)
    setStatus(true, "Script updated! ✓")
    return true
end

-- ── Polling loop ─────────────────────────────────────────────────────────────
local pollConn
local elapsed = 0

RunService.Heartbeat:Connect(function(dt)
    if not listening then return end
    elapsed = elapsed + dt
    if elapsed < POLL_HZ then return end
    elapsed = 0

    -- Update "last update" label
    if lastUpdate > 0 then
        local secs = os.time() - lastUpdate
        if secs < 60 then
            lastLabel.Text = "Last update: " .. secs .. "s ago"
        else
            lastLabel.Text = "Last update: " .. math.floor(secs/60) .. "m ago"
        end
    end

    fetchAndApply()
end)

-- ── Button handlers ───────────────────────────────────────────────────────────
connectBtn.MouseButton1Click:Connect(function()
    listening = not listening
    if listening then
        connectBtn.Text = "⏹ Stop Listening"
        connectBtn.BackgroundColor3 = Color3.fromRGB(140,30,30)
        setStatus(false, "Connecting…")
        fetchAndApply()
    else
        connectBtn.Text = "▶ Start Listening"
        connectBtn.BackgroundColor3 = Color3.fromRGB(20,120,60)
        setStatus(false, "Stopped")
    end
end)

pushBtn.MouseButton1Click:Connect(function()
    fetchAndApply()
end)

clearBtn.MouseButton1Click:Connect(function()
    removeScript()
    lastCode = ""
    setStatus(false, "Script removed")
    lastLabel.Text = "Last update: never"
end)

-- ── Toolbar toggle ────────────────────────────────────────────────────────────
mainBtn.Click:Connect(function()
    widget.Enabled = not widget.Enabled
end)

print("[RR Circuits Plugin] Loaded. Click the toolbar button to open.")
