return {
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
    "echasnovski/mini.align",
    event = { "BufReadPre" },
    opts = {},
  },
  {
    "echasnovski/mini.icons",
    opts = {},
    init = function()
      package.preload["nvim-web-devicons"] = function()
        package.loaded["nvim-web-devicons"] = {}
        require("mini.icons").mock_nvim_web_devicons()
        return package.loaded["nvim-web-devicons"]
      end
    end,
  },
  {
    "echasnovski/mini.hipatterns",
    event = { "BufReadPost" },
    opts = function()
      local hipatterns = require "mini.hipatterns"
      return {
        highlighters = {
          hex_color = hipatterns.gen_highlighter.hex_color(),
        },
      }
    end,
  },
}
