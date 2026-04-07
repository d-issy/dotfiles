--- @class util.file
local M = {}

--- Check if file is big
--- @param buf? number
--- @return boolean
M.is_big = function(buf)
  buf = buf or vim.api.nvim_get_current_buf()
  local file_size = vim.fn.getfsize(vim.fn.bufname(buf))
  return file_size > 1572864 -- 1.5MB
end

--- Disable features for big file
--- @param buf? number
M.disable_futures_for_bigfile = function(buf)
  buf = buf or vim.api.nvim_get_current_buf()

  -- syntax off
  vim.bo[buf].syntax = "off"

  -- disable lsp
  vim.api.nvim_create_autocmd("LspAttach", {
    buffer = buf,
    callback = function(args)
      vim.schedule(function()
        local client = vim.lsp.get_client_by_id(args.data.client_id)
        if client then
          client:buf_detach(buf)
        end
      end)
    end,
  })
end

return M
