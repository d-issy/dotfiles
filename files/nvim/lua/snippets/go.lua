--@cspell: disable
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

return {
  s("main", {
    t { "package main", "", "" },
    t { "func main() {", "\t" },
    i(0),
    t { "", "}" },
  }, { condition = function(line) return line == "main" end }),
  s("fn", {
    t "func ",
    i(1),
    t "(",
    i(2),
    t ") ",
    m(3, ",", "("),
    i(3),
    m(3, ",", ")"),
    m(3, ".", " "),
    t { "{", "\t" },
    i(0),
    t { " ", "}" },
  }, { condition = function(line) return line == "fn" end }),
  s("if", { t "if ", i(1), t { " {", "\t" }, i(0), t { "", "}" } }),
  s("elif", { t " else if ", i(1), t { " {", "\t" }, i(0), t { "", "}" } }),
  s("el", { t { " else {", "\t" }, i(0), t { "", "}" } }),
  s("iferr", { t { "if err != nil {", "\t" }, i(0), t { "", "}" } }),
  s("for", { t "for ", i(1), m(1, ".", " "), t { "{", "\t" }, i(0), t { "", "}" } }),
  s("st", {
    m(1, ".", "type "),
    i(1),
    m(1, ".", " "),
    t "struct",
    m(1, ".", " "),
    t "{",
    m(1, ".", "\n\t"),
    i(2),
    m(1, ".", "\n"),
    t "}",
    m(1, "^$", "{"),
    i(0),
    m(1, "^$", "}"),
  }),
  s("in", {
    m(1, ".", "type "),
    i(1),
    m(1, ".", " "),
    t "interface",
    m(1, ".", " "),
    t "{",
    m(1, ".", "\n\t"),
    i(2),
    m(1, ".", "\n"),
    t "}",
    m(1, "^$", "{"),
    i(0),
    m(1, "^$", "}"),
  }),
  s("m", { t "map[", i(1), t "]", i(0) }),
  s("t", t "true"),
  s("f", t "false"),
  s("b", t "bool"),
  s("s", t "string"),
  s("e", t "error"),
  s("br", t "break"),
  s("con", t "continue"),
  s("const", { t "const ", i(1), t " = ", i(0) }),
  s("r", { t "return", m(1, ".", " "), i(1) }),
  s("test", {
    t "func Test",
    i(1),
    t { "(t *testing.T) {", "\t" },
    i(0),
    t { "", "}" },
  }, { condition = function(line) return line == "test" end }),
}
