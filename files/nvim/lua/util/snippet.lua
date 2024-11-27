local M = {}

local luasnip = require "luasnip"

--- @param trigger string|table
--- @param expansion string
function M.alias(trigger, expansion)
  return luasnip.snippet(trigger, luasnip.text_node(expansion))
end

--- @param trigger string|table
--- @param expansion string
--- @param params? [any]
function M.fmt(trigger, expansion, params)
  if params == nil then
    local _, count = expansion:gsub("{}", "")
    params = {}
    for i = 1, count do
      table.insert(params, luasnip.insert_node(i))
    end
    if count > 0 then
      params[count] = luasnip.insert_node(0)
    end
  end
  return luasnip.snippet(trigger, require("luasnip.extras.fmt").fmt(expansion, params))
end

-- conditions
M.conds = {}

--- @param line string
--- @param matcher string
function M.conds.line_start(line, matcher)
  return line == matcher
end

--- @param line string
--- @param matcher string
function M.conds.line_start_whitespace(line, matcher)
  return line:match("^%s*" .. matcher) ~= nil
end

return M
