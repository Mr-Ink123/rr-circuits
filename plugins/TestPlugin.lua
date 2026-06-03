-- TestPlugin.lua — Minimal test to verify plugins folder works
-- If this works, the full plugin will too
local tb = plugin:CreateToolbar("RR Test")
local btn = tb:CreateButton("✅ Plugin Works!", "If you see this, plugins folder is correct!", "")
btn.Click:Connect(function()
    print("[RR Circuits] Plugin folder is working!")
end)
print("[RR Test] Plugin loaded successfully!")
