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

function! g:plug.is_enabled(plug_name)
  return has_key(g:plugs, a:plug_name) && isdirectory(g:plugs[a:plug_name].dir)
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

Plug 'shepabashi/vim-snippets-extra'

Plug 'neoclide/coc.nvim', {'branch': 'release', 'do': ':CocInstall coc-json coc-tsservercoc-snippets coc-ultisnips coc-emmet coc-pairs coc-marketplace coc-html coc-css'}

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

Plug 'AndrewRadev/splitjoin.vim'
Plug 'junegunn/vim-easy-align'
Plug 'majutsushi/tagbar'
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

" Go
if executable('go') && v:version >= 800
  Plug 'fatih/vim-go', {'do': ':GoInstallBinaries'}
endif

" Markdown
Plug 'plasticboy/vim-markdown', {'for': 'markdown'}
Plug 'previm/previm', {'for': 'markdown'}
Plug 'dhruvasagar/vim-table-mode', {'for': 'markdown'}

call plug#end()
