Helper = (function()
  local M = {}
  M.isTargetApp = function(targetApps, app)
    if type(app) == "string" then
      app = hs.application.find(app)
    elseif app == nil then
      app = hs.application.frontmostApplication()
    end

    if app == nil then
      return false
    end

    for _, target in ipairs(targetApps) do
      if app:bundleID() == target then
        return true
      end
    end
    return false
  end

  M.isTerminalApp = function(app)
    return Helper.isTargetApp({
      "com.apple.Terminal",
      "com.googlecode.iterm2",
      "com.jetbrains.intellij",
      "com.microsoft.VSCode",
      "com.github.wez.wezterm",
      "org.alacritty",
    }, app)
  end

  M.isVirtualMachineApp = function(app)
    return Helper.isTargetApp({
      "com.parallels.desktop.console",
      "com.vmware.fusion",
      "org.virtualbox.app.VirtualBox",
    }, app)
  end

  M.clamp = function(value, min, max) return math.min(math.max(value, min), max) end
  return M
end)()
