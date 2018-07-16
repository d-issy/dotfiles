if exists("b:current_syntax")
  finish
endif

let s:cpo_save = &cpo
set cpo&vim

syn case match

" comment
syn keyword javascriptCommentTodo TODO FIXME XXX BUG contained
syn match   javascriptLineComment "\/\/.*" contains=@Spell,javascriptCommentTodo
syn region  javascriptComment     start="/\*"  end="\*/" contains=@Spell,javascriptCommentTodo
hi def link javascriptCommentTodo Todo
hi def link javascriptLineComment Comment
hi def link javascriptComment     Comment
" variable
syn keyword javascriptVariable var let const
hi def link javascriptVariable Identifier
" constant
syn keyword javascriptNull null undefined
hi def link javascriptNull Keyword
" string
syn match   javascriptSpecial "\\\(0\|[^xu0-9]\|x\x\x\|u\x\{4}\|u{\x\+}\)"
syn region  javascriptString  start=+\z(['"]\)+ skip=+\\\\\|\\\z1+ end=+\z1+ contains=@Spell,javascriptSpecial
hi def link javascriptSpecial Special
hi def link javascriptString  String
" regexp
syn region  javascriptRegexpString start=+/[^/*]+ skip=+\\\\\|\\/+ end=+/[gimuys]\{,6\}+ oneline
hi def link javascriptRegexpString String
" number
syn match   javascriptNumber  "\c\<\(\(\(0\|[1-9]\d*\)\.\d*\|\.\d*\|0\|[1-9]\d*\)\(e[+-]\=[1-9]\d*\)\=\|0b[01]\+\|0o\o\+\|0x\x\+\)\>"
syn keyword javascriptNumber  Nan Infinity
hi def link javascriptNumber  Number
" boolean
syn keyword javascriptBoolean true false
hi def link javascriptBoolean Boolean
" condition
syn keyword javascriptConditional if else switch
hi def link javascriptConditional Conditional
" repeat
syn keyword javascriptRepeat while for do
hi def link javascriptRepeat Repeat
" operator
syn keyword javascriptOperator delete instanceof new typeof
syn keyword javascriptForOperator in
hi def link javascriptOperator Operator
hi def link javascriptForOperator Operator
" exception
syn keyword javascriptExceptions try catch finally throw
hi def link javascriptExceptions Exception
" class
syn keyword javascriptClassKeyword   class nextgroup=javascriptClassName skipwhite
syn keyword javascriptClassExtends   extends nextgroup=javascriptClassSuperName skipwhite
syn keyword javascriptClassStatic    static
syn keyword javascriptClassSuper     super
syn match   javascriptClassName      /\<[a-zA-Z$_][0-9a-zA-Z$_]\+\>/ skipwhite contained
syn match   javascriptClassSuperName /\<[a-zA-Z$_][0-9a-zA-Z$_\.]\+\>/ skipwhite contained
hi def link javascriptClassKeyword   Keyword
hi def link javascriptClassExtends   Keyword
hi def link javascriptClassStatic    Keyword
hi def link javascriptClassSuper     Keyword
hi def link javascriptClassName      Identifier
hi def link javascriptClassSuperName Identifier
" function
syn match javascriptFunction    /\<[a-zA-z$_][0-9a-zA-Z$_]*/ contained skipwhite
syn match javascriptFunctionDef /\<[a-zA-z$_][0-9a-zA-Z$_]*\s*(/ contains=javascriptFunction
hi def link javascriptFunction Function
" this
syn keyword javascriptIdentifier  this
hi def link javascriptIdentifier  Identifier
" global
syn keyword javascriptType Object Function Boolean Symbol Number Date String RegExp Array Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array Float32Array Float64Array Error EvalError InternalError RangeError ReferenceError SyntaxError TypeError URIError Map Set WeakMap WeakSet ArrayBuffer DataView Promise Generator GeneratorFunction Reflect Proxy
syn keyword javascriptGlobalObject Math JSON
syn keyword javascriptGlobal console
syn keyword javascriptDebugger debugger
hi def link javascriptType         Type
hi def link javascriptGlobalObject Constant
hi def link javascriptGlobal       Special
hi def link javascriptDebugger     Keyword


""""""""""""""
" es6 syntax
""""""""""""""
" template
syn region javascriptTemplateExp start=+${+ end=+}+ contained contains=@javascriptExpressions
syn region javascriptTemplate    start=+`+ skip=+\\`+ end=+`+ contains=javascriptTemplateExp
hi def link javascriptTemplate   String
" decorator
syn match  javascriptDecorator /@\%(\a[0-9A-Za-z]*\)/
hi def link javascriptDecorator Function
" allow func
syn match  javascriptArrowFunc    /=>/
syn match  javascriptArrowFuncDef /[a-zA-Z$_][0-9a-zA-Z$_]*\ze\s*=.\+=>/ contains=javascriptFunction
hi def link javascriptArrowFunc Operator

""""""""""""""
" jsx syntax
""""""""""""""
syn match  jsxTagName "\%(</\=\)\zs\%(\a[-0-9A-Za-z]*\)" contained
syn match  jsxArg     "\%(\<\a[-:0-9A-Za-z]*\)\ze="      contained
syn region jsxRegion
      \ contained
      \ contains=@javascriptExpressions,jsxRegion
      \ start=+{+
      \ end=+}+
syn match  jsxText    /[^<]*/ contained nextgroup=jsxTag,jsxEndTag
syn region jsxTag
      \ nextgroup=jsxText
      \ skipwhite
      \ skipempty
      \ contains=jsxTagName,jsxArg,javascriptString,javascriptTemplate,jsxRegion
      \ start=+<\a[-:0-9A-Za-z]*+
      \ end=+>+
syn match  jsxEndTag "</\a[-0-9A-Za-z]*>" contains=javascriptxTagName
hi def link jsxTagName   htmlTagName
hi def link jsxArg       htmlArg
hi def link jsxTag       htmlTag
hi def link jsxEndTag    htmlTag

""""""""""""""
" reserved
""""""""""""""
syn keyword javascriptReserved abstract arguments as async await boolean break byte case char constructor continue default function double enum eval export final float from goto implements import int interface long native package private protected public return short synchronized throws transient void volatile with yield


""""""""""""""
" expression
""""""""""""""
syn cluster javascriptExpressions contains=javascriptBoolean,javascriptComment,javascriptIdentifier,javascriptLabel,javascriptLineComment,javascriptNull,javascriptNumber,javascriptOperator,javascriptRegexpString,javascriptRepeat,javascriptReserved,javascriptSpecial,javascriptStorageClass,javascriptString,javascriptTemplate,javascriptType,javascriptExceptions


hi def link javascriptReserved Keyword
syn sync fromstart
syn sync maxlines=100

let b:current_syntax = "javascript"

let &cpo = s:cpo_save
unlet s:cpo_save
