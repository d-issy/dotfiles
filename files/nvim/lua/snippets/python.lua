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

return {
  s("im", {
    -- from
    m(1, "^A$", "from typing "),
    m(1, "^Ar$", "from argparse "),
    m(1, "^It?$", "from collections.abc "),
    m(1, "^Mu?$", "from collections.abc "),
    m(1, "^Or$", "from collections.abc "),
    m(1, "^P$", "from pathlib "),
    m(1, "^[CS]$", "from collections.abc "),
    m(1, "^[FLOT]$", "from typing "),
    m(1, "^ca?$", "from functools "),
    m(1, "^d$", "from dataclasses "),
    m(1, "^g$", "from logging "),
    m(1, "^lr$", "from functools "),
    -- basic
    t "import ",
    i(1),
    -- abbreviation
    m(1, "^A$", "ny"),
    m(1, "^Ar$", "gumentParser"),
    m(1, "^C$", "allable"),
    m(1, "^F$", "inal"),
    m(1, "^I$", "terable"),
    m(1, "^It$", "erator"),
    m(1, "^L$", "iteral"),
    m(1, "^M$", "apping"),
    m(1, "^Mu$", "tableMapping"),
    m(1, "^O$", "ptional"),
    m(1, "^Or$", "deredDict"),
    m(1, "^P$", "ath"),
    m(1, "^S$", "equence"),
    m(1, "^T$", "ypedDict"),
    m(1, "^c$", "ache"),
    m(1, "^ca$", "ched_property"),
    m(1, "^d$", "ataclass"),
    m(1, "^g$", "etLogger"),
    m(1, "^j$", "son"),
    m(1, "^l$", "ogging"),
    m(1, "^lr$", "u_cache"),
    m(1, "^p$", "ogging"),
    -- as
    m(1, "^da$", "tetime as dt"),
    m(1, "^nu$", "mpy as np"),
    m(1, "^pa$", "ndas as pd"),
  }),
  s("def", {
    t "def ",
    i(1),
    t "(",
    i(2),
    t ")",
    m(3, ".", " -> "),
    m(3, ",", "tuple["),
    i(3),
    m(3, ",", "]"),
    t { ":", "\t" },
    i(0, "..."),
  }),
  s("class", {
    t "class ",
    i(1),
    t { ":", "\t" },
    t { "def __init__(self" },
    m(2, ".", ", "),
    i(2),
    t { "):", "\t\t" },
    i(0, "..."),
  }),
  s("dc", { t { "@dataclass", "" }, t "class ", i(1), t { ":", "\t" }, i(0, "...") }),
  s("td", { t "class ", i(1), t { "(TypedDict):", "\t" }, i(0, "...") }),
  s("if", { t "if ", i(1), t { ":", "\t" }, i(0, "...") }),
  s("elif", { t "elif ", i(1), t { ":", "\t" }, i(0, "...") }),
  s("el", { t { "else:", "\t" }, i(0, "...") }),
  s("for", { t "for ", i(2), t " in ", i(1), t { ":", "\t" }, i(0, "...") }),
  s("fore", { t "for ", i(3), t ", ", i(2), t " in enumerate(", i(1), t { "):", "\t" }, i(0, "...") }),
  s("list", { t "list", m(1, "^%(", "", "["), i(1), m(1, "^%(", ")", "]") }),
  s("tuple", { t "tuple", m(1, "^%(", "", "["), i(1), m(1, "^%(", ")", "]") }),
  s("set", { t "set", m(1, "^%(", "", "["), i(1), m(1, "^%(", ")", "]") }),
  s("b", t "bool"),
  s("s", t "str"),
  s("i", t "int"),
  s("r", { t "return", m(1, ".", " "), i(1) }),
  s("t", t "True"),
  s("f", t "False"),
  s("n", t "None"),
  s("br", t "break"),
  s("cn", t "continue"),
  postfix("??", { l(l.POSTFIX_MATCH .. " | None") }),
  postfix("?", { l("Optional[" .. l.POSTFIX_MATCH .. "]") }),
  postfix(".len", { l("len(" .. l.POSTFIX_MATCH .. ")") }),
  postfix(".str", { l("str(" .. l.POSTFIX_MATCH .. ")") }),
  postfix(".int", { l("str(" .. l.POSTFIX_MATCH .. ")") }),
  postfix(".type", { l("type(" .. l.POSTFIX_MATCH .. ")") }),
  postfix(".not", { l("not(" .. l.POSTFIX_MATCH .. ")") }),
}
