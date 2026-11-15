{ pkgs, lib }:

# Apply changes to managed JSON settings while preserving unmanaged keys and array entries.
#
# The target file must be plain JSON, optionally with whole-line `//` comments.
# Those comment lines are dropped when the file is rewritten. Trailing comments,
# block comments and trailing commas are not supported and abort the merge with
# an error naming the file. The target must not be a symlink.
{
  targetDir,
  settingsFile,
  overrides,
}:
let
  desired = pkgs.writeText "managed-${settingsFile}" (builtins.toJSON overrides);
  legacyStateName = "${lib.removePrefix "." (baseNameOf targetDir)}-${settingsFile}";
  stateName = "${legacyStateName}-${builtins.substring 0 8 (builtins.hashString "sha256" targetDir)}";
  filter = ''
    def missing: {"__dotfiles_merge_missing__": true};
    def reconcile($current; $previous; $desired):
      if $previous == missing and $desired == missing then $current
      elif ($desired | type) == "object" and $desired != missing then
        ($current | if type == "object" and . != missing then . else {} end) as $base |
        ($previous | if type == "object" and . != missing then . else {} end) as $old |
        reduce (($old | keys) + ($desired | keys) | unique[]) as $key ($base;
          reconcile(
            (if has($key) then .[$key] else missing end);
            (if $old | has($key) then $old[$key] else missing end);
            (if $desired | has($key) then $desired[$key] else missing end)
          ) as $value |
          if $value == missing then del(.[$key]) else .[$key] = $value end)
      elif $desired == missing then
        if ($previous | type) == "object" and ($current | type) == "object" then
          reduce ($previous | keys[]) as $key ($current;
            reconcile((if has($key) then .[$key] else missing end); $previous[$key]; missing) as $value |
            if $value == missing then del(.[$key]) else .[$key] = $value end) |
          if length == 0 then missing else . end
        elif ($previous | type) == "array" and ($current | type) == "array" then
          reconcile($current; $previous; []) | if length == 0 then missing else . end
        else if $current == $previous then missing else $current end end
      elif ($desired | type) == "array" then
        ($current | if type == "array" then . else [] end) as $base |
        ($previous | if type == "array" then . else [] end) as $old |
        reduce $old[] as $item ($base;
          if ($desired | index($item)) == null and index($item) != null then del(.[index($item)]) else . end) |
        reduce $desired[] as $item (.;
          if index($item) != null then . else . + [$item] end)
      else $desired end;
    reconcile($current[0]; $previous[0]; $desired[0])
  '';
in
lib.hm.dag.entryAfter [ "writeBoundary" ] ''
  (
    set -e
    targetDir=${lib.escapeShellArg targetDir}
    targetFile="$targetDir/${settingsFile}"
    if [ -n "''${DRY_RUN+x}" ]; then
      printf 'Would reconcile managed JSON settings in %s\n' "$targetFile"
      exit 0
    fi
    stateDir="''${XDG_STATE_HOME:-$HOME/.local/state}/dotfiles"
    stateFile="$stateDir/${stateName}"
    legacyStateFile="$stateDir/${legacyStateName}"
    if [ -L "$targetFile" ]; then
      echo "error: $targetFile is a symlink; refusing to replace it with a regular file" >&2
      exit 1
    fi
    # Fall back to the state file name used before it included the directory hash.
    previousFile="$stateFile"
    if [ ! -f "$stateFile" ] && [ -f "$legacyStateFile" ]; then
      previousFile="$legacyStateFile"
    fi
    ${pkgs.coreutils}/bin/mkdir -p "$targetDir" "$stateDir"
    tmpFile="$(${pkgs.coreutils}/bin/mktemp "$targetFile.XXXXXX")"
    tmpState="$(${pkgs.coreutils}/bin/mktemp "$stateFile.XXXXXX")"
    trap '${pkgs.coreutils}/bin/rm -f "$tmpFile" "$tmpState"' EXIT
    if ! ${pkgs.jq}/bin/jq -n \
      --slurpfile current <(if [ -f "$targetFile" ]; then ${pkgs.gnused}/bin/sed '/^[[:space:]]*\/\//d' "$targetFile"; else printf '{}'; fi) \
      --slurpfile previous <(if [ -f "$previousFile" ]; then ${pkgs.coreutils}/bin/cat "$previousFile"; else printf '{}'; fi) \
      --slurpfile desired ${desired} \
      -f ${pkgs.writeText "merge-json.jq" filter} > "$tmpFile"; then
      echo "error: failed to merge managed settings into $targetFile" >&2
      echo "hint: the file must be valid JSON; only whole-line // comments are supported" >&2
      exit 1
    fi
    if [ ! -f "$targetFile" ] || ! ${pkgs.diffutils}/bin/cmp -s "$targetFile" "$tmpFile"; then
      if [ -f "$targetFile" ]; then
        ${pkgs.coreutils}/bin/chmod --reference="$targetFile" "$tmpFile"
      else
        ${pkgs.coreutils}/bin/chmod 600 "$tmpFile"
      fi
      ${pkgs.coreutils}/bin/mv "$tmpFile" "$targetFile"
    fi
    if [ ! -f "$stateFile" ] || ! ${pkgs.diffutils}/bin/cmp -s "$stateFile" ${desired}; then
      ${pkgs.coreutils}/bin/cp ${desired} "$tmpState"
      ${pkgs.coreutils}/bin/chmod 600 "$tmpState"
      ${pkgs.coreutils}/bin/mv "$tmpState" "$stateFile"
    fi
  )
''
