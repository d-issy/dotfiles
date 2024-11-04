{ config, pkgs, ... }:

let
  version = "1.1.2";

  platform =
    if pkgs.stdenv.isDarwin then "osx-universal"
    else if pkgs.stdenv.system == "x86_64-linux" then "linux-amd64"
    else if pkgs.stdenv.system == "aarch64-linux" then "linux-aarch64"
    else throw "Unsupported platform";

  hashs = {
    "linux-amd64" = "461d949dd4e8e03949dddf65398426adeaa67b459c2fca1316208bcac36aaac7";
    "linux-aarch64" = "d0040fe19970f3b104e4858acd449a09242f9189f591b943a6f43281c11fc4df";
    "osx-universal" = "444ccaf4f4b68c92488dba239190837718c070251a08b603939ff9eb72a3eaef";
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
