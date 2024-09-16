{ config, pkgs, ... }:

{
  config = {
    home.packages = [
      pkgs.google-cloud-sdk
    ];
  };
}
