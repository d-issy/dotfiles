# Installs the multi-call tmux-notice binary under `name`. The binary dispatches
# on argv[0]; the wrapper pins tmux on PATH and passes Nix-provided settings as
# environment variables.
{
  pkgs,
  name,
  tmux,
  env ? { },
}:

let
  inherit (pkgs) lib;
  unwrapped = import ./package.nix { inherit pkgs; };
in
pkgs.runCommand name
  {
    nativeBuildInputs = [ pkgs.makeBinaryWrapper ];
    meta.mainProgram = name;
  }
  ''
    makeBinaryWrapper ${unwrapped}/bin/tmux-notice $out/bin/${name} \
      --argv0 ${name} \
      --prefix PATH : ${tmux}/bin \
      ${lib.concatStringsSep " " (lib.mapAttrsToList (k: v: "--set ${k} ${lib.escapeShellArg v}") env)}
  ''
