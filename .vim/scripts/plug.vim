if !exists('g:env')
  finish
endif

" vim-plug object {{ 1
let g:plug = {
      \ 'path':   expand(g:env.vimpath) . '/autoload/plug.vim',
      \ 'base':   expand(g:env.vimpath) . '/plugged',
      \ 'url':    'https://raw.github.com/junegunn/vim-plug/master/plug.vim',
      \ 'github': 'https://github.com/junegunn/vim-plug',
      \ }

function! g:plug.ready()
  return filereadable(g:plug.path)
endfunction

function! g:plug.is_installed(plug_name)
  return has_key(g:plugs, a:plug_name) && isdirectory(g:plugs[a:plug_name].dir)
endfunction

function! g:plug.is_runtimepath(plug_name)
  return index(split(&runtimepath, ','), get(g:plugs[a:plug_name], 'dir')) != -1
endfunction

function! g:plug.is_enabled(plug_name)
  return g:plug.is_installed(a:plug_name) && g:plug.is_runtimepath(a:plug_name)
endfunction
"}}

" vim-plug init if no exists {{
if !g:plug.ready()
  execute printf('!curl -fLo %s --create-dirs %s', g:plug.path, g:plug.url)
  augroup plug_install
    autocmd VimEnter * PlugInstall --sync
  augroup END
endif
"}}

" vim-plug
call plug#begin(g:plug.base)

" snippets
if executable('python') && !has('gui_macvim')
  Plug 'sirver/ultisnips'
endif

Plug 'honza/vim-snippets'
Plug 'shepabashi/vim-snippets-extra'

" linter
Plug 'w0rp/ale'

" fzf
if executable('fzf')
  Plug '/usr/local/opt/fzf'
  Plug 'junegunn/fzf.vim'
endif

" colorscheme
Plug 'morhetz/gruvbox'

" editorconfig
Plug 'editorconfig/editorconfig-vim'

" comment
Plug 'scrooloose/nerdcommenter'

Plug 'junegunn/vim-easy-align'
Plug 'majutsushi/tagbar'
Plug 'mattn/emmet-vim'
Plug 'scrooloose/nerdtree'
Plug 'thinca/vim-quickrun'
Plug 'tpope/tpope-vim-abolish'
Plug 'tpope/vim-surround'
Plug 'wellle/targets.vim'

" git
if executable('git')
  Plug 'airblade/vim-gitgutter'
  Plug 'tpope/vim-fugitive'
endif

" for C/C++
Plug 'justmao945/vim-clang'

" for Arduino
Plug 'sudar/vim-arduino-syntax'

" Go
if executable('go') && v:version >= 800
  Plug 'fatih/vim-go', {'do': ':GoInstallBinaries'}
endif

" Javascript
if executable('node') && executable('npm')
  Plug 'ternjs/tern_for_vim', {'do': 'npm install'}
  Plug 'leafgarland/typescript-vim'
endif

" Java
if executable('javac')
  Plug 'vim-scripts/javacomplete', {'do': 'javac autoload/Reflection.java'}
endif

" Markdown
Plug 'plasticboy/vim-markdown', {'for': 'markdown'}
Plug 'previm/previm', {'for': 'markdown'}
Plug 'dhruvasagar/vim-table-mode', {'for': 'markdown'}

" Python
if has('python3') && executable('pip')
  Plug 'davidhalter/jedi-vim'
endif

call plug#end()
