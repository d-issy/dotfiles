{ lib, files }:

{
  type = lib.types.attrsOf (
    lib.types.submodule {
      options = {
        source = lib.mkOption {
          type = lib.types.either lib.types.str (lib.types.enum [ true ]);
          description = ''
            Source path relative to dot.files. Use `true` to reuse the target
            name as the source (only valid when key == source path).
          '';
        };
        recursive = lib.mkOption {
          type = with lib.types; nullOr bool;
          default = null;
          description = "Override recursive flag. When null, auto-derived from source file type.";
        };
      };
    }
  );

  resolveEntry =
    name: entry:
    let
      srcStr = if entry.source == true then name else entry.source;
      src = files + "/${srcStr}";
    in
    {
      source = src;
      recursive =
        if entry.recursive != null then entry.recursive else builtins.readFileType src == "directory";
    };
}
