//! Shared plumbing: errors, colors, child processes, /dev/tty, and paths.

use std::ffi::OsStr;
use std::fs::{File, OpenOptions};
use std::io::{IsTerminal, Read, Write};
use std::os::unix::process::ExitStatusExt;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};

use crate::config::Config;

pub const RED: &str = "\x1b[0;31m";
pub const GREEN: &str = "\x1b[0;32m";
pub const YELLOW: &str = "\x1b[0;33m";
pub const BLUE: &str = "\x1b[0;34m";
pub const RESET: &str = "\x1b[0m";

/// How a command stops early.
#[derive(Debug)]
pub enum Fail {
    /// Print `Error: <message>` and exit 1.
    Die(String),
    /// Exit with this status; whatever failed already reported itself.
    Exit(i32),
}

pub type Res<T> = Result<T, Fail>;

pub fn die<T>(message: impl Into<String>) -> Res<T> {
    Err(Fail::Die(message.into()))
}

pub fn error_line(message: &str) -> String {
    format!("{RED}Error:{RESET} {message}")
}

/// Report a failure without exiting, as when the original died inside a
/// command substitution and the caller carried on.
pub fn report(fail: &Fail) {
    if let Fail::Die(message) = fail {
        eprintln!("{}", error_line(message));
    }
}

pub fn warn(message: &str) {
    eprintln!("{}", warn_line(message));
}

pub fn warn_line(message: &str) -> String {
    format!("{YELLOW}Warning:{RESET} {message}")
}

/// The working directory and settings every command runs with.
#[derive(Debug, Clone)]
pub struct Ctx {
    pub cwd: PathBuf,
    pub cfg: Config,
}

impl Ctx {
    pub fn new(cwd: PathBuf, cfg: Config) -> Self {
        let cwd = std::fs::canonicalize(&cwd).unwrap_or(cwd);
        Self { cwd, cfg }
    }

    /// The same settings running from another directory.
    pub fn with_cwd(&self, cwd: PathBuf) -> Self {
        Self::new(cwd, self.cfg.clone())
    }

    pub fn command(&self, program: &str) -> Command {
        let mut command = Command::new(program);
        command.current_dir(&self.cwd);
        command
    }

    pub fn git<I, S>(&self, args: I) -> Command
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        let mut command = self.command(&self.cfg.git);
        command.args(args);
        command
    }

    pub fn tmux<I, S>(&self, args: I) -> Command
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        let mut command = self.command(&self.cfg.tmux);
        command.args(args);
        command
    }

    pub fn gh<I, S>(&self, args: I) -> Command
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        let mut command = self.command(&self.cfg.gh);
        command.args(args);
        command
    }

    /// Resolve a possibly relative path against the working directory.
    pub fn resolve(&self, path: &str) -> PathBuf {
        self.cwd.join(path)
    }

    /// `realpath`, falling back to the input when it cannot be resolved.
    pub fn canonical(&self, path: &str) -> String {
        if path.is_empty() {
            return String::new();
        }
        let full = self.resolve(path);
        if let Ok(real) = std::fs::canonicalize(&full) {
            return real.to_string_lossy().into_owned();
        }
        // GNU realpath accepts a missing last component.
        if let (Some(parent), Some(name)) = (full.parent(), full.file_name())
            && let Ok(real) = std::fs::canonicalize(parent)
        {
            return real.join(name).to_string_lossy().into_owned();
        }
        path.to_string()
    }

    /// `[[ -e path ]]`
    pub fn exists(&self, path: &str) -> bool {
        !path.is_empty() && self.resolve(path).exists()
    }

    /// `[[ -e path || -L path ]]`
    pub fn exists_or_link(&self, path: &str) -> bool {
        !path.is_empty() && self.resolve(path).symlink_metadata().is_ok()
    }

    /// `[[ -d path ]]`
    pub fn is_dir(&self, path: &str) -> bool {
        !path.is_empty() && self.resolve(path).is_dir()
    }
}

fn status_code(status: ExitStatus) -> i32 {
    status
        .code()
        .unwrap_or_else(|| 128 + status.signal().unwrap_or(0))
}

fn spawn_failed(command: &Command, err: &std::io::Error) -> i32 {
    eprintln!(
        "worktree: {}: {}",
        command.get_program().to_string_lossy(),
        io_message(err)
    );
    127
}

/// An io::Error message without the trailing "(os error N)".
pub fn io_message(err: &std::io::Error) -> String {
    let text = err.to_string();
    match text.find(" (os error ") {
        Some(index) => text[..index].to_string(),
        None => text,
    }
}

/// Strip trailing newlines, like `$(...)`.
pub fn chomp(text: &str) -> String {
    text.trim_end_matches('\n').to_string()
}

/// Run with inherited stdio and return the exit status.
pub fn run(command: &mut Command) -> i32 {
    match command.status() {
        Ok(status) => status_code(status),
        Err(err) => spawn_failed(command, &err),
    }
}

/// Run with stdout and stderr discarded.
pub fn run_quiet(command: &mut Command) -> i32 {
    run(command.stdout(Stdio::null()).stderr(Stdio::null()))
}

/// Run with stdout discarded and stderr shown.
pub fn run_no_stdout(command: &mut Command) -> i32 {
    run(command.stdout(Stdio::null()))
}

pub fn succeeds(command: &mut Command) -> bool {
    run_quiet(command) == 0
}

/// Run and fail like `set -e` would when the command fails.
pub fn checked(command: &mut Command) -> Res<()> {
    match run(command) {
        0 => Ok(()),
        code => Err(Fail::Exit(code)),
    }
}

/// `$(command)` with stderr shown.
pub fn capture(command: &mut Command) -> (i32, String) {
    command.stdout(Stdio::piped());
    match command.output() {
        Ok(output) => (
            status_code(output.status),
            chomp(&String::from_utf8_lossy(&output.stdout)),
        ),
        Err(err) => (spawn_failed(command, &err), String::new()),
    }
}

/// `$(command 2>/dev/null)`
pub fn capture_quiet(command: &mut Command) -> (i32, String) {
    capture(command.stderr(Stdio::null()))
}

/// Raw stdout bytes with stderr shown.
pub fn capture_bytes(command: &mut Command) -> (i32, Vec<u8>) {
    command.stdout(Stdio::piped());
    match command.output() {
        Ok(output) => (status_code(output.status), output.stdout),
        Err(err) => (spawn_failed(command, &err), Vec::new()),
    }
}

/// `x="$(command)"` under `set -e`: the command's failure ends the run.
pub fn checked_capture(command: &mut Command) -> Res<String> {
    match capture(command) {
        (0, text) => Ok(text),
        (code, _) => Err(Fail::Exit(code)),
    }
}

/// Feed `input` to the command and capture stdout and stderr.
pub fn run_with_input(
    command: &mut Command,
    input: &[u8],
) -> std::io::Result<(i32, Vec<u8>, Vec<u8>)> {
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn()?;
    let mut stdin = child.stdin.take();
    let output = std::thread::scope(|scope| {
        scope.spawn(move || {
            if let Some(stdin) = stdin.as_mut() {
                // The reader may exit early; a broken pipe is not an error here.
                let _ = stdin.write_all(input);
            }
        });
        child.wait_with_output()
    })?;
    Ok((status_code(output.status), output.stdout, output.stderr))
}

/// Pipe lines to the fuzzy finder and return its selection ("" when cancelled).
pub fn fuzzy_select(ctx: &Ctx, lines: &str, args: &[String]) -> String {
    let mut command = ctx.command(&ctx.cfg.fuzzy_finder);
    command
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped());
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(err) => {
            spawn_failed(&command, &err);
            return String::new();
        }
    };
    let mut stdin = child.stdin.take();
    let output = std::thread::scope(|scope| {
        scope.spawn(move || {
            if let Some(stdin) = stdin.as_mut() {
                let _ = stdin.write_all(lines.as_bytes());
            }
        });
        child.wait_with_output()
    });
    match output {
        Ok(output) => chomp(&String::from_utf8_lossy(&output.stdout)),
        Err(_) => String::new(),
    }
}

/// Join rows into the newline-terminated text a pipe would carry.
pub fn lines_text<S: AsRef<str>>(rows: &[S]) -> String {
    rows.iter()
        .map(|row| format!("{}\n", row.as_ref()))
        .collect()
}

/// Split like `IFS=$'\t' read -r a b ...`: tabs are IFS whitespace, so runs
/// collapse and leading/trailing tabs are dropped; the last field keeps the rest.
pub fn read_tab_fields(line: &str, count: usize) -> Vec<String> {
    let mut fields = Vec::with_capacity(count);
    let mut rest = line.trim_start_matches('\t');
    for index in 0..count {
        if index + 1 == count {
            fields.push(rest.trim_end_matches('\t').to_string());
            break;
        }
        match rest.find('\t') {
            Some(pos) => {
                fields.push(rest[..pos].to_string());
                rest = rest[pos..].trim_start_matches('\t');
            }
            None => {
                fields.push(rest.to_string());
                rest = "";
            }
        }
    }
    fields
}

/// `${text%%$'\t'*}` and `${text#*$'\t'}`
pub fn split_first_tab(text: &str) -> (String, String) {
    match text.split_once('\t') {
        Some((head, tail)) => (head.to_string(), tail.to_string()),
        None => (text.to_string(), text.to_string()),
    }
}

/// coreutils `basename` for the absolute paths this tool handles.
pub fn basename(path: &str) -> String {
    let trimmed = path.trim_end_matches('/');
    if trimmed.is_empty() {
        return if path.is_empty() {
            String::new()
        } else {
            "/".into()
        };
    }
    trimmed.rsplit('/').next().unwrap_or(trimmed).to_string()
}

/// coreutils `dirname`.
pub fn dirname(path: &str) -> String {
    let trimmed = path.trim_end_matches('/');
    if trimmed.is_empty() {
        return if path.is_empty() {
            ".".into()
        } else {
            "/".into()
        };
    }
    match trimmed.rfind('/') {
        None => ".".into(),
        Some(index) => {
            let parent = trimmed[..index].trim_end_matches('/');
            if parent.is_empty() {
                "/".into()
            } else {
                parent.to_string()
            }
        }
    }
}

/// `$(<file)`; None when the file cannot be read.
pub fn read_file(path: &Path) -> Option<String> {
    std::fs::read(path)
        .ok()
        .map(|bytes| chomp(&String::from_utf8_lossy(&bytes)))
}

pub fn write_line(path: &Path, value: &str) -> Res<()> {
    std::fs::write(path, format!("{value}\n")).map_err(|err| {
        eprintln!("worktree: {}: {}", path.display(), io_message(&err));
        Fail::Exit(1)
    })
}

const TTY: &str = "/dev/tty";

fn open_tty_write() -> std::io::Result<File> {
    OpenOptions::new().write(true).open(TTY)
}

/// `printf ... >/dev/tty` where a failure ends the run.
pub fn tty_print(text: &str) -> Res<()> {
    tty_print_lenient(text).then_some(()).ok_or(Fail::Exit(1))
}

/// `printf ... >/dev/tty` where a failure is reported and ignored.
pub fn tty_print_lenient(text: &str) -> bool {
    match open_tty_write().and_then(|mut tty| tty.write_all(text.as_bytes())) {
        Ok(()) => true,
        Err(err) => {
            eprintln!("worktree: {TTY}: {}", io_message(&err));
            false
        }
    }
}

/// Outcome of `read -r -p prompt response <source`.
pub enum Reply {
    /// The redirection failed; the variable keeps its old value.
    Unopened,
    /// End of input before a newline (read fails, partial text is kept).
    Eof(String),
    Line(String),
}

pub fn read_reply(prompt: &str, source: &str) -> Reply {
    let mut file = match File::open(source) {
        Ok(file) => file,
        Err(err) => {
            eprintln!("worktree: {source}: {}", io_message(&err));
            return Reply::Unopened;
        }
    };
    if file.is_terminal() {
        eprint!("{prompt}");
        let _ = std::io::stderr().flush();
    }
    let mut bytes = Vec::new();
    let mut byte = [0_u8; 1];
    let complete = loop {
        match file.read(&mut byte) {
            Ok(1) if byte[0] == b'\n' => break true,
            Ok(1) => bytes.push(byte[0]),
            Ok(_) | Err(_) => break false,
        }
    };
    let text = String::from_utf8_lossy(&bytes)
        .trim_matches([' ', '\t'])
        .to_string();
    if complete {
        Reply::Line(text)
    } else {
        Reply::Eof(text)
    }
}

/// `read` from /dev/tty where a failed read ends the run (`set -e`).
pub fn tty_read_checked(prompt: &str) -> Res<String> {
    match read_reply(prompt, TTY) {
        Reply::Line(text) => Ok(text),
        Reply::Unopened | Reply::Eof(_) => Err(Fail::Exit(1)),
    }
}

/// `read` from /dev/tty updating `value` the way bash does, success or not.
pub fn tty_read_into(prompt: &str, value: &mut String) {
    match read_reply(prompt, TTY) {
        Reply::Unopened => {}
        Reply::Eof(text) | Reply::Line(text) => *value = text,
    }
}

/// `if ! read ...; then die Cancelled; fi` then a strict y/yes match.
pub fn confirm_yes(prompt: &str, source: &str) -> Res<()> {
    match read_reply(prompt, source) {
        Reply::Line(text) if is_yes(&text) => Ok(()),
        _ => die("Cancelled"),
    }
}

/// `[Yy] | [Yy][Ee][Ss]`
pub fn is_yes(text: &str) -> bool {
    text.eq_ignore_ascii_case("y") || text.eq_ignore_ascii_case("yes")
}

/// `[Yy]*`
pub fn starts_with_yes(text: &str) -> bool {
    text.starts_with(['y', 'Y'])
}

pub fn is_inside_tmux() -> bool {
    std::env::var_os("TMUX").is_some_and(|value| !value.is_empty())
}

/// A temporary directory removed on drop.
pub struct TempDir(PathBuf);

impl TempDir {
    pub fn new() -> Res<Self> {
        use std::sync::atomic::{AtomicU32, Ordering};
        static COUNTER: AtomicU32 = AtomicU32::new(0);
        let base = std::env::temp_dir();
        for _ in 0..100 {
            let nanos = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_or(0, |d| d.subsec_nanos());
            let name = format!(
                "worktree.{}.{}.{nanos}",
                std::process::id(),
                COUNTER.fetch_add(1, Ordering::Relaxed)
            );
            let path = base.join(name);
            if std::fs::create_dir(&path).is_ok() {
                return Ok(Self(path));
            }
        }
        eprintln!("worktree: could not create a temporary directory");
        Err(Fail::Exit(1))
    }

    pub fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tab_fields_follow_bash_read() {
        assert_eq!(read_tab_fields("a\tb\tc\td", 4), ["a", "b", "c", "d"]);
        assert_eq!(read_tab_fields("a\t\tc", 3), ["a", "c", ""]);
        assert_eq!(read_tab_fields("a\tb\tc\td", 2), ["a", "b\tc\td"]);
        assert_eq!(read_tab_fields("\ta\t", 2), ["a", ""]);
    }

    #[test]
    fn path_parts_match_coreutils() {
        assert_eq!(basename("/a/b"), "b");
        assert_eq!(basename("/a/b/"), "b");
        assert_eq!(dirname("/a/b"), "/a");
        assert_eq!(dirname("/a"), "/");
        assert_eq!(dirname("a"), ".");
    }

    #[test]
    fn yes_matching() {
        assert!(is_yes("Y") && is_yes("yEs") && !is_yes("yess") && !is_yes(""));
        assert!(starts_with_yes("yup") && !starts_with_yes("n"));
    }
}
