return {
  {
    "nvim-treesitter/nvim-treesitter",
    event = { "BufReadPost" },
    cmd = { "TSInstall", "TSBufEnable", "TSBufDisable", "TSModuleInfo" },
    build = ":TSUpdate",
    opts = {
      sync_install = true,
      auto_install = true,
      ensure_installed = {
        "diff",
        "lua",
        "luadoc",
        "markdown",
        "markdown_inline",
        "printf",
        "vim",
        "vimdoc",
      },
      incremental_selection = { enable = true },
      highlight = {
        enable = true,
        use_languagetree = true,
      },
      indent = { enable = true },
    },
    config = function(_, opts)
      require("nvim-treesitter.configs").setup(opts)
    end,
  },
}
