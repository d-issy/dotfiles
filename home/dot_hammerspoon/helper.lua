local M = {}

local isTargetApp = function(targetApps, app)
  if type(app) == 'string' then
    app = hs.application.find(app)
  elseif app == nil then
    app = hs.application.frontmostApplication()
  end

  if app == nil then return false end

  for _, target in ipairs(targetApps) do
    if app:bundleID() == target then return true end
  end
  return false
end

M.isTerminalApp = function(app)
  return isTargetApp({
    'com.apple.Terminal',
    'com.googlecode.iterm2',
    'com.jetbrains.intellij',
    'com.microsoft.VSCode',
    'com.parallels.desktop.console',
    'com.github.wez.wezterm',
    'org.alacritty',
  }, app)
end

M.isVirtualMachineApp = function(app)
  return isTargetApp({
    'com.vmware.fusion',
    'org.virtualbox.app.VirtualBox',
  }, app)
end

return M
