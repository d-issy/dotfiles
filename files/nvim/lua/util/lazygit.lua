--- @class util.lazygit
local M = {}

---  lazygit open.
--- @param args? string[]
function M.open(args)
  local cmd = vim.list_extend({ "lazygit" }, args or {})
  require("util.terminal").run(cmd, {
    on_exit = function()
      vim.schedule(function()
        vim.cmd "checktime"
      end)
    end,
  })
end

--- lazygit commit log.
function M.commit_log()
  M.open { "log" }
end

return M
