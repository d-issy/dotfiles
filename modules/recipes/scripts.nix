{ pkgs, ... }:

{
  home.shellAliases = {
    wt = "worktree";
    wtc = "worktree create";
    wtcf = "worktree create --finish";
    wtd = "worktree delete";
    wtdc = "worktree delete --current";
    wtl = "worktree list";
    wtr = "worktree rename";
    wts = "worktree status";
    wtsw = "worktree switch";
  };

  dot.programs.scripts = {
    enable = true;

    shellIntegration.zsh.enable = false;

    gitAutoCommit = {
      enable = true;
      thinking = "low";
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
        worktree_query = "${pkgs.git}/bin/git worktree list --porcelain | ${pkgs.gawk}/bin/awk '/^branch / { sub(\"refs/heads/\", \"\", $2); print $2 }'";
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
