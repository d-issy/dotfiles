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

if empty(glob('~/.vim/autoload/plug.vim'))
  finish
endif

" Plugin Key Bind
nnoremap <silent><Leader>d :NERDTreeToggle<CR>
nnoremap <silent><Leader>gs :Gstatus<CR>

nmap <silent><Leader>c <Plug>NERDCommenterToggle
vmap <silent><Leader>c <Plug>NERDCommenterToggle

" vim-easy-align
xmap <leader>. <Plug>(EasyAlign)
nmap <leader>. <Plug>(EasyAlign)

" autofix
nnoremap <silent><Leader>f :ALEFix<CR>
