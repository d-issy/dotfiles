set expandtab
set tabstop=2
set softtabstop=2
set shiftwidth=2

if g:plug.is_enabled('tern_for_vim')
  nnoremap <buffer> <Leader>r :TernRename<CR><C-w>
endif
