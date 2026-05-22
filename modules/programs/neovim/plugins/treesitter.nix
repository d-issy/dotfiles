{ dotfiles, ... }:

{
  programs.nixvim = {
    plugins = {
      treesitter = {
        enable = true;
        nixGrammars = false;
        lazyLoad.settings.event = [ "BufReadPost" ];

        luaConfig.post = builtins.readFile (dotfiles.files + "/nvim/lua/nixvim/plugins/treesitter.lua");
      };

      treesitter-context = {
        enable = true;
        lazyLoad.settings.event = [ "BufReadPost" ];
        settings = {
          max_lines = 5;
        };
      };
    };
  };
}
