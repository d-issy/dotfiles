return {
  {
    "dressing.nvim",
    opts = {
      input = {
        title_pos = "center",
        insert_only = false,
        start_in_insert = false,
      },
    },
  },
  {
    "noice.nvim",
    opts = {
      cmdline = {
        view = "cmdline",
      },
      presets = {
        command_palette = false,
      },
    },
  },
  {
    "dashboard-nvim",
    opts = function(_, opts)
      local logo = [[
        ╔╗                    
        ║║                    
      ╔═╝║     ╔╗╔══╗╔══╗╔╗ ╔╗
      ║╔╗║╔═══╗╠╣║══╣║══╣║║ ║║
      ║╚╝║╚═══╝║║╠══║╠══║║╚═╝║
      ╚══╝     ╚╝╚══╝╚══╝╚═╗╔╝
                         ╔═╝║ 
                         ╚══╝ 
      ]]

      logo = string.rep("\n", 8) .. logo .. "\n\n"
      opts.config.header = vim.split(logo, "\n")
    end,
  },
  {
    "bufferline.nvim",
    opts = function(_, opts)
      -- tab mode
      opts.options.mode = "tabs"
    end,
  },
  {
    "lualine.nvim",
    opts = function(_, opts)
      opts.sections.lualine_a[1] = { function() return vim.fn.mode():sub(1, 1):upper() end }
      opts.sections.lualine_y = { { "filetype", colored = false } }

      table.remove(opts.sections.lualine_x, 1)
      table.remove(opts.sections.lualine_z, 1)
    end,
  },
}
