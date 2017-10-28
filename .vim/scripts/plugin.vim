"=====================================================
" vim-plug init if no exists
"=====================================================
if empty(glob('~/.vim/autoload/plug.vim'))
  silent !curl -fLo ~/.vim/autoload/plug.vim --create-dirs
        \ https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim
  autocmd VimEnter * PlugInstall --sync | source $MYVIMRC
endif

"=====================================================
" vim-plug
"=====================================================
call plug#begin('~/.vim/plugged')
Plug 'sirver/ultisnips'
Plug 'honza/vim-snippets'
Plug 'shepabashi/vim-snippets-extra'

Plug 'w0rp/ale'

Plug 'bling/vim-airline'
Plug 'vim-airline/vim-airline-themes'

Plug 'scrooloose/nerdtree'
Plug 'scrooloose/nerdcommenter'

Plug 'tpope/tpope-vim-abolish'
Plug 'rhysd/accelerated-jk'
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

"=====================================================
" plugin settings
"=====================================================

" UtiSnip
let g:UltiSnipsExpandTrigger = "<c-k>"
let g:UltiSnipsJumpForwardTrigger = "<c-j>"

" CtrlP
let g:ctrlp_map = ',,'
let g:ctrlp_show_hidden = 1
let g:ctrlp_custom_ignore = {
      \ 'dir':  '\v[\/](\.git|\.hg|\.idea|\.svn|plugged|node_modules|vendor)$',
      \ }

" NERDTree
let g:NERDTreeQuitOnOpen = 1
let g:NERDTreeShowHidden = 1
let g:NERDTreeIgnore = [
      \ '.git',
      \ '.hg',
      \ '.svn',
      \ '.idea',
      \ ]

" NERDCommenter
let g:NERDCreateDefaultMappings = 0
let g:NERDSpaceDelims = 1
let g:NERDCompactSexyComs = 1
let g:NERDDefaultAlign = 'left'

" ALE
let g:ale_lint_on_text_changed = 'never'
let g:ale_lint_on_enter = 0
let g:ale_lint_on_save = 1
let g:ale_lint_on_filetype_changed = 0
let g:ale_lint_delay = 0
let g:ale_set_loclist = 0
let g:ale_set_quickfix = 1
let g:ale_open_list = 1

let g:ale_fixers = {
      \ 'c':          ['clang-format'],
      \ 'cpp':        ['clang-format'],
      \ 'javascript': ['eslint'],
      \ 'python':     ['autopep8', 'isort'],
      \ }

let g:ale_linters = {
      \ 'c':          [],
      \ 'cpp':        [],
      \ 'go':         [],
      \ 'javascript': [],
      \ 'python':     ['flake8'],
      \ }

" GitGutter
set updatetime=250

" emmet
let g:user_emmet_leader_key='<c-e>'
let g:user_emmet_settings = {
      \  'variables': {
      \    'lang': 'ja',
      \  },
      \}

" javascript-libraries-syntax.vim
let g:used_javascript_libs = 'jquery,underscore,backbone,gularjs,angularui,angularuirouter,requirejs,sugar,jasmine,chai,ramda,react,flux,handlebars,d3,vue'

" jedi-vim
let g:jedi#popup_on_dot = 0
let g:jedi#goto_command = "<C-]>"
let g:jedi#goto_definitions_command = ""

" markdown
let g:vim_markdown_folding_disabled = 1
let g:vim_markdown_new_list_item_indent = 2
let g:vim_markdown_math = 1
let g:vim_markdown_frontmatter = 1
let g:vim_markdown_toml_frontmatter = 1
let g:vim_markdown_json_frontmatter = 1
let g:vim_markdown_fenced_languages = [
      \ 'c++=cpp',
      \ 'viml=vim',
      \ 'bash=sh',
      \ 'ini=dosini',
      \ 'go',
      \ 'html',
      \ 'javascript',
      \ 'json',
      \ 'python',
      \ ]
