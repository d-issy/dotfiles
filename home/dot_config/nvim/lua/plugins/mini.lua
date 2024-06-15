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
          MiniFiles.open() ---@diagnostic disable-line: undefined-global
        end,
        desc = "Files",
      },
    },
  },
}
