use serde::Deserialize;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};

const VERSION: &str = "1.0.0";

const RED: &str = "\x1b[0;31m";
const GREEN: &str = "\x1b[0;32m";
const YELLOW: &str = "\x1b[0;33m";
const BLUE: &str = "\x1b[0;34m";
const RESET: &str = "\x1b[0m";

const MAX_DIFF_BYTES: usize = 204_800;

const HELP: &str = "git-auto-commit - AI-powered commit message generator using Pi CLI

Usage: git auto-commit [options]

Options:
  -h, --help     Show this help message
  -v, --version  Show version
  -d, --direct   Skip branch protection and commit directly to main/master

Requirements:
  - pi CLI must be installed and authenticated
  - Changes must be staged (git add)
  - On main/master, will ask before committing (use -d to skip)

Example:
  git add .
  git auto-commit
  git auto-commit -d   # commit directly to main/master
";

const COMMIT_PROMPT: &str = "Generate a git commit message for the following staged changes.

Rules:
- Use Conventional Commits format: type(scope): description
- Types: feat, fix, update, remove, docs, ci, test, chore, refactor
- Scope is optional, derive from file paths if clear
- Title: concise (under 50 chars)
- Body: optional, only if needed. Use short bullet points (2-4 items max)

IMPORTANT: Respond with ONLY the commit message itself. No explanation, no reasoning, no code blocks, no signatures (like \"Generated with Pi\" or \"Co-Authored-By\").

Staged changes:";

const BRANCH_PROMPT: &str = "Generate a git branch name for the following staged changes.

Rules:
- Use kebab-case (lowercase with hyphens)
- Keep it short and descriptive (2-4 words)
- No prefix like feature/ or fix/

IMPORTANT: Respond with ONLY the branch name itself. No explanation, no reasoning, no formatting.

Staged changes:";

#[derive(Deserialize)]
struct Config {
    pi_args: Vec<String>,
    diff_pathspecs: Vec<String>,
}

/// Process exit code carried up as an error.
#[derive(Debug, PartialEq)]
struct Exit(i32);

type Res<T> = Result<T, Exit>;

#[derive(Debug, PartialEq)]
enum Parsed {
    Help,
    Version,
    Run { direct: bool },
    Unknown(String),
}

fn parse_args(args: &[String]) -> Parsed {
    let mut direct = false;
    for arg in args {
        match arg.as_str() {
            "-h" | "--help" => return Parsed::Help,
            "-v" | "--version" => return Parsed::Version,
            "-d" | "--direct" => direct = true,
            other => return Parsed::Unknown(other.to_string()),
        }
    }
    Parsed::Run { direct }
}

/// Emulates bash `echo -e`: interprets backslash escapes and appends a newline
/// unless `\c` is seen.
fn echo_e(s: &str) -> Vec<u8> {
    let b = s.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < b.len() {
        if b[i] != b'\\' || i + 1 >= b.len() {
            out.push(b[i]);
            i += 1;
            continue;
        }
        let c = b[i + 1];
        i += 2;
        match c {
            b'a' => out.push(7),
            b'b' => out.push(8),
            b'c' => return out,
            b'e' | b'E' => out.push(27),
            b'f' => out.push(12),
            b'n' => out.push(b'\n'),
            b'r' => out.push(b'\r'),
            b't' => out.push(b'\t'),
            b'v' => out.push(11),
            b'\\' => out.push(b'\\'),
            b'0' => {
                let mut v: u32 = 0;
                let mut n = 0;
                while n < 3 && i < b.len() && (b'0'..=b'7').contains(&b[i]) {
                    v = v * 8 + u32::from(b[i] - b'0');
                    i += 1;
                    n += 1;
                }
                out.push((v & 0xff) as u8);
            }
            b'x' | b'u' | b'U' => {
                let max = match c {
                    b'x' => 2,
                    b'u' => 4,
                    _ => 8,
                };
                let mut v: u32 = 0;
                let mut n = 0;
                while n < max && i < b.len() && b[i].is_ascii_hexdigit() {
                    v = v.wrapping_mul(16) + (b[i] as char).to_digit(16).unwrap_or(0);
                    i += 1;
                    n += 1;
                }
                if n == 0 {
                    out.push(b'\\');
                    out.push(c);
                } else if c == b'x' {
                    out.push((v & 0xff) as u8);
                } else if let Some(ch) = char::from_u32(v) {
                    let mut buf = [0u8; 4];
                    out.extend_from_slice(ch.encode_utf8(&mut buf).as_bytes());
                }
            }
            other => {
                out.push(b'\\');
                out.push(other);
            }
        }
    }
    out.push(b'\n');
    out
}

fn say(s: &str) {
    let mut out = std::io::stdout();
    let _ = out.write_all(&echo_e(s));
    let _ = out.flush();
}

fn is_space(c: char) -> bool {
    matches!(c, ' ' | '\t' | '\n' | '\x0b' | '\x0c' | '\r')
}

/// Emulates the trailing-newline stripping of bash command substitution.
fn strip_trailing_newlines(s: &str) -> &str {
    s.trim_end_matches('\n')
}

fn commit_prompt(diff: &[u8], instruction: &str) -> Vec<u8> {
    let mut p = Vec::new();
    p.extend_from_slice(COMMIT_PROMPT.as_bytes());
    p.extend_from_slice(b"\n\n");
    p.extend_from_slice(diff);
    p.push(b'\n');
    push_instruction(&mut p, instruction);
    p
}

fn branch_prompt(stat: &[u8], instruction: &str) -> Vec<u8> {
    let mut p = Vec::new();
    p.extend_from_slice(BRANCH_PROMPT.as_bytes());
    p.extend_from_slice(b"\n\n");
    p.extend_from_slice(stat);
    push_instruction(&mut p, instruction);
    p
}

fn push_instruction(p: &mut Vec<u8>, instruction: &str) {
    if !instruction.is_empty() {
        p.extend_from_slice(format!("\nAdditional instruction: {instruction}\n").as_bytes());
    }
}

fn diff_args(pathspecs: &[String]) -> Vec<String> {
    let mut args: Vec<String> = ["diff", "--staged", "--"]
        .iter()
        .map(|s| (*s).to_string())
        .collect();
    args.extend(pathspecs.iter().cloned());
    args
}

/// Cleans model output into a branch name: first non-fence, non-blank line,
/// quotes/backticks removed, whitespace collapsed to hyphens.
fn sanitize_branch_name(output: &str) -> String {
    let line = output
        .split('\n')
        .find(|l| {
            let t = l.trim_start_matches(is_space);
            !t.starts_with("```") && !t.chars().all(is_space)
        })
        .unwrap_or("");
    let line: String = line
        .chars()
        .filter(|c| !matches!(c, '`' | '"' | '\''))
        .collect();
    let mut out = String::new();
    let mut in_space = false;
    for c in line.trim_matches(is_space).chars() {
        if is_space(c) {
            in_space = true;
        } else {
            if in_space {
                out.push('-');
                in_space = false;
            }
            out.push(c);
        }
    }
    out.trim_matches('-').to_string()
}

fn first_is(response: &str, set: &str) -> bool {
    response.chars().next().is_some_and(|c| set.contains(c))
}

fn status_color(status: &str) -> Option<&'static str> {
    match status {
        "A" => Some(GREEN),
        "D" => Some(RED),
        "M" => Some(YELLOW),
        _ => None,
    }
}

fn format_staged_line(line: &str) -> String {
    let (status, path) = line.split_once('\t').unwrap_or((line, ""));
    match status_color(status) {
        Some(color) => format!("  {color}{status}{RESET} {path}"),
        None => format!("  {status} {path}"),
    }
}

fn strip_remote_head(head: &str) -> &str {
    head.strip_prefix("refs/remotes/origin/").unwrap_or(head)
}

struct Tty(Option<File>);

impl Tty {
    fn open() -> Res<File> {
        OpenOptions::new()
            .read(true)
            .write(true)
            .open("/dev/tty")
            .map_err(|e| {
                eprintln!("/dev/tty: {e}");
                Exit(1)
            })
    }

    /// Emulates `read -r -p PROMPT var </dev/tty`: prompt on stderr, value
    /// trimmed of surrounding blanks, EOF is fatal.
    fn read(&mut self, prompt: &str) -> Res<String> {
        if self.0.is_none() {
            self.0 = Some(Self::open()?);
        }
        eprint!("{prompt}");
        let _ = std::io::stderr().flush();
        let file = self.0.as_mut().ok_or(Exit(1))?;
        let mut line = Vec::new();
        let mut byte = [0u8; 1];
        loop {
            match file.read(&mut byte) {
                Ok(1) => {
                    if byte[0] == b'\n' {
                        break;
                    }
                    line.push(byte[0]);
                }
                _ => return Err(Exit(1)),
            }
        }
        Ok(String::from_utf8_lossy(&line)
            .trim_matches(is_space)
            .to_string())
    }
}

fn git_output(args: &[String]) -> Res<Vec<u8>> {
    let out = Command::new("git")
        .args(args)
        .stdin(Stdio::inherit())
        .stderr(Stdio::inherit())
        .output()
        .map_err(|e| {
            eprintln!("git: {e}");
            Exit(127)
        })?;
    if out.status.success() {
        Ok(out.stdout)
    } else {
        Err(Exit(out.status.code().unwrap_or(1)))
    }
}

fn git_quiet_ok(args: &[&str]) -> bool {
    Command::new("git")
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|s| s.success())
}

fn git_text(args: &[&str]) -> Res<String> {
    let args: Vec<String> = args.iter().map(|s| (*s).to_string()).collect();
    let out = git_output(&args)?;
    Ok(strip_trailing_newlines(&String::from_utf8_lossy(&out)).to_string())
}

fn detect_main_branch() -> String {
    let head = Command::new("git")
        .args(["symbolic-ref", "refs/remotes/origin/HEAD"])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output();
    if let Ok(out) = head
        && out.status.success()
    {
        let text = String::from_utf8_lossy(&out.stdout);
        return strip_remote_head(strip_trailing_newlines(&text)).to_string();
    }
    for branch in ["main", "master"] {
        if git_quiet_ok(&[
            "show-ref",
            "--verify",
            "--quiet",
            &format!("refs/heads/{branch}"),
        ]) {
            return branch.to_string();
        }
    }
    "main".to_string()
}

fn command_exists(name: &str) -> bool {
    let Some(path) = std::env::var_os("PATH") else {
        return false;
    };
    std::env::split_paths(&path).any(|dir| {
        let p = dir.join(name);
        p.is_file()
            && fs::metadata(&p).is_ok_and(|m| {
                use std::os::unix::fs::PermissionsExt;
                m.permissions().mode() & 0o111 != 0
            })
    })
}

/// Runs pi with the prompt on stdin. Returns stdout with trailing newlines
/// stripped; on failure replays pi's stderr and exits 1.
fn run_pi(cfg: &Config, prompt: Vec<u8>) -> Res<String> {
    let mut child = Command::new("pi")
        .args(&cfg.pi_args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            eprintln!("pi: {e}");
            Exit(1)
        })?;
    let stdin = child.stdin.take();
    let writer = std::thread::spawn(move || {
        if let Some(mut stdin) = stdin {
            let _ = stdin.write_all(&prompt);
        }
    });
    let out = child.wait_with_output().map_err(|_| Exit(1))?;
    let _ = writer.join();
    if !out.status.success() {
        let _ = std::io::stderr().write_all(&out.stderr);
        return Err(Exit(1));
    }
    Ok(strip_trailing_newlines(&String::from_utf8_lossy(&out.stdout)).to_string())
}

fn generate_commit_message(cfg: &Config, diff: &[u8], instruction: &str) -> Res<String> {
    run_pi(cfg, commit_prompt(diff, instruction))
}

fn generate_branch_name(cfg: &Config, instruction: &str) -> Res<String> {
    let stat = git_output(&["diff".into(), "--staged".into(), "--stat".into()])?;
    let out = run_pi(cfg, branch_prompt(&stat, instruction))?;
    Ok(sanitize_branch_name(&out))
}

/// Returns an empty string when the user cancels (content unchanged or empty).
fn edit_with_editor(initial: &str) -> String {
    let dir = std::env::temp_dir();
    let mut path = PathBuf::new();
    let mut file = None;
    for n in 0..100 {
        path = dir.join(format!("git-auto-commit.{}.{n}", std::process::id()));
        if let Ok(f) = OpenOptions::new().write(true).create_new(true).open(&path) {
            file = Some(f);
            break;
        }
    }
    let Some(mut file) = file else {
        return String::new();
    };
    let _ = writeln!(file, "{initial}");
    drop(file);

    let editor = std::env::var("VISUAL")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| std::env::var("EDITOR").ok().filter(|s| !s.is_empty()))
        .unwrap_or_else(|| "vim".to_string());
    let mut words = editor.split(is_space).filter(|w| !w.is_empty());
    if let Some(prog) = words.next() {
        let tty_in = OpenOptions::new().read(true).open("/dev/tty");
        let tty_out = OpenOptions::new().write(true).open("/dev/tty");
        if let (Ok(i), Ok(o)) = (tty_in, tty_out) {
            let _ = Command::new(prog)
                .args(words)
                .arg(&path)
                .stdin(i)
                .stdout(o)
                .status();
        }
    }

    let content = fs::read(&path).unwrap_or_default();
    let _ = fs::remove_file(&path);
    let content = String::from_utf8_lossy(&content);
    let result = strip_trailing_newlines(&content);
    if result == initial {
        String::new()
    } else {
        result.to_string()
    }
}

fn read_instruction(tty: &mut Tty) -> Res<String> {
    tty.read("Instruction (Enter to skip): ")
}

/// Branch selection flow when on the main branch.
fn choose_branch(cfg: &Config, tty: &mut Tty, current: &str) -> Res<()> {
    say(&format!("{YELLOW}Warning: You are on {current}{RESET}"));
    let mut response = tty.read("Create a new branch? [Y/n] ")?;
    if response.is_empty() {
        response = "Y".into();
    }
    if first_is(&response, "Nn") {
        say(&format!("{YELLOW}Committing directly to {current}{RESET}"));
        return Ok(());
    }
    say(&format!("{BLUE}Generating branch name...{RESET}"));
    let mut branch_name = generate_branch_name(cfg, "")?;
    loop {
        if !git_quiet_ok(&["check-ref-format", "--branch", &branch_name]) {
            say(&format!(
                "{RED}Error: invalid branch name: {branch_name}{RESET}"
            ));
            say(&format!(
                "{YELLOW}Choose e(dit) or r(egenerate) to get a valid name{RESET}"
            ));
            let response = tty.read("[e(dit)/r(egenerate)/other to cancel] ")?;
            if first_is(&response, "Rr") {
                let instruction = read_instruction(tty)?;
                branch_name = generate_branch_name(cfg, &instruction)?;
            } else if first_is(&response, "Ee") {
                let new_branch = edit_with_editor(&branch_name).replace('\n', "");
                if !new_branch.is_empty() {
                    branch_name = new_branch;
                }
            } else {
                say(&format!("{YELLOW}Cancelled{RESET}"));
                return Err(Exit(1));
            }
            continue;
        }
        say(&format!("{BLUE}Suggested branch:{RESET}"));
        say(&format!("  {GREEN}{branch_name}{RESET}"));
        say("");

        let mut response =
            tty.read("Create and switch to this branch? [Y/n/e(dit)/r(egenerate)] ")?;
        if response.is_empty() {
            response = "Y".into();
        }
        if first_is(&response, "Yy") {
            let status = Command::new("git")
                .args(["switch", "-c", &branch_name])
                .status()
                .map_err(|_| Exit(127))?;
            if !status.success() {
                return Err(Exit(status.code().unwrap_or(1)));
            }
            say(&format!("{GREEN}Switched to {branch_name}{RESET}"));
            break;
        } else if first_is(&response, "Rr") {
            let instruction = read_instruction(tty)?;
            say(&format!("{BLUE}Regenerating branch name...{RESET}"));
            branch_name = generate_branch_name(cfg, &instruction)?;
        } else if first_is(&response, "Ee") {
            let new_branch = edit_with_editor(&branch_name).replace('\n', "");
            if !new_branch.is_empty() {
                branch_name = new_branch;
            }
        } else {
            say(&format!("{YELLOW}Cancelled{RESET}"));
            return Err(Exit(1));
        }
    }
    say("");
    Ok(())
}

fn run(cfg: &Config, direct: bool) -> Res<()> {
    if !git_quiet_ok(&["rev-parse", "--is-inside-work-tree"]) {
        say(&format!("{RED}Error: Not in a git repository{RESET}"));
        return Err(Exit(1));
    }
    if !command_exists("pi") {
        say(&format!("{RED}Error: pi CLI not found{RESET}"));
        return Err(Exit(1));
    }

    let main_branch = detect_main_branch();
    let current_branch = git_text(&["branch", "--show-current"])?;
    say(&format!(
        "{BLUE}Branch:{RESET} {current_branch} ({main_branch})"
    ));

    let staged_files = git_text(&["diff", "--staged", "--name-status"])?;
    if staged_files.is_empty() {
        say(&format!("{YELLOW}No staged files to commit{RESET}"));
        return Ok(());
    }
    say(&format!("{BLUE}Staged files:{RESET}"));
    for line in staged_files.split('\n') {
        say(&format_staged_line(line));
    }
    say("");

    let mut tty = Tty(None);
    if current_branch == main_branch && !direct {
        choose_branch(cfg, &mut tty, &current_branch)?;
    }

    // Only the text sent to the LLM is filtered and capped; the commit still contains everything staged.
    let mut staged_diff = git_output(&diff_args(&cfg.diff_pathspecs))?;
    staged_diff.truncate(MAX_DIFF_BYTES);
    while staged_diff.last() == Some(&b'\n') {
        staged_diff.pop();
    }

    say(&format!("{BLUE}Generating commit message...{RESET}"));
    let mut commit_message = generate_commit_message(cfg, &staged_diff, "")?;

    loop {
        say(&format!("{BLUE}Generated commit message:{RESET}"));
        say(&format!("{GREEN}{commit_message}{RESET}"));
        say("");

        let mut response = tty.read("Proceed with this commit? [Y/n/e(dit)/r(egenerate)] ")?;
        if response.is_empty() {
            response = "Y".into();
        }
        if first_is(&response, "Yy") {
            let status = Command::new("git")
                .args(["commit", "-m", &commit_message])
                .status()
                .map_err(|_| Exit(127))?;
            if !status.success() {
                return Err(Exit(status.code().unwrap_or(1)));
            }
            say(&format!("{GREEN}Committed successfully!{RESET}"));
            return Ok(());
        } else if first_is(&response, "Rr") {
            let instruction = read_instruction(&mut tty)?;
            say(&format!("{BLUE}Regenerating commit message...{RESET}"));
            commit_message = generate_commit_message(cfg, &staged_diff, &instruction)?;
        } else if first_is(&response, "Ee") {
            let new_message = edit_with_editor(&commit_message);
            if !new_message.is_empty() {
                commit_message = new_message;
            }
        } else {
            say(&format!("{YELLOW}Commit cancelled{RESET}"));
            return Err(Exit(1));
        }
    }
}

fn load_config(args: &mut Vec<String>) -> Result<Config, String> {
    if args.first().map(String::as_str) != Some("--config") || args.len() < 2 {
        return Err("git-auto-commit: missing --config <file>".into());
    }
    let path = args[1].clone();
    args.drain(..2);
    let text = fs::read_to_string(&path).map_err(|e| format!("git-auto-commit: {path}: {e}"))?;
    serde_json::from_str(&text).map_err(|e| format!("git-auto-commit: {path}: {e}"))
}

fn main() {
    let mut args: Vec<String> = std::env::args().skip(1).collect();
    let cfg = match load_config(&mut args) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(1);
        }
    };
    let code = match parse_args(&args) {
        Parsed::Help => {
            print!("{HELP}");
            0
        }
        Parsed::Version => {
            println!("git-auto-commit {VERSION}");
            0
        }
        Parsed::Unknown(arg) => {
            say(&format!("{RED}Unknown option: {arg}{RESET}"));
            print!("{HELP}");
            1
        }
        Parsed::Run { direct } => match run(&cfg, direct) {
            Ok(()) => 0,
            Err(Exit(code)) => code,
        },
    };
    let _ = std::io::stdout().flush();
    std::process::exit(code);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(a: &[&str]) -> Vec<String> {
        a.iter().map(|s| (*s).to_string()).collect()
    }

    #[test]
    fn parses_args_like_the_shell_loop() {
        assert_eq!(parse_args(&v(&[])), Parsed::Run { direct: false });
        assert_eq!(parse_args(&v(&["-d"])), Parsed::Run { direct: true });
        assert_eq!(parse_args(&v(&["--direct"])), Parsed::Run { direct: true });
        assert_eq!(parse_args(&v(&["-d", "-h"])), Parsed::Help);
        assert_eq!(parse_args(&v(&["--version", "-x"])), Parsed::Version);
        assert_eq!(
            parse_args(&v(&["-d", "--bad", "-h"])),
            Parsed::Unknown("--bad".into())
        );
    }

    #[test]
    fn commit_prompt_layout() {
        let p = String::from_utf8(commit_prompt(b"DIFF", "")).unwrap();
        assert!(p.starts_with(
            "Generate a git commit message for the following staged changes.\n\nRules:\n"
        ));
        assert!(p.ends_with("Staged changes:\n\nDIFF\n"));
        let p = String::from_utf8(commit_prompt(b"DIFF", "be brief")).unwrap();
        assert!(p.ends_with("Staged changes:\n\nDIFF\n\nAdditional instruction: be brief\n"));
    }

    #[test]
    fn branch_prompt_layout() {
        let p = String::from_utf8(branch_prompt(b" a | 1 +\n", "")).unwrap();
        assert!(p.ends_with("Staged changes:\n\n a | 1 +\n"));
        let p = String::from_utf8(branch_prompt(b" a | 1 +\n", "x")).unwrap();
        assert!(p.ends_with("Staged changes:\n\n a | 1 +\n\nAdditional instruction: x\n"));
    }

    #[test]
    fn diff_args_append_pathspecs() {
        assert_eq!(
            diff_args(&v(&[":(top)", ":(top,exclude,glob)**/*.pem"])),
            v(&[
                "diff",
                "--staged",
                "--",
                ":(top)",
                ":(top,exclude,glob)**/*.pem"
            ])
        );
    }

    #[test]
    fn sanitizes_branch_names() {
        assert_eq!(sanitize_branch_name("add-login\n"), "add-login");
        assert_eq!(
            sanitize_branch_name("```\n  \n`Add Login Page`\n```\n"),
            "Add-Login-Page"
        );
        assert_eq!(
            sanitize_branch_name("  \"it's  a\tname\"  \nsecond"),
            "its-a-name"
        );
        assert_eq!(sanitize_branch_name("---x---"), "x");
        assert_eq!(sanitize_branch_name("   \n```"), "");
        assert_eq!(sanitize_branch_name(""), "");
    }

    #[test]
    fn echo_e_handles_escapes() {
        assert_eq!(echo_e("a\\tb"), b"a\tb\n");
        assert_eq!(echo_e("a\\\\b"), b"a\\b\n");
        assert_eq!(echo_e("a\\cb"), b"a");
        assert_eq!(echo_e("\\033[0m"), b"\x1b[0m\n");
        assert_eq!(echo_e("\\x41\\q"), b"A\\q\n");
        assert_eq!(echo_e("plain"), b"plain\n");
    }

    #[test]
    fn staged_lines_are_colored_by_status() {
        assert_eq!(
            format_staged_line("A\tf.txt"),
            format!("  {GREEN}A{RESET} f.txt")
        );
        assert_eq!(
            format_staged_line("D\tf.txt"),
            format!("  {RED}D{RESET} f.txt")
        );
        assert_eq!(
            format_staged_line("M\tf.txt"),
            format!("  {YELLOW}M{RESET} f.txt")
        );
        assert_eq!(format_staged_line("R100\ta\tb"), "  R100 a\tb");
    }

    #[test]
    fn response_matching_is_prefix_based() {
        assert!(first_is("yes", "Yy"));
        assert!(first_is("Re", "Rr"));
        assert!(!first_is("", "Yy"));
        assert!(!first_is("x", "Nn"));
    }

    #[test]
    fn remote_head_prefix_is_stripped() {
        assert_eq!(strip_remote_head("refs/remotes/origin/main"), "main");
        assert_eq!(strip_remote_head("refs/remotes/origin/feat/x"), "feat/x");
        assert_eq!(strip_remote_head("other"), "other");
    }

    #[test]
    fn strips_only_trailing_newlines() {
        assert_eq!(strip_trailing_newlines("a\n\n"), "a");
        assert_eq!(strip_trailing_newlines(" a \n"), " a ");
    }
}
