--- @class util.terminal
local M = {}

local tmux = require "util.tmux"
local array = require "util.array"

--- @class util.terminal.CmdOptions
--- @field cwd? string
--- @field env? table<string,string>
local function float_term(cmd, opts)
  local width = math.floor(vim.o.columns * 0.9)
  local height = math.floor(vim.o.lines * 0.8)
  local row = math.floor((vim.o.lines - height) / 2)
  local col = math.floor((vim.o.columns - width) / 2)

  local buf = vim.api.nvim_create_buf(false, true)
  vim.bo[buf].bufhidden = "wipe"

  vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    width = width,
    height = height,
    row = row,
    col = col,
    style = "minimal",
    border = "rounded",
  })

  vim.fn.termopen(cmd, {
    cwd = opts.cwd,
    env = opts.env,
  })
  vim.cmd.startinsert()
end

--- run command.
--- @param cmd string|string[]
--- @param opts? util.terminal.CmdOptions
function M.run(cmd, opts)
  opts = opts or {}
  cmd = array.new(cmd)

  if tmux.is_enabled() then
    tmux.popup(cmd, opts)
  else
    float_term(cmd, opts)
  end
end

return M
