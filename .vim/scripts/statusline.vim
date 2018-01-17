" default statusline
set statusline=%f\ %m%r
set statusline+=%=%l/%L\ %y

" laststatus
set laststatus=1

augroup statusline
  au!
  autocmd FileType nerdtree setlocal statusline=NerdTree
augroup END
