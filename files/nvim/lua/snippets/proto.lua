---@diagnostic disable: unused-local
local ls = require "luasnip"
local s = ls.snippet
local sn = ls.snippet_node
local isn = ls.indent_snippet_node
local t = ls.text_node
local i = ls.insert_node
local f = ls.function_node
local c = ls.choice_node
local d = ls.dynamic_node
local r = ls.restore_node
local events = require "luasnip.util.events"
local ai = require "luasnip.nodes.absolute_indexer"
local extras = require "luasnip.extras"
local l = extras.lambda
local rep = extras.rep
local p = extras.partial
local m = extras.match
local n = extras.nonempty
local dl = extras.dynamic_lambda
local fmt = require("luasnip.extras.fmt").fmt
local fmta = require("luasnip.extras.fmt").fmta
local conds = require "luasnip.extras.expand_conditions"
local postfix = require("luasnip.extras.postfix").postfix
local types = require "luasnip.util.types"
local parse = require("luasnip.util.parser").parse_snippet

local S = require "util.snippet"

return {
  S.alias("syn", 'syntax = "proto3";'),
  S.fmt(
    "sv",
    [[
      service {} {{
        {}
      }}
    ]]
  ),
  S.fmt(
    "rpc",
    [[
      rpc {}({}Request) returns ({}Response) {{}}
    ]],
    { i(1), rep(1), rep(1) }
  ),
  S.fmt("m", [[message {} {{{}}}]]),
  S.fmt(
    "mrr",
    [[
      message {}Request {{{}{}{}}}

      message {}Response {{{}{}{}}}
    ]],
    {
      i(1),
      m(2, ".", "\n\t"),
      i(2),
      m(2, ".", "\n"),
      rep(1),
      m(3, ".", "\n\t"),
      i(3),
      m(3, ".", "\n"),
    }
  ),
  S.alias("o", "optional "),
  S.alias("r", "repeated "),
  S.alias("dep", "[deprecated = true] "),
  S.fmt("b", "bool {} = {};"),
  S.fmt("s", "string {} = {};"),
  S.fmt("i", "int64 {} = {};"),
  S.fmt("in", "int32 {} = {};"),
  S.fmt("m", "map<{}, {}> {} = {};"),
  S.fmt("t", "google.protobuf.Timestamp {} = {};"),
  S.fmt(
    "e",
    [[
      enum {} {{
        {}_UNSPECIFIED = 0;
        {}_{}
      }}
    ]],
    {
      i(1),
      l(l._1:upper(), 1),
      l(l._1:upper(), 1),
      i(2),
    }
  ),
}
