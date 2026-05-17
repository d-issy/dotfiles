local fname = vim.api.nvim_buf_get_name(buf)
local dir = fname ~= "" and vim.fs.dirname(fname) or vim.uv.cwd()

local oxfmt = vim.fs.find({ ".oxfmtrc.json", ".oxfmtrc.jsonc" }, { upward = true, path = dir })
if #oxfmt > 0 then
  return { "oxfmt" }
end

local biome = vim.fs.find({ "biome.json", "biome.jsonc" }, { upward = true, path = dir })
if #biome > 0 then
  return { "biome" }
end

return { "prettierd", "prettier", stop_after_first = true }
