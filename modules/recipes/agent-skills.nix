{
  config.dot.programs.agent-skills = {
    enable = true;

    defaultTargets = [
      "claude"
      "universal"
    ];

    skills = {
      manage-agent-skills = {
        enable = true;
        name = "Manage Agent Skills";
        description = "Use when adding, splitting, merging, or refining reusable agent skills under files/agent-skills in this dotfiles repository.";

        summary = "Maintain agent skills in this dotfiles repository";
        starterPrompt = "Use {skill} to add or refine an agent skill in this repository.";
        invocation.model = false;
      };
      manage-pull-request = {
        enable = true;
        name = "Manage Pull Request";
        description = "Always use this skill alongside any skill or workflow that creates, drafts, publishes, updates, checks, or reviews a GitHub pull request.";

        summary = "Always apply to GitHub pull request workflows";
        starterPrompt = "Always use {skill} alongside any skill or workflow that creates, drafts, publishes, updates, checks, or reviews a GitHub pull request.";
      };
      openspec = {
        enable = true;
        name = "OpenSpec";
        description = "Use when planning or implementing a change with OpenSpec, including checking a change's status, applying its tasks, or validating its artifacts.";

        summary = "Plan and implement changes with OpenSpec";
        starterPrompt = "Use {skill} to plan and implement this change with OpenSpec.";
      };
    };
  };
}
