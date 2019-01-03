" python
if executable('pyls')
  augroup LspPy
    au User lsp_setup call lsp#register_server({
          \ 'name': 'pyls',
          \ 'cmd': {server_info->['pyls']},
          \ 'whitelist': ['python'],
          \ })
    autocmd FileType python setlocal omnifunc=lsp#complete
    autocmd FileType python nmap <buffer> <silent><C-]> <plug>(lsp-definition)
    autocmd FileType python nmap <buffer> <silent><Leader>f :LspDocumentFormat<CR>
  augroup END
endif

" go
if executable('golsp')
  augroup LspGo
    au!
    autocmd User lsp_setup call lsp#register_server({
          \ 'name': 'golsp',
          \ 'cmd': {server_info->['golsp']},
          \ 'whitelist': ['go'],
          \ })

    autocmd FileType go setlocal omnifunc=lsp#complete
  augroup END
endif
