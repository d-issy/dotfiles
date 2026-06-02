{ pkgs, ... }:

{
  config.dot.programs.navi.cheats.python.sections = [
    {
      variables = {
        python_file = ''${pkgs.fd}/bin/fd -t f -e py --- --fzf-overrides "--no-select-1"'';
        python_module = ''${pkgs.fd}/bin/fd -t f -e py | ${pkgs.gnused}/bin/sed -e 's|\.py$||' -e 's|/|.|g' --- --fzf-overrides "--no-select-1"'';
      };
      entries = [
        {
          description = "Run python script";
          command = "python <python_file>";
        }
        {
          description = "Run python module";
          command = "python -m <python_module>";
        }
      ];
    }
    {
      tags = [ "uv" ];
      variables = {
        python_file = ''${pkgs.fd}/bin/fd -t f -e py --- --fzf-overrides "--no-select-1"'';
        python_module = ''${pkgs.fd}/bin/fd -t f -e py | ${pkgs.gnused}/bin/sed -e 's|\.py$||' -e 's|/|.|g' --- --fzf-overrides "--no-select-1"'';
      };
      entries = [
        {
          description = "Initialize new project";
          command = "uv init <project_name>";
        }
        {
          description = "Add package";
          command = "uv add <package>";
        }
        {
          description = "Add dev package";
          command = "uv add --dev <package>";
        }
        {
          description = "Remove package";
          command = "uv remove <package>";
        }
        {
          description = "Sync dependencies";
          command = "uv sync";
        }
        {
          description = "Lock dependencies";
          command = "uv lock";
        }
        {
          description = "Run python script with uv";
          command = "uv run python <python_file>";
        }
        {
          description = "Run python module with uv";
          command = "uv run python -m <python_module>";
        }
        {
          description = "Run command in virtual environment";
          command = "uv run <command>";
        }
      ];
    }
  ];
}
