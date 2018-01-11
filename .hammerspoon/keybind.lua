hs.hotkey.bind({'cmd', 'ctrl'}, 'D', function()
    hs.application.launchOrFocus('Dash')
end)

hs.hotkey.bind({'cmd', 'ctrl'}, 'K', function()
    hs.application.launchOrFocus('Keynote')
end)

hs.hotkey.bind({'cmd', 'ctrl'}, 'N', function()
    hs.application.launchOrFocus('Numi')
end)

hs.hotkey.bind({'cmd', 'ctrl'}, 'P', function()
    hs.application.launchOrFocus('Microsoft PowerPoint')
end)

hs.hotkey.bind({'cmd', 'ctrl'}, 'V', function()
    hs.application.launchOrFocus('Vivaldi')
end)

--- reload
hs.hotkey.bind({'cmd', 'alt', 'ctrl'}, 'R', function() 
    hs.reload()
end)
