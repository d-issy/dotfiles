" encoding
set encoding=utf-8
set fileencoding=utf-8

" break code
set fileformats=unix,dos,mac

" back space
set backspace=indent,eol,start

" color
set t_Co=256

if g:plug.is_enabled('vim-colorschemes')
  colorscheme gruvbox
endif

augroup change_colors
  au!

  " select
  au VimEnter * hi Visual ctermfg=NONE ctermbg=237 cterm=NONE

  " search
  au VimEnter * hi Search ctermfg=NONE ctermbg=237 cterm=NONE

  " statusline
  au VimEnter * hi StatusLine    ctermfg=255 ctermbg=237 cterm=NONE
  au VimEnter * hi StatusLineNC  ctermfg=245 ctermbg=237 cterm=NONE
  au InsertEnter * hi StatusLine ctermfg=214 ctermbg=236 cterm=bold
  au InsertLeave * hi StatusLine ctermfg=255 ctermbg=237 cterm=NONE

  " tabbar
  au VimEnter * hi TabLine     ctermfg=15 ctermbg=237 cterm=NONE
  au VimEnter * hi TabLineFill ctermfg=243 ctermbg=237 cterm=underline
  au VimEnter * hi TabLineSel  ctermfg=243 ctermbg=235 cterm=NONE

augroup END

" indent
set expandtab
set autoindent
set smartindent
set breakindent

set tabstop=4
set shiftwidth=4
set softtabstop=0

" fold
set foldmethod=indent
set foldlevel=99
set foldnestmax=2
set foldminlines=1
autocmd FileType c setlocal foldmethod=syntax
autocmd FileType cpp setlocal foldmethod=syntax

" search
set ignorecase
set smartcase
set incsearch
set hlsearch
nohlsearch

" netrw
let g:netrw_banner=0
let g:netrw_browse_split=4
let g:netrw_altv=1
let g:netrw_liststyle=3

" no bell
set visualbell t_vb=
set noerrorbells

" multibyte
set ambiwidth=double

" complete
set completeopt=longest,menuone
set wildmenu
set wildmode=longest,list

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
