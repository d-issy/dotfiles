{ config, pkgs, ... }: {
  config = {
    home.file.".claude" = {
      source = ../files/claude;
      recursive = true;
    };
  };
}

