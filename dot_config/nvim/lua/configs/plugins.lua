local packer = require('packer')

packer.startup(function(use)
  -- package manaager
  use 'wbthomason/packer.nvim'

  -- prepare
  use 'MunifTanjim/nui.nvim'
  use 'kyazdani42/nvim-web-devicons'
  use 'nvim-lua/plenary.nvim'

  -- ui
  use 'sainnhe/edge'
  use 'nvim-lualine/lualine.nvim'
  use 'akinsho/bufferline.nvim'
  use 'lukas-reineke/indent-blankline.nvim'
  use 'nvim-neo-tree/neo-tree.nvim'
  use 'kkharji/lspsaga.nvim'
  --- treesitter
  use { 'nvim-treesitter/nvim-treesitter', run = ':TSUpdate' }
  use 'nvim-treesitter/playground'
  use 'p00f/nvim-ts-rainbow'

  -- lsp
  use 'neovim/nvim-lspconfig'
  use 'williamboman/nvim-lsp-installer'
  use 'onsails/lspkind.nvim'

  -- cmp
  use 'hrsh7th/nvim-cmp'
  use 'hrsh7th/cmp-buffer'
  use 'hrsh7th/cmp-cmdline'
  use 'hrsh7th/cmp-nvim-lsp'
  use 'hrsh7th/cmp-path'
  use 'hrsh7th/cmp-vsnip'

  -- telescope
  use 'nvim-telescope/telescope.nvim'

  -- others
  use 'akinsho/toggleterm.nvim'
  use 'hrsh7th/vim-vsnip'
  use { 'numToStr/Comment.nvim', config = function() require 'Comment'.setup {} end }
  use { 'windwp/nvim-autopairs', config = function() require 'nvim-autopairs'.setup {} end }
  use { 'norcalli/nvim-colorizer.lua', config = function() require 'colorizer'.setup { 'lua', 'css', 'html' } end }
end)
