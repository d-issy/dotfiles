if has('vim_starting')
  set nocompatible
endif

"================================
" Plugins
"================================
call plug#begin('~/.vim/plugged')
Plug 'Shougo/neocomplete'
Plug 'Shougo/neosnippet'
Plug 'Shougo/neosnippet-snippets'
Plug 'davidhalter/jedi-vim', {'for': 'python'}
Plug 'fatih/vim-go', {'do': ':GoInstallBinaries', 'for': 'go'}
Plug 'itchyny/lightline.vim'
Plug 'mattn/emmet-vim', {'for': ['html', 'css']}
Plug 'scrooloose/nerdtree'
Plug 'thinca/vim-quickrun'
call plug#end()

"================================
" Settings
"================================
execute 'source' fnamemodify(expand('<sfile>'), ':h').'/.vim/scripts/basic.vim'
execute 'source' fnamemodify(expand('<sfile>'), ':h').'/.vim/scripts/plugin.vim'
execute 'source' fnamemodify(expand('<sfile>'), ':h').'/.vim/scripts/keybind.vim'
