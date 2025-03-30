---@class util.quit
local M = {}

--- Quit All for neovim 0.11 empty buffer bug
function M.all()
  local buffers = vim.fn.getbufinfo { buflisted = 1 }
  for _, buf in ipairs(buffers) do
    if buf.name == "" then
      local lines = vim.api.nvim_buf_get_lines(buf.bufnr, 0, 1, false)
      if #lines == 0 or (#lines == 1 and lines[1] == "") then
        vim.api.nvim_buf_delete(buf.bufnr, { force = true })
      end
    end
  end
  vim.api.nvim_command "quitall"
end

return M
