{ config, pkgs, lib, ... }:
let
  claudeOverrides = lib.importJSON ../files/claude/settings.json;
  claudeFilesFiltered = builtins.filterSource
    (path: type:
      !(lib.hasSuffix "settings.json" (baseNameOf path))
    )
    ../files/claude;
in
{
  config = {
    home.file.".claude" = {
      source = claudeFilesFiltered;
      recursive = true;
    };

    home.activation.claudeSettingsMerge = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
      claudeDir="${config.home.homeDirectory}/.claude"
      settingsFile="$claudeDir/settings.json"
      overrides='${builtins.toJSON claudeOverrides}'

      mkdir -p "$claudeDir"
      if [ -f "$settingsFile" ]; then
        echo "Merging Claude settings..."
        ${pkgs.jq}/bin/jq -s '.[0] * .[1]' "$settingsFile" <(echo "$overrides") > "$settingsFile.tmp"
        mv "$settingsFile.tmp" "$settingsFile"
      else
        echo "Creating new Claude settings..."
        echo "$overrides" > "$settingsFile"
      fi
    '';
  };
}
