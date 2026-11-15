use crate::candidates::Candidates;
use crate::config::{Config, Variable};
use crate::error::{Error, Result};
use crate::resolve::Prompter;
use std::io::Write;
use std::process::{Command, Stdio};

pub const EXIT_CANCELLED: u8 = 130;

pub struct Output {
    pub code: i32,
    pub stdout: String,
}

pub trait Picker {
    fn pick(&mut self, args: &[String], input: &str) -> Result<Output>;
}

impl<F> Picker for F
where
    F: FnMut(&[String], &str) -> Result<Output>,
{
    fn pick(&mut self, args: &[String], input: &str) -> Result<Output> {
        self(args, input)
    }
}

pub struct Fzf<'a> {
    pub config: &'a Config,
}

impl Picker for Fzf<'_> {
    fn pick(&mut self, args: &[String], input: &str) -> Result<Output> {
        let command = &self.config.fzf.command;
        let failure = |error: std::io::Error| Error::failure(format!("{command}: {error}"));
        let mut child = Command::new(command)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(failure)?;
        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| Error::failure("fzf stdin is unavailable"))?;
        let data = input.to_string();
        let writer = std::thread::spawn(move || {
            // fzf may exit before reading everything; a broken pipe is fine.
            let _ = stdin.write_all(data.as_bytes());
        });
        let output = child.wait_with_output().map_err(failure)?;
        let _ = writer.join();
        Ok(Output {
            code: output.status.code().unwrap_or(i32::from(EXIT_CANCELLED)),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        })
    }
}

pub struct FzfPrompter<'a, P> {
    pub config: &'a Config,
    pub picker: P,
}

impl<P: Picker> FzfPrompter<'_, P> {
    fn base_args(&self, name: &str, header: &str) -> Vec<String> {
        let mut args = self.config.fzf.variable_options.clone();
        args.extend([
            "--prompt".to_string(),
            format!("{name}: "),
            "--header".to_string(),
            format!("command: {header}"),
        ]);
        args
    }
}

impl<P: Picker> Prompter for FzfPrompter<'_, P> {
    fn run(&mut self, command: &str) -> String {
        Command::new("sh")
            .args(["-c", command])
            .stdin(Stdio::inherit())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .output()
            .map(|output| String::from_utf8_lossy(&output.stdout).into_owned())
            .unwrap_or_default()
    }

    fn choose(
        &mut self,
        name: &str,
        variable: &Variable,
        candidates: &Candidates,
        header: &str,
    ) -> Result<Option<Vec<String>>> {
        let mut args = self.base_args(name, header);
        if !candidates.headers.is_empty() {
            args.push("--header-lines".to_string());
            args.push(candidates.headers.len().to_string());
        }
        if variable.multi {
            args.push("--multi".to_string());
        }
        let input = [candidates.headers.as_slice(), candidates.values.as_slice()]
            .concat()
            .join("\n");
        let output = self.picker.pick(&args, &input)?;
        if output.code != 0 {
            return Ok(None);
        }
        let lines = output.stdout.split('\n').filter(|line| !line.is_empty());
        Ok(Some(lines.map(str::to_string).collect()))
    }

    fn input(&mut self, name: &str, header: &str) -> Result<Option<String>> {
        // With no candidates fzf exits 1 on enter but still prints the query.
        let mut args = self.base_args(name, header);
        args.push("--print-query".to_string());
        let output = self.picker.pick(&args, "")?;
        if !matches!(output.code, 0 | 1) {
            return Ok(None);
        }
        let query = output.stdout.split('\n').next().unwrap_or("");
        Ok(Some(query.to_string()))
    }
}
