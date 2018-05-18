"=====================================================
" plugin settings
"=====================================================
" UtiSnip
let g:UltiSnipsExpandTrigger = "<c-k>"
let g:UltiSnipsJumpForwardTrigger = "<c-j>"

" fzf
let $FZF_DEFAULT_COMMAND = 'ag --hidden -g ""'
if g:plug.is_enabled('fzf.vim')
  command! -bang -nargs=? -complete=dir Files
        \ call fzf#vim#files(<q-args>, fzf#vim#with_preview(), <bang>0)
  command! -bang -nargs=? -complete=dir Ag
        \ call fzf#vim#ag(<q-args>, '--hidden', fzf#vim#with_preview(), <bang>0)
  command! -bang Colors
        \ call fzf#vim#colors({'left': '15%', 'options': '--reverse'}, <bang>0)
  command! -bang Filetypes
        \ call fzf#vim#filetypes({'left': '15%', 'options': '--reverse'}, <bang>0)
endif

" NERDCommenter
let g:NERDCreateDefaultMappings = 0
let g:NERDSpaceDelims = 1
let g:NERDCompactSexyComs = 1
let g:NERDDefaultAlign = 'left'

" ALE
let g:ale_lint_on_text_changed = 'never'
let g:ale_lint_on_enter = 0
let g:ale_lint_on_save = 1
let g:ale_lint_on_filetype_changed = 0
let g:ale_lint_delay = 0
let g:ale_set_loclist = 0
let g:ale_set_quickfix = 1
let g:ale_open_list = 1

let g:ale_fixers = {
      \ 'c':          ['clang-format'],
      \ 'cpp':        ['clang-format'],
      \ 'javascript': ['eslint'],
      \ 'python':     ['isort', 'autopep8'],
      \ 'typescript': ['eslint'],
      \ }

let g:ale_linters = {
      \ 'c':          [],
      \ 'cpp':        [],
      \ 'go':         [],
      \ 'javascript': ['eslint'],
      \ 'python':     ['flake8'],
      \ }

" GitGutter
set updatetime=250

" emmet
let g:user_emmet_leader_key='<c-e>'
let g:user_emmet_settings = {
      \  'variables': {
      \    'lang': 'ja',
      \  },
      \}

" jsx
autocmd BufNewFile,BufRead *.js set filetype=javascript.jsx
autocmd BufNewFile,BufRead *.jsx set filetype=javascript.jsx

" typescript
autocmd BufNewFile,BufRead *.ts set filetype=typescript.jsx
autocmd BufNewFile,BufRead *.tsx set filetype=typescript.jsx

" jedi-vim
let g:jedi#popup_on_dot = 0
let g:jedi#goto_command = "<C-]>"
let g:jedi#goto_definitions_command = ""

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
