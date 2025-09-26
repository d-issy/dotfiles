local map = require "util.map"

local servers = {
  gopls = {
    settings = {
      gopls = {
        codelenses = {
          generate = true,
          gc_details = true,
          test = true,
          tidy = true,
          upgrade_dependency = true,
          vendor = true,
        },
        hints = {
          assignVariableTypes = false,
          compositeLiteralFields = true,
          compositeLiteralTypes = true,
          constantValues = false,
          functionTypeParameters = true,
          parameterNames = true,
          rangeVariableTypes = false,
        },
      },
    },
  },
  lua_ls = {
    settings = {
      Lua = {
        diagnostics = {
          globals = { "vim", "hs" },
        },
        hint = {
          enable = true,
          arrayIndex = "Disable",
        },
        workspace = {
          library = vim.list_slice(vim.api.nvim_get_runtime_file("", true), 2),
        },
      },
    },
  },
  typos_lsp = {
    init_options = {
      diagnosticSeverity = "Hint",
    },
  },
}

return {
  "neovim/nvim-lspconfig",
  dependencies = {
    "mason-org/mason-lspconfig.nvim",
    "mason.nvim",
    "blink.cmp",
  },
  event = { "BufReadPost" },
  opts = {
    servers = servers,
  },
  config = function(_, opts)
    vim.lsp.inlay_hint.enable()
    vim.diagnostic.config {
      float = true,
      update_in_insert = true,
      severity_sort = true,
      virtual_lines = { current_line = true },
      signs = {
        text = {
          [vim.diagnostic.severity.ERROR] = "✘",
          [vim.diagnostic.severity.WARN] = "▲",
          [vim.diagnostic.severity.HINT] = "⚑",
          [vim.diagnostic.severity.INFO] = "»",
        },
      },
    }

    local jump = function(idx)
      return function()
        vim.diagnostic.jump { count = idx }
      end
    end

    local hover = function()
      vim.lsp.buf.hover { border = "rounded" }
    end

    map.setup {
      { "[d", jump(-1), desc = "LSP Prev Diagnostic" },
      { "]d", jump(1), desc = "LSP Next Diagnostic" },
      { "K", hover, desc = "LSP Hover" },
      { "<leader>cc", vim.lsp.codelens.run, desc = "Run Codelens" },
      { "<leader>cC", vim.lsp.codelens.refresh, desc = "Run Codelens (Refresh)" },
    }

    local capabilities = require("blink.cmp").get_lsp_capabilities()
    vim.lsp.config("*", { capabilities = capabilities })

    local servers = opts.servers or {}
    local setup_handlers = type(opts.setup) == "table" and opts.setup or {}
    local enabled = {}

    local function configure(server)
      if enabled[server] then
        return
      end

      local server_opts = vim.tbl_deep_extend("force", {}, servers[server] or {})
      server_opts.capabilities = vim.tbl_deep_extend("force", {}, capabilities, server_opts.capabilities or {})

      local handler = setup_handlers[server] or setup_handlers["*"]
      if handler then
        if handler(server, server_opts) then
          enabled[server] = true
          return
        end
      end

      vim.lsp.config(server, server_opts)
      vim.lsp.enable(server)
      enabled[server] = true
    end
    for server in pairs(servers) do
      configure(server)
    end

    local mason_lspconfig = require "mason-lspconfig"
    mason_lspconfig.setup { automatic_enable = false }

    for _, server in ipairs(mason_lspconfig.get_installed_servers()) do
      configure(server)
    end

    local mappings = mason_lspconfig.get_mappings()
    local registry = require "mason-registry"
    registry:on("package:install:success", function(pkg)
      local server = mappings.package_to_lspconfig[pkg.name]
      if server then
        vim.schedule(function()
          configure(server)
        end)
      end
    end)
  end,
}
