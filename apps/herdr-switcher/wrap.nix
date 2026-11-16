{ pkgs, unwrapped }:

{
  name,
  herdr,
  ghq,
  fuzzyFinder,
  includeParentDirectories ? false,
  attach ? false,
}:

let
  inherit (pkgs) lib;
  configFile = (pkgs.formats.json { }).generate "${name}.json" {
    inherit includeParentDirectories attach;
    herdr = lib.getExe herdr;
    ghq = lib.getExe ghq;
    inherit fuzzyFinder;
  };
in
pkgs.writeShellScriptBin name ''
  exec ${lib.getExe unwrapped} --config ${configFile} "$@"
''
