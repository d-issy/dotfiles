{ pkgs, lib }:

# Apply changes to managed JSON settings while preserving unmanaged keys and array entries.
{
  targetDir,
  settingsFile,
  overrides,
}:
let
  desired = pkgs.writeText "managed-${settingsFile}" (builtins.toJSON overrides);
  stateName = "${lib.removePrefix "." (builtins.baseNameOf targetDir)}-${settingsFile}";
  filter = ''
    def missing: {"__dotfiles_merge_missing__": true};
    def reconcile($current; $previous; $desired):
      if $previous == $desired then $current
      elif ($desired | type) == "object" and $desired != missing then
        ($current | if type == "object" then . else {} end) as $base |
        ($previous | if type == "object" then . else {} end) as $old |
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
          if ($old | index($item)) != null or index($item) != null then . else . + [$item] end)
      else $desired end;
    reconcile($current[0]; $previous[0]; $desired[0])
  '';
in
lib.hm.dag.entryAfter [ "writeBoundary" ] ''
  (
    set -e
    targetDir=${lib.escapeShellArg targetDir}
    targetFile="$targetDir/${settingsFile}"
    stateDir="''${XDG_STATE_HOME:-$HOME/.local/state}/dotfiles"
    stateFile="$stateDir/${stateName}"
    ${pkgs.coreutils}/bin/mkdir -p "$targetDir" "$stateDir"
    tmpFile="$(${pkgs.coreutils}/bin/mktemp "$targetFile.XXXXXX")"
    tmpState="$(${pkgs.coreutils}/bin/mktemp "$stateFile.XXXXXX")"
    trap '${pkgs.coreutils}/bin/rm -f "$tmpFile" "$tmpState"' EXIT
    ${pkgs.jq}/bin/jq -n \
      --slurpfile current <(if [ -f "$targetFile" ]; then ${pkgs.gnused}/bin/sed '/^[[:space:]]*\/\//d' "$targetFile"; else printf '{}'; fi) \
      --slurpfile previous <(if [ -f "$stateFile" ]; then ${pkgs.coreutils}/bin/cat "$stateFile"; else printf '{}'; fi) \
      --slurpfile desired ${desired} \
      -f ${pkgs.writeText "merge-json.jq" filter} > "$tmpFile"
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
