return {
  "mason-org/mason.nvim",
  cmd = {
    "Mason",
    "MasonUpdate",
    "MasonInstall",
    "MasonUninstall",
    "MasonUninstallAll",
    "MasonLog",
  },
  keys = {
    { "<leader>cm", "<cmd>Mason<cr>", desc = "LSP Mason" },
  },
  opts = {
    ensure_installed = {
      "stylua",
      "lua-language-server",
      "typos-lsp",
    },
    ui = { border = "rounded" },
  },
}
