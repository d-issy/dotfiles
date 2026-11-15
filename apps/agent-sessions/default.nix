{ pkgs }:

pkgs.stdenvNoCC.mkDerivation {
  pname = "dot-agent-sessions";
  version = "0.1.0";
  src = ./src;

  nativeBuildInputs = [
    pkgs.esbuild
    pkgs.makeWrapper
  ];

  buildPhase = ''
    runHook preBuild
    esbuild main.ts --bundle --platform=node --format=esm --target=node22 --outfile=dot-agent-sessions.mjs
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    install -Dm644 dot-agent-sessions.mjs "$out/lib/dot-agent-sessions/dot-agent-sessions.mjs"
    makeWrapper ${pkgs.nodejs}/bin/node "$out/bin/dot-agent-sessions" \
      --add-flags "$out/lib/dot-agent-sessions/dot-agent-sessions.mjs"
    runHook postInstall
  '';

  meta = {
    description = "Watch Claude Code and Codex sessions live";
    mainProgram = "dot-agent-sessions";
  };
}
