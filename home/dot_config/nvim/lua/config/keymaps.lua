local function map(mode, lhs, rhs, opts)
  opts = opts or {}
  opts.silent = true
  vim.keymap.set(mode, lhs, rhs, opts)
end

local function toggle(option, values)
  if values then
    if vim.opt_local[option]:get() == values[1] then
      vim.opt_local[option] = values[2]
    else
      vim.opt_local[option] = values[1]
    end
  end
  vim.opt_local[option] = not vim.opt_local[option]:get()
end

map('n', '<C-Up>', '<cmd>resize -2<cr>', { desc = 'Decrease window height' })
map('n', '<C-Down>', '<cmd>resize +2<cr>', { desc = 'Increase window height' })
map(
  'n',
  '<C-Left>',
  '<cmd>vertical resize -2<cr>',
  { desc = 'Decrease window width' }
)
map(
  'n',
  '<C-Right>',
  '<cmd>vertical resize +2<cr>',
  { desc = 'Increase window width' }
)
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

map('n', '<leader>un', function() toggle('number') end, { desc = 'Toggle Number' })
map('n', '<leader>ur', function() toggle('relativenumber') end, { desc = 'Toggle Relative Number' })
map('n', '<leader>uw', function() toggle('wrap') end, { desc = 'Toggle wrap' })
