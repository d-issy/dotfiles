_:

{
  programs.nixvim = {
    plugins.grug-far = {
      enable = true;
      lazyLoad.settings.cmd = [ "GrugFar" ];
      settings = {
        windowCreationCommand = "15split";
        openTargetWindow.preferredLocation = "above";
        startInsertMode = true;
        keymaps = {
          qflist.n = "<c-q>";
          refresh.n = "<c-r>";
          close.n = "q";
          replace.n = "<leader>r";
          syncLocations.n = "<leader>s";
          syncLine.n = "<leader>l";
          historyOpen.n = "<leader>t";
          historyAdd.n = "<leader>a";
          gotoLocation.n = "<enter>";
          pickHistoryEntry.n = "<enter>";
          abort.n = "<leader>b";
        };
      };
    };

    keymaps = [
      {
        mode = "n";
        key = "<leader>fr";
        action = "<cmd>GrugFar<cr>";
        options = {
          desc = "Find or Replace";
          silent = true;
          noremap = true;
        };
      }
    ];
  };
}
