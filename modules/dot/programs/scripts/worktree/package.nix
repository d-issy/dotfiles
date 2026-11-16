{
  cfg,
  fuzzyFinderCommand,
  lib,
  pkgs,
  gh ? pkgs.gh,
}:

let
  app = pkgs.dotApps.worktree;

  configFile = (pkgs.formats.json { }).generate "worktree.json" {
    inherit (cfg) model thinking;
    diffPathspecs = import ../llm-diff-pathspecs.nix;
    fuzzyFinder = fuzzyFinderCommand;
    git = "${pkgs.git}/bin/git";
    gh = "${gh}/bin/gh";
    tmux = "${pkgs.tmux}/bin/tmux";
    patch = "${pkgs.patch}/bin/patch";
    petname = "${pkgs.rust-petname}/bin/petname";
  };
in
pkgs.writeShellScriptBin "worktree" ''
  exec ${lib.getExe app} --config ${configFile} "$@"
''
