local obj = {}

-- term check
local terms = {
    'com.apple.Terminal',
    'com.googlecode.iterm2',
}

obj.isTerm = function(app)
    if type(app) == 'string' then
        app = hs.application.find(app)
        if app == nil then
            return false
        end
    end
    for i, t in ipairs(terms) do
        if app:bundleID() == t then
            return true
        end
    end
    return false
end

return obj
