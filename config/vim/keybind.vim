let g:mapleader = "\<Space>"

nnoremap <silent><Leader>w :w<CR>
nnoremap <silent><Leader>ts :ter ++close tig status<CR>

"""""""""""
" plugins "
"""""""""""
if g:plug.is_enabled('nerdtree')
  nnoremap <silent><Leader>e :NERDTreeToggle<CR>
endif

if g:plug.is_enabled('fzf.vim')
  nnoremap <silent><Leader><Leader> :Files<CR>
  nnoremap <silent><Leader>a :Rg<CR>
  nnoremap <silent><Leader>b :Buffers<CR>
endif
