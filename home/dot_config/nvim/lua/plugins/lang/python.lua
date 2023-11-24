return {
  {
    "nvim-lspconfig",
    opts = {
      setup = {
        ["pyright"] = function(server, _)
          require("lspconfig")[server].setup {
            settings = {
              python = {
                analysis = {
                  autoSearchPaths = true,
                  diagnosticMode = "workspace",
                  useLibraryCodeForTypes = true,
                },
              },
            },
            -- automatic select interpreter
            on_new_config = function(new_config, _)
              local util = require "lspconfig.util"
              local filepath = vim.api.nvim_buf_get_name(vim.api.nvim_get_current_buf())
              local python_root = util.root_pattern(
                ".venv",
                "venv",
                "poetry.lock",
                "Pipfile.lock",
                "pyproject.toml",
                "requirements.txt",
                "setup.py",
                "setup.cfg",
                ".python-version", -- pyenv
                ".tool-versions", -- asdf
                ".git" -- git
              )(filepath)
              new_config.root_dir = python_root

              local check = function(file) return util.path.exists(util.path.join(python_root, file)) end
              if check ".venv" then
                new_config.settings.python.pythonPath = util.path.join(python_root, ".venv", "bin", "python")
              elseif check "venv" then
                new_config.settings.python.pythonPath = util.path.join(python_root, "venv", "bin", "python")
              elseif check "poetry.lock" then
                new_config.cmd = { "poetry", "run", "pyright-langserver", "--stdio" }
              elseif check "Pipfile.lock" then
                new_config.cmd = { "pipenv", "run", "pyright-langserver", "--stdio" }
              else
                -- use default config
              end
            end,
          }
          return true
        end,
      },
    },
  },
}
