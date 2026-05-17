vim.tbl_filter(function(path)
  local config = vim.uv.fs_realpath(vim.fn.stdpath "config") or vim.fn.stdpath "config"
  local real = vim.uv.fs_realpath(path) or path
  return real ~= config
end, vim.list_slice(vim.api.nvim_get_runtime_file("", true), 2))
