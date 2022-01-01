" encoding
set encoding=utf-8
scriptencoding=utf-8
set fileencoding=utf-8

" break code
set fileformats=unix,dos,mac

" back space
set backspace=indent,eol,start

" indent
set expandtab
set autoindent
set smartindent
set breakindent

set tabstop=4
set shiftwidth=4
set softtabstop=0
set shiftround

" search
set ignorecase
set smartcase
set incsearch
set hlsearch
nohlsearch

" list
set list
set listchars=tab:>-,trail:•,nbsp:_

" netrw
let g:netrw_banner=0
let g:netrw_liststyle=3

" no bell
set visualbell t_vb=
set noerrorbells

" complete
set completeopt=longest,menuone
set wildmenu
set wildmode=longest:list,full
set hidden

" showcmd
set showcmd

" showmode
set noshowmode

" showbreak
set showbreak=/

" backup
set directory=/tmp

" ctrl-a
set nrformats=hex

" window
set splitright
set splitbelow

" syntax
syntax on
filetype plugin indent on
