local packer = require('packer')

packer.startup(function(use)
  -- package manaager
  use 'wbthomason/packer.nvim'

  -- prepare
  use 'MunifTanjim/nui.nvim'
  use 'kyazdani42/nvim-web-devicons'
  use 'nvim-lua/plenary.nvim'

  -- ui
  use 'akinsho/bufferline.nvim'
  use 'lukas-reineke/indent-blankline.nvim'
  use 'nvim-neo-tree/neo-tree.nvim'
  use 'sainnhe/edge'
  use 'kkharji/lspsaga.nvim'
  --- treesitter
  use { 'nvim-treesitter/nvim-treesitter', run = ':TSUpdate' }
  use 'nvim-treesitter/playground'
  use 'p00f/nvim-ts-rainbow'

  -- snippet
  use 'hrsh7th/vim-vsnip'

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

  -- terminal
  use 'akinsho/toggleterm.nvim'

  -- others
  use { 'numToStr/Comment.nvim', config = function() require 'Comment'.setup {} end }
  use { 'windwp/nvim-autopairs', config = function() require 'nvim-autopairs'.setup {} end }
end)
