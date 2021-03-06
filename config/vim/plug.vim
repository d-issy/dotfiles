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

" git
Plug 'airblade/vim-gitgutter'
Plug 'tpope/vim-fugitive'

" snippet
if has('python3')
Plug 'SirVer/ultisnips'
endif
Plug 'mattn/vim-sonictemplate'


" fzf
Plug 'junegunn/fzf', {'do': { -> fzf#install() }}
Plug 'junegunn/fzf.vim'

" lsp
Plug 'prabirshrestha/vim-lsp'
Plug 'mattn/vim-lsp-settings'
Plug 'prabirshrestha/asyncomplete.vim'
Plug 'prabirshrestha/asyncomplete-lsp.vim'
Plug 'thomasfaingnaert/vim-lsp-ultisnips'

" other
Plug 'editorconfig/editorconfig-vim' " editorconfig
Plug 'ghifarit53/tokyonight-vim'     " colorscheme
Plug 'junegunn/vim-easy-align'       " align
Plug 'markonm/traces.vim'            " replace preview
Plug 'tpope/vim-commentary'          " comment
Plug 'tpope/vim-surround'            " text object


call plug#end()
" }}}

""""""""""""
" settings "
""""""""""""

" nerdtree {{{
if g:plug.is_enabled('nerdtree')
let g:NERDTreeAutoDeleteBuffer = 1
let g:NERDTreeShowHidden       = 1
let g:NERDTreeMinimalMenu      = 1
let g:NERDTreeMinimalUI        = 1
let g:NERDTreeNaturalSort      = 1
let g:NERDTreeQuitOnOpen       = 1
let g:netrw_dirhistmax = 0
let g:NERDTreeIgnore = ['\~$', '\.git']

let g:NERDTreeGitStatusUseNerdFonts = 1

let s:FolderColor = 'D4843E'
let g:WebDevIconsDefaultFolderSymbolColor = s:FolderColor
endif


if g:plug.is_enabled('nerdtree-git-plugin')
let g:NERDTreeGitStatusIndicatorMapCustom = {
  \ 'Modified'  :'',
  \ 'Staged'    :'',
  \ 'Untracked' :'',
  \ 'Renamed'   :'',
  \ 'Unmerged'  :' ',
  \ 'Deleted'   :'',
  \ 'Dirty'     :'',
  \ 'Ignored'   :' ',
  \ 'Clean'     :' ',
  \ 'Unknown'   :' ',
  \ }
endif
" }}}

" gitgutter {{{
if g:plug.is_enabled('vim-gitgutter')
autocmd BufEnter * set updatetime=100
endif
" }}}

" tokyonight {{{
if g:plug.is_enabled('tokyonight-vim')
set t_Co=256
set background=dark
let g:tokyonight_style                     = 'night'
let g:tokyonight_transparent_background    = 1
let g:tokyonight_disable_italic_comment    = 1
let g:tokyonight_menu_selection_background = 'red'
colorscheme tokyonight
endif
" }}}

" Ultisnip {{{
if g:plug.is_enabled('ultisnips')
let g:UltiSnipsExpandTrigger       = "<c-l>"
let g:UltiSnipsJumpForwardTrigger  = "<c-n>"
let g:UltiSnipsJumpBackwardTrigger = "<c-p>"
let g:UltiSnipsSnippetStorageDirectoryForUltiSnipsEdit = expand('$XDG_CONFIG_HOME/vim/UltiSnips')
endif
" }}}

" sonic template {{{
let g:sonictemplate_vim_template_dir = expand("$XDG_CONFIG_HOME/vim/template")
" }}}

" lsp {{{
if g:plug.is_enabled('vim-lsp')
function! s:on_lsp_buffer_enabled() abort " {{{
  nmap <buffer> K <plug>(lsp-hover)
  nmap <buffer> gd <plug>(lsp-definition)
  nmap <buffer> gf <plug>(lsp-document-format)
  nmap <buffer> gr <plug>(lsp-references)
  nmap <buffer> <leader>gr <plug>(lsp-rename)
endfunction " }}}

augroup lsp_install " {{{
  au!
  autocmd User lsp_buffer_enabled call s:on_lsp_buffer_enabled()
augroup END " }}}

let g:lsp_diagnostics_float_delay = 100

endif
" }}}
