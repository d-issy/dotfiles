return {
  "nvim-treesitter",
  opts = {
    auto_install = true,
    sync_install = true,
    highlight = { enable = true },
    indent = { enable = true },
    ensure_installed = {
      "diff",
      "jsdoc",
      "lua",
      "luadoc",
      "markdown",
      "markdown_inline",
    },
  },
}
