let g:mapleader = "\<Space>"

"""""""""""
" plugins "
"""""""""""
if g:plug.is_enabled('nerdtree')
  nnoremap <silent><Leader>e :NERDTreeToggle<CR>
endif
