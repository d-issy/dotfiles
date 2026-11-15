{ pkgs }:

let
  # Node.js LTS, matching node-version in the GitHub Actions workflows.
  nodejs = pkgs.nodejs_26;
in
pkgs.stdenvNoCC.mkDerivation {
  pname = "agent-session";
  version = "0.1.0";
  src = ./src;

  nativeBuildInputs = [
    pkgs.esbuild
    pkgs.makeWrapper
  ];

  buildPhase = ''
    runHook preBuild
    esbuild main.ts --bundle --platform=node --format=esm --target=node${pkgs.lib.versions.major nodejs.version} --outfile=agent-session.mjs
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    install -Dm644 agent-session.mjs "$out/lib/agent-session/agent-session.mjs"
    makeWrapper ${nodejs}/bin/node "$out/bin/agent-session" \
      --add-flags "$out/lib/agent-session/agent-session.mjs"
    runHook postInstall
  '';

  meta = {
    description = "Watch Claude Code and Codex sessions live";
    mainProgram = "agent-session";
  };
}
