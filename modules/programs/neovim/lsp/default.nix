_:

let
  raw = __raw: { inherit __raw; };

  lspKeymap = key: action: desc: {
    inherit key action;
    options.desc = desc;
  };
in
{
  imports = [
    ./copilot.nix
    ./gopls.nix
    ./lua-ls.nix
    ./nil-ls.nix
    ./typos-lsp.nix
    ./vtsls.nix
  ];

  programs.nixvim = {
    lsp = {
      inlayHints.enable = true;

      keymaps = [
        (lspKeymap "[d" (raw "function() vim.diagnostic.jump({ count = -1 }) end") "LSP Prev Diagnostic")
        (lspKeymap "]d" (raw "function() vim.diagnostic.jump({ count = 1 }) end") "LSP Next Diagnostic")
        (lspKeymap "K" (raw ''function() vim.lsp.buf.hover({ border = "rounded" }) end'') "LSP Hover")
        (lspKeymap "<leader>cc" (raw "vim.lsp.codelens.run") "Run Codelens")
        (lspKeymap "<leader>cC" (raw "function() vim.lsp.codelens.enable(true) end")
          "Run Codelens (Refresh)"
        )
      ];
    };

    extraConfigLua = builtins.readFile ../../../../files/nvim/lua/nixvim/lsp/default.lua;
  };
}
