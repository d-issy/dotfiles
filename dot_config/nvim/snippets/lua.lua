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

table.insert(snippets, s('rqp', fmt([[
local {}, {} = pcall(require, '{}')
if not {} then
  {}
end
]], {
  i(2, 'status_ok'),
  rep(1),
  i(1),
  rep(2),
  i(0, 'return'),
})))

table.insert(snippets, s('if', fmt([[
if {} then
  {}
end
]], {
  i(1),
  i(0, '-- TODO: implements'),
})))

return snippets
