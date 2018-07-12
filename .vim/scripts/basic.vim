" encoding
scriptencoding=utf-8
set encoding=utf-8
set fileencoding=utf-8

" python 3.7 deprecated imp
" so plugins using python3 can not work
" this is an instant solution until vim improve this issues
" refs: https://github.com/vim/vim/issues/3117
if has('python3')
  silent! python3 1
endif

" break code
set fileformats=unix,dos,mac

" back space
set backspace=indent,eol,start

" color
set t_Co=256
set background=dark

if g:plug.is_enabled('gruvbox')
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
  if v:version >= 800
    au VimEnter * hi StatusLineTerm    ctermfg=255 ctermbg=237 cterm=NONE
    au VimEnter * hi StatusLineTermNC  ctermfg=245 ctermbg=237 cterm=NONE
  endif

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
set shiftround

" search
set ignorecase
set smartcase
set incsearch
set hlsearch
nohlsearch

" list
set list
set listchars=tab:\ \ ,trail:•

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

" ctags
augroup ctags
  autocmd!
  if executable('ctags')
    set tags=\.tags,./tags,tags
    autocmd BufWritePost *.js silent call system('ctags -R -f .tags &')
    autocmd BufWritePost *.py silent call system('ctags -R -f .tags &')
  endif
augroup END

" syntax
syntax on
filetype plugin indent on
