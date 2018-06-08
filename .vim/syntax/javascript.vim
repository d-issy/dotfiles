if exists("b:current_syntax")
  finish
endif

let s:cpo_save = &cpo
set cpo&vim

syn keyword jsCommentTodo TODO FIXME XXX contained
syn match   jsLineComment "\/\/.*" contains=@Spell,jsCommentTodo
syn match   jsCommentSkip "^[ \t]*\*\($\|[ \t]\+\)"
syn region  jsComment     start="/\*"  end="\*/" contains=@Spell,jsCommentTodo
syn match   jsSpecial     "\\\(0\|[^xu\d]\|x\x\x\|u\x\x\x\x\|u{\x\+}\)"
syn region  jsString      start=+\z(['"]\)+ skip=+\\\\\|\\\z1+ end=+\z1+ contains=jsSpecial,@htmlPreproc
syn match   jsNumber       "\c\<\(\(\(0\|[1-9]\d*\)\.\d*\|\.\d*\|0\|[1-9]\d*\)\(e[+-]\=[1-9]\d*\)\=\|0b[01]\+\|0o\o\+\|0x\x\+\)\>"
syn region  jsRegexpString start=+/[^/*]+ skip=+\\\\\|\\/+ end=+/[gimuys]\{,6\}+ contains=@htmlPreproc oneline
syn keyword jsStorageClass var let const
syn keyword jsConditional  if else switch
syn keyword jsRepeat       while for do in
syn keyword jsBranch       break continue
syn keyword jsOperator     new delete instanceof typeof
syn keyword jsType         Array Boolean Date Function Number Object String RegExp
syn keyword jsStatement    return with
syn keyword jsBoolean      true false
syn keyword jsNull         null undefined
syn keyword jsIdentifier   arguments
syn keyword jsThis         this
syn keyword jsLabel        case default
syn keyword jsException    try catch finally throw
syn keyword jsMessage      alert confirm prompt status
syn keyword jsGlobal       self top parent window console
syn keyword jsMember       document event location
syn keyword jsDebug        debugger
syn keyword jsReserved     abstract async await boolean byte char class constructor double enum function export extends final float from function goto implements import int interface long native package private protected public short static super synchronized throws transient volatile

syn sync fromstart
syn sync maxlines=100

hi def link jsComment          Comment
hi def link jsLineComment      Comment
hi def link jsCommentTodo      Todo
hi def link jsSpecial          Special
hi def link jsThis             Special
hi def link jsString           String
hi def link jsTemplate         String
hi def link jsCharacter        Character
hi def link jsNumber           Number
hi def link jsConditional      Conditional
hi def link jsRepeat           Repeat
hi def link jsBranch           Conditional
hi def link jsOperator         Operator
hi def link jsType             Type
hi def link jsStorageClass     StorageClass
hi def link jsStatement        Statement
hi def link jsFunction         Function
hi def link jsBraces           Function
hi def link jsError            Error
hi def link jsParenError       Error
hi def link jsNull             Keyword
hi def link jsBoolean          Boolean
hi def link jsRegexpString     String
hi def link jsIdentifier       Identifier
hi def link jsLabel            Label
hi def link jsException        Exception
hi def link jsMessage          Keyword
hi def link jsGlobal           Special
hi def link jsMember           Special
hi def link jsReserved         Keyword
hi def link jsDebug            Debug
hi def link jsConstant         Label
hi def link jsDecorator        Special

" es6 syntax
syn region jsTemplateExp  start=+${+ end=+}+ contained contains=@jsExpression
syn region jsTemplate     start=+`+ skip=+\\`+ end=+`+ contains=jsTemplateExp

syn match  jsDecorator "@\@<=\%(\a[0-9A-Za-z]*\)"

" jsx
syn match  jsxTagName "\%(</\=\)\@<=\%(\a[-0-9A-Za-z]*\)" contained
syn match  jsxArg     "\a[-:0-9A-Za-z]*\(=\)\@="          contained
syn region jsxRegion
      \ contained
      \ contains=@jsExpression,jsxRegion
      \ start=+{+
      \ end=+}+

syn region jsxTag
      \ contains=jsxTagName,jsxArg,jsString,jsTemplate,jsxRegion
      \ start=+<\a[-:0-9A-Za-z]*+
      \ end=+>+

syn match jsxEndTag "</\a[-0-9A-Za-z]*>" contains=jsxTagName

hi def link jsxTagName   htmlTagName
hi def link jsxArg       htmlArg
hi def link jsxTag       htmlTag
hi def link jsxEndTag    htmlTag

syn cluster jsExpression contains=jsBoolean,jsBraces,jsBranch,jsCharacter,jsComment,jsCommentTodo,jsConditional,jsConstant,jsDebug,jsError,jsException,jsFunction,jsGlobal,jsIdentifier,jsLabel,jsLineComment,jsMember,jsMessage,jsNull,jsNumber,jsOperator,jsParenError,jsRegexpString,jsRepeat,jsReserved,jsSpecial,jsStatement,jsStorageClass,jsString,jsTemplate,jsThis,jsType,


let b:current_syntax = "javascript"

let &cpo = s:cpo_save
unlet s:cpo_save
