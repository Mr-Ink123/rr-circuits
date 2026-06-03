--[[
  RR Circuits — Roblox Studio Plugin  v1.2
  ==========================================
  Connects to the RR Circuits editor on your PC and:
   • Creates Buttons / Trigger Volumes / UI directly in the Workspace & StarterGui
   • Inserts a Script that wires events to those objects

  INSTALL:
   1. Copy this file to:  %LOCALAPPDATA%\Roblox\Plugins\RRCircuits.lua
   2. Studio Settings → Security → Allow HTTP Requests  ✓
   3. Run RR Circuits (the installed app, not the browser)
   4. Click the RR Circuits button in the Studio toolbar
--]]

local HttpService = game:GetService("HttpService")
local RunService  = game:GetService("RunService")
local StarterGui  = game:GetService("StarterGui")

local HOST = "http://localhost:9001"
local POLL = 1.5

-- ── Panel ─────────────────────────────────────────────────────────────────────
local toolbar = plugin:CreateToolbar("RR Circuits")
local mainBtn = toolbar:CreateButton("RR Circuits",
    "Connect to RR Circuits on your PC","rbxassetid://14978048121")

local wi = DockWidgetPluginGuiInfo.new(
    Enum.InitialDockState.Right, false, false, 270, 480, 220, 340)
local widget = plugin:CreateDockWidgetPluginGui("RRCv12", wi)
widget.Title = "RR Circuits"

local root = Instance.new("ScrollingFrame", widget)
root.Size            = UDim2.new(1,0,1,0)
root.BackgroundColor3 = Color3.fromRGB(8,18,34)
root.BorderSizePixel = 0
root.ScrollBarThickness = 4
root.CanvasSize      = UDim2.new(0,0,0,0)
root.AutomaticCanvasSize = Enum.AutomaticSize.Y

local uil = Instance.new("UIListLayout", root)
uil.SortOrder = Enum.SortOrder.LayoutOrder
uil.Padding   = UDim.new(0,4)
local pad = Instance.new("UIPadding", root)
pad.PaddingLeft=UDim.new(0,10); pad.PaddingRight=UDim.new(0,10)
pad.PaddingTop =UDim.new(0,10); pad.PaddingBottom=UDim.new(0,8)

local function mkLabel(txt, size, color, lo)
    local l = Instance.new("TextLabel", root)
    l.Size=UDim2.new(1,0,0,size or 18); l.BackgroundTransparency=1
    l.Font=Enum.Font.Gotham; l.TextSize=size or 12
    l.TextColor3=color or Color3.fromRGB(160,200,240)
    l.TextXAlignment=Enum.TextXAlignment.Left
    l.Text=txt; l.TextWrapped=true; l.LayoutOrder=lo or 0
    return l
end
local function mkBtn(txt, col, lo)
    local b=Instance.new("TextButton",root)
    b.Size=UDim2.new(1,0,0,34); b.BackgroundColor3=col or Color3.fromRGB(30,60,100)
    b.BorderSizePixel=0; b.Font=Enum.Font.GothamBold; b.TextSize=13
    b.TextColor3=Color3.new(1,1,1); b.Text=txt; b.LayoutOrder=lo or 0
    Instance.new("UICorner",b).CornerRadius=UDim.new(0,6)
    return b
end
local function mkSep(lo)
    local f=Instance.new("Frame",root); f.Size=UDim2.new(1,0,0,1)
    f.BackgroundColor3=Color3.fromRGB(25,45,75); f.BorderSizePixel=0; f.LayoutOrder=lo or 0
end

mkLabel("⚡ RR Circuits", 15, Color3.fromRGB(255,140,0), 1)
mkSep(2)
local statusLbl = mkLabel("● Disconnected", 12, Color3.fromRGB(200,60,60), 3)
local infoLbl   = mkLabel("", 10, Color3.fromRGB(80,110,150), 4)
local logLbl    = mkLabel("", 10, Color3.fromRGB(60,90,130), 5)
mkSep(6)

-- Type/Parent dropdowns
local function mkDD(opts, lo)
    local b=Instance.new("TextButton",root)
    b.Size=UDim2.new(1,0,0,28); b.BackgroundColor3=Color3.fromRGB(12,26,48)
    b.BorderSizePixel=1; b.BorderColor3=Color3.fromRGB(40,70,110)
    b.Font=Enum.Font.Gotham; b.TextSize=11
    b.TextColor3=Color3.fromRGB(180,220,255)
    b.TextXAlignment=Enum.TextXAlignment.Left
    b.Text="  "..opts[1]; b.LayoutOrder=lo or 0
    local i=1
    b.MouseButton1Click:Connect(function()
        i=(i%#opts)+1; b.Text="  "..opts[i]
    end)
    return b, function() return opts[i] end
end

mkLabel("Script Type:", 10, Color3.fromRGB(100,130,160), 7)
local _,getType = mkDD({"Script","LocalScript","ModuleScript"}, 8)
mkLabel("Insert Into:", 10, Color3.fromRGB(100,130,160), 9)
local _,getParent = mkDD({"ServerScriptService","ReplicatedStorage","StarterPlayerScripts","StarterGui","Workspace"}, 10)
mkSep(11)

local connectBtn = mkBtn("▶ Start Listening", Color3.fromRGB(15,110,55), 12)
local pushBtn    = mkBtn("⬆ Push Now",        Color3.fromRGB(15,55,130), 13)
local clearBtn   = mkBtn("🗑 Clear All",       Color3.fromRGB(90,25,25),  14)
mkSep(15)
mkLabel("Requires:\nStudio Settings → Security\n→ Allow HTTP Requests ✓\n\nRun the RR Circuits app (not browser).", 10, Color3.fromRGB(70,100,140), 16)

-- ── State ─────────────────────────────────────────────────────────────────────
local listening        = false
local lastCode         = ""
local lastManifestJSON = ""   -- hash of last objects array — skip recreation if unchanged
local insertedScript   = nil
local createdParts     = {}

-- ── Helpers ───────────────────────────────────────────────────────────────────
local function log(msg)
    print("[RR Circuits] "..tostring(msg))
    logLbl.Text = tostring(msg)
end

local function hexColor(hex)
    hex = tostring(hex):gsub("#","")
    if #hex < 6 then return Color3.new(0.7,0.7,0.7) end
    return Color3.fromRGB(
        tonumber(hex:sub(1,2),16) or 180,
        tonumber(hex:sub(3,4),16) or 180,
        tonumber(hex:sub(5,6),16) or 180
    )
end

local function vec3(s, dx, dy, dz)
    local t={}
    for v in (tostring(s or "")):gmatch("[%-%.%d]+") do
        t[#t+1]=tonumber(v) or 0
    end
    return Vector3.new(t[1] or dx or 0, t[2] or dy or 2, t[3] or dz or 0)
end

local function resolveParent(name)
    local map = {
        ServerScriptService=game:GetService("ServerScriptService"),
        ReplicatedStorage=game:GetService("ReplicatedStorage"),
        StarterPlayerScripts=game:GetService("StarterPlayer").StarterPlayerScripts,
        StarterGui=StarterGui, Workspace=workspace
    }
    return map[name] or game:GetService("ServerScriptService")
end

-- ── Create one scene object ────────────────────────────────────────────────────
local function createOne(obj)
    local t    = tostring(obj.type or "part")
    local name = tostring(obj.name or "RRObj")
    local c    = obj.config or {}

    -- Remove stale copy
    local stale = workspace:FindFirstChild(name)
    if stale then stale:Destroy() end
    local staleGui = StarterGui:FindFirstChild(name)
    if staleGui then staleGui:Destroy() end

    -- ── Button / Toggle Button ──────────────────────────────────────────────
    if t == "button" or t == "toggle_btn" then
        local p = Instance.new("Part")
        p.Name      = name
        p.Size      = vec3(c.size, 4, 2, 4)
        p.Position  = vec3(c.pos,  0, 1, 0)
        p.Anchored  = true
        p.Color     = hexColor(c.color or "0066FF")
        p.Material  = Enum.Material.SmoothPlastic
        p.Parent    = workspace

        -- Label on top face
        local sg = Instance.new("SurfaceGui"); sg.Face=Enum.NormalId.Top; sg.Parent=p
        local tl = Instance.new("TextLabel",sg)
        tl.Size=UDim2.new(1,0,1,0); tl.BackgroundTransparency=1
        tl.Text=tostring(c.text or name)
        tl.TextColor3=Color3.new(1,1,1)
        tl.Font=Enum.Font.GothamBold; tl.TextScaled=true

        -- Click detector
        local cd = Instance.new("ClickDetector")
        cd.MaxActivationDistance = tonumber(c.maxDist) or 32
        cd.Parent = p

        table.insert(createdParts, p)
        log("Created "..(t=="toggle_btn" and "Toggle Button" or "Button")..": "..name)

    -- ── Trigger Volume ──────────────────────────────────────────────────────
    elseif t == "trigger_vol" then
        local p = Instance.new("Part")
        p.Name         = name
        p.Size         = vec3(c.size, 10, 8, 10)
        p.Position     = vec3(c.pos,  0,  4,  0)
        p.Anchored     = true
        p.CanCollide   = false
        p.Transparency = tonumber(c.opacity) or 0.7
        p.Color        = hexColor(c.color or "FF6600")
        p.Material     = Enum.Material.Neon
        p.Parent       = workspace

        local sel = Instance.new("SelectionBox")
        sel.Adornee       = p
        sel.Color3        = hexColor(c.color or "FF6600")
        sel.LineThickness = 0.04
        sel.Parent        = workspace

        table.insert(createdParts, p)
        table.insert(createdParts, sel)
        log("Created Trigger Volume: "..name)

    -- ── Interaction Volume (ProximityPrompt) ────────────────────────────────
    elseif t == "interact_vol" then
        local p = Instance.new("Part")
        p.Name         = name
        p.Size         = vec3(c.size, 6, 4, 6)
        p.Position     = vec3(c.pos,  0, 2, 0)
        p.Anchored     = true
        p.CanCollide   = false
        p.Transparency = 0.6
        p.Color        = hexColor(c.color or "00CCFF")
        p.Material     = Enum.Material.Neon
        p.Parent       = workspace

        local pp = Instance.new("ProximityPrompt")
        pp.ActionText            = tostring(c.promptText or "Interact")
        pp.ObjectText            = name
        pp.MaxActivationDistance = tonumber(c.maxDist) or 8
        pp.RequiresLineOfSight   = false
        pp.Parent = p

        table.insert(createdParts, p)
        log("Created Interaction Volume: "..name)

    -- ── Handle Volume ───────────────────────────────────────────────────────
    elseif t == "handle_vol" then
        local p = Instance.new("Part")
        p.Name=name; p.Size=vec3(c.size,4,4,4); p.Position=vec3(c.pos,0,2,0)
        p.Anchored=true; p.CanCollide=false; p.Transparency=0.5
        p.Color=hexColor(c.color or "AA66FF"); p.Material=Enum.Material.Neon
        p.Parent=workspace
        table.insert(createdParts, p)
        log("Created Handle Volume: "..name)

    -- ── ScreenGui ───────────────────────────────────────────────────────────
    elseif t == "screen_gui" then
        local staleS = StarterGui:FindFirstChild(name)
        if staleS then staleS:Destroy() end
        local sg = Instance.new("ScreenGui")
        sg.Name=name; sg.ResetOnSpawn=(c.resetOnSpawn=="true")
        sg.IgnoreGuiInset=true; sg.Parent=StarterGui
        table.insert(createdParts, sg)
        log("Created ScreenGui: "..name)

    -- ── UI Button ───────────────────────────────────────────────────────────
    elseif t == "ui_button" or t == "ui_toggle" then
        local guiName = tostring(c.parent or "RRGui")
        local gui = StarterGui:FindFirstChild(guiName)
        if not gui then
            gui=Instance.new("ScreenGui"); gui.Name=guiName
            gui.ResetOnSpawn=false; gui.IgnoreGuiInset=true; gui.Parent=StarterGui
            table.insert(createdParts, gui)
        end
        local oldBtn = gui:FindFirstChild(name)
        if oldBtn then oldBtn:Destroy() end

        -- Parse size: "200,50"
        local sw, sh = 200, 50
        if c.size then
            local w,h = c.size:match("([%d%.]+)[,%s]+([%d%.]+)")
            sw = tonumber(w) or 200; sh = tonumber(h) or 50
        end
        -- Parse pos: "0.5,-100,0.9,0"
        local px,po,py,pyo = 0.5,-100,0.9,0
        if c.pos then
            local a,b2,cc2,d2 = c.pos:match("([%-%.%d]+)[,%s]+([%-%.%d]+)[,%s]+([%-%.%d]+)[,%s]+([%-%.%d]+)")
            px=tonumber(a) or 0.5; po=tonumber(b2) or -100
            py=tonumber(cc2) or 0.9; pyo=tonumber(d2) or 0
        end

        local btn = Instance.new("TextButton")
        btn.Name=name
        btn.Size=UDim2.new(0,sw,0,sh)
        btn.Position=UDim2.new(px,po,py,pyo)
        btn.BackgroundColor3=hexColor(c.bgColor or c.color or "0066FF")
        btn.TextColor3=hexColor(c.textColor or "FFFFFF")
        btn.Text=tostring(c.text or (t=="ui_toggle" and "OFF" or "Button"))
        btn.Font=Enum.Font.GothamBold; btn.TextSize=16; btn.BorderSizePixel=0
        if t=="ui_toggle" then
            btn:SetAttribute("OnColor",  tostring(c.onColor  or "00AA44"))
            btn:SetAttribute("OffColor", tostring(c.offColor or "AA0000"))
            btn:SetAttribute("OnText",   tostring(c.onText   or "ON"))
            btn:SetAttribute("OffText",  tostring(c.text     or "OFF"))
        end
        Instance.new("UICorner",btn).CornerRadius=UDim.new(0,8)
        btn.Parent=gui
        table.insert(createdParts, btn)
        log("Created "..(t=="ui_toggle" and "UI Toggle" or "UI Button")..": "..name)

    -- ── UI Label ────────────────────────────────────────────────────────────
    elseif t == "ui_label" then
        local guiName=tostring(c.parent or "RRGui")
        local gui=StarterGui:FindFirstChild(guiName) or (function()
            local g=Instance.new("ScreenGui"); g.Name=guiName
            g.ResetOnSpawn=false; g.IgnoreGuiInset=true; g.Parent=StarterGui
            table.insert(createdParts,g); return g
        end)()
        local lbl=Instance.new("TextLabel"); lbl.Name=name
        local sw,sh=200,30
        if c.size then local w,h=c.size:match("([%d]+)[,%s]+([%d]+)"); sw=tonumber(w) or 200; sh=tonumber(h) or 30 end
        lbl.Size=UDim2.new(0,sw,0,sh); lbl.BackgroundTransparency=1
        lbl.TextColor3=hexColor(c.textColor or "FFFFFF")
        lbl.Text=tostring(c.text or "Label")
        lbl.Font=Enum.Font.Gotham; lbl.TextSize=14; lbl.Parent=gui
        table.insert(createdParts,lbl)
        log("Created UI Label: "..name)

    -- ── UI Frame ────────────────────────────────────────────────────────────
    elseif t == "ui_frame" then
        local guiName=tostring(c.parent or "RRGui")
        local gui=StarterGui:FindFirstChild(guiName) or (function()
            local g=Instance.new("ScreenGui"); g.Name=guiName
            g.ResetOnSpawn=false; g.IgnoreGuiInset=true; g.Parent=StarterGui
            table.insert(createdParts,g); return g
        end)()
        local fr=Instance.new("Frame"); fr.Name=name
        local sw,sh=300,200
        if c.size then local w,h=c.size:match("([%d]+)[,%s]+([%d]+)"); sw=tonumber(w) or 300; sh=tonumber(h) or 200 end
        fr.Size=UDim2.new(0,sw,0,sh); fr.BackgroundColor3=hexColor(c.bgColor or "111827")
        fr.BorderSizePixel=0; fr.Parent=gui
        Instance.new("UICorner",fr).CornerRadius=UDim.new(0,8)
        table.insert(createdParts,fr); log("Created UI Frame: "..name)

    -- ── UI TextBox ──────────────────────────────────────────────────────────
    elseif t == "ui_textbox" then
        local guiName=tostring(c.parent or "RRGui")
        local gui=StarterGui:FindFirstChild(guiName) or (function()
            local g=Instance.new("ScreenGui"); g.Name=guiName
            g.ResetOnSpawn=false; g.IgnoreGuiInset=true; g.Parent=StarterGui
            table.insert(createdParts,g); return g
        end)()
        local tb=Instance.new("TextBox"); tb.Name=name
        local sw,sh=200,40
        if c.size then local w,h=c.size:match("([%d]+)[,%s]+([%d]+)"); sw=tonumber(w) or 200; sh=tonumber(h) or 40 end
        tb.Size=UDim2.new(0,sw,0,sh); tb.PlaceholderText=tostring(c.placeholder or "Type here...")
        tb.BackgroundColor3=Color3.fromRGB(15,30,55); tb.TextColor3=Color3.new(1,1,1)
        tb.Font=Enum.Font.Gotham; tb.TextSize=14; tb.BorderSizePixel=0
        tb.ClearTextOnFocus=false; tb.Parent=gui
        table.insert(createdParts,tb); log("Created UI TextBox: "..name)

    -- ── Generic Part ────────────────────────────────────────────────────────
    elseif t == "part" then
        local p=Instance.new("Part"); p.Name=name
        p.Size=vec3(c.size,4,4,4); p.Position=vec3(c.pos,0,2,0)
        p.Anchored=(c.anchored~="false"); p.Color=hexColor(c.color or "AAAAAA")
        p.Parent=workspace
        table.insert(createdParts,p); log("Created Part: "..name)

    else
        log("Unknown type: "..t.." for "..name)
    end
end

-- ── Insert / update Script ─────────────────────────────────────────────────────
local function upsertScript(code)
    local parent = resolveParent(getParent())
    if insertedScript and insertedScript.Parent then
        insertedScript.Source = code
        log("Script updated in "..getParent())
        return
    end
    local ex = parent:FindFirstChild("RRCircuit")
    if ex then ex:Destroy() end
    local s
    local tp = getType()
    if tp=="LocalScript" then s=Instance.new("LocalScript")
    elseif tp=="ModuleScript" then s=Instance.new("ModuleScript")
    else s=Instance.new("Script") end
    s.Name="RRCircuit"; s.Source=code; s.Parent=parent
    insertedScript=s
    log("Script inserted → "..tp.." in "..getParent())
end

-- ── Fetch & Apply ──────────────────────────────────────────────────────────────
local function fetchAndApply()
    -- HTTP request
    local ok, raw = pcall(function()
        return HttpService:GetAsync(HOST.."/api/code/roblox", true)
    end)
    if not ok then
        statusLbl.Text="● Cannot reach localhost:9001"
        statusLbl.TextColor3=Color3.fromRGB(200,60,60)
        infoLbl.Text="Is RR Circuits running? (run the installed app)"
        return false
    end

    -- Parse JSON
    local ok2, data = pcall(HttpService.JSONDecode, HttpService, raw)
    if not ok2 or type(data) ~= "table" then
        statusLbl.Text="● Bad JSON response"
        statusLbl.TextColor3=Color3.fromRGB(200,60,60)
        return false
    end

    statusLbl.Text="● Connected"
    statusLbl.TextColor3=Color3.fromRGB(60,220,100)

    -- Create scene objects ONLY when the manifest has changed
    -- (prevents constant delete-and-recreate on every poll)
    local objects = data.objects
    if type(objects) == "table" and #objects > 0 then
        local newJSON = HttpService:JSONEncode(objects)
        if newJSON ~= lastManifestJSON then
            lastManifestJSON = newJSON
            infoLbl.Text = "Creating "..#objects.." object(s)..."
            local ok3, err3 = pcall(function()
                for _, obj in ipairs(objects) do
                    createOne(obj)
                end
            end)
            if not ok3 then
                log("Scene error: "..tostring(err3))
                infoLbl.Text = "Scene error — check Output window"
            else
                infoLbl.Text = #objects.." object(s) in scene ✓"
            end
        else
            -- Same manifest — objects already in scene, nothing to do
            if infoLbl.Text == "" or infoLbl.Text:find("Creating") then
                infoLbl.Text = #objects.." object(s) in scene ✓"
            end
        end
    else
        if lastManifestJSON ~= "" then
            lastManifestJSON = ""
        end
        infoLbl.Text = "No scene objects in this circuit"
    end

    -- Insert/update script
    local code = data.code
    if type(code)=="string" and code~="" and code~=lastCode then
        lastCode = code
        local ok4, err4 = pcall(upsertScript, code)
        if not ok4 then log("Script error: "..tostring(err4)) end
    end

    return true
end

-- ── Polling ────────────────────────────────────────────────────────────────────
local elapsed=0
RunService.Heartbeat:Connect(function(dt)
    if not listening then return end
    elapsed=elapsed+dt
    if elapsed<POLL then return end
    elapsed=0
    fetchAndApply()
end)

-- ── Buttons ────────────────────────────────────────────────────────────────────
connectBtn.MouseButton1Click:Connect(function()
    listening=not listening
    if listening then
        connectBtn.Text="⏹ Stop Listening"
        connectBtn.BackgroundColor3=Color3.fromRGB(140,30,30)
        fetchAndApply()
    else
        connectBtn.Text="▶ Start Listening"
        connectBtn.BackgroundColor3=Color3.fromRGB(15,110,55)
        statusLbl.Text="● Stopped"; statusLbl.TextColor3=Color3.fromRGB(200,60,60)
    end
end)

pushBtn.MouseButton1Click:Connect(function() fetchAndApply() end)

clearBtn.MouseButton1Click:Connect(function()
    for _,obj in ipairs(createdParts) do
        pcall(function() if obj and obj.Parent then obj:Destroy() end end)
    end
    createdParts={}
    if insertedScript and insertedScript.Parent then
        insertedScript:Destroy(); insertedScript=nil
    end
    lastCode=""; lastManifestJSON=""; infoLbl.Text="Cleared"; logLbl.Text=""
    statusLbl.Text="● Cleared"; statusLbl.TextColor3=Color3.fromRGB(200,160,60)
end)

mainBtn.Click:Connect(function() widget.Enabled=not widget.Enabled end)
print("[RR Circuits Plugin v1.2] Loaded")
