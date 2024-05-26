local M = {}

M.pattern = os.getenv "HOME" .. "/.local/share/chezmoi/home/*"

---@return boolean
function M.is_enabled() return vim.fn.executable "chezmoi" == 1 end

function M.apply()
  if M.is_enabled() then
    local out = vim.fn.trim(vim.fn.system { "chezmoi", "apply", "--verbose", "--force" })
    if out ~= "" then
      vim.notify("chezmoi applyed\n" .. out)
    end
  end
end

return M
