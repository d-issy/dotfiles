let g:mapleader = "\<Space>"

nnoremap <silent><Leader>w :w<CR>

" git
nnoremap <silent><Leader>ts :ter ++close tig status<CR>
if g:plug.is_enabled('vim-fugitive')
nnoremap <silent><Leader>tb :Gblame<CR><C-w><C-w>
endif

" file manager
if g:plug.is_enabled('nerdtree')
  nnoremap <silent><Leader>e :NERDTreeToggle<CR>
endif

" fzf
if g:plug.is_enabled('fzf.vim')
  nnoremap <silent><Leader><Leader> :Files<CR>
  nnoremap <silent><Leader>a :Rg<CR>
  nnoremap <silent><Leader>b :Buffers<CR>
endif

" easy align
if g:plug.is_enabled('vim-easy-align')
   xmap ga <Plug>(EasyAlign)
   nmap ga <Plug>(EasyAlign)
endif
