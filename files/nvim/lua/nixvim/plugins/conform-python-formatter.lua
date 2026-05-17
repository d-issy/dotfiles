if require("conform").get_formatter_info("ruff_format", buf).available then
  return { "ruff_format" }
end
return { "black", "isort" }
