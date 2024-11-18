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
  S.fmt(
    { trig = "main", condition = S.conds.line_start },
    [[
      package main

      func main() {{
        {}
      }}
    ]]
  ),
  S.fmt(
    { trig = "fn", condition = S.conds.line_start },
    [[
      func {}({}) {}{}{}{}{{
        {}
      }}
    ]],
    {
      i(1),
      i(2),
      m(3, ",", "("),
      i(3),
      m(3, ",", ")"),
      m(3, ".", " "),
      i(0),
    }
  ),
  S.fmt(
    "if",
    [[
      if {} {{
        {}
      }}
    ]]
  ),
  S.fmt(
    { trig = "%s*elif", regTrig = true },
    [[
       else if {} {{
      }}
    ]]
  ),
  S.fmt(
    { trig = "%s*el", regTrig = true },
    [[
       else {{
      }}
    ]]
  ),
  S.fmt(
    "iferr",
    [[
      if err != nil {{
        {}
      }}
    ]]
  ),
  S.fmt(
    "for",
    [[
      for {}{}{{
        {}
      }}
    ]],
    { i(1), m(1, ".", " "), i(0) }
  ),
  S.fmt("st", [[struct{}{{{}{}{}}}{}{}]], {
    m(1, ".", " "),
    m(1, ".", "\n\t"),
    i(1),
    m(1, ".", "\n"),
    m(1, "^$", "{}"),
    i(0),
  }),
  S.fmt("in", [[interface{}{{{}{}{}}}{}{}]], {
    m(1, ".", " "),
    m(1, ".", "\n\t"),
    i(1),
    m(1, ".", "\n"),
    m(1, "^$", "{}"),
    i(0),
  }),
  S.fmt("ty", "type {} {}"),
  S.fmt("m", "map[{}]{}"),
  S.fmt("[", "[]{}"),
  S.alias("n", "nil"),
  S.alias("t", "true"),
  S.alias("f", "false"),
  S.alias("b", "bool"),
  S.alias("s", "string"),
  S.alias("e", "error"),
  S.alias("br", "break"),
  S.alias("con", "continue"),
  S.fmt("re", "return {}{}err", { i(1), m(1, ".", ", ") }),
  S.fmt("rn", "return nil{}{}", { m(1, ".", " "), i(1) }),
  S.fmt("rt", "return true{}{}", { m(1, ".", " "), i(1) }),
  S.fmt("rf", "return false{}{}", { m(1, ".", " "), i(1) }),
  S.fmt("c", "const {} = {}"),
  S.fmt("v", "var {} {}{}", { i(1), m(2, "^[A-Z]", "*"), i(2) }),
  S.fmt("vm", "var {} = make({}{}{})", { i(1), i(2), m(2, ",", " "), i(3) }),
  S.alias("ve", "var err error"),
  S.alias("ctx", "ctx context.Context"),
  S.alias("ctxb", "ctx := context.Background()"),
  S.alias("ctxt", "ctx := context.TODO()"),
  S.alias("ctxc", "ctx, cancel := context.WithCancel(context.Background())"),
}
