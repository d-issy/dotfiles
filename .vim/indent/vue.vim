if exists('b:did_indent')
  finish
endif

if !exists('*HtmlIndent')
  if exists('b:did_indent')
    unlet b:did_indent
  endif
  runtime! indent/html.vim
endif
if !exists('*GetJavascriptIndent')
  if exists('b:did_indent')
    unlet b:did_indent
  endif
  runtime! indent/javascript.vim
endif
if !exists('*GetCSSIndent')
  if exists('b:did_indent')
    unlet b:did_indent
  endif
  runtime! indent/css.vim
endif
let b:did_indent=1

setlocal indentexpr=VueIndent()
setlocal noautoindent
setlocal nolisp
setlocal nosmartindent
setlocal nocindent
setlocal indentkeys=o,O,<Return>,<>>,{,},!^F

let s:cpo_save = &cpo

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
    if preline =~ '^<style'
      return 0
    endif
    return GetCSSIndent()
  endif
  return -1
endfunction


let &cpo = s:cpo_save
unlet s:cpo_save
