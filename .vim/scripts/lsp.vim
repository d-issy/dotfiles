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
if executable('go-langserver')
  augroup LspGo
    au User lsp_setup call lsp#register_server({
          \ 'name': 'go-langserver',
          \ 'cmd': {server_info->['go-langserver', '-gocodecompletion']},
          \ 'whitelist': ['go'],
          \ })
  augroup END
endif
