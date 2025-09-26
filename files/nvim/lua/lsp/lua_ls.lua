return {
  settings = {
    Lua = {
      diagnostics = {
        globals = { "vim", "hs" },
      },
      hint = {
        enable = true,
        arrayIndex = "Disable",
      },
      workspace = {
        library = vim.list_slice(vim.api.nvim_get_runtime_file("", true), 2),
      },
    },
  },
}
