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
  {
    "echasnovski/mini.indentscope",
    version = "*",
    event = { "BufReadPost" },
    opts = {
      symbol = "│",
      options = { try_as_border = true },
    },
    init = function()
      vim.api.nvim_create_autocmd("FileType", {
        pattern = {
          "alpha",
          "dashboard",
          "fzf",
          "help",
          "lazy",
          "lazyterm",
          "mason",
          "neo-tree",
          "notify",
          "toggleterm",
          "Trouble",
          "trouble",
        },
        callback = function()
          vim.b.miniindentscope_disable = true
        end,
      })
    end,
  },
}
