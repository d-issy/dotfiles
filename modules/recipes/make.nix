{ pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.gnumake ];

    dot.programs.commandLibrary.groups.make.sections = [
      {
        when.files = [
          "GNUmakefile"
          "makefile"
          "Makefile"
        ];
        variables.target = {
          command = "${pkgs.gnumake}/bin/make -qp";
          match = "^([a-z0-9][^:\\s]*)\\s*:([^=]|$)";
          unique = true;
          sort = true;
        };
        entries = [
          {
            description = "run make target";
            alias = "make";
            command = "make <target>";
          }
        ];
      }
    ];
  };
}
