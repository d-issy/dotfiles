{ dot, ... }:

let
  raw = __raw: { inherit __raw; };

  lspKeymap = key: action: desc: {
    inherit key action;
    options.desc = desc;
  };
in
{
  imports = [
    ./basedpyright.nix
    ./gopls.nix
    ./lua-ls.nix
    ./nixd.nix
    ./ruff.nix
    ./rust-analyzer.nix
    ./typos-lsp.nix
    ./vtsls.nix
  ];

  programs.nixvim = {
    lsp = {
      inlayHints.enable = true;

      keymaps = [
        (lspKeymap "K" (raw ''function() vim.lsp.buf.hover({ border = "rounded" }) end'') "LSP Hover")
        (lspKeymap "<leader>cc" (raw "vim.lsp.codelens.run") "Run Codelens")
        (lspKeymap "<leader>cC" (raw "function() vim.lsp.codelens.enable(true) end") "Enable Codelens")
      ];
    };

    extraConfigLua = dot.readFile "nvim/lua/nixvim/lsp/default.lua";
  };
}
