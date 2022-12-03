local luasnip = require 'luasnip'
local s = luasnip.s
local i = luasnip.i
local t = luasnip.t

local fmt = require 'luasnip.extras.fmt'.fmt

local snip = require('snip')


local snippets = {}


table.insert(snippets, s('syntax', t 'syntax = "proto3";', snip.OptStartOfLine))
table.insert(snippets, s('service', fmt([[
service <> {
  <>
}
]],
  { i(1), i(0) },
  { delimiters = '<>' }
), snip.OptStartOfLine))

table.insert(snippets, s('rpc', fmt('rpc <>(<>) returns (<>);' ,
  { i(1), i(2), i(3) },
  { delimiters = '<>' }
), snip.OptStartOfLine))

table.insert(snippets, s('message', fmt([[
message <> {
  <>
}
]],
  { i(1), i(0) },
  { delimiters = '<>' }
), snip.OptStartOfLine))

table.insert(snippets, s('enum', fmt([[
enum <> {
  <>
}
]],
  { i(1), i(0) },
  { delimiters = '<>' }
), snip.OptStartOfLine))

table.insert(snippets, s('d', fmt('double {} = {};', { i(1), i(0) })))
table.insert(snippets, s('f', fmt('float {} = {};', { i(1), i(0) })))
table.insert(snippets, s('f32', fmt('float32 {} = {};', { i(1), i(0) })))
table.insert(snippets, s('f64', fmt('float64 {} = {};', { i(1), i(0) })))
table.insert(snippets, s('fi32', fmt('fixed32 {} = {};', { i(1), i(0) })))
table.insert(snippets, s('fi64', fmt('fixed64 {} = {};', { i(1), i(0) })))
table.insert(snippets, s('i32', fmt('int32 {} = {};', { i(1), i(0) })))
table.insert(snippets, s('i64', fmt('int64 {} = {};', { i(1), i(0) })))
table.insert(snippets, s('s', fmt('string {} = {};', { i(1), i(0) })))
table.insert(snippets, s('s32', fmt('sint32 {} = {};', { i(1), i(0) })))
table.insert(snippets, s('s64', fmt('sint64 {} = {};', { i(1), i(0) })))
table.insert(snippets, s('u32', fmt('uint32 {} = {};', { i(1), i(0) })))
table.insert(snippets, s('u64', fmt('uint64 {} = {};', { i(1), i(0) })))
table.insert(snippets, s('bool', fmt('bool {} = {};', { i(1), i(0) })))
table.insert(snippets, s('bytes', fmt('bytes {} = {};', { i(1), i(0) })))

table.insert(snippets, s('required', t 'required '))
table.insert(snippets, s('repeated', t 'repeated '))

return snippets
