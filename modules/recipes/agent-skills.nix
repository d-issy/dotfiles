{
  config.dot.programs.agent-skills = {
    enable = true;

    defaultAgents = [
      "claude"
      "universal"
    ];

    skills = {
      interview.enable = true;
      runbook.enable = false;
    };
  };
}
