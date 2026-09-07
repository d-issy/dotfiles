{
  config.dot.programs.agent-skills = {
    enable = true;

    defaultTargets = [
      "claude"
      "universal"
    ];

    skills = {
      manage-pull-request = {
        enable = true;
        name = "Manage Pull Request";
        description = "Always use when creating, drafting, publishing, updating, checking, or reviewing GitHub pull requests alongside any other PR skill or workflow.";

        summary = "Always apply to GitHub pull request workflows";
        starterPrompt = "Always use {skill} alongside any skill or workflow that creates, drafts, publishes, updates, checks, or reviews a GitHub pull request.";
      };
      orchestrate-subagents = {
        enable = true;
        name = "Orchestrate Subagents";
        description = "Use when Pi should delegate independent work to Claude, Codex, Cursor, or other coding agents in Herdr panes and synthesize their results.";

        summary = "Delegate work to agents in managed Herdr panes";
        starterPrompt = "Use {skill} to delegate independent work to subagents and synthesize the results.";
        invocation.model = false;
        targets = [ "pi" ];
      };
      openspec = {
        enable = true;
        name = "OpenSpec";
        description = "Use when planning or implementing a change with OpenSpec, including checking a change's status, applying its tasks, or validating its artifacts.";

        summary = "Plan and implement changes with OpenSpec";
        starterPrompt = "Use {skill} to plan and implement this change with OpenSpec.";
        invocation.model = false;
      };
    };
  };
}
