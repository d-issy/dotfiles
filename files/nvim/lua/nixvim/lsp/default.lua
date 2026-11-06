vim.lsp.config("*", {
  capabilities = vim.tbl_deep_extend("force", vim.lsp.protocol.make_client_capabilities(), {
    textDocument = {
      completion = {
        completionItem = {
          snippetSupport = true,
          resolveSupport = {
            properties = { "documentation", "detail", "additionalTextEdits" },
          },
        },
      },
    },
  }),
})

vim.api.nvim_create_autocmd("LspAttach", {
  callback = function(args)
    local client = vim.lsp.get_client_by_id(args.data.client_id)
    if not client then
      return
    end

    if client:supports_method(vim.lsp.protocol.Methods.textDocument_completion) then
      vim.lsp.completion.enable(true, client.id, args.buf, { autotrigger = true })
    end

    if client:supports_method(vim.lsp.protocol.Methods.textDocument_inlineCompletion, args.buf) then
      vim.lsp.inline_completion.enable(true, { bufnr = args.buf })
    end

    if client:supports_method(vim.lsp.protocol.Methods.textDocument_signatureHelp) then
      local provider = client.server_capabilities.signatureHelpProvider or {}
      local chars = {}
      for _, c in ipairs(provider.triggerCharacters or {}) do
        chars[c] = true
      end
      for _, c in ipairs(provider.retriggerCharacters or {}) do
        chars[c] = true
      end

      local function sig_win()
        local ok, win = pcall(vim.api.nvim_buf_get_var, args.buf, "lsp_floating_preview")
        if ok and win and vim.api.nvim_win_is_valid(win) then
          return win
        end
      end

      local function close_sig()
        local win = sig_win()
        if win then
          pcall(vim.api.nvim_win_close, win, true)
        end
      end

      local function open_sig()
        vim.lsp.buf.signature_help {
          focusable = false,
          silent = true,
          border = "rounded",
          close_events = { "InsertLeave", "BufLeave", "BufHidden" },
        }
      end

      if next(chars) then
        vim.api.nvim_create_autocmd("InsertCharPre", {
          buf = args.buf,
          callback = function()
            local ch = vim.v.char
            if ch == ")" or ch == "]" or ch == "}" then
              vim.defer_fn(close_sig, 0)
            elseif chars[ch] then
              vim.defer_fn(open_sig, 0)
            end
          end,
        })

        vim.api.nvim_create_autocmd("TextChangedI", {
          buf = args.buf,
          callback = function()
            if not sig_win() then
              return
            end
            local params = vim.lsp.util.make_position_params(0, client.offset_encoding)
            client:request(vim.lsp.protocol.Methods.textDocument_signatureHelp, params, function(err, result)
              if err or not result or not result.signatures or vim.tbl_isempty(result.signatures) then
                close_sig()
              end
            end, args.buf)
          end,
        })
      end
    end
  end,
})

vim.keymap.set("i", "<C-Space>", function()
  vim.lsp.completion.get()
end, { desc = "Trigger LSP completion" })

vim.keymap.set({ "i", "s" }, "<C-s>", function()
  vim.lsp.buf.signature_help {
    border = "rounded",
    close_events = { "InsertLeave", "BufLeave", "BufHidden" },
  }
end, { desc = "LSP signature help" })

vim.keymap.set("i", "<CR>", function()
  if vim.fn.pumvisible() == 1 then
    local info = vim.fn.complete_info { "selected" }
    if info.selected ~= -1 then
      return "<C-y>"
    end
    return "<C-e><CR>"
  end
  return "<CR>"
end, { expr = true, desc = "Confirm completion or insert newline" })

vim.keymap.set("i", "<Tab>", function()
  if vim.fn.pumvisible() == 1 then
    return "<C-n>"
  end
  if vim.lsp.inline_completion.get() then
    return ""
  end
  return "<Tab>"
end, { expr = true, desc = "Next completion item or accept inline completion" })

vim.keymap.set("i", "<S-Tab>", function()
  if vim.fn.pumvisible() == 1 then
    return "<C-p>"
  end
  return "<S-Tab>"
end, { expr = true, desc = "Prev completion item" })

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
