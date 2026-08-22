{
  config.dot.programs.agent-skills = {
    enable = true;

    defaultAgents = [
      "claude"
      "universal"
    ];

    skills = {
      copy-to-clipboard.enable = true;
      delegate-to-agent.enable = true;
      manage-agent-skills.enable = true;
      manage-pull-request.enable = true;
      openspec.enable = true;
    };
  };
}
