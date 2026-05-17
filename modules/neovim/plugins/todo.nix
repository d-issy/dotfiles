{ ... }:

{
  programs.nixvim.plugins.todo-comments = {
    enable = true;

    lazyLoad.settings = {
      event = [ "BufReadPost" ];
      keys = [
        {
          __unkeyed-1 = "]t";
          __unkeyed-3.__raw = ''
            function()
              require("todo-comments").jump_next()
            end
          '';
          desc = "Next Todo Comment";
        }
        {
          __unkeyed-1 = "[t";
          __unkeyed-3.__raw = ''
            function()
              require("todo-comments").jump_prev()
            end
          '';
          desc = "Previous Todo Comment";
        }
      ];
    };

    settings = { };
  };
}
