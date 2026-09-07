{ pkgs, lib }:

# Merge JSON while preserving existing configuration.
# Only the keys specified in overrides will be updated.
{
  targetDir, # Full path to the config directory (e.g., "${config.home.homeDirectory}/.claude")
  settingsFile, # Settings file name (e.g., "settings.json")
  overrides, # Settings object to override
}:
let
  overridesJson = builtins.toJSON overrides;
in
lib.hm.dag.entryAfter [ "writeBoundary" ] ''
  targetDir="${targetDir}"
  targetFile="$targetDir/${settingsFile}"

  mkdir -p "$targetDir"
  if [ -f "$targetFile" ]; then
    # Remove JSON comments (// ...) before parsing with jq
    ${pkgs.gnused}/bin/sed '/^[[:space:]]*\/\//d' "$targetFile" | \
      ${pkgs.jq}/bin/jq -s '.[0] * .[1]' - <(printf '%s' ${lib.escapeShellArg overridesJson}) > "$targetFile.tmp"
    mv "$targetFile.tmp" "$targetFile"
  else
    echo ${lib.escapeShellArg overridesJson} > "$targetFile"
  fi
''
