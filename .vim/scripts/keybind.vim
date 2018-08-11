let g:mapleader = "\<Space>"

noremap <Down> <Nop>
noremap <Up> <Nop>
noremap <Left> <Nop>
noremap <Right> <Nop>

inoremap <Down> <Nop>
inoremap <Up> <Nop>
inoremap <Left> <Nop>
inoremap <Right> <Nop>

nnoremap Q <Nop>
nnoremap Y y$

nnoremap n nzz
nnoremap N Nzz
nnoremap * *zz
nnoremap # #zz

nnoremap j gj
nnoremap k gk

nnoremap <silent><Leader>d :Ex<CR>
nnoremap <silent><Leader>w :w<CR>
nnoremap <silent><C-[><C-[> :noh<CR><C-[>

if g:plug.is_enabled('ale')
  nnoremap <silent><Leader>f :ALEFix<CR>
endif

if g:plug.is_enabled('fzf.vim')
  nnoremap <silent><Leader><Leader> :Files<CR>
  nnoremap <silent><Leader>a :Rg!<CR>
  nnoremap <silent><Leader>b :Buffers<CR>
  nnoremap <silent><Leader>h :Helptags<CR>
  nnoremap <silent><Leader>l :Lines<CR>
  nnoremap <silent><Leader>t :BTags<CR>
endif

if g:plug.is_enabled('nerdtree')
  nnoremap <Leader>e :NERDTreeToggle<CR>
endif

if g:plug.is_enabled('nerdcommenter')
  nmap <silent><Leader>/ <Plug>NERDCommenterToggle
  vmap <silent><Leader>/ <Plug>NERDCommenterToggle
endif

if g:plug.is_enabled('vim-easy-align')
  vmap <silent><Leader>f <Plug>(EasyAlign)
endif

if g:plug.is_enabled('vim-quickrun')
  nnoremap <silent><Leader>q :QuickRun<CR>
endif
