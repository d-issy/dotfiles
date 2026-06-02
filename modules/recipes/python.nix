{
  config.dot.programs.navi.cheats.python.sections = [
    {
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
      variables = {
        python_file = ''find . -type f -name '*.py' -not -path '*/__pycache__/*' -not -path '*/__init__.py' | sed 's|^\./||' --- --fzf-overrides '--no-select-1'';
        python_module = ''find . -type f -name '*.py' -not -path '*/__pycache__/*' -not -path '*/__init__.py' -not -path '*test*' | sed -e 's|^\./||' -e 's|\.py$||' -e 's|/|.|g' --- --fzf-overrides '--no-select-1'';
      };
    }
    {
      tags = [ "uv" ];
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
      variables = {
        python_file = ''find . -type f -name '*.py' -not -path '*/__pycache__/*' -not -path '*/__init__.py' | sed 's|^\./||' --- --fzf-overrides '--no-select-1'';
        python_module = ''find . -type f -name '*.py' -not -path '*/__pycache__/*' -not -path '*/__init__.py' -not -path '*test*' | sed -e 's|^\./||' -e 's|\.py$||' -e 's|/|.|g' --- --fzf-overrides '--no-select-1'';
      };
    }
  ];
}
