local function get_python_root()
  return require("lspconfig.util").root_pattern(
    ".venv",
    "venv",
    "poetry.lock",
    "Pipfile.lock",
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    ".python-version",
    ".git"
  )(vim.api.nvim_buf_get_name(vim.api.nvim_get_current_buf()))
end

local function pyright_opts(setup_name)
  local path = require("lspconfig.util").path
  local python_root = get_python_root()

  local cmd = { setup_name .. "-langserver", "--stdio" }
  if path.exists(path.join(python_root, "poetry.lock")) then
    cmd = { "poetry", "run", setup_name .. "-langserver", "--stdio" }
  elseif path.exists(path.join(python_root, "Pipfile.lock")) then
    cmd = { "pipenv", "run", setup_name .. "-langserver", "--stdio" }
  end

  return {
    root_dir = get_python_root,
    cmd = cmd,
    settings = {
      [setup_name] = {
        analysis = {
          autoSearchPaths = true,
          useLibraryCodeForTypes = true,
          diagnosticMode = "workspace",

          diagnosticSeverityOverrides = {
            strictParameterNoneValue = "none",
            -- warning
            reportDeprecated = "warning",
            reportMissingParameterType = "warning",
            reportMissingTypeArgument = "warning",
            reportMissingTypeStubs = "warning",
            reportUnusedClass = "warning",
            reportUnusedFunction = "warning",
            reportUnusedImport = "warning",
            reportUnusedVariable = "warning",
            -- none
            reportInplicitOverride = "none",
            reportUnknownArgumentType = "none",
            reportUnknownLambdaType = "none",
            reportUnknownMemberType = "none",
            reportUnknownParameterType = "none",
            reportUnknownVariableType = "none",
          },
        },
      },
    },
  }
end

return {
  "nvim-lspconfig",
  opts = {
    setup = {
      basedpyright = function(server, _opts)
        require("lspconfig")[server].setup(pyright_opts(server))
        return true
      end,
    },
  },
}
