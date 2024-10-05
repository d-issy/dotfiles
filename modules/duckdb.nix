{ config, pkgs, ... }:

let
  version = "1.1.1";

  platform =
    if pkgs.stdenv.isDarwin then "osx-universal"
    else if pkgs.stdenv.system == "x86_64-linux" then "linux-amd64"
    else if pkgs.stdenv.system == "aarch64-linux" then "linux-aarch64"
    else throw "Unsupported platform";

  hashs = {
    "linux-amd64" = "7f3f1a26e98b3f1fcc673ffb81d2daf43c07689ed60e88173d6a4fd307f118ae";
    "linux-aarch64" = "9e1d2183453451050f6151bffb2425b78aa278f98acaca68a2671e36a9583be7";
    "osx-universal" = "d6db79a6651ad6b0a35bb11fe9affdac9758ebef7b61b8e3f3f6a5a66fb4bf56";
  };

  duckdb = pkgs.stdenv.mkDerivation {
    name = "duckdb";
    src = pkgs.fetchurl {
      url = "https://github.com/duckdb/duckdb/releases/download/v${version}/duckdb_cli-${platform}.zip";
      sha256 = hashs.${platform};
    };
    buildInputs = [ pkgs.unzip ];

    unpackPhase = ''
      mkdir -p $out/bin
      unzip $src -d $out/bin
    '';

    installPhase = ''
      chmod +x $out/bin/duckdb
    '';
  };
in
{
  home.packages = [ duckdb ];
}
