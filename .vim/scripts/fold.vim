set foldmethod=marker
set foldmarker={{,}}
set foldlevel=99
set foldnestmax=2
set foldminlines=3

augroup fold
  au!

  au FileType c setlocal foldmethod=syntax
  au FileType cpp setlocal foldmethod=syntax
  au FileType go setlocal foldmethod=indent
  au FileType javascript setlocal foldmethod=indent
  au FileType make setlocal foldmethod=indent
  au FileType python setlocal foldmethod=indent
  au FileType vim setlocal foldminlines=0 foldlevel=0

augroup END
