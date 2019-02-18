hs.hotkey.bind({'alt'}, 'T', function()
    hs.alert.closeAll()
    hs.alert.show(os.date('%Y-%m-%d %H:%M'))
end)
