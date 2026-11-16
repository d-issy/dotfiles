use std::ffi::OsStr;
use std::io::{self, Write};
use std::os::unix::fs::PermissionsExt;
use std::process::{Child, Output};

/// The current effective user ID.
pub fn effective_uid() -> u32 {
    rustix::process::geteuid().as_raw()
}

/// Checks for a process without sending a signal. Permission denial still
/// means the process exists.
pub fn process_exists(pid: i32) -> bool {
    if pid <= 0 {
        return false;
    }
    let Some(pid) = rustix::process::Pid::from_raw(pid) else {
        return false;
    };
    matches!(
        rustix::process::test_kill_process(pid),
        Ok(()) | Err(rustix::io::Errno::PERM)
    )
}

/// Finds an executable regular file using the current `PATH`.
pub fn is_on_path(program: &str) -> bool {
    std::env::var_os("PATH").is_some_and(|paths| is_in_paths(program, &paths))
}

fn is_in_paths(program: &str, paths: &OsStr) -> bool {
    std::env::split_paths(paths).any(|directory| {
        std::fs::metadata(directory.join(program))
            .is_ok_and(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
    })
}

/// Writes input while collecting output so neither pipe can block the other.
/// A child that exits without draining stdin is allowed to close its pipe early.
pub fn wait_with_input(mut child: Child, input: &[u8]) -> io::Result<Output> {
    let stdin = child.stdin.take();
    std::thread::scope(|scope| {
        let writer = scope.spawn(move || {
            if let Some(mut stdin) = stdin {
                let _ = stdin.write_all(input);
            }
        });
        let output = child.wait_with_output();
        let _ = writer.join();
        output
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::process::{Command, Stdio};
    use std::sync::atomic::{AtomicUsize, Ordering};

    struct TempDir(PathBuf);

    impl TempDir {
        fn new() -> Self {
            static COUNTER: AtomicUsize = AtomicUsize::new(0);
            loop {
                let path = std::env::temp_dir().join(format!(
                    "dot-process-{}-{}",
                    std::process::id(),
                    COUNTER.fetch_add(1, Ordering::Relaxed)
                ));
                match fs::create_dir(&path) {
                    Ok(()) => return Self(path),
                    Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
                    Err(error) => panic!("cannot create test directory: {error}"),
                }
            }
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn detects_the_current_process_and_rejects_nonpositive_pids() {
        assert!(process_exists(std::process::id().cast_signed()));
        assert!(!process_exists(0));
        assert!(!process_exists(-1));
    }

    #[test]
    fn path_lookup_requires_an_executable_regular_file() {
        let directory = TempDir::new();
        let paths = std::env::join_paths([
            directory.path().join("missing"),
            directory.path().to_path_buf(),
        ])
        .unwrap();
        assert!(!is_in_paths("tool", &paths));

        let program = directory.path().join("tool");
        fs::create_dir(&program).unwrap();
        fs::set_permissions(&program, fs::Permissions::from_mode(0o700)).unwrap();
        assert!(!is_in_paths("tool", &paths));
        fs::remove_dir(&program).unwrap();

        fs::write(&program, "").unwrap();
        fs::set_permissions(&program, fs::Permissions::from_mode(0o600)).unwrap();
        assert!(!is_in_paths("tool", &paths));
        fs::set_permissions(&program, fs::Permissions::from_mode(0o700)).unwrap();
        assert!(is_in_paths("tool", &paths));
    }

    #[test]
    fn drains_large_output_while_writing_large_input() {
        let child = Command::new("sh")
            .args([
                "-c",
                "i=0; while [ \"$i\" -lt 4096 ]; do printf '%064d' 0; i=$((i + 1)); done; cat; printf error >&2",
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        let input = vec![b'x'; 1024 * 1024];
        let output = wait_with_input(child, &input).unwrap();
        assert!(output.status.success());
        assert_eq!(output.stdout.len(), 4096 * 64 + input.len());
        assert!(output.stdout[..4096 * 64].iter().all(|byte| *byte == b'0'));
        assert_eq!(&output.stdout[4096 * 64..], input.as_slice());
        assert_eq!(output.stderr, b"error");
    }

    #[test]
    fn accepts_a_child_that_closes_stdin_early() {
        let child = Command::new("sh")
            .args(["-c", "exec 0<&-; printf done"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        let output = wait_with_input(child, &vec![b'x'; 1024 * 1024]).unwrap();
        assert!(output.status.success());
        assert_eq!(output.stdout, b"done");
    }

    #[test]
    fn accepts_a_child_without_piped_stdin() {
        let child = Command::new("sh")
            .args(["-c", "printf done"])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        let output = wait_with_input(child, b"unused").unwrap();
        assert!(output.status.success());
        assert_eq!(output.stdout, b"done");
    }
}
