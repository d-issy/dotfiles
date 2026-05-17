_:

{
  imports = [
    ./ai.nix
    ./comment.nix
    ./conform.nix
    ./dap.nix
    ./dial.nix
    ./git.nix
    ./markdown.nix
    ./markit.nix
    ./luasnip.nix
    ./lspconfig.nix
    ./mini.nix
    ./screenkey.nix
    ./oil.nix
    ./replace.nix
    ./snacks.nix
    ./neotest.nix
    ./todo.nix
    ./treesitter.nix
    ./ui.nix
  ];

  programs.nixvim.plugins.lz-n.enable = true;
}
