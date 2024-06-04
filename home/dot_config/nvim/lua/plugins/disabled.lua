local DISABLED_PLUGINS = {
  "friendly-snippets",
  "lualine.nvim",
  "nvim-snippets",
  "nvim-spectre",
}

local plugin_settings = {}
for _, plugin in ipairs(DISABLED_PLUGINS) do
  table.insert(plugin_settings, { plugin, enabled = false })
end
return plugin_settings
