{ pkgs }:

let
  # Node.js LTS, matching node-version in the GitHub Actions workflows.
  nodejs = pkgs.nodejs_26;
in
pkgs.stdenvNoCC.mkDerivation {
  pname = "command-library";
  version = "0.1.0";
  src = ./src;

  nativeBuildInputs = [
    pkgs.esbuild
    pkgs.makeWrapper
  ];

  buildPhase = ''
    runHook preBuild
    esbuild main.ts --bundle --platform=node --format=esm --target=node${pkgs.lib.versions.major nodejs.version} --outfile=command-library.mjs
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    install -Dm644 command-library.mjs "$out/lib/command-library/command-library.mjs"
    makeWrapper ${nodejs}/bin/node "$out/bin/command-library" \
      --add-flags "$out/lib/command-library/command-library.mjs"
    runHook postInstall
  '';

  meta = {
    description = "Pick a command from the command library with fzf";
    mainProgram = "command-library";
  };
}
