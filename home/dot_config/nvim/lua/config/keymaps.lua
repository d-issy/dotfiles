local function map(mode, lhs, rhs, opts)
  opts = opts or {}
  opts.silent = true
  vim.keymap.set(mode, lhs, rhs, opts)
end

local function toggle(option, values)
  local function fn()
    if values then
      if vim.opt_local[option]:get() == values[1] then
        vim.opt_local[option] = values[2]
      else
        vim.opt_local[option] = values[1]
      end
    end
    vim.opt_local[option] = not vim.opt_local[option]:get()
  end
  return fn
end

map('n', '<C-Up>', '<cmd>resize -2<cr>', { desc = 'height--' })
map('n', '<C-Down>', '<cmd>resize +2<cr>', { desc = 'height++' })
map('n', '<C-Left>', '<cmd>vertical resize -2<cr>', { desc = 'width--' })
map('n', '<C-Right>', '<cmd>vertical resize +2<cr>', { desc = 'width++' })
map('n', '<leader>b[', '<cmd>bp<cr>', { desc = 'Prev Buffer' })
map('n', '<leader>b]', '<cmd>bn<cr>', { desc = 'Next Buffer' })
map('n', '<leader>qq', '<cmd>qa<cr>', { desc = 'Quit all' })
map('n', '<leader>t[', '<cmd>tabprevious<cr>', { desc = 'Prev Tab' })
map('n', '<leader>t]', '<cmd>tabnext<cr>', { desc = 'Next Tab' })
map('n', '<leader>td', '<cmd>tabclose<cr>', { desc = 'Close Tab' })
map('n', '<leader>tf', '<cmd>tabfirst<cr>', { desc = 'First Tab' })
map('n', '<leader>tl', '<cmd>tablast<cr>', { desc = 'Last Tab' })
map('n', '<leader>tt', '<cmd>tabnew<cr>', { desc = 'New Tab' })
map('n', '<leader>w', '<cmd>w<cr><esc>', { desc = 'Write' })
map('n', '<leader>un', toggle 'number', { desc = 'Toggle Number' })
map('n', '<leader>ur', toggle 'relativenumber', { desc = 'Toggle Relative' })
map('n', '<leader>uw', toggle 'wrap', { desc = 'Toggle wrap' })

map(
  'n',
  '<leader>gs',
  function() require('lazy.util').float_term { 'tig', 'status' } end
)
