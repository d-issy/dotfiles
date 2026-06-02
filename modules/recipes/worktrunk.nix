{ pkgs, ... }:

let
  wtNuInit = pkgs.runCommand "wt-nu-init" { } ''
    ${pkgs.worktrunk}/bin/wt config shell init nu > $out
  '';
in
{
  config = {
    home.packages = [ pkgs.worktrunk ];

    programs.zsh.initContent = ''
      eval "$(${pkgs.worktrunk}/bin/wt config shell init zsh)"
    '';

    xdg.dataFile."nushell/vendor/autoload/wt.nu".source = wtNuInit;

    dot.programs.navi.cheats.worktrunk.sections = [
      {
        tags = [
          "worktrunk"
          "wt"
        ];
        entries = [
          {
            description = "Create new worktree and branch";
            alias = "wc";
            command = "wt switch --create <branch_name>";
          }
          {
            description = "Create new worktree from specific base branch";
            command = "wt switch --create <branch_name> --base <base_branch>";
          }
          {
            description = "Switch to worktree";
            alias = "ws";
            command = "wt switch";
          }
          {
            description = "Switch to worktree by name";
            command = "wt switch <branch>";
          }
          {
            description = "Switch to default branch";
            command = "wt switch ^";
          }
          {
            description = "Switch to previous worktree";
            command = "wt switch -";
          }
          {
            description = "List all worktrees";
            alias = "wl";
            command = "wt list";
          }
          {
            description = "Remove current worktree";
            alias = "wr";
            command = "wt remove";
          }
          {
            description = "Merge current branch into default branch";
            alias = "wm";
            command = "wt merge";
          }
          {
            description = "Switch to worktree and launch command";
            alias = "wx";
            command = "wt switch -x <command> <branch>";
          }
          {
            description = "Create worktree and launch command";
            alias = "wcx";
            command = "wt switch --create <branch_name> -x <command>";
          }
          {
            description = "Switch to GitHub PR worktree";
            alias = "wpr";
            command = "wt switch pr:<pr_number>";
          }
        ];
        variables.branch = "git branch --format='%(refname:short)'";
      }
    ];
  };
}
