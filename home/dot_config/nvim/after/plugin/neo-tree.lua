local status_ok, neo_tree = pcall(require, 'neo-tree')
if not status_ok then return end

vim.g.neo_tree_remove_legacy_commands = 1

neo_tree.setup {
  window = {
    mappings = {
      ['b'] = function() vim.api.nvim_exec("Neotree focus buffers position=current", true) end,
      ['f'] = function() vim.api.nvim_exec("Neotree focus filesystem position=current", true) end,
      ['g'] = function() vim.api.nvim_exec("Neotree focus git_status position=current", true) end,
      ['l'] = function() vim.api.nvim_exec("Neotree focus left", true) end,
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

local opts = { noremap = true, silent = true }
vim.keymap.set('n', '<Leader>e', function() vim.cmd [[Neotree toggle filesystem position=float]] end, opts)
vim.keymap.set('n', '<Leader>b', function() vim.cmd [[Neotree toggle buffers position=left]] end, opts)
