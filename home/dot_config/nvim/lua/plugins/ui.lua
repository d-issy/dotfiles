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
    opts = function(_, opts)
      opts.cmdline = { view = "cmdline" }
      opts.presets.command_palette = false
      opts.presets.lsp_doc_border = true
    end,
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
    "lualine.nvim",
    enabled = false,
    opts = function(_, opts)
      opts.sections.lualine_a[1] = { function() return vim.fn.mode():sub(1, 1):upper() end }
      opts.sections.lualine_y = { { "filetype", colored = false } }

      table.remove(opts.sections.lualine_x, 1)
      table.remove(opts.sections.lualine_z, 1)
    end,
  },
  {
    "bufferline.nvim",
    opts = {
      options = {
        show_buffer_close_icons = false,
        show_close_icon = false,
      },
    },
  },
}
