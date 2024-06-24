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
    -- stylua: ignore
    keys = {
      { "<leader>e", function() require("mini.files").open() end, desc = "Files" },
    },
  },
  {
    "echasnovski/mini.surround",
    event = { "BufReadPre" },
    opts = {
      mappings = {
        add = "gsa",
        delete = "gsd",
        find = "gsf",
        find_left = "gsF",
        highlight = "gsh",
        replace = "gsr",
        update_n_lines = "gsn",
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
