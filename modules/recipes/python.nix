{ pkgs, ... }:

let
  pythonVariables = {
    python_file = {
      command = "${pkgs.fd}/bin/fd -t f -e py";
    };
    python_module = {
      command = "${pkgs.fd}/bin/fd -t f -e py";
      match = "^(.*)\\.py$";
      replace = [
        {
          from = "/";
          to = ".";
        }
      ];
    };
  };
in
{
  config = {
    dot.languages.python = {
      enable = false;

      pipx.enable = false;
      pipenv.enable = false;
      poetry.enable = false;
      uv.enable = false;
    };

    dot.programs.commandLibrary.groups.python.sections = [
      {
        when.commands = [ "python" ];
        variables = pythonVariables;
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
        when.commands = [ "uv" ];
        variables = pythonVariables;
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
  };
}
