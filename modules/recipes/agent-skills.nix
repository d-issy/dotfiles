{
  config.dot.programs.agent-skills = {
    enable = true;

    defaultAgents = [
      "claude"
      "universal"
    ];

    skills = {
      pi-agent-user-settings = {
        enable = true;
        agents.pi = true;
      };
      pi-customization = {
        enable = true;
        agents.pi = true;
      };
      runbook.enable = true;
    };
  };
}
