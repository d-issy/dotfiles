" python 3.7: use importlib instead of imp
" refs: https://github.com/vim/vim/issues/3117
" solved: patch-8.1.201
if has('python3') && !has('patch-8.1.201')
  silent! python3 1
endif
