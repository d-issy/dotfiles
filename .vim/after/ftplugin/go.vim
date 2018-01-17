setlocal noexpandtab

setlocal completeopt-=preview

let g:go_fmt_command = "goimports"

let g:go_gocode_unimported_packages = 1
let g:go_highlight_array_whitespace_error = 1
let g:go_highlight_chan_whitespace_error = 1
let g:go_highlight_extra_types = 1
let g:go_highlight_space_tab_error = 1
let g:go_highlight_trailing_whitespace_error = 1
let g:go_highlight_operators = 1
let g:go_highlight_functions = 1
let g:go_highlight_methods = 1
let g:go_highlight_fields = 1
let g:go_highlight_types = 1
let g:go_highlight_build_constraints = 1
let g:go_highlight_string_spellcheck = 1
let g:go_highlight_format_strings = 1
let g:go_highlight_generate_tags = 1

let g:go_template_autocreate = 0

nnoremap <buffer> <silent><Leader>r :GoRename<CR>
nnoremap <buffer> <silent><Leader>s :GoInfo<CR>
