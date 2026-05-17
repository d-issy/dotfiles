{ ... }:

{
  programs.nixvim.plugins = {
    mini-surround = {
      enable = true;
      lazyLoad.settings.event = [ "BufReadPre" ];
      settings.mappings = {
        add = "gsa";
        delete = "gsd";
        find = "gsf";
        find_left = "gsF";
        highlight = "gsh";
        replace = "gsr";
        update_n_lines = "gsn";
      };
    };

    mini-align = {
      enable = true;
      lazyLoad.settings.event = [ "BufReadPre" ];
      settings = { };
    };

    mini-icons = {
      enable = true;
      mockDevIcons = true;
      settings = { };
    };

    mini-hipatterns = {
      enable = true;
      lazyLoad.settings.event = [ "BufReadPost" ];
      settings.highlighters.hex_color.__raw = ''
        require("mini.hipatterns").gen_highlighter.hex_color()
      '';
    };
  };
}
