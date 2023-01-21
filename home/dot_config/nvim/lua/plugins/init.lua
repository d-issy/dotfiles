return {
  {
    'sainnhe/edge',
    lazy = false,
    priority = 1000,
    config = function()
      vim.g.edge_style = 'neon'
      vim.g.edge_dim_foreground = 1
      vim.cmd 'colorscheme edge'
    end,
  },
  { 'akinsho/toggleterm.nvim', opts = { size = 13, start_in_insert = true, shade_terminals = false } },
  { 'j-hui/fidget.nvim', config = true },
  { 'lewis6991/gitsigns.nvim', config = true },
  { 'norcalli/nvim-colorizer.lua', opts = { 'lua', 'css', 'html' } },
  { 'numToStr/Comment.nvim', config = true },
  { 'nvim-lualine/lualine.nvim', dependencies = { 'nvim-tree/nvim-web-devicons' } },
  { 'windwp/nvim-autopairs', config = true },
}
