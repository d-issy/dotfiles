{
  config = {
    home.shellAliases = {
      pid = "pi";
      pic = "pi --continue";
      pir = "pi --resume";
    };

    dot.home.file.".pi/agent".source = "pi/agent";
  };
}
