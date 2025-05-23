{ config, pkgs, ... }:

{
  config = {
    home.shellAliases = { lg = "lazygit"; };

    programs.lazygit = {
      enable = true;
      settings = {
        gui = {
          language = "en";
          nerdFontsVersion = "3";
          sidePanelWidth = 0.30;
          expandFocusedSidePanel = true;
          commitLogSize = 2;
          showUntrackedFiles = true;
          authorColors = { "*" = "#b7bdf8"; };
          theme = {
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
          git = {
            autoForwardBranches = "none";
          };
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
