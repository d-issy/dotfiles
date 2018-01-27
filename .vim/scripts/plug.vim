if !exists('g:env')
  finish
endif

" vim-plug object {{ 1
let g:plug = {
      \ "path":   expand(g:env.vimpath) . "/autoload/plug.vim",
      \ "base":   expand(g:env.vimpath) . "/plugged",
      \ "url":    "https://raw.github.com/junegunn/vim-plug/master/plug.vim",
      \ "github": "https://github.com/junegunn/vim-plug",
      \ }

function! g:plug.ready()
  return filereadable(g:plug.path)
endfunction

function! g:plug.is_installed(plug_name)
  return has_key(g:plugs, a:plug_name) && isdirectory(g:plugs[a:plug_name].dir)
endfunction

function! g:plug.is_runtimepath(plug_name)
  return index(split(&runtimepath, ","), get(g:plugs[a:plug_name], "dir")) != -1
endfunction

function! g:plug.is_enabled(plug_name)
  return g:plug.is_installed(a:plug_name) && g:plug.is_runtimepath(a:plug_name)
endfunction
"}}

" vim-plug init if no exists {{
if !g:plug.ready()
  execute printf("!curl -fLo %s --create-dirs %s", g:plug.path, g:plug.url)
  autocmd VimEnter * PlugInstall --sync
endif
"}}

" vim-plug
call plug#begin(g:plug.base)
if !has('gui_macvim')
Plug 'sirver/ultisnips'
endif
Plug 'honza/vim-snippets'
Plug 'shepabashi/vim-snippets-extra'

Plug 'flazz/vim-colorschemes'

Plug 'w0rp/ale'

Plug 'scrooloose/nerdtree'
Plug 'scrooloose/nerdcommenter'

Plug 'tpope/tpope-vim-abolish'
Plug 'rhysd/accelerated-jk'
Plug 'kien/ctrlp.vim'
Plug 'airblade/vim-gitgutter'
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
if v:version >= 800
  Plug 'fatih/vim-go', {'do': ':GoInstallBinaries'}
endif

" HTML5
Plug 'mattn/emmet-vim'
Plug 'othree/html5.vim'
Plug 'hail2u/vim-css3-syntax'

" Javascript
Plug 'othree/yajs.vim'
Plug 'mxw/vim-jsx'
Plug 'othree/javascript-libraries-syntax.vim'
Plug 'ternjs/tern_for_vim', {'do': 'npm install'}
Plug 'leafgarland/typescript-vim'

" Java
Plug 'vim-scripts/javacomplete', {'do': 'which javac > /dev/null 2>&1 && javac autoload/Reflection.java'}

" Markdown
Plug 'plasticboy/vim-markdown', {'for': 'markdown'}
Plug 'kannokanno/previm', {'for': 'markdown'}

" Python
Plug 'davidhalter/jedi-vim', {'for': 'python', 'do': 'which pip3 > /dev/null 2>&1 && pip3 install jedi'}
Plug 'shepabashi/vim-pyenv', {'for': 'python'}

" Vim Processing
Plug 'sophacles/vim-processing'
call plug#end()
