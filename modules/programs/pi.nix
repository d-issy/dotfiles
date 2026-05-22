{ dotfiles, ... }:

{
  config = {
    home.file.".pi/agent" = {
      source = (dotfiles.files + "/pi/agent");
      recursive = true;
    };
  };
}
