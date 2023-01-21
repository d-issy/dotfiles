return {
  {
    'nvim-neo-tree/neo-tree.nvim',
    branch = 'v2.x',
    dependencies = {
      "nvim-lua/plenary.nvim",
      "MunifTanjim/nui.nvim",
      "nvim-tree/nvim-web-devicons",
    },
    cmd = 'Neotree',
    keys = {
      { '<Leader>e', '<cmd>Neotree toggle filesystem position=float<CR>' },
      { '<Leader>b', '<cmd>Neotree toggle buffers position=left<CR>' }
    },
    init = function()
      vim.g.neo_tree_remove_legacy_commands = 1
      if vim.fn.argc() == 1 then
        local stat = vim.loop.fs_stat(vim.fn.argv(0))
        if stat and stat.type == 'directory' then
          require('neo-tree')
        end
      end
    end,
    opts = {
      window = {
        mappings = {
          ['b'] = function() vim.api.nvim_exec('Neotree focus buffers position=current', true) end,
          ['f'] = function() vim.api.nvim_exec('Neotree focus filesystem position=current', true) end,
          ['g'] = function() vim.api.nvim_exec('Neotree focus git_status position=current', true) end,
          ['l'] = function() vim.api.nvim_exec('Neotree focus left', true) end,
        }
      },
      filesystem = {
        filtered_items = {
          hide_dotfiles = false,
          hide_gitignored = true,
          hide_by_name = {
            '.git',
            '.pytest_cache',
            '.vscode',
            '.venv',
            '__pycache__',
            'node_modules',
          },
          hide_by_pattern = {},
          never_show = {},
          never_show_by_pattern = {},
        },
        group_empty_dirs = true,
        window = {
          mappings = {
            ['a'] = { 'add', config = { show_path = 'relative' } },
            ['c'] = { 'copy', config = { show_path = 'relative' } },
          }
        },
      },
    }
  }
}
