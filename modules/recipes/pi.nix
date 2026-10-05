{
  config,
  dot,
  ...
}:
{
  config = {
    home = {
      shellAliases = {
        pic = "pi --continue";
        pir = "pi --resume";
      };

      activation.piSettings = dot.mergeJson {
        targetDir = "${config.home.homeDirectory}/.pi/agent";
        settingsFile = "settings.json";
        overrides = {
          tuiMode = "regular";
          defaultTools = [ "+codemode" ];
          codemode.mode = "only";
        };
      };
    };

    dot.home.file.".pi/agent".source = "pi/agent";
  };
}
