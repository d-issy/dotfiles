{ dot, ... }:

{
  config = {
    home.file.".pi/agent" = {
      source = dot.files + "/pi/agent";
      recursive = true;
    };
  };
}
