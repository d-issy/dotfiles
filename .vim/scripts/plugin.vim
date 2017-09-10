" neocomplete
" let g:neocomplete#enable_at_startup = 1
let g:neocomplete#sources#dictionary#dictionaries = {
      \ 'default' : '',
      \ 'go' : '~/.vim/dict/go.dict',
      \}

" snippet
imap <C-k> <Plug>(neosnippet_expand_or_jump)
smap <C-k> <Plug>(neosnippet_expand_or_jump)
let g:neosnippet#snippets_directory = '~/.vim/snippets/'

" emmet
let g:user_emmet_leader_key='<c-e>'
