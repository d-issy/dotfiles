return {
  -- better vim.ui
  {
    "stevearc/dressing.nvim",
    lazy = true,
    init = function()
      ---@diagnostic disable-next-line: duplicate-set-field
      vim.ui.select = function(...)
        require("lazy").load { plugins = { "dressing.nvim" } }
        return vim.ui.select(...)
      end
      ---@diagnostic disable-next-line: duplicate-set-field
      vim.ui.input = function(...)
        require("lazy").load { plugins = { "dressing.nvim" } }
        return vim.ui.input(...)
      end
    end,
  },

  -- noice ui
  -- @cspell: words noice,cmdline,getcmdline
  {
    "folke/noice.nvim",
    event = "VeryLazy",
    dependencies = {
      "nvim-treesitter/nvim-treesitter",
    },
    opts = {
      cmdline = {
        view = "cmdline",
        format = {
          cmdline = { pattern = "^:", icon = ":", lang = "vim" },
          -- stylua: ignore
          search_down = { kind = "search", pattern = "^/", icon = " ", lang = "regex" },
          -- stylua: ignore
          search_up = { kind = "search", pattern = "^%?", icon = " ", lang = "regex" },
          filter = { pattern = "^:%s*!", icon = "", lang = "bash" },
          lua = { pattern = "^:%s*lua%s+", icon = "", lang = "lua" },
          help = { pattern = "^:%s*he?l?p?%s+", icon = "" },
        },
      },
      lsp = {
        override = {
          ["vim.lsp.util.convert_input_to_markdown_lines"] = true,
          ["vim.lsp.util.stylize_markdown"] = true,
        },
      },
      presets = {
        bottom_search = true,
        command_palette = false,
        long_message_to_split = true,
      },
    },
    -- stylua: ignore
    keys = {
      { "<S-Enter>", function() require("noice").redirect(vim.fn.getcmdline()) end, mode = "c", desc = "Redirect Cmdline" },
      { "<leader>snl", function() require("noice").cmd "last" end, desc = "Noice Last Message" },
      { "<leader>snh", function() require("noice").cmd "history" end, desc = "Noice History" },
      { "<leader>sna", function() require("noice").cmd "all" end, desc = "Noice All" },
      {
        "<c-f>",
        function() if not require("noice.lsp").scroll(4) then return "<c-f>" end end,
        silent = true, expr = true, mode = { "i", "n", "s" }, desc = "Scroll forward",
      },
      {
        "<c-b>",
        function() if not require("noice.lsp").scroll(-4) then return "<c-b>" end end,
        silent = true, expr = true, mode = { "i", "n", "s" }, desc = "Scroll backward",
      },
    },
  },

  -- statusline
  {
    "nvim-lualine/lualine.nvim",
    event = "VeryLazy",
    opts = function()
      return {
        options = {
          theme = "auto",
          globalstatus = true,
          component_separators = "",
          section_separators = "",
          disabled_filetypes = {
            statusline = { "TelescopePrompt", "lazy" },
          },
        },
        extensions = { "neo-tree" },
        sections = {
          lualine_a = {
            {
              "mode",
              fmt = function(mode) return mode:sub(1, 1) end,
              right_padding = 2,
            },
          },
          lualine_b = { "diagnostics" },
          lualine_c = { "buffers" },
          lualine_x = { "branch", "diff" },
          lualine_y = { "filetype" },
          lualine_z = { function() return " " end },
        },
        tabline = {
          lualine_b = {
            -- stylua: ignore
            { "filetype", icon_only = true, separator = "", padding = { left = 1, right = 0 } },
            -- stylua: ignore
            { "filename", path = 1, symbols = { modified = "  ", readonly = "", unnamed = "" } },
            function() return require("nvim-navic").get_location() end,
          },
        },
      }
    end,
  },

  -- indent guides for Neovim
  {
    "lukas-reineke/indent-blankline.nvim",
    event = "BufReadPost",
    opts = {
      char = "▏",
      filetype_exclude = {
        "help",
        "dashboard",
        "neo-tree",
        "Trouble",
        "lazy",
      },
      show_trailing_blankline_indent = false,
      show_current_context = false,
    },
  },

  -- navic
  -- @cspell: words navic
  {
    "SmiteshP/nvim-navic",
    opts = function()
      return {
        icons = {
          File = " ",
          Module = " ",
          Namespace = " ",
          Package = " ",
          Class = " ",
          Method = " ",
          Property = " ",
          Field = " ",
          Constructor = " ",
          Enum = "練",
          Interface = "練",
          Function = " ",
          Variable = " ",
          Constant = " ",
          String = " ",
          Number = " ",
          Boolean = "◩ ",
          Array = " ",
          Object = " ",
          Key = " ",
          Null = "ﳠ ",
          EnumMember = " ",
          Struct = " ",
          Event = " ",
          Operator = " ",
          TypeParameter = " ",
        },
        highlight = true,
        separator = " > ",
        depth_limit = 0,
        depth_limit_indicator = "..",
        safe_output = true,
      }
    end,
  },

  -- ui parts
  { "nvim-lua/plenary.nvim", lazy = true },
  { "nvim-tree/nvim-web-devicons", lazy = true },
  { "MunifTanjim/nui.nvim", lazy = true },
}
