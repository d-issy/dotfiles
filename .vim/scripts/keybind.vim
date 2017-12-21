let mapleader = "\<Space>"

" Basic
noremap <Down> <Nop>
noremap <Up> <Nop>
noremap <Left> <Nop>
noremap <Right> <Nop>

nnoremap n nzz
nnoremap N Nzz
nnoremap * *zz
nnoremap # #zz

nnoremap <silent><Leader>w :w<CR>
nnoremap <silent><C-[><C-[> :noh<CR><C-[>

if v:version >= 800
  tnoremap <ESC> <C-\><C-n>
  tnoremap <C-[> <C-\><C-n>
endif

" Plugins Key Bind
if g:plug.is_enabled('nerdtree')
  nnoremap <silent><Leader>d :NERDTreeToggle<CR>
endif

if g:plug.is_enabled('nerdcommenter')
  nmap <silent><Leader>/ <Plug>NERDCommenterToggle
  vmap <silent><Leader>/ <Plug>NERDCommenterToggle
endif

if g:plug.is_enabled('ctrlp.vim')
  nnoremap <silent><Leader><Leader> :CtrlP<CR>
endif

if g:plug.is_enabled('ale')
  nnoremap <silent><Leader>f :ALEFix<CR>
endif

if g:plug.is_enabled('vim-quickrun')
  nnoremap <silent><Leader>q :QuickRun<CR>
endif

if g:plug.is_enabled('accelerated-jk')
  nmap j <Plug>(accelerated_jk_gj)
  nmap k <Plug>(accelerated_jk_gk)
endif
