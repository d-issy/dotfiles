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

  local win = vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    width = width,
    height = height,
    row = row,
    col = col,
    style = "minimal",
    border = "rounded",
  })

  local term_opts = {
    on_exit = function()
      vim.schedule(function()
        if vim.api.nvim_win_is_valid(win) then
          vim.api.nvim_win_close(win, true)
        end
      end)
    end,
  }
  if opts.cwd then
    term_opts.cwd = opts.cwd
  end
  if opts.env then
    term_opts.env = vim.tbl_isempty(opts.env) and vim.empty_dict() or opts.env
  end

  if vim.tbl_isempty(term_opts) then
    vim.fn.termopen(cmd)
  else
    vim.fn.termopen(cmd, term_opts)
  end
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
