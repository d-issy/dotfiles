{
  home.file.".codex/hooks.json".text =
    builtins.toJSON {
      hooks.Stop = [
        {
          hooks = [
            {
              type = "command";
              command = "tmux-notice on codex-wait >/dev/null 2>&1 || true";
              timeout = 5;
            }
          ];
        }
      ];
    }
    + "\n";
}
