-- wifiWatcher
local netConfig = hs.network.configuration.open()
local proxy = false
local interface = 'en0'

local function setProxy()
    proxy = true
    netConfig:setLocation('school')
end

local function unsetProxy()
    proxy = false
    netConfig:setLocation('local')
end

wifiWatcher = hs.wifi.watcher.new(function(watcher, message, _) 
    if message ~= 'SSIDChange' then
        return
    end

    local nextSSID = hs.wifi.currentNetwork(interface)
    if nextSSID == 'KIT-WLAP2' and (not proxy) then
        setProxy()
    elseif nextSSID ~= 'KIT-WLAP2' and proxy  then
        unsetProxy()
    end
end)

if hs.wifi.currentNetwork(interface) == 'KIT-WLAP2' then
    setProxy()
else
    unsetProxy()
end

wifiWatcher:start()
