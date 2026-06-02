{
  config.dot.programs.navi.cheats.nix.sections = [
    {
      tags = [ "nix switch" ];
      entries = [
        {
          description = "switch home-manager configuration for this machine";
          command = "nix run .#switch";
        }
      ];
    }
    {
      tags = [ "nix flake" ];
      entries = [
        {
          description = "update all flake inputs";
          command = "nix flake update";
        }
        {
          description = "check flake without building derivations";
          command = "nix flake check --no-build";
        }
        {
          description = "show flake outputs";
          command = "nix flake show";
        }
      ];
    }
    {
      tags = [ "nix generations" ];
      entries = [
        {
          description = "list home-manager generations";
          command = "nix run .#generations";
        }
      ];
    }
    {
      tags = [ "nix gc" ];
      entries = [
        {
          description = "expire old generations and garbage collect";
          command = "nix run .#gc";
        }
      ];
    }
  ];
}
