local luasnip = require 'luasnip'
local s = luasnip.s
local i = luasnip.i
local t = luasnip.t

local isn = luasnip.indent_snippet_node
local d = luasnip.dynamic_node
local c = luasnip.choice_node
local f = luasnip.function_node
local sn = luasnip.snippet_node

local ai = require 'luasnip.nodes.absolute_indexer'
local fmt = require 'luasnip.extras.fmt'.fmt
local rep = require 'luasnip.extras'.rep
local postfix = require 'luasnip.extras.postfix'.postfix

local snippets = {}

table.insert(snippets, s('main',
  fmt([[
package main

func main() {
	<>
}
]] , { i(0, '// TODO:implements') }, { delimiters = '<>' }
  )
))

table.insert(snippets, s('if',
  fmt([[
if <> {
	<>
}
  ]],
    {
      i(1),
      i(0, '// TODO:implements'),
    }, { delimiters = '<>' }
  )
))

table.insert(snippets, s('el',
  fmt([[ else {
	<>
}]], { i(0, '// TODO:implements') }, { delimiters = '<>' }
  )
))

table.insert(snippets, s('err',
  fmt([[
if err != nil {
	return <><>err
}
<>
]] ,
    {
      i(1),
      f(function(args, _)
        return #(args[1][1]) == 0 and '' or ', '
      end, { 1 }
      ),
      i(0),
    }, { delimiters = '<>' }
  )
))

table.insert(snippets, s('st', fmt('<type><space><name><space>struct<space>{<fields>}', {
  name = i(1),
  type = f(
    function(args, _)
      return #(args[1][1]) == 0 and '' or 'type'
    end, { 1 }
  ),
  space = f(
    function(args, _)
      return #(args[1][1]) == 0 and '' or ' '
    end, { 1 }
  ),
  fields = i(0),
}, { delimiters = '<>' })))

table.insert(snippets, s('in', fmt('<type><space><name><space>interface<space>{<fields>}', {
  name = i(1),
  type = f(
    function(args, _)
      return #(args[1][1]) == 0 and '' or 'type'
    end, { 1 }
  ),
  space = f(
    function(args, _)
      return #(args[1][1]) == 0 and '' or ' '
    end, { 1 }
  ),
  fields = i(0),
}, { delimiters = '<>' })))

table.insert(snippets, s('m', fmt('map[{}]{}', { i(1), i(0) })))
table.insert(snippets, s('t', t 'true'))
table.insert(snippets, s('f', t 'false'))
table.insert(snippets, s('b', t 'bool'))
table.insert(snippets, s('s', t 'string'))
table.insert(snippets, s('e', t 'error'))

return snippets
