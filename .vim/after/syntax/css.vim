syn sync minlines=100

" position attr
syn match cssPositioningAttr contained "\<contents\|run-in\>"
syn match cssPositioningAttr contained "\<flow\(-root\)\=\>"
syn match cssPositioningAttr contained "\<ruby\(-\(base\|text\)\(-container\)\=\)\=\>"

" pseudo class
syn keyword cssPseudoClassId contained default defined enabled fullscreen indeterminate optional required valid
syn match cssPseudoClassId contained "\<\(focus-within\|host\)\>"
syn match cssPseudoClassId contained "\<read-\(only\|write\)\>"
syn match cssPseudoClassId contained "\<first\(-\(child\|of-type\)\)\=\>"
syn region cssPseudoClassFn contained matchgroup=cssFunctionName start="\<\(dir\|host\)(" end=")"
"" Selectors Level 4 (working draft)
syn match cssPseudoClassId contained "\<\(placeholder-shown\)\>"
syn match cssPseudoClassId contained "\<\(in\|out-of\)-range\>"
syn region cssPseudoClassFn contained matchgroup=cssFunctionName start="\(-\(webkit\|moz\|ms\)-\)\=\(any\|matches\|has\)(" end=")"
