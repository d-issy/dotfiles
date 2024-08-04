{ config, pkgs, ... }:

{
  programs.git = {
    enable = true;

    userName = "d-issy";
    userEmail = "12374694+d-issy@users.noreply.github.com";

    extraConfig = {
      color = {
        ui = "auto";
        diff = true;
      };
      init.defaultBranch = "main";
      commit.verbose = true;
      push.default = "current";
      pull = {
        ff = "only";
        rebase = false;
        autostash = true;
      };
      merge.conflictstyle = "diff3";
      rebase.autostash = true;
      fetch.prune = true;
      core = {
        quotePath = false;
        ignorecase = false;
        autocrlf = false;
      };
      ghq.root = "~/code";
      url."git@github.com:".insteadOf = "https://github.com/";
    };
  };

  xdg.configFile."git/ignore".source = ../files/git/ignore;
}
