{ pkgs, dot, ... }:

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

    xdg.configFile."nvim/lua/util" = {
      source = dot.files + "/nvim/lua/util";
      recursive = true;
    };

    xdg.configFile."nvim/lua/snippets" = {
      source = dot.files + "/nvim/lua/snippets";
      recursive = true;
    };

  };
}
