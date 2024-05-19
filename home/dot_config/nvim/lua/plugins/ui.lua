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
    "bufferline.nvim",
    opts = {
      options = {
        show_buffer_close_icons = false,
        show_close_icon = false,
      },
    },
  },
  {
    "edgy.nvim",
    opts = function(_, opts)
      -- disable neo-tree
      opts.left = {}
    end,
  },
}
