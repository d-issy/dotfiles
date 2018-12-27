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

    function! GoCompletion(findstart, base) abort
      let l:res = lsp#complete(a:findstart, a:base)
      if a:findstart
        return l:res
      end
      return map(l:res, {_, v -> {
            \ 'word': v['menu'] == 'function' ?
            \         substitute(v['word'], '\v\(\zs.*', '', '') :
            \         substitute(v['word'], '\s=.*', '', ''),
            \ 'abbr': v['word'],
            \ 'menu': v['menu'] == 'enum member' ? '' : v['menu'],
            \ 'info': v['info']
            \ }})
    endfunction
    autocmd FileType go setlocal omnifunc=GoCompletion
  augroup END
endif
