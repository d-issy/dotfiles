return {
  { "echasnovski/mini.nvim", version = "*" },
  {
    "echasnovski/mini.files",
    version = "*",
    config = true,
    keys = {
      {
        "<leader>e",
        function()
          MiniFiles.open()
        end,
        desc = "Files",
      },
    },
  },
  {
    "echasnovski/mini.bufremove",
    version = "*",
    opts = { silent = true },
    keys = {
      {
        "<leader>bd",
        function()
          MiniBufremove.unshow()
        end,
        desc = "Buffer Delete",
      },
    },
  },
}
