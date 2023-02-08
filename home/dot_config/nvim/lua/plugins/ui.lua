return {
  -- better vim.ui
  {
    'stevearc/dressing.nvim',
    lazy = true,
    init = function()
      ---@diagnostic disable-next-line: duplicate-set-field
      vim.ui.select = function(...)
        require('lazy').load({ plugins = { 'dressing.nvim' } })
        return vim.ui.select(...)
      end
      ---@diagnostic disable-next-line: duplicate-set-field
      vim.ui.input = function(...)
        require('lazy').load({ plugins = { 'dressing.nvim' } })
        return vim.ui.input(...)
      end
    end,
  },

  -- indent guides for Neovim
  {
    'lukas-reineke/indent-blankline.nvim',
    event = 'BufReadPost',
    opts = {
      char = '▏',
      filetype_exclude = { 'help', 'alpha', 'dashboard', 'neo-tree', 'Trouble', 'lazy' },
      show_trailing_blankline_indent = false,
      show_current_context = false,
    },
  },

  -- noice ui
  {
    'folke/noice.nvim',
    event = 'VeryLazy',
    dependencies = {
      'nvim-treesitter/nvim-treesitter',
    },
    opts = {
      cmdline = {
        view = 'cmdline',
        format = {
          cmdline = { pattern = '^:', icon = ':', lang = 'vim' },
          search_down = { kind = 'search', pattern = '^/', icon = ' ', lang = 'regex' },
          search_up = { kind = 'search', pattern = '^%?', icon = ' ', lang = 'regex' },
          filter = { pattern = '^:%s*!', icon = '', lang = 'bash' },
          lua = { pattern = '^:%s*lua%s+', icon = '', lang = 'lua' },
          help = { pattern = '^:%s*he?l?p?%s+', icon = '' },
        },
      },
      lsp = {
        override = {
          ['vim.lsp.util.convert_input_to_markdown_lines'] = true,
          ['vim.lsp.util.stylize_markdown'] = true,
        },
      },
      presets = {
        bottom_search = true,
        command_palette = false,
        long_message_to_split = true,
      },
    },
    keys = {
      {
        '<S-Enter>',
        function()
          require('noice').redirect(vim.fn.getcmdline())
        end,
        mode = 'c',
        desc = 'Redirect Cmdline',
      },
      {
        '<leader>snl',
        function()
          require('noice').cmd('last')
        end,
        desc = 'Noice Last Message',
      },
      {
        '<leader>snh',
        function()
          require('noice').cmd('history')
        end,
        desc = 'Noice History',
      },
      {
        '<leader>sna',
        function()
          require('noice').cmd('all')
        end,
        desc = 'Noice All',
      },
      {
        '<c-f>',
        function()
          if not require('noice.lsp').scroll(4) then
            return '<c-f>'
          end
        end,
        silent = true,
        expr = true,
        desc = 'Scroll forward',
        mode = { 'i', 'n', 's' },
      },
      {
        '<c-b>',
        function()
          if not require('noice.lsp').scroll(-4) then
            return '<c-b>'
          end
        end,
        silent = true,
        expr = true,
        desc = 'Scroll backward',
        mode = { 'i', 'n', 's' },
      },
    },
  },

  -- ui parts
  { 'nvim-lua/plenary.nvim', lazy = true },
  { 'nvim-tree/nvim-web-devicons', lazy = true },
  { 'MunifTanjim/nui.nvim', lazy = true },
}
