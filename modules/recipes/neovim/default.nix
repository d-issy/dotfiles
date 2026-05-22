{ pkgs, ... }:

{
  imports = [
    ./config
    ./lsp
    ./plugins
  ];

  config = {
    programs.nixvim = {
      enable = true;
      defaultEditor = true;
    };

    home = {
      packages = [
        pkgs.tree-sitter
      ];
      shellAliases = {
        v = "nvim";
      };
    };

    dot.xdg.configFile."nvim/lua/util".source = true;
    dot.xdg.configFile."nvim/lua/snippets".source = true;
  };
}
