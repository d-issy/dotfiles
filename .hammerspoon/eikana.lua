-- KeyCode
Escape = 0x35
RightCmd = 0x36
LeftCmd = 0x37
Eisuu = 0x66
Kana = 0x68

-- eikana
singleCmd = false
eikanaEventTap = hs.eventtap.new({
    hs.eventtap.event.types.flagsChanged,
    hs.eventtap.event.types.keyDown
}, function(event)
    local eventType = event:getType()
    local keyCode = event:getKeyCode()

    -- keyDown Event
    if eventType == hs.eventtap.event.types.keyDown then
        singleCmd = false
        if keyCode == Escape then
            hs.eventtap.keyStroke({}, Eisuu)
        end
        return
    end
    
    -- except VMWare Fusion
    local activeApplication = hs.application.frontmostApplication()
    if activeApplication:bundleID() == 'com.vmware.fusion' then
        return
    end

    local flags = event:getFlags()
    if flags['cmd'] then
        singleCmd = true
        return
    end

    if singleCmd then
        singleCmd = false
        if keyCode == RightCmd then
            hs.eventtap.keyStroke({}, Kana)
        elseif keyCode == LeftCmd then
            hs.eventtap.keyStroke({}, Eisuu)
        end
    end
end)
eikanaEventTap:start()
