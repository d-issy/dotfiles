{
  config.dot.programs.agent-skills = {
    enable = true;

    defaultAgents = [
      "claude"
      "universal"
    ];

    skills = {
      interview-me.enable = true;
      pi-agent-user-settings = {
        enable = true;
        agents.pi = true;
      };
      runbook.enable = true;
    };
  };
}
