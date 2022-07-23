local install_path = vim.fn.stdpath 'data' .. '/site/pack/packer/start/packer.nvim'
if vim.fn.empty(vim.fn.glob(install_path)) > 0 then
  PACKER_BOOT = vim.fn.system {
    'git',
    'clone',
    '--depth',
    '1',
    'https://github.com/wbthomason/packer.nvim',
    install_path,
  }
  print 'Installing packer close and reopen Neovim...'
  vim.cmd 'packadd packer.nvim'
end

vim.cmd [[
  augroup packer_config
    autocmd!
    autocmd BufWritePost plugins.lua source <afile> | PackerSync
  augroup end
]]

local status_ok, packer = pcall(require, 'packer')
if not status_ok then
  return
end

packer.init {
  display = {
    open_fn = function()
      return require 'packer.util'.float { border = 'rounded' }
    end
  }
}

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
  use { 'nvim-neo-tree/neo-tree.nvim', branch = 'v2.x' }
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

  if PACKER_BOOT then
    require 'packer'.snyc()
  end
end)
