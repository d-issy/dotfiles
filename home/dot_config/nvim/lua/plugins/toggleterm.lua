return {
  'akinsho/toggleterm.nvim',
  keys = function()
    local Terminal = require 'toggleterm.terminal'.Terminal
    local tig_status = Terminal:new { cmd = 'tig status', direction = 'float' }
    return {
      { '<Leader>t', '<cmd>ToggleTerm<CR>' },
      { '<Leader>gs', function() tig_status:toggle() end },
    }
  end,
  config = function()
    require 'toggleterm'.setup {
      size = 13,
      start_in_insert = true,
      shade_terminals = false
    }

    function _G.set_terminal_keymaps()
      local opts = { noremap = true }
      vim.api.nvim_buf_set_keymap(0, 't', '<C-w>h', [[<C-\><C-n><C-W>h]], opts)
      vim.api.nvim_buf_set_keymap(0, 't', '<C-w>j', [[<C-\><C-n><C-W>j]], opts)
      vim.api.nvim_buf_set_keymap(0, 't', '<C-w>k', [[<C-\><C-n><C-W>k]], opts)
      vim.api.nvim_buf_set_keymap(0, 't', '<C-w>l', [[<C-\><C-n><C-W>l]], opts)
    end

    -- if you only want these mappings for toggle term use term://*toggleterm#* instead
    vim.api.nvim_create_autocmd('TermOpen', { pattern = 'term://*', callback = set_terminal_keymaps })
  end
}
