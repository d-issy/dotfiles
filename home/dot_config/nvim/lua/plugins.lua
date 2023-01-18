local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", -- latest stable release
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

local status_ok, lazy = pcall(require, 'lazy')
if not status_ok then return end

lazy.setup {
  {
    'sainnhe/edge', lazy = false, priority = 1000, config = function()
      vim.g.edge_style = 'neon'
      vim.g.edge_dim_foreground = 1
      vim.cmd 'colorscheme edge'
    end,
  },
  {
    'nvim-neo-tree/neo-tree.nvim', branch = 'v2.x', dependencies = {
      "nvim-lua/plenary.nvim",
      "MunifTanjim/nui.nvim",
      "nvim-tree/nvim-web-devicons",
    }
  },
  {
    'nvim-treesitter/nvim-treesitter',
    lazy = true,
    dependencies = {
      'nvim-treesitter/playground',
      { 'lukas-reineke/indent-blankline.nvim', opts = {
        char = "▏",
        show_current_context = true
      } },
    }
  },
  { 'neovim/nvim-lspconfig', event = 'InsertEnter',
    dependencies = {
      { 'jose-elias-alvarez/null-ls.nvim' },
      { 'folke/neodev.nvim', config = true },
      {
        'williamboman/mason.nvim',
        config = true,
        dependencies = {
          { 'williamboman/mason-lspconfig.nvim', opts = { automatic_installation = false } }
        }
      },
      {
        'glepnir/lspsaga.nvim', branch = 'main',
        opts = { ui = { code_action = '', diagnostic = '' } },
        keys = {
          { '<leader>f', function() vim.lsp.buf.format { async = true } end },
          { 'gd', '<cmd>Lspsaga lsp_finder<CR>' },
          { 'K', '<cmd>Lspsaga hover_doc<CR>' },
          { '<leader>d', '<cmd>Lspsaga show_line_diagnostics<CR>' },
          { '<leader>h', '<cmd>Lspsaga code_action<CR>' },
          { '<leader>l', '<cmd>Lspsaga outline<CR>' },
          { '<leader>r', '<cmd>Lspsaga rename<CR>' },
          { '<leader>[', '<cmd>Lspsaga diagnostic_jump_prev<CR>' },
          { '<leader>]', '<cmd>Lspsaga diagnostic_jump_next<CR>' },
        }
      },
    }
  },
  {
    'hrsh7th/nvim-cmp', dependencies = {
      'hrsh7th/cmp-buffer',
      'hrsh7th/cmp-cmdline',
      'hrsh7th/cmp-nvim-lsp',
      'hrsh7th/cmp-path',
      'hrsh7th/cmp-nvim-lsp-signature-help',
      'L3MON4D3/LuaSnip',
      'saadparwaiz1/cmp_luasnip',
    },
  },
  { 'akinsho/toggleterm.nvim', opts = { size = 13, start_in_insert = true, shade_terminals = false } },
  { 'nvim-lualine/lualine.nvim', dependencies = { 'nvim-tree/nvim-web-devicons' } },
  { 'nvim-telescope/telescope.nvim', dependencies = { 'nvim-lua/plenary.nvim' } },
  { 'norcalli/nvim-colorizer.lua', opts = { 'lua', 'css', 'html' } },
  { 'j-hui/fidget.nvim', config = true },
  { 'lewis6991/gitsigns.nvim', config = true },
  { 'numToStr/Comment.nvim', config = true },
  { 'windwp/nvim-autopairs', config = true },
}
