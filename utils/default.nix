{ config, pkgs, lib, ... }:

{
  # Merge JSON while preserving existing configuration
  # Only the keys specified in overrides will be updated
  mergeJson = {
    targetDir,              # Full path to the config directory (e.g., "${config.home.homeDirectory}/.config/zed")
    settingsFile,           # Settings file name (e.g., "settings.json")
    overrides,              # Settings object to override
    skipIfMissing ? false,  # If true, skip merge when targetDir doesn't exist (useful for WSL/Windows paths)
    replace ? false         # If true, replace entire file instead of merging (useful for arrays)
  }:
    let
      overridesJson = builtins.toJSON overrides;
      mergeScript = if replace then ''
        echo ${lib.escapeShellArg overridesJson} > "$targetFile.tmp"
        mv "$targetFile.tmp" "$targetFile"
      '' else ''
        # Remove JSON comments (// ...) before parsing with jq
        ${pkgs.gnused}/bin/sed '/^[[:space:]]*\/\//d' "$targetFile" | \
          ${pkgs.jq}/bin/jq -s '.[0] * .[1]' - <(printf '%s' ${lib.escapeShellArg overridesJson}) > "$targetFile.tmp"
        mv "$targetFile.tmp" "$targetFile"
      '';
    in
    lib.hm.dag.entryAfter [ "writeBoundary" ] ''
      targetDir="${targetDir}"
      targetFile="$targetDir/${settingsFile}"

      ${if skipIfMissing then ''
        if [ -d "$targetDir" ]; then
          if [ -f "$targetFile" ]; then
            ${mergeScript}
          else
            echo ${lib.escapeShellArg overridesJson} > "$targetFile"
          fi
        fi
      '' else ''
        mkdir -p "$targetDir"
        if [ -f "$targetFile" ]; then
          ${mergeScript}
        else
          echo ${lib.escapeShellArg overridesJson} > "$targetFile"
        fi
      ''}
    '';
}
