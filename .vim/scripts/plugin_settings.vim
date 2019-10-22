"=====================================================
" plugin settings
"=====================================================
" UtiSnip
let g:UltiSnipsExpandTrigger = '<c-l>'
let g:UltiSnipsJumpForwardTrigger = '<c-j>'
let g:UltiSnipsJumpBackwardTrigger = '<c-k>'

" fzf
let $FZF_DEFAULT_COMMAND = "rg --files --hidden --glob '!.git'"
if g:plug.is_enabled('fzf.vim')
  command! -bang -nargs=? -complete=dir Files
        \ call fzf#vim#files(<q-args>, fzf#vim#with_preview(), <bang>0)
  command! -bang -nargs=? -complete=dir Ag
        \ call fzf#vim#ag(<q-args>, '--hidden', fzf#vim#with_preview(), <bang>0)
  command! -bang -nargs=* Rg
    \ call fzf#vim#grep(
    \   "rg --column --line-number --color=always --smart-case --hidden --glob '!.git' ".shellescape(<q-args>), 1,
    \   fzf#vim#with_preview(),
    \   <bang>0)
  command! -bang Colors
        \ call fzf#vim#colors({'left': '25%', 'options': '--reverse'}, <bang>0)
  command! -bang Filetypes
        \ call fzf#vim#filetypes({'left': '25%', 'options': '--reverse'}, <bang>0)
endif

" NERDTree
let g:NERDTreeAutoDeleteBuffer = 1
let g:NERDTreeDirArrows = 1
let g:NERDTreeIgnore=['\~$', '\.git']
let g:NERDTreeMinimalUI = 1
let g:NERDTreeQuitOnOpen = 1
let g:NERDTreeShowHidden = 1

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
      \ 'rust':       ['rustfmt'],
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

" quickrun
let g:quickrun_no_default_key_mappings = 0

" jedi-vim
let g:jedi#popup_on_dot = 0
let g:jedi#goto_command = '<C-]>'
let g:jedi#goto_definitions_command = ''
let g:jedi#force_py_version = 3
let g:jedi#show_call_signatures = 0

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

" table-mode-vim
let g:table_mode_corner = '|'


" coc-nvim
if g:plug.is_enabled('coc.nvim')
  inoremap <silent><expr> <TAB>
        \ pumvisible() ? coc#_select_confirm() :
        \ coc#expandableOrJumpable() ? "\<C-r>=coc#rpc#request('doKeymap', ['snippets-expand-jump',''])\<CR>" :
        \ <SID>check_back_space() ? "\<TAB>" :
        \ coc#refresh()

  function! s:check_back_space() abort
    let col = col('.') - 1
    return !col || getline('.')[col - 1]  =~# '\s'
  endfunction

  let g:coc_snippet_next = '<tab>'
  autocmd VimEnter * nmap <silent> <C-]> <Plug>(coc-definition)
  autocmd VimEnter * nmap <silent> <leader>r <Plug>(coc-rename)
  autocmd VimEnter * nmap <silent> <leader>f <Plug>(coc-format)
  autocmd VimEnter * nmap <silent> <leader>j <Plug>(coc-references)
  autocmd VimEnter * nmap <silent> <leader>k :call CocAction('doHover')<CR>
  autocmd VimEnter * nmap <silent> <leader>o :CocList outline<CR>
endif
