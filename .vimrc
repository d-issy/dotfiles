"================================
" Plugins
"================================
call plug#begin('~/.vim/plugged')

" General
Plug 'sirver/ultisnips'
Plug 'honza/vim-snippets'
Plug 'shepabashi/vim-snippets-extra'

Plug 'bling/vim-airline'
Plug 'vim-airline/vim-airline-themes'

Plug 'scrooloose/nerdtree'
Plug 'scrooloose/nerdcommenter'

Plug 'tpope/tpope-vim-abolish'
Plug 'kien/ctrlp.vim'
Plug 'airblade/vim-gitgutter'
Plug 'osyo-manga/vim-over'
Plug 'tpope/vim-surround'
Plug 'thinca/vim-quickrun'
Plug 'junegunn/vim-easy-align'

" for C/C++
Plug 'justmao945/vim-clang'

" for Arduino
Plug 'sudar/vim-arduino-syntax'

" Git
Plug 'tpope/vim-fugitive'

" Go
Plug 'fatih/vim-go', {'for': 'go', 'do': ':GoInstallBinaries'}

" HTML5
Plug 'mattn/emmet-vim'
Plug 'othree/html5.vim'
Plug 'hail2u/vim-css3-syntax'

" Javascript
Plug 'othree/yajs.vim'
Plug 'mxw/vim-jsx'
Plug 'othree/javascript-libraries-syntax.vim'
Plug 'ternjs/tern_for_vim', {'do': 'npm install'}

" Java
Plug 'vim-scripts/javacomplete', {'do': 'javac autoload/Reflection.java'}

" Markdown
Plug 'plasticboy/vim-markdown', {'for': 'markdown'}
Plug 'kannokanno/previm', {'for': 'markdown'}

" Python
Plug 'davidhalter/jedi-vim', {'for': 'python'}
Plug 'shepabashi/vim-pyenv', {'for': 'python'}

" Vim Processing
Plug 'sophacles/vim-processing'

call plug#end()

"================================
" Settings
"================================
execute 'source' fnamemodify(expand('<sfile>'), ':h').'/.vim/scripts/basic.vim'
execute 'source' fnamemodify(expand('<sfile>'), ':h').'/.vim/scripts/plugin.vim'
execute 'source' fnamemodify(expand('<sfile>'), ':h').'/.vim/scripts/keybind.vim'
