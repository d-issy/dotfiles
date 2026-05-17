{ pkgs, ... }:

{
  imports = [
    ./config
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

    xdg.configFile."nvim/lua/plugins" = {
      source = ../../files/nvim/lua/plugins;
      recursive = true;
    };

    xdg.configFile."nvim/lua/util" = {
      source = ../../files/nvim/lua/util;
      recursive = true;
    };

    xdg.configFile."nvim/lua/snippets" = {
      source = ../../files/nvim/lua/snippets;
      recursive = true;
    };

    xdg.configFile."nvim/lua/lsp" = {
      source = ../../files/nvim/lua/lsp;
      recursive = true;
    };
  };
}
