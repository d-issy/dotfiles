{ config, lib, ... }:

let
  cfg = config.dot.programs.agent-skills;

  agentTargets = {
    claude = ".claude/skills";
    cursor = ".cursor/skills";
    pi = ".pi/agent/skills";
    universal = ".agents/skills";
  };

  agentNames = lib.attrNames agentTargets;

  mkSkillEntry =
    target: skillName:
    lib.nameValuePair "${target}/${skillName}" {
      source = "agent-skills/${skillName}";
      recursive = true;
    };

  enabledSkills = lib.filterAttrs (_: skill: skill.enable) cfg.skills;

  skillAgents = skill: if skill.agents == null then cfg.defaultAgents else skill.agents;

  mkSkillEntries =
    skillName: skill:
    map (agentName: mkSkillEntry agentTargets.${agentName} skillName) (lib.unique (skillAgents skill));
in
{
  options.dot.programs.agent-skills = {
    enable = lib.mkEnableOption "agent skills";

    defaultAgents = lib.mkOption {
      type = lib.types.listOf (lib.types.enum agentNames);
      default = [ ];
      description = "Default agent targets for enabled skills.";
      example = [
        "claude"
        "universal"
      ];
    };

    skills = lib.mkOption {
      type = lib.types.attrsOf (
        lib.types.submodule {
          options = {
            enable = lib.mkEnableOption "this agent skill";
            agents = lib.mkOption {
              type = lib.types.nullOr (lib.types.listOf (lib.types.enum agentNames));
              default = null;
              description = "Agent targets for this skill. When null, defaultAgents is used.";
              example = [ "pi" ];
            };
          };
        }
      );
      default = { };
      description = "Agent skills to install from files/agent-skills.";
      example = {
        "my-skill" = {
          enable = true;
          agents = [ "pi" ];
        };
      };
    };
  };

  config = lib.mkIf cfg.enable {
    dot.home.file = builtins.listToAttrs (
      lib.concatLists (lib.mapAttrsToList mkSkillEntries enabledSkills)
    );
  };
}
