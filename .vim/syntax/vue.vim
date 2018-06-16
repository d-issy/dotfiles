if !exists("main_syntax")
  if exists("b:current_syntax")
    finish
  endif
  let main_syntax = 'vue'
endif

let s:cpo_save = &cpo
set cpo&vim


syn include @vueTemplate syntax/html.vim
unlet b:current_syntax
syn include @vueCSS syntax/css.vim
unlet b:current_syntax
syn include @vueJavascript syntax/javascript.vim
unlet b:current_syntax

syn region vueString start=+"+ skip=+\\\\\|\\"+ end=+"+
syn match  vueTagName +\%(</\=\)\zs\%(template\|script\|style\)+ contained
syn match  vueTag +^</\=\%(template\|script\|style\)[^>]*>+ contained contains=vueTagName,vueString
hi def link vueString  String
hi def link vueTagName Keyword
hi def link vueTag htmlTag

syn region vueTemplate
      \ contains=vueTag,@vueTemplate
      \ keepend
      \ start=+<template+
      \ end=+</template>+

syn region vueCSS
      \ contains=vueTag,@vueCSS
      \ keepend
      \ start=+<style+
      \ end=+</style>+

syn region vueJavascript
      \ contains=vueTag,@vueJavascript
      \ keepend
      \ start=+<script+
      \ end=+</script>+


let b:current_syntax = "vue"
if main_syntax == 'vue'
  unlet main_syntax
endif

let &cpo = s:cpo_save
unlet s:cpo_save
