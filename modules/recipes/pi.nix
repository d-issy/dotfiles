{
  config = {
    home.shellAliases = {
      pid = "pi --debug";
      pic = "pi --continue";
      pir = "pi --resume";
    };

    dot.home.file.".pi/agent".source = "pi/agent";
  };
}
