" encoding
set encoding=utf-8
set fileencoding=utf-8

" break code
set fileformats=unix,dos,mac

" back space
set backspace=indent,eol,start

" color
set t_Co=256

" defualt colorscheme
colorscheme badwolf

" indent
set expandtab
set autoindent
set smartindent
set breakindent

set tabstop=4
set shiftwidth=4
set softtabstop=0

" search
set ignorecase
set smartcase
set incsearch
set hlsearch

" no bell
set visualbell t_vb=
set noerrorbells

" set font
set guifont=CamingoCode\ Regular:h16
set guifontwide=Hiragino\ Sans\ W2:h16

" multibyte
set ambiwidth=double

" complete
set completeopt=longest,menuone

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
