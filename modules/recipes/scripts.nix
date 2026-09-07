{ pkgs, ... }:

{
  home.shellAliases = {
    wt = "worktree";
    wtc = "worktree create";
    wtcf = "worktree create --finish";
    wtd = "worktree delete";
    wtdc = "worktree delete --current";
    wtl = "worktree list";
    wtp = "worktree prune";
    wtr = "worktree rename";
    wts = "worktree status";
    wtsw = "worktree switch";
  };

  dot.programs.scripts = {
    enable = true;

    gitAutoCommit = {
      enable = true;
      thinking = "low";
    };

    herdrSubagents.enable = true;

    tmuxNotice = {
      enable = true;
      fallback = {
        icons = [ "•" ];
        sessionNotificationIndicatorColor = "#ebcb8b"; # yellow
        titleMode = "name";
      };
      notices = {
        pi-wait = {
          icons = [
            "π"
            " "
          ];
          sessionNotificationIndicatorColor = "#8ec07c"; # green
          titleStripPatterns = [ "^(π| )\\s*" ];
        };
        claude-wait = {
          icons = [
            "✳"
            " "
          ];
          sessionNotificationIndicatorColor = "#d08770"; # orange
          titleStripPatterns = [ "^[✻✳]\\s*" ];
        };
        codex-wait = {
          icons = [
            "{}"
            "  "
          ];
          sessionNotificationIndicatorColor = "#88c0d0"; # cyan
        };
      };
    };

    worktree = {
      enable = true;
      thinking = "low";
    };
  };

  dot.programs.navi.cheats.worktree.sections = [
    {
      tags = [ "worktree" ];
      variables = {
        pull_number = "${pkgs.gh}/bin/gh pr list --- --column 1 --delimiter '\\t'";
      };
      entries = [
        {
          description = "Switch GitHub pull request worktree";
          alias = "wtpr";
          command = "worktree switch --pr <pull_number>";
        }
      ];
    }
  ];
}
