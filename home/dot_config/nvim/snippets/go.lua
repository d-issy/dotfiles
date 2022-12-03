local luasnip = require 'luasnip'
local s = luasnip.s
local i = luasnip.i
local t = luasnip.t

local fmt = require 'luasnip.extras.fmt'.fmt

local snip = require('snip')

local snippets = {}

table.insert(snippets, s('main', fmt([[
package main

func main() {
	<>
}
]],
  { i(0, '// TODO:implements') },
  { delimiters = '<>' }
), snip.OptStartOfLine))

table.insert(snippets, s('fn', fmt([[
func <name>() <b1><args><b2>{
	<main>
}
]],
  {
    name = i(1),
    args = i(2),
    main = i(0, '// TODO: implements'),
    b1 = luasnip.function_node(function(args, _)
      if #(args[1][1]) > 0 and string.match(args[1][1], ',') ~= nil then
        return '('
      else
        return ''
      end
    end, { 2 }),
    b2 = luasnip.function_node(function(args, _)
      if #(args[1][1]) > 0 then
        return string.match(args[1][1], ',') and ') ' or ' '
      else
        return ''
      end
    end, { 2 }),
  },
  { delimiters = '<>' }
), snip.OptStartOfLine))

table.insert(snippets, s('if', fmt([[
if <> {
	<>
}
]],
  {
    i(1),
    i(0, '// TODO:implements'),
  },
  { delimiters = '<>' }
), snip.OptStartOfLine))

table.insert(snippets, s('el', fmt([[ else {
	<>
}]], { i(0, '// TODO: implements') }, { delimiters = '<>' })))

table.insert(snippets, s('err', fmt([[
if err != nil {
	return <><>err
}
<>
]],
  {
    i(1),
    luasnip.function_node(function(args, _)
      return #(args[1][1]) == 0 and '' or ', '
    end, { 1 }
    ),
    i(0),
  },
  { delimiters = '<>' }
), snip.OptStartOfLine))

table.insert(snippets, s('for', fmt([[
for <condition><space>{
	<body>
}
]],
  {
    condition = i(1),
    space = luasnip.function_node(function(args, _)
      return #(args[1][1]) > 0 and ' ' or ''
    end, { 1 }
    ),
    body = i(0, '// TODO:implements'),
  },
  { delimiters = '<>' }
), snip.OptStartOfLine))

table.insert(snippets, s('st', fmt('<type><space><name><space>struct<space>{<fields>}',
  {
    name = i(1),
    type = luasnip.function_node(function(args, _)
      return #(args[1][1]) > 0 and 'type' or ''
    end, { 1 }
    ),
    space = luasnip.function_node(function(args, _)
      return #(args[1][1]) > 0 and ' ' or ''
    end, { 1 }
    ),
    fields = i(0),
  },
  { delimiters = '<>' }
)))

table.insert(snippets, s('in', fmt('<type><space><name><space>interface<space>{<fields>}',
  {
    name = i(1),
    type = luasnip.function_node(function(args, _)
      return #(args[1][1]) > 0 and 'type' or ''
    end, { 1 }
    ),
    space = luasnip.function_node(function(args, _)
      return #(args[1][1]) > 0 and ' ' or ''
    end, { 1 }
    ),
    fields = i(0),
  },
  { delimiters = '<>' }
)))

table.insert(snippets, s('m', fmt('map[{}]{}', { i(1), i(0) })))
table.insert(snippets, s('t', t 'true'))
table.insert(snippets, s('f', t 'false'))
table.insert(snippets, s('b', t 'bool'))
table.insert(snippets, s('s', t 'string'))
table.insert(snippets, s('e', t 'error'))

return snippets
