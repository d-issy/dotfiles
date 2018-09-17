-- create menu canvas
local max = hs.screen.primaryScreen():frame()
cv = hs.canvas.new{x = 0, y = max.h - 27, w = max.w, h = 20}
cv:behavior({'canJoinAllSpaces'})

-- change functions
function changeTime()
    local time = os.date('%m/%d %H:%M')
    cv[1] = {
        type = 'text',
        text = time,
        textSize = 15.0,
        textAlignment = 'center',
        frame = { x = max.w/2 - 50, y = 3, w = 100, h = 20 },
    }
end

function changeVolume()
    local volume = tostring(math.floor(hs.audiodevice.defaultOutputDevice():volume() + 0.5))
    cv[2] = {
        type = 'text',
        text = 'V '..volume..'%',
        textSize = 15.0,
        textAlignment = 'left',
        frame = {x = 30, y = 0, w = 70, h = 20},
    }
end

function changeBattery()
    local battery = tostring(math.floor(hs.battery.percentage() + 0.5))
    cv[3] = {
        type = 'text',
        text = 'B '..battery..'%',
        textSize = 15.0,
        textAlignment = 'left',
        frame = {x = 100, y = 0, w = 70, h = 20},
    }
end

function changeWifi()
    local wifi = hs.wifi.currentNetwork('en0')
    if wifi == nil then wifi = '(No Connection)' end
    cv[4] = {
        type = 'text',
        text = wifi,
        textSize = 15.0,
        textAlignment = 'right',
        frame = {x = 0, y = 0, w = max.w - 30, h = 20},
    }
end

-- initilize
changeTime()
changeVolume()
changeBattery()
changeWifi()

-- updater
menuUpdater = hs.timer.doEvery(1, function()
    local win = hs.window.focusedWindow()
    if win ~= nil then
        local isShow = cv:isShowing()
        if win:isFullScreen() then
            if isShow then cv:hide() end
        elseif not isShow then
            cv:show()
        end
    end
    changeTime()
end)

mBatteryWatcher = hs.battery.watcher.new(changeBattery)
mWifiWatcher = hs.wifi.watcher.new(changeWifi)

mVolume = hs.audiodevice.defaultOutputDevice()
mVolume:watcherCallback(changeVolume)
hs.audiodevice.watcher.setCallback(function()
    mVolume = hs.audiodevice.defaultOutputDevice()
    mVolume:watcherCallback(changeVolume)
    mVolume:watcherStart()
end)


hs.timer.doAfter(3, function()
    menuUpdater:start()
    mBatteryWatcher:start()
    mWifiWatcher:start()

    mVolume:watcherStart()
    hs.audiodevice.watcher.start()
end)
