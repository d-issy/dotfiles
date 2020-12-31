let g:mapleader = "\<Space>"

nnoremap <silent><Leader>w :w<CR>

"""""""""""
" plugins "
"""""""""""
if g:plug.is_enabled('nerdtree')
  nnoremap <silent><Leader>e :NERDTreeToggle<CR>
endif
