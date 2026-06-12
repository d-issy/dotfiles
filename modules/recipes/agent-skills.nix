{
  config.dot.programs.agent-skills = {
    enable = true;

    defaultAgents = [
      "claude"
      "universal"
    ];

    skills = {
      interview-me.enable = true;
      pi-project-tools = {
        enable = true;
        agents.pi = true;
      };
      runbook.enable = true;
    };
  };
}
