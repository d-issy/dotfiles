_:

{
  dot.programs.codex = {
    enable = true;

    settings = {
      # 272,000 tokens × 97.5% (default: 95% = 258,400 tokens).
      model_auto_compact_token_limit = 265200;
      tui.status_line = [
        "model-with-reasoning"
        "context-remaining"
        "weekly-limit"
      ];
      # Increase concurrent threads from the default of 4 to 16.
      agents.max_concurrent_threads_per_session = 16;
    };

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
  };
}
