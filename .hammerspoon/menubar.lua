local max = hs.screen.primaryScreen():frame()
cv = hs.canvas.new{x = 0, y = max.h - 27, w = max.w, h = 20}

hs.timer.doEvery(1, function()
    --
    date = os.date('%m/%d %H:%M')
    --
    volume = io.popen("osascript -e 'output volume of (get volume settings)'"):read('*a')
    volume = string.gsub(volume, '[\n\r]*', '')
    --
    battery = io.popen("pmset -g batt | egrep '([0-9]+\\%)' -o | cut -f1 -d';'"):read('*a')
    battery = string.gsub(battery, '%%[\n\r]*', '')
    --
    wifi = io.popen("/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I | sed -e \"s/^ *SSID: //p\" -e d"):read('*a')
    wifi = string.gsub(wifi, '[\n\r]*', '')
    --

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
        frame = {x = 30, y = 0, w = 70, h = 20},
    }

    cv[3] = {
        type = 'text',
        text = 'B '..battery..'%',
        textSize = 15.0,
        frame = {x = 100, y = 0, w = 70, h = 20},
    }

    cv[4] = {
        type = 'text',
        text = wifi,
        textAlignment = 'right',
        textSize = 15.0,
        frame = {x = 0, y = 0, w = max.w - 30, h = 20},
    }

end)

cv:show()
