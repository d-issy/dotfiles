if !exists('main_indent')
  if exists('b:did_indent')
    finish
  endif
  let main_indent = 'vue'
endif

setlocal indentexpr=VueIndent()
setlocal indentkeys=o,O,<Return>,<>>,{,},!^F

let s:cpo_save = &cpo

if !exists('*HtmlIndent')
  runtime! indent/html.vim
  unlet b:did_indent
endif
if !exists('*GetJavascriptIndent')
  runtime! indent/javascript.vim
  unlet b:did_indent
endif
if !exists('*GetCSSIndent')
  runtime! indent/css.vim
  unlet b:did_indent
endif

function! VueIndent()
  let line = trim(getline(v:lnum))
  let preline = trim(getline(prevnonblank(v:lnum - 1)))
  if  line =~ '^</\\=\\%(template\\|script\\|style\\)'
    return 0
  endif

  let stack = map([]+synstack(line('.'),col('.')),'synIDattr(v:val,"name")')
  if stack[0] =~ 'vueTemplate'
    return HtmlIndent()
  elseif stack[0] =~ 'vueJavascript'
    if preline =~ '^<script'
      return 0
    endif
    return GetJavascriptIndent()
  elseif stack[0] =~ 'vueCSS'
    if preline =~ '^<script'
      return 0
    endif
    return GetCSSIndent()
  endif
  return -1
endfunction

let b:did_indent='vue'
if main_indent == 'vue'
  unlet main_indent
endif

let &cpo = s:cpo_save
unlet s:cpo_save

