{
  config,
  dot,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.agent-skills;

  agentTargets = {
    claude = ".claude/skills";
    cursor = ".cursor/skills";
    pi = ".pi/agent/skills";
    universal = ".agents/skills";
  };

  agentNames = lib.attrNames agentTargets;

  mkSkillMarkdown =
    agentName: skillName: skill:
    pkgs.writeText "agent-skill-${skillName}-${agentName}.md" ''
      ---
      name: ${builtins.toJSON skillName}
      description: ${builtins.toJSON skill.description}
      ${
        lib.optionalString (agentName == "claude") ''
          disable-model-invocation: ${lib.boolToString (!skill.invocation.model)}
          user-invocable: ${lib.boolToString skill.invocation.user}
        ''
      }---
      ${builtins.readFile (dot.files + "/agent-skills/${skillName}/SKILL.md")}
    '';

  mkOpenAIYaml =
    skillName: skill:
    pkgs.writeText "agent-skill-${skillName}-openai.yaml" ''
      interface:
        display_name: ${builtins.toJSON skill.name}
        short_description: ${builtins.toJSON skill.summary}
        default_prompt: ${
          builtins.toJSON (lib.replaceStrings [ "{skill}" ] [ ("$" + skillName) ] skill.starterPrompt)
        }
      policy:
        allow_implicit_invocation: ${lib.boolToString skill.invocation.model}
    '';

  mkSkillSource =
    agentName: skillName: skill:
    let
      source = dot.files + "/agent-skills/${skillName}";
    in
    pkgs.runCommandLocal "agent-skill-${skillName}-${agentName}" { } ''
      cp -R ${source} "$out"
      chmod -R u+w "$out"
      cp ${mkSkillMarkdown agentName skillName skill} "$out/SKILL.md"

      ${lib.optionalString (agentName == "universal") ''
        mkdir -p "$out/agents"
        cp ${mkOpenAIYaml skillName skill} "$out/agents/openai.yaml"
      ''}
    '';

  mkSkillEntry =
    agentName: skillName: skill:
    let
      target = agentTargets.${agentName};
    in
    lib.nameValuePair "${target}/${skillName}" {
      source = mkSkillSource agentName skillName skill;
      recursive = false;
    };

  enabledSkills = lib.filterAttrs (_: skill: skill.enable) cfg.skills;

  skillTargets = skill: if skill.targets == null then cfg.defaultTargets else skill.targets;

  mkSkillEntries =
    skillName: skill:
    map (agentName: mkSkillEntry agentName skillName skill) (lib.unique (skillTargets skill));
in
{
  options.dot.programs.agent-skills = {
    enable = lib.mkEnableOption "agent skills";

    defaultTargets = lib.mkOption {
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
            name = lib.mkOption {
              type = lib.types.str;
              description = "Human-facing skill name.";
            };
            description = lib.mkOption {
              type = lib.types.str;
              description = "What the skill does and when agents should use it.";
            };
            summary = lib.mkOption {
              type = lib.types.str;
              description = "Short user-facing summary of the skill.";
            };
            starterPrompt = lib.mkOption {
              type = lib.types.str;
              description = "User-facing starter prompt. Use {skill} where target-specific invocation syntax belongs.";
            };
            invocation = lib.mkOption {
              type = lib.types.submodule {
                options = {
                  user = lib.mkOption {
                    type = lib.types.bool;
                    default = true;
                    description = "Whether users may invoke the skill explicitly.";
                  };
                  model = lib.mkOption {
                    type = lib.types.bool;
                    default = true;
                    description = "Whether models may invoke the skill automatically.";
                  };
                };
              };
              default = { };
              description = "Who may invoke the skill.";
            };
            targets = lib.mkOption {
              type = lib.types.nullOr (lib.types.listOf (lib.types.enum agentNames));
              default = null;
              description = "Agent targets for this skill. When null, defaultTargets is used.";
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
          name = "My Skill";
          description = "Use when running my reusable workflow.";
          summary = "Run my reusable workflow";
          starterPrompt = "Use {skill} to run my reusable workflow.";
          invocation = {
            user = true;
            model = false;
          };
          targets = [ "claude" ];
        };
      };
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = lib.concatLists (
      lib.mapAttrsToList (skillName: skill: [
        {
          assertion = skill.invocation.user || skill.invocation.model;
          message = "dot.programs.agent-skills.skills.${skillName} must allow user or model invocation.";
        }
        {
          assertion = lib.hasInfix "{skill}" skill.starterPrompt;
          message = "dot.programs.agent-skills.skills.${skillName}.starterPrompt must contain {skill}.";
        }
      ]) enabledSkills
    );

    home.file = builtins.listToAttrs (
      lib.concatLists (lib.mapAttrsToList mkSkillEntries enabledSkills)
    );
  };
}
