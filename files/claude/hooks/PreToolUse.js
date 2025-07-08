#!/usr/bin/env node

// PreToolUse hook to block grep and find commands, suggest rg instead

const path = require("path");
const fs = require("fs");

// Configuration: Tools and commands to explicitly approve
const TOOL_APPROVALS = [
  // Git operations
  { toolName: "Bash", command: "git status" },
  { toolName: "Bash", command: "git diff" },
  { toolName: "Bash", command: "git log" },
  { toolName: "Bash", command: "git show" },
  { toolName: "Bash", command: "git add" },
  { toolName: "Bash", command: "git switch" },
  { toolName: "Bash", command: "git restore" },
  { toolName: "Bash", command: "git grep" },
  { toolName: "Bash", command: "git worktree" },
  { toolName: "Bash", command: "git pull" },

  // Package management
  { toolName: "Bash", command: "npm list" },
  { toolName: "Bash", command: "npm outdated" },
  { toolName: "Bash", command: "npm run" },
  { toolName: "Bash", command: "yarn list" },
  { toolName: "Bash", command: "pip list" },
  { toolName: "Bash", command: "pip show" },
  { toolName: "Bash", command: "go list" },
  { toolName: "Bash", command: "cargo tree" },

  // GitHub CLI
  { toolName: "Bash", command: "gh pr list" },
  { toolName: "Bash", command: "gh pr view" },
  { toolName: "Bash", command: "gh pr diff" },
  { toolName: "Bash", command: "gh pr checks" },
  { toolName: "Bash", command: "gh issue list" },
  { toolName: "Bash", command: "gh issue view" },
  { toolName: "Bash", command: "gh repo view" },
  { toolName: "Bash", command: "gh repo list" },
  { toolName: "Bash", command: "gh status" },
  { toolName: "Bash", command: "gh run list" },
  { toolName: "Bash", command: "gh run view" },
  { toolName: "Bash", command: "gh workflow list" },
  { toolName: "Bash", command: "gh release list" },
  { toolName: "Bash", command: "gh release view" },

  // GitHub API (READ-only PR comments)
  // Example: gh api repos/owner/repo/pulls/123/comments
  {
    toolName: "Bash",
    pattern: /^gh\s+api\s+repos\/[^\/]+\/[^\/]+\/pulls\/\d+\/comments$/,
    regex: true,
  },

  // Development tools
  { toolName: "Bash", command: "mkdir" },
  { toolName: "Bash", command: "make -n" },
  { toolName: "Bash", command: "docker ps" },
  { toolName: "Bash", command: "docker images" },
  { toolName: "Bash", command: "rg" },
];

// Configuration: Tools and commands to block with their replacement messages
const TOOL_RESTRICTIONS = [
  // Bash commands (simple prefix match, rg exception applies)
  {
    toolName: "Bash",
    command: "grep",
    message: `Use "rg" instead of "grep" for security (respects .gitignore). Example: rg -n pattern`,
  },
  {
    toolName: "Bash",
    command: "find",
    message: `Use "rg" instead of "find" for security (respects .gitignore). Example: rg --files --glob '*.js'`,
  },
  {
    toolName: "Bash",
    command: "cat",
    message: `Use Read tool or "rg" instead of "cat" for security`,
  },
  {
    toolName: "Bash",
    command: "head",
    message: `Use Read tool or "rg" instead of "head" for security`,
  },
  {
    toolName: "Bash",
    command: "tail",
    message: `Use Read tool or "rg" instead of "tail" for security`,
  },
  {
    toolName: "Bash",
    command: "ls",
    message: `Use "rg" instead of "ls" for security (respects .gitignore). Example: rg --files --max-depth 1`,
  },
  {
    toolName: "Bash",
    command: "git checkout",
    message: `Use "git switch" for branch switching or "git restore" for file restoration instead of "git checkout"`,
  },

  // Special git operations (regex patterns, no rg exception)
  // Example: git add .
  {
    toolName: "Bash",
    pattern: /^git\s+add\s+\.\s*$/,
    regex: true,
    message: `Use specific file paths with "git add" - never use "git add ." or "git add -A"`,
  },
  // Example: git add -A
  {
    toolName: "Bash",
    pattern: /^git\s+add\s+-A\s*$/,
    regex: true,
    message: `Use specific file paths with "git add" - never use "git add ." or "git add -A"`,
  },

  // GitHub CLI restrictions
  // Example: gh pr view --comments, gh pr view 123 --comments
  {
    toolName: "Bash",
    pattern: /^gh\s+pr\s+view\s+.*--comments/,
    regex: true,
    message: `Use "gh api repos/owner/repo/pulls/PR_NUMBER/comments" instead of "gh pr view --comments" for reliable comment retrieval`,
  },

  // Claude Code tools
  {
    toolName: "LS",
    message: `Use "rg --files --max-depth 1" instead of LS tool for security (respects .gitignore)`,
  },
  {
    toolName: "Glob",
    message: `Use "rg --files --glob 'pattern'" instead of Glob tool for security (respects .gitignore)`,
  },
];

// Configuration: Security-sensitive file patterns to block (current directory only)
const SECURITY_PATTERNS = [
  // Security files
  /id_rsa/,
  /id_ed25519/,
  /\.key$/,
  /\.pem$/,
  /\.p12$/,
  /\.pfx$/,
  /\.token$/,
  /\.secret$/,
  /\.password$/,
  /\.env/,

  // Development directories to protect
  /\.git\//,
  /\.git$/,
  /node_modules\//,
  /node_modules$/,
  /\.next\//,
  /\.next$/,
  /dist\//,
  /dist$/,
  /build\//,
  /build$/,
  /target\//,
  /target$/,
  /\.cargo\//,
  /\.cargo$/,
];

/**
 * Read JSON input from stdin
 * @returns {Promise<string>} The input string
 */
function readStdinInput() {
  return new Promise((resolve) => {
    let input = "";
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      resolve(input);
    });
  });
}

/**
 * Block a command with JSON output
 * @param {string} reason - The reason for blocking
 */
function blockCommand(reason) {
  console.log(
    JSON.stringify({
      decision: "block",
      reason: reason,
    }),
  );
  process.exit(0);
}

/**
 * Approve a command with JSON output
 * @param {string} command - The command being approved
 */
function approveCommand(command) {
  console.log(
    JSON.stringify({
      decision: "approve",
      reason: `${command} command allowed`,
    }),
  );
  process.exit(0);
}

/**
 * Check if a command should be blocked
 * @param {string} commandText - The command to check
 * @param {string} blockedCommand - The command to block (prefix match)
 * @returns {boolean} True if the command should be blocked
 */
function isBlockedCommand(commandText, blockedCommand) {
  const blockedPattern = new RegExp(`\\b${blockedCommand}\\b`);
  const allowedPattern = /\brg\b/;
  return blockedPattern.test(commandText) && !allowedPattern.test(commandText);
}

/**
 * Check if a command contains security-sensitive patterns
 * @param {string} command - The command to check
 * @returns {boolean} True if the command contains security-sensitive patterns
 */
function containsSecurityPatterns(command) {
  return SECURITY_PATTERNS.some((pattern) => pattern.test(command));
}

/**
 * Check if a path is outside the current working directory
 * @param {string} filePath - The file path to check
 * @returns {boolean} True if the path is outside the current directory
 */
function isOutsideCurrentDirectory(filePath) {
  const currentDir = process.cwd();
  const absolutePath = path.resolve(filePath);

  // Check if file/directory exists
  if (!fs.existsSync(absolutePath)) {
    return false;
  }

  // Check if the absolute path is outside the current directory
  const relativePath = path.relative(currentDir, absolutePath);
  return relativePath.startsWith("..") || path.isAbsolute(relativePath);
}

/**
 * Check if a command tries to access files outside current directory
 * @param {string} command - The command to check
 * @returns {boolean} True if the command accesses files outside current directory
 */
function accessesOutsideDirectory(command) {
  // Split command by spaces and filter out options (starting with -)
  const args = command
    .split(/\s+/)
    .filter((arg) => !arg.startsWith("-") && arg.length > 0);

  // Skip the first argument (command name)
  const paths = args.slice(1);

  // Check each path argument
  return paths.some((pathArg) => {
    // Skip if it looks like an option value or doesn't look like a path
    if (pathArg.includes("=") || pathArg.match(/^[A-Z_]+=.*/)) {
      return false;
    }

    return isOutsideCurrentDirectory(pathArg);
  });
}

/**
 * Process a command and block if necessary
 * @param {string} toolName - The name of the tool
 * @param {object} toolInput - The tool input object
 */
function processCommand(toolName, toolInput) {
  // Extract the appropriate content to check based on tool type
  let contentToCheck = "";

  if (toolName === "Bash") {
    contentToCheck = toolInput?.command || "";
  } else if (
    toolName === "Read" ||
    toolName === "Write" ||
    toolName === "Edit" ||
    toolName === "MultiEdit"
  ) {
    contentToCheck = toolInput?.file_path || "";
  } else if (toolName === "LS") {
    contentToCheck = toolInput?.path || "";
  } else if (toolName === "Glob") {
    contentToCheck = (toolInput?.path || "") + " " + (toolInput?.pattern || "");
  } else {
    contentToCheck = JSON.stringify(toolInput);
  }

  // Check for security-sensitive patterns
  if (containsSecurityPatterns(contentToCheck)) {
    blockCommand(
      `Access to security-sensitive files or directories is blocked`,
    );
  }

  // Check for outside directory access
  if (accessesOutsideDirectory(contentToCheck)) {
    blockCommand(`Access to files outside current directory is blocked`);
  }

  // Check for tool and command restrictions first
  for (const restriction of TOOL_RESTRICTIONS) {
    if (restriction.toolName === toolName) {
      if (!restriction.command && !restriction.pattern) {
        // Tool-level restriction (LS, Glob, etc.)
        blockCommand(restriction.message);
      } else if (toolName === "Bash") {
        const command = toolInput?.command || "";

        if (restriction.regex && restriction.pattern) {
          // Regex pattern match (no rg exception)
          if (restriction.pattern.test(command)) {
            blockCommand(restriction.message);
          }
        } else if (restriction.command) {
          // Simple command match (with rg exception)
          if (isBlockedCommand(command, restriction.command)) {
            blockCommand(restriction.message);
          }
        }
      }
    }
  }

  // Check for explicit approvals (lower priority than restrictions)
  for (const approval of TOOL_APPROVALS) {
    if (approval.toolName === toolName) {
      if (approval.regex && approval.pattern) {
        // Regex pattern match for approval
        if (approval.pattern.test(contentToCheck)) {
          approveCommand(approval.command || "pattern");
        }
      } else if (approval.command) {
        // Simple command match for approval
        const commandPattern = new RegExp(`\\b${approval.command}\\b`);
        if (commandPattern.test(contentToCheck)) {
          approveCommand(approval.command);
        }
      }
    }
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const input = await readStdinInput();
    const data = JSON.parse(input);
    const toolName = data.tool_name;

    processCommand(toolName, data.tool_input);

    // Allow all other commands to proceed (no output = continue as normal)
    process.exit(0);
  } catch (error) {
    // If JSON parsing fails, allow the command to proceed
    process.exit(0);
  }
}

// Start the hook
main();
