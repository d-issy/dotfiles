{ pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.gnumake ];

    dot.programs.navi.cheats.make.sections = [
      {
        entries = [
          {
            description = "run make";
            command = "make <target>";
          }
        ];
        variables.target = ''make -qp | awk -F':' '/^[a-z0-9][^:]*\s*:([^=]|$)/ {print $1}' | sort -u'';
      }
    ];
  };
}
