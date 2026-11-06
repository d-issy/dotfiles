{ pkgs }:

let
  herdr = pkgs.writeShellScriptBin "herdr" ''
    exec ${pkgs.bash}/bin/bash "$TEST_HERDR_MOCK" "$@"
  '';
  scriptModule = import ../../modules/dot/programs/scripts/herdr-subagents.nix {
    inherit pkgs;
    inherit (pkgs) lib;
    config.dot.programs.scripts.herdrSubagents = {
      commandName = "herdr-subagents";
      herdrPackage = herdr;
    };
  };
  herdrSubagents = scriptModule.options.dot.programs.scripts.herdrSubagents.package.default;
in
pkgs.runCommand "herdr-subagents-regressions"
  {
    nativeBuildInputs = with pkgs; [
      bash
      coreutils
      diffutils
      jq
    ];
    HERDR_SUBAGENTS_SCRIPT = "${herdrSubagents}/bin/herdr-subagents";
  }
  ''
    bash ${./herdr-subagents.sh}
    touch "$out"
  ''
