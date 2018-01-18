set foldmethod=marker
set foldmarker={{,}}
set foldlevel=99
set foldnestmax=2
set foldminlines=3

augroup fold
  au!

  au FileType vim setlocal foldminlines=0
  au FileType vim setlocal foldlevel=0

  au FileType c setlocal foldmethod=syntax
  au FileType cpp setlocal foldmethod=syntax
  au FileType go setlocal foldmethod=indent
  au FileType javascript setlocal foldmethod=syntax
  au FileType python setlocal foldmethod=indent

augroup END
