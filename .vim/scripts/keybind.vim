let mapleader = "\<Space>"

noremap <Down> <Nop>
noremap <Up> <Nop>
noremap <Left> <Nop>
noremap <Right> <Nop>

nnoremap Q <Nop>
noremap Y y$

nnoremap n nzz
nnoremap N Nzz
nnoremap * *zz
nnoremap # #zz

nnoremap <silent><Leader>d :Ex<CR>
nnoremap <silent><Leader>w :w<CR>
nnoremap <silent><C-[><C-[> :noh<CR><C-[>

if g:plug.is_enabled('nerdcommenter')
  nmap <silent><Leader>/ <Plug>NERDCommenterToggle
  vmap <silent><Leader>/ <Plug>NERDCommenterToggle
endif

if g:plug.is_enabled('fzf.vim')
  nnoremap <silent><Leader><Leader> :Files<CR>
  nnoremap <silent><Leader>a :Ag!<CR>
  nnoremap <silent><Leader>b :Buffers<CR>
  nnoremap <silent><Leader>h :Helptags<CR>
  nnoremap <silent><Leader>p :Filetypes<CR>
  nnoremap <silent><Leader>co :Colors<CR>
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
