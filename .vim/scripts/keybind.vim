let mapleader = ','

" Bassic
noremap <Down> <Nop>
noremap <Up> <Nop>
noremap <Left> <Nop>
noremap <Right> <Nop>

nnoremap n nzz
nnoremap N Nzz
nnoremap * *zz
nnoremap # #zz

nnoremap <silent><C-[><C-[> :noh<CR><C-[>

" terminal mode
tnoremap <ESC> <C-\><C-n>
tnoremap <C-[> <C-\><C-n>

if empty(glob('~/.vim/autoload/plug.vim'))
  finish
endif

" Plugin Key Bind
nnoremap <silent><Leader>d :NERDTreeToggle<CR>
nnoremap <silent><Leader>gs :Gstatus<CR>

nmap <silent><Leader>c <Plug>NERDCommenterToggle
vmap <silent><Leader>c <Plug>NERDCommenterToggle

" autofix
nnoremap <silent><Leader>f :ALEFix<CR>

" QuickRun
nnoremap <silent><Leader>q :QuickRun<CR>

" vim-easy-align
xmap <leader>. <Plug>(EasyAlign)
nmap <leader>. <Plug>(EasyAlign)


" accelerated_jk
nmap j <Plug>(accelerated_jk_gj)
nmap k <Plug>(accelerated_jk_gk)
