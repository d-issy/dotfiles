local function pick(kind)
  return function()
    local actions = require "CopilotChat.actions"
    local items = actions[kind .. "_actions"]()
    if not items then
      return
    end
    require("CopilotChat.integrations.telescope").pick(items)
  end
end

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
    "zbirenbaum/copilot-cmp",
    dependencies = { "copilot.lua" },
    opts = {},
    config = function(_, opts)
      require("copilot_cmp").setup(opts)
    end,
  },
  {
    "CopilotC-Nvim/CopilotChat.nvim",
    branch = "canary",
    cmd = "CopilotChat",
    opts = function()
      local select = require "CopilotChat.select"
      return {
        model = "gpt-4",
        auto_insert_mode = true,
        show_help = true,
        question_header = " You ",
        answer_header = "  Copilot ",
        window = {
          width = 0.3,
        },
        selection = function(source)
          return select.visual(source) or select.buffer(source)
        end,
        prompts = {
          Explain = {
            prompt = "/COPILOT_EXPLAIN 選択範囲の説明を箇条書きで完結にまとめてください。",
          },
          Review = {
            prompt = "/COPILOT_REVIEW 選択したコードをレビューしてください。",
            callback = function(response, source) end,
          },
          Fix = {
            prompt = "/COPILOT_GENERATE このコードには問題があります。バグを修正したコードに書き直して表示してください。",
          },
          Optimize = {
            prompt = "/COPILOT_GENERATE 選択したコードを最適化してパフォーマンスと可読性を向上させてください。",
          },
          Docs = {
            prompt = "/COPILOT_GENERATE 選択した部分にドキュメントコメントを追加してください。",
          },
          Tests = {
            prompt = "/COPILOT_GENERATE 私のコードにテストコードを書いてください。",
          },
          FixDiagnostic = {
            prompt = "Please assist with the following diagnostic issue in file:",
            selection = select.diagnostics,
          },
          Commit = {
            prompt = "commitzenの規約に基いてコミットメッセージを書いてください。タイトルは最大50文字にし、メッセージは72文字で折り返してください。コードブロック全体をgitcommit言語でラップしてください。",
            selection = select.gitdiff,
          },
          CommitStaged = {
            prompt = "commitizen規約に従って変更のコミットメッセージを書いてください。タイトルは最大50文字、メッセージは72文字で折り返すようにしてください。メッセージ全体をgitcommit言語のコードブロックで囲ってください。",
            selection = function(source)
              return select.gitdiff(source, true)
            end,
          },
        },
      }
    end,
    keys = {
      { "<c-s>", "<CR>", ft = "copilot-chat", desc = "Submit Prompt", remap = true },
      { "<leader>a", "", desc = "+ai", mode = { "n", "v" } },
      {
        "<leader>aa",
        function()
          return require("CopilotChat").toggle()
        end,
        desc = "Toggle (CopilotChat)",
        mode = { "n", "v" },
      },
      {
        "<leader>ax",
        function()
          return require("CopilotChat").reset()
        end,
        desc = "Clear (CopilotChat)",
        mode = { "n", "v" },
      },
      {
        "<leader>aq",
        function()
          local input = vim.fn.input "Quick Chat: "
          if input ~= "" then
            require("CopilotChat").ask(input)
          end
        end,
        desc = "Quick Chat (CopilotChat)",
        mode = { "n", "v" },
      },
      -- Show help actions with telescope
      { "<leader>ad", pick "help", desc = "Diagnostic Help (CopilotChat)", mode = { "n", "v" } },
      -- Show prompts actions with telescope
      { "<leader>ap", pick "prompt", desc = "Prompt Actions (CopilotChat)", mode = { "n", "v" } },
    },
    config = function(_, opts)
      local chat = require "CopilotChat"
      require("CopilotChat.integrations.cmp").setup()

      vim.api.nvim_create_autocmd("BufEnter", {
        pattern = "copilot-chat",
        callback = function()
          vim.opt_local.relativenumber = false
          vim.opt_local.number = false
        end,
      })

      chat.setup(opts)
    end,
  },
}
