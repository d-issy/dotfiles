setlocal tabstop=2
setlocal softtabstop=2
setlocal shiftwidth=2

" vim previm_open_cmd
let g:previm_open_cmd = 'open -a Vivaldi'

if g:plug.is_enabled('previm')
  nnoremap <buffer> <silent><Leader>q :PrevimOpen<CR>
endif
