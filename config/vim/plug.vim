""""""""
" init "
""""""""
" plug init {{{
let g:plug = {
  \ "path": expand('$XDG_CONFIG_HOME/vim/autoload/plug.vim'),
  \ "base": expand('$XDG_CONFIG_HOME/vim/plugged'),
  \ "url": 'https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim',
  \ }

function! g:plug.ready()
  return filereadable(g:plug.path)
endfunction

function! g:plug.is_enabled(plug_name)
  return has_key(g:plugs, a:plug_name) && isdirectory(g:plugs[a:plug_name].dir)
endfunction

if !g:plug.ready()
  silent echo 'installing plug.vim...'
  silent execute printf('!curl -fLo %s --create-dirs %s', g:plug.path, g:plug.url)
  silent echo 'done'
endif
" }}}

"""""""""""
" plugins "
"""""""""""

" plugins {{{
call plug#begin(g:plug.base)

" nerdtree
Plug 'preservim/nerdtree'
Plug 'ryanoasis/vim-devicons'
Plug 'tiagofumo/vim-nerdtree-syntax-highlight'
Plug 'PhilRunninger/nerdtree-buffer-ops'
Plug 'Xuyuanp/nerdtree-git-plugin'

" colorscheme
Plug 'ghifarit53/tokyonight-vim'

call plug#end()
" }}}

""""""""""""
" settings "
""""""""""""

" nerdtree {{{
if g:plug.is_enabled('nerdtree')
let g:NERDTreeAutoDeleteBuffer = 1
let g:NERDTreeShowHidden = 1
let g:NERDTreeMinimalMenu = 1
let g:NERDTreeMinimalUI = 1
let g:NERDTreeNaturalSort = 1
let g:NERDTreeIgnore = ['\~$', '\.git']
let g:netrw_dirhistmax = 0

let g:NERDTreeGitStatusUseNerdFonts = 1

let s:FolderColor = 'D4843E'
let g:WebDevIconsDefaultFolderSymbolColor = s:FolderColor
endif
" }}}

" tokyonight {{{
if g:plug.is_enabled('tokyonight-vim')
set t_Co=256
set background=dark
let g:tokyonight_style = 'night'
let g:tokyonight_transparent_background = 1
let g:tokyonight_disable_italic_comment = 1
let g:tokyonight_menu_selection_background = 'red'
colorscheme tokyonight
endif
" }}}
