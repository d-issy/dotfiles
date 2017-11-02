" default statusline
set statusline=%F\ %m%r
set statusline+=%=%l/%L\ [%{&ff}][%{&fileencoding}]%y

" laststatus
set laststatus=2

" filetype
autocmd FileType nerdtree setlocal statusline=NerdTree
