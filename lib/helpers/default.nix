{ pkgs, lib, ... }:

{
  json = import ./json { inherit pkgs lib; };
}
