" neocomplete
" let g:neocomplete#enable_at_startup = 1
let g:neocomplete#sources#dictionary#dictionaries = {
      \  'default' : '',
      \  'go' : '~/.vim/dict/go.dict',
      \}

" snippet
imap <C-k> <Plug>(neosnippet_expand_or_jump)
smap <C-k> <Plug>(neosnippet_expand_or_jump)
let g:neosnippet#snippets_directory = '~/.vim/snippets/'

" emmet
let g:user_emmet_leader_key='<c-e>'
let g:user_emmet_settings = {
      \  'variables': {
      \    'lang': 'ja',
      \  },
      \}

" CtrlP
let g:ctrlp_map = ',,'
let g:ctrlp_show_hidden = 1
let g:ctrlp_custom_ignore = {
      \ 'dir':  '\v[\/](\.git|\.hg|\.idea|\.svn|plugged|node_modules|vendor)$',
      \ }

" NERDTree
let g:NERDTreeQuitOnOpen = 1
let g:NERDTreeShowHidden = 1
let g:NERDTreeIgnore = [
      \ '.git',
      \ '.hg',
      \ '.svn',
      \ '.idea',
      \ ]

" NERDCommenter
let g:NERDCreateDefaultMappings = 0
let g:NERDSpaceDelims = 1
let g:NERDCompactSexyComs = 1
let g:NERDDefaultAlign = 'left'

" markdown
let g:vim_markdown_folding_disabled = 1
let g:vim_markdown_new_list_item_indent = 2
let g:vim_markdown_math = 1
let g:vim_markdown_frontmatter = 1
let g:vim_markdown_toml_frontmatter = 1
let g:vim_markdown_json_frontmatter = 1
let g:vim_markdown_fenced_languages = [
      \ 'c++=cpp',
      \ 'viml=vim',
      \ 'bash=sh',
      \ 'ini=dosini',
      \ 'go',
      \ 'html',
      \ 'javascript',
      \ 'json',
      \ 'python',
      \ ]
