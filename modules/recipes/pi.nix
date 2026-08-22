{
  config = {
    home.shellAliases = {
      pic = "pi --continue";
      pir = "pi --resume";
    };

    dot.home.file.".pi/agent".source = "pi/agent";
  };
}
