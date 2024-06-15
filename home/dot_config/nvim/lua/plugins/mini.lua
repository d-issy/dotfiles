return {
  { "echasnovski/mini.nvim", version = "*" },
  {
    "echasnovski/mini.files",
    version = "*",
    opts = {
      mappings = {
        synchronize = ";",
      },
    },
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
