pub const VERSION: &str = "1.0.0";

pub const HELP: &str = "git-auto-commit - AI-powered commit message generator using Pi CLI

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

#[derive(Debug, PartialEq)]
pub enum Command {
    Help,
    Version,
    Run { direct: bool },
    Unknown(String),
}

impl Command {
    pub fn parse(args: &[String]) -> Self {
        let mut direct = false;
        for arg in args {
            match arg.as_str() {
                "-h" | "--help" => return Self::Help,
                "-v" | "--version" => return Self::Version,
                "-d" | "--direct" => direct = true,
                other => return Self::Unknown(other.to_owned()),
            }
        }
        Self::Run { direct }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(a: &[&str]) -> Vec<String> {
        a.iter().map(|s| (*s).to_string()).collect()
    }

    #[test]
    fn parses_args_like_the_shell_loop() {
        assert_eq!(Command::parse(&v(&[])), Command::Run { direct: false });
        assert_eq!(Command::parse(&v(&["-d"])), Command::Run { direct: true });
        assert_eq!(
            Command::parse(&v(&["--direct"])),
            Command::Run { direct: true }
        );
        assert_eq!(Command::parse(&v(&["-d", "-h"])), Command::Help);
        assert_eq!(Command::parse(&v(&["--version", "-x"])), Command::Version);
        assert_eq!(
            Command::parse(&v(&["-d", "--bad", "-h"])),
            Command::Unknown("--bad".into())
        );
    }
}
