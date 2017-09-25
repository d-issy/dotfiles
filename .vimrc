if has('vim_starting')
  set nocompatible
endif

"================================
" Plugins
"================================
call plug#begin('~/.vim/plugged')

" General
Plug 'sirver/ultisnips'
Plug 'honza/vim-snippets'

Plug 'bling/vim-airline'
Plug 'vim-airline/vim-airline-themes'

Plug 'scrooloose/nerdtree'
Plug 'scrooloose/nerdcommenter'

Plug 'kien/ctrlp.vim'
Plug 'airblade/vim-gitgutter'
Plug 'osyo-manga/vim-over'
Plug 'tpope/vim-surround'
Plug 'thinca/vim-quickrun'
Plug 'godlygeek/tabular'

" for C/C++
Plug 'justmao945/vim-clang'

" for Arduino
Plug 'sudar/vim-arduino-syntax'

" Git
Plug 'tpope/vim-fugitive'

" Go
Plug 'fatih/vim-go', {'for': 'go', 'do': ':GoInstallBinaries'}

" HTML5
Plug 'mattn/emmet-vim', {'for': ['html', 'css', 'jsx']}
Plug 'othree/html5.vim', {'for': 'html'}
Plug 'hail2u/vim-css3-syntax', {'for': ['html', 'css']}

" Javascript
Plug 'pangloss/vim-javascript', {'for': ['html', 'javascript', 'jsx']}
Plug 'maxmellon/vim-jsx-pretty', {'for': ['javascript', 'jsx']}

" Markdown
Plug 'plasticboy/vim-markdown', {'for': 'markdown'}
Plug 'kannokanno/previm', {'for': 'markdown'}

" Python
Plug 'davidhalter/jedi-vim', {'for': 'python'}
Plug 'shepabashi/vim-pyenv', {'for': 'python'}

call plug#end()

"================================
" Settings
"================================
execute 'source' fnamemodify(expand('<sfile>'), ':h').'/.vim/scripts/basic.vim'
execute 'source' fnamemodify(expand('<sfile>'), ':h').'/.vim/scripts/plugin.vim'
execute 'source' fnamemodify(expand('<sfile>'), ':h').'/.vim/scripts/keybind.vim'
