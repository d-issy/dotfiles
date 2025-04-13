local llm_vendors = {
  ["claude@3.5-sonnet"] = {
    __inherited_from = "copilot",
    model = "claude-3.5-sonnet",
  },
  ["claude@3.7-sonnet"] = {
    __inherited_from = "copilot",
    model = "claude-3.7-sonnet",
  },
  ["google@gemma3:b1"] = {
    __inherited_from = "openai",
    endpoint = "https://openrouter.ai/api/v1",
    api_key_name = "OPENROUTER_API_KEY",
    model = "google/gemma-3-1b-it:free",
    disable_tools = true,
  },
  ["google@gemma3:b4"] = {
    __inherited_from = "openai",
    endpoint = "https://openrouter.ai/api/v1",
    api_key_name = "OPENROUTER_API_KEY",
    model = "google/gemma-3-4b-it:free",
    disable_tools = true,
  },
  ["google@gemma3:b12"] = {
    __inherited_from = "openai",
    endpoint = "https://openrouter.ai/api/v1",
    api_key_name = "OPENROUTER_API_KEY",
    model = "google/gemma-3-12b-it:free",
    disable_tools = true,
  },
  ["google@gemma3:b27"] = {
    __inherited_from = "openai",
    endpoint = "https://openrouter.ai/api/v1",
    api_key_name = "OPENROUTER_API_KEY",
    model = "google/gemma-3-27b-it:free",
    disable_tools = true,
  },
}

return {
  {
    "zbirenbaum/copilot.lua",
    cmd = "Copilot",
    build = ":Copilot auth",
    opts = {
      suggestion = { enabled = false },
      panel = { enabled = false },
      filetypes = {
        markdown = true,
        help = true,
      },
    },
  },
  {
    "yetone/avante.nvim",
    event = "VeryLazy",
    enabled = function()
      return vim.env.XDG_CONFIG_HOME == vim.fn.expand "~/.config"
    end,
    lazy = false,
    version = false,
    build = "make",
    dependencies = {
      "zbirenbaum/copilot.lua",
    },
    opts = {
      provider = "claude@3.7-sonnet",
      vendors = llm_vendors,
      file_selector = {
        provider = "snacks",
      },
      windows = {
        sidebar_header = {
          enabled = true,
          align = "right",
          rounded = false,
        },
        input = {
          prefix = "",
        },
      },
    },
    keys = {
      {
        "<leader>ap",
        function()
          local providers = {}
          for provider_name, _ in pairs(llm_vendors) do
            table.insert(providers, provider_name)
          end
          vim.ui.select(providers, {
            prompt = "Select Avante Provider",
          }, function(choice)
            if choice then
              vim.cmd("AvanteSwitchProvider " .. choice)
              vim.notify("Switched to " .. choice .. " provider", vim.log.levels.INFO)
            end
          end)
        end,
        desc = "Avante Switch Provider",
      },
    },
  },
}
