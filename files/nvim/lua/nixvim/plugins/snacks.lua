local snacks = require "snacks"

snacks.toggle.option("relativenumber", { name = "Relative Number" }):map "<leader>ur"
snacks.toggle.option("spell", { name = "Spell" }):map "<leader>us"
snacks.toggle.option("wrap", { name = "Wrap" }):map "<leader>uw"
snacks.toggle.diagnostics():map "<leader>ud"
snacks.toggle.indent():map "<leader>ug"
snacks.toggle.inlay_hints():map "<leader>ui"
snacks.toggle.line_number():map "<leader>un"

vim.api.nvim_create_autocmd("LspProgress", {
  callback = function(ev)
    local spinner = { "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏" }
    vim.notify(vim.lsp.status(), vim.log.levels.INFO, {
      id = "lsp_progress",
      title = "LSP Progress",
      opts = function(notif)
        notif.icon = ev.data.params.value.kind == "end" and " "
          or spinner[math.floor(vim.uv.hrtime() / (1e6 * 80)) % #spinner + 1]
      end,
    })
  end,
})
