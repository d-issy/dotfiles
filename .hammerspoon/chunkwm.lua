-- focus window {{
hs.hotkey.bind({'alt'}, 'H', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --focus west')
end)

hs.hotkey.bind({'alt'}, 'J', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --focus south')
end)

hs.hotkey.bind({'alt'}, 'K', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --focus north')
end)

hs.hotkey.bind({'alt'}, 'L', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --focus east')
end)

hs.hotkey.bind({'alt'}, 'P', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --focus prev')
end)

hs.hotkey.bind({'alt'}, 'N', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --focus next')
end)
-- }}

-- swap window {{
hs.hotkey.bind({'shift', 'alt'}, 'H', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --swap west')
end)

hs.hotkey.bind({'shift', 'alt'}, 'J', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --swap south')
end)

hs.hotkey.bind({'shift', 'alt'}, 'K', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --swap north')
end)

hs.hotkey.bind({'shift', 'alt'}, 'L', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --swap east')
end)
-- }}

-- move window {{
hs.hotkey.bind({'cmd', 'alt'}, 'H', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --warp west')
end)

hs.hotkey.bind({'cmd', 'alt'}, 'J', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --warp south')
end)

hs.hotkey.bind({'cmd', 'alt'}, 'K', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --warp north')
end)

hs.hotkey.bind({'cmd', 'alt'}, 'L', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --warp east')
end)
-- }}

-- size left or top {{
hs.hotkey.bind({'ctrl', 'alt'}, 'H', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --use-temporary-ratio 0.05 --adjust-window-edge west; /usr/local/bin/chunkc tiling::window --use-temporary-ratio -0.05 --adjust-window-edge east')
end)

hs.hotkey.bind({'ctrl', 'alt'}, 'J', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --use-temporary-ratio 0.05 --adjust-window-edge south; /usr/local/bin/chunkc tiling::window --use-temporary-ratio -0.05 --adjust-window-edge north')
end)

hs.hotkey.bind({'ctrl', 'alt'}, 'K', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --use-temporary-ratio 0.05 --adjust-window-edge north; /usr/local/bin/chunkc tiling::window --use-temporary-ratio -0.05 --adjust-window-edge south')
end)

hs.hotkey.bind({'ctrl', 'alt'}, 'L', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --use-temporary-ratio 0.05 --adjust-window-edge east; /usr/local/bin/chunkc tiling::window --use-temporary-ratio -0.05 --adjust-window-edge west')
end)
-- }}

-- floating {{
-- make floating window fill screen
hs.hotkey.bind({'cmd', 'ctrl'}, 'Up', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --grid-layout 1:1:0:0:1:1')
end)
-- make floating window fill left-hand of screen
hs.hotkey.bind({'cmd', 'ctrl'}, 'Left', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --grid-layout 1:2:0:0:1:1')
end)
-- make floating window fill right-hand of screen
hs.hotkey.bind({'cmd', 'ctrl'}, 'Right', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --grid-layout 1:2:1:0:1:1')
end)
-- }}

-- toggle {{
-- rotate tree
hs.hotkey.bind({'alt'}, 'A', function()
    hs.execute('/usr/local/bin/chunkc tiling::desktop --toggle offset')
end)

-- toggle window fullscreen
hs.hotkey.bind({'alt'}, 'F', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --toggle fullscreen')
end)

-- toggle window native fullscreen
hs.hotkey.bind({'cmd', 'ctrl'}, 'F', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --toggle native-fullscreen')
end)

-- toggle window parent zoom
hs.hotkey.bind({'alt'}, 'D', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --toggle parent')
end)

-- toggle window split type
hs.hotkey.bind({'alt'}, 'E', function()
    hs.execute('/usr/local/bin/chunkc tiling::window --toggle split')
end)
-- }}

-- change layout of desktop {{
hs.hotkey.bind({'ctrl', 'alt'}, 'A', function()
    hs.execute('/usr/local/bin/chunkc tiling::desktop --layout bsp')
end)
hs.hotkey.bind({'ctrl', 'alt'}, 'S', function()
    hs.execute('/usr/local/bin/chunkc tiling::desktop --layout monocle')
end)
hs.hotkey.bind({'ctrl', 'alt'}, 'D', function()
    hs.execute('/usr/local/bin/chunkc tiling::desktop --layout float')
end)
-- }}
