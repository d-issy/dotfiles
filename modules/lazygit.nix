{ config, pkgs, ... }:

{
  config = {
    home.shellAliases = { lg = "lazygit"; };

    programs.lazygit = {
      enable = true;
      settings = {
        gui.language = "en";
        gui.nerdFontsVersion = "3";
        gui.sidePanelWidth = 0.30;
        gui.expandFocusedSidePanel = true;
        gui.commitLogSize = 2;
        gui.showUntrackedFiles = true;
        gui.authorColors = { "*" = "#b7bdf8"; };
        gui.theme = {
          activeBorderColor = [ "#f5a97f" "bold" ];
          inactiveBorderColor = [ "#494d64" ];
          optionsTextColor = [ "#8aadf4" ];
          selectedLineBgColor = [ "#363a4f" ];
          cherryPickedCommitBgColor = [ "#363a4f" ];
          cherryPickedCommitFgColor = [ "#cad3f5" ];
          unstagedChangesColor = [ "#ed8796" ];
          defaultFgColor = [ "#cad3f5" ];
          searchingActiveBorderColor = [ "#eed49f" ];
        };
        quitOnTopLevelReturn = true;
        keybinding = {
          universal = {
            quit = "Q";
            return = "q";
          };
          files = {
            commitChanges = "";
            commitChangesWithEditor = "c";
          };
        };
      };
    };
  };
}
