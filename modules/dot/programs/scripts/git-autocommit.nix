{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.scripts.gitAutoCommit;
  jsonFormat = pkgs.formats.json { };

  piArgs = [
    "--print"
  ]
  ++ lib.optionals (cfg.model != null) [
    "--model"
    cfg.model
  ]
  ++ lib.optionals (cfg.thinking != null) [
    "--thinking"
    cfg.thinking
  ]
  ++ [
    "--no-session"
    "--no-tools"
    "--no-extensions"
    "--no-skills"
    "--no-prompt-templates"
    "--no-context-files"
  ];

  configFile = jsonFormat.generate "git-auto-commit.json" {
    pi_args = piArgs;
    diff_pathspecs = import ./llm-diff-pathspecs.nix;
  };

  app = import ../../../../apps/rust-app.nix { inherit pkgs; } {
    pname = "git-autocommit";
    description = "AI-powered commit message generator using Pi CLI";
    mainProgram = "git-auto-commit";
  };

  gitAutoCommit = pkgs.writeShellScriptBin "git-auto-commit" ''
    export PATH=${lib.makeBinPath [ pkgs.git ]}:"$PATH"
    exec ${lib.getExe app} --config ${configFile} "$@"
  '';
in
{
  options.dot.programs.scripts.gitAutoCommit = {
    enable = lib.mkEnableOption "git auto-commit command";

    model = lib.mkOption {
      type = with lib.types; nullOr str;
      default = null;
      description = "Pi model passed to git-auto-commit. When null, no --model option is passed.";
    };

    thinking = lib.mkOption {
      type = with lib.types; nullOr str;
      default = null;
      description = "Pi thinking level passed to git-auto-commit. When null, no --thinking option is passed.";
    };
  };

  config = lib.mkIf (config.dot.programs.scripts.enable && cfg.enable) {
    home.packages = [ gitAutoCommit ];
  };
}
