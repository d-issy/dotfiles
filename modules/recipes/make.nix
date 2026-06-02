{ pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.gnumake ];

    dot.programs.navi.cheats.make.sections = [
      {
        variables.target = ''${pkgs.gnumake}/bin/make -qp | ${pkgs.gawk}/bin/awk -F':' '/^[a-z0-9][^:]*\s*:([^=]|$)/ {print $1}' | ${pkgs.coreutils}/bin/sort -u'';
        entries = [
          {
            description = "run make";
            command = "make <target>";
          }
        ];
      }
    ];
  };
}
