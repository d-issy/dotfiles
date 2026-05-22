_:

{
  programs.nixvim.plugins.gitsigns = {
    enable = true;

    lazyLoad.settings.event = [ "BufReadPost" ];

    settings = {
      signs = {
        add.text = "▎";
        change.text = "▎";
        delete.text = "";
        topdelete.text = "";
        changedelete.text = "▎";
        untracked.text = "▎";
      };

      on_attach = ''
        function(buffer)
        ${builtins.readFile ../../../../files/nvim/lua/nixvim/plugins/gitsigns-on-attach.lua}
        end
      '';
    };
  };
}
