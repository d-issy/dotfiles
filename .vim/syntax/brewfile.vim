if exists("b:current_syntax")
  finish
endif

let s:cpo_save = &cpo
set cpo&vim

syn region brewString start=+"+ skip=+\\\\\|\\"+ end=+"+
syn region brewPkgName start=+"+ skip=+\\\\\|\\"+ end=+"+ contained
syn match brewNumber "[0-9]\+"
syn keyword brewBoolean true false
syn keyword brewKeyword brew cask mas tap cask_args nextgroup=brewPkgName skipwhite
syn keyword brewKeyword if unless

syn keyword brewArgs system
syn match brewArgs +appdir:+
syn match brewArgs +args:+
syn match brewArgs +conflicts_with:+
syn match brewArgs +id:+
syn match brewArgs +link:+
syn match brewArgs +restart_service:+

hi def link brewString String
hi def link brewNumber Number
hi def link brewName Number
hi def link brewBoolean Boolean
hi def link brewKeyword Keyword
hi def link brewArgs Identifier

let b:current_syntax = "brewfile"

let &cpo = s:cpo_save
unlet s:cpo_save
