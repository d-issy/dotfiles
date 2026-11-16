# The binary is multi-call: it dispatches on argv[0], which --argv0 sets.
{ pkgs, unwrapped }:

{
  name,
  tmux,
  env ? { },
}:

let
  inherit (pkgs) lib;
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
