local max = hs.screen.primaryScreen():frame()
cv = hs.canvas.new{x = 0, y = max.h - 27, w = max.w, h = 20}
cv:behavior({"canJoinAllSpaces"})

menuUpdater = hs.timer.doEvery(1, function()
    local date = os.date('%m/%d %H:%M')
    local volume = tostring(math.floor(hs.audiodevice.defaultOutputDevice():volume() + 0.5))
    local battery = tostring(math.floor(hs.battery.percentage() + 0.5))
    local wifi = hs.wifi.currentNetwork('en0')
    if wifi == nil then
        wifi = '(No Connection)'
    end

    cv[1] = {
        type = 'text',
        text = date,
        textSize = 15.0,
        textAlignment = 'center',
        frame = { x = max.w/2 - 50, y = 3, w = 100, h = 20 },
    }

    cv[2] = {
        type = 'text',
        text = 'V '..volume..'%',
        textSize = 15.0,
        textAlignment = 'left',
        frame = {x = 30, y = 0, w = 70, h = 20},
    }

    cv[3] = {
        type = 'text',
        text = 'B '..battery..'%',
        textSize = 15.0,
        textAlignment = 'left',
        frame = {x = 100, y = 0, w = 70, h = 20},
    }

    cv[4] = {
        type = 'text',
        text = wifi,
        textSize = 15.0,
        textAlignment = 'right',
        frame = {x = 0, y = 0, w = max.w - 30, h = 20},
    }
end)

menuUpdater:start()
cv:show()
