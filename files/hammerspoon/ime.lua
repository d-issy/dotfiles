local helper = require "helper"
local eventtap = hs.eventtap
local eventTypes = eventtap.event.types
local codes = hs.keycodes.map

-- variables
local singleCmd = false
local modeKana = false

-- for skk switch support
local skkActive = nil
local isActiveSKK = function()
  if skkActive == nil then
    skkActive = hs.fnutils.contains(hs.keycodes.methods(), "AquaSKK 統合")
  end
  return skkActive
end

local switchToEisu = function()
  if not isActiveSKK() then
    hs.eventtap.keyStroke({}, codes.eisu, 0)
    return
  end

  if modeKana then
    hs.eventtap.keyStroke({}, codes.l, 0)
  end
  modeKana = false
end

local switchToKana = function()
  if not isActiveSKK() then
    hs.eventtap.keyStroke({}, codes.kana, 0)
    return
  end

  if not modeKana then
    hs.eventtap.keyStroke({ "ctrl" }, codes.j, 0)
  end
  modeKana = true
end

-- ime event
IMEEventTap = hs.eventtap.new({ eventTypes.flagsChanged, eventTypes.keyDown }, function(event)
  local eventType = event:getType()
  local keyCode = event:getKeyCode()
  local flags = event:getFlags()
  local key = codes[keyCode]

  -- except virtual machine app
  if helper.isVirtualMachineApp() then
    singleCmd = false
    return false
  end

  -- keyDown
  if eventType == eventTypes.keyDown then
    if keyCode == codes.escape then
      switchToEisu()
    elseif flags.ctrl and key == "[" then
      switchToEisu()
      hs.eventtap.keyStroke({}, codes.escape, 0)
    elseif flags.ctrl and key == "j" then
      switchToKana()
    end
    singleCmd = false
    return false
  end

  -- cmdPress
  if flags.cmd then
    singleCmd = true
    return
  end

  -- cmdRelease
  if singleCmd then
    if keyCode == codes.rightCmd then
      switchToKana()
    elseif keyCode == codes.cmd then
      switchToEisu()
    end
    singleCmd = false
  end
end)

IMEEventTap:start()
