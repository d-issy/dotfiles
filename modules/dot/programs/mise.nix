{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.mise;
  tomlFormat = pkgs.formats.toml { };
  nushellCacheDir = "${config.xdg.cacheHome}/mise";
  nushellActivation = "${nushellCacheDir}/activate.nu";

  idiomaticVersionFileTools = {
    python.files = [ ".python-version" ];
    node.files = [
      ".node-version"
      ".nvmrc"
    ];
    ruby.files = [
      ".ruby-version"
      "Gemfile"
    ];
    java.files = [ ".java-version" ];
    go.files = [ ".go-version" ];
    terraform.files = [ ".terraform-version" ];
    elixir.files = [ ".exenv-version" ];
  };

  enabledIdiomaticVersionFileTools = lib.attrNames (
    lib.filterAttrs (tool: _: cfg.idiomaticVersionFiles.${tool}.enable) idiomaticVersionFileTools
  );
  idiomaticVersionFileSettings = lib.optionalAttrs (enabledIdiomaticVersionFileTools != [ ]) {
    idiomatic_version_file_enable_tools = enabledIdiomaticVersionFileTools;
  };
  globalConfig = lib.optionalAttrs (cfg.settings != { } || idiomaticVersionFileSettings != { }) {
    settings = cfg.settings // idiomaticVersionFileSettings;
  };

  mkIdiomaticVersionFileOptions =
    tool:
    { files }:
    {
      enable = lib.mkEnableOption "reading ${tool}'s idiomatic version files (${lib.concatStringsSep ", " files})";
    };
in
{
  options.dot.programs.mise = {
    enable = lib.mkEnableOption "mise";

    package = lib.mkPackageOption pkgs "mise" { nullable = true; };

    zshIntegration.enable = lib.mkEnableOption "zsh integration";

    nushellIntegration.enable = lib.mkEnableOption "nushell integration";

    idiomaticVersionFiles = lib.mapAttrs mkIdiomaticVersionFileOptions idiomaticVersionFileTools;

    settings = lib.mkOption {
      type = lib.types.attrs;
      default = { };
      description = "Additional mise settings written under settings in mise/config.toml.";
    };
  };

  config = lib.mkIf cfg.enable {
    warnings =
      lib.optional (cfg.package == null && (cfg.zshIntegration.enable || cfg.nushellIntegration.enable))
        ''
          You have enabled shell integration for `dot.programs.mise` but have not set `package`.

          The shell integration will not be added.
        '';

    home.packages = lib.mkIf (cfg.package != null) [ cfg.package ];

    xdg.configFile."mise/config.toml" = lib.mkIf (globalConfig != { }) {
      source = tomlFormat.generate "mise-config" globalConfig;
    };

    programs = {
      zsh.initContent = lib.mkIf (cfg.zshIntegration.enable && cfg.package != null) ''
        eval "$(${lib.getExe cfg.package} activate zsh)"
      '';

      nushell = lib.mkIf (cfg.nushellIntegration.enable && cfg.package != null) {
        # Mise captures PATH and HOME when generating its activation script.
        # Generate it before config.nu is parsed, using the live shell environment.
        extraEnv = ''
          mkdir ${builtins.toJSON nushellCacheDir}
          ^${lib.getExe cfg.package} activate nu | save --force ${builtins.toJSON nushellActivation}
        '';
        extraConfig = ''
          use ${builtins.toJSON nushellActivation}
        '';
      };
    };
  };
}
