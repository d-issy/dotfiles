local M = {}

--- Toggle vim options
--- @param options string|string[]
--- @return function
function M.option(options)
  if type(options) == "string" then
    options = { options }
  end
  local notify = #options == 1
  return function()
    for _, option in ipairs(options) do
      if vim.opt_local[option]:get() then
        vim.opt_local[option] = false
        if notify then
          vim.api.nvim_notify("Disabled", vim.log.levels.WARN, { title = "Option (" .. option .. ")" })
        end
      else
        vim.opt_local[option] = true
        if notify then
          vim.api.nvim_notify("Enabled", vim.log.levels.INFO, { title = "Option (" .. option .. ")" })
        end
      end
    end
  end
end

return M
