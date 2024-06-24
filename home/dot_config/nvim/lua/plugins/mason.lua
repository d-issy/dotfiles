return {
  "williamboman/mason.nvim",
  cmd = {
    "Mason",
    "MasonUpdate",
    "MasonInstall",
    "MasonUninstall",
    "MasonUninstallAll",
    "MasonLog",
  },
  opts = {
    ensure_installed = { "stylua", "lua-language-server" },
  },
  config = function(_, opts)
    require("mason").setup(opts)

    local mr = require "mason-registry"
    mr:on("package:install:success", function()
      vim.defer_fn(function()
        require("lazy.core.handler.event").trigger {
          event = "FileType",
          buf = vim.api.nvim_get_current_buf(),
        }
      end, 100)
    end)

    mr.refresh(function()
      for _, tool in ipairs(opts.ensure_installed) do
        local p = mr.get_package(tool)
        if not p:is_installed() then
          p:install()
        end
      end
    end)
  end,
}
