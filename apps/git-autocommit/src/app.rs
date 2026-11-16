use crate::bash::say;
use crate::config::Config;
use crate::error::{Error, Result};
use crate::staged::StagedEntry;
use crate::tty::{Answer, Tty};
use crate::{editor, git, pi, prompt};
use dot::color::Color;
use dot::process::is_on_path;

pub struct App {
    config: Config,
    direct: bool,
    tty: Tty,
}

impl App {
    pub fn new(config: Config, direct: bool) -> Self {
        Self {
            config,
            direct,
            tty: Tty::default(),
        }
    }

    pub fn run(&mut self) -> Result<()> {
        if !git::is_inside_work_tree() {
            return Err(Error::NotInRepository);
        }
        if !is_on_path("pi") {
            return Err(Error::PiNotFound);
        }

        let main_branch = git::detect_main_branch();
        let current_branch = git::current_branch()?;
        say(&format!(
            "{} {current_branch} ({main_branch})",
            Color::Blue.paint("Branch:")
        ));

        let staged_files = git::staged_name_status()?;
        if staged_files.is_empty() {
            say(&Color::Yellow.paint("No staged files to commit"));
            return Ok(());
        }
        say(&Color::Blue.paint("Staged files:"));
        for line in staged_files.split('\n') {
            say(&StagedEntry::parse(line).to_string());
        }
        say("");

        if current_branch == main_branch && !self.direct {
            self.choose_branch(&current_branch)?;
        }
        self.commit()
    }

    fn generate_commit_message(&self, diff: &[u8], instruction: &str) -> Result<String> {
        pi::run(&self.config.pi_args, prompt::commit(diff, instruction))
    }

    fn generate_branch_name(&self, instruction: &str) -> Result<String> {
        let stat = git::staged_stat()?;
        let output = pi::run(&self.config.pi_args, prompt::branch(&stat, instruction))?;
        Ok(prompt::sanitize_branch_name(&output))
    }

    fn choose_branch(&mut self, current: &str) -> Result<()> {
        say(&Color::Yellow.paint(format!("Warning: You are on {current}")));
        if self.tty.confirm("Create a new branch? [Y/n] ")? == Answer::No {
            say(&Color::Yellow.paint(format!("Committing directly to {current}")));
            return Ok(());
        }
        say(&Color::Blue.paint("Generating branch name..."));
        let mut branch_name = self.generate_branch_name("")?;
        loop {
            if !git::is_valid_branch_name(&branch_name) {
                branch_name = self.fix_invalid_branch_name(branch_name)?;
                continue;
            }
            say(&Color::Blue.paint("Suggested branch:"));
            say(&format!("  {}", Color::Green.paint(&branch_name)));
            say("");

            let answer = self
                .tty
                .confirm("Create and switch to this branch? [Y/n/e(dit)/r(egenerate)] ")?;
            match answer {
                Answer::Yes => {
                    git::switch_create(&branch_name)?;
                    say(&Color::Green.paint(format!("Switched to {branch_name}")));
                    break;
                }
                Answer::Regenerate => {
                    let instruction = self.tty.instruction()?;
                    say(&Color::Blue.paint("Regenerating branch name..."));
                    branch_name = self.generate_branch_name(&instruction)?;
                }
                Answer::Edit => edit_in_place(&mut branch_name, editor::edit_line),
                Answer::No | Answer::Other => return Err(Error::BranchCancelled),
            }
        }
        say("");
        Ok(())
    }

    fn fix_invalid_branch_name(&mut self, mut branch_name: String) -> Result<String> {
        say(&Color::Red.paint(format!("Error: invalid branch name: {branch_name}")));
        say(&Color::Yellow.paint("Choose e(dit) or r(egenerate) to get a valid name"));
        match self.tty.choose("[e(dit)/r(egenerate)/other to cancel] ")? {
            Answer::Regenerate => {
                let instruction = self.tty.instruction()?;
                self.generate_branch_name(&instruction)
            }
            Answer::Edit => {
                edit_in_place(&mut branch_name, editor::edit_line);
                Ok(branch_name)
            }
            _ => Err(Error::BranchCancelled),
        }
    }

    fn commit(&mut self) -> Result<()> {
        let diff = git::staged_diff_for_llm(&self.config.diff_pathspecs)?;

        say(&Color::Blue.paint("Generating commit message..."));
        let mut message = self.generate_commit_message(&diff, "")?;
        loop {
            say(&Color::Blue.paint("Generated commit message:"));
            say(&Color::Green.paint(&message));
            say("");

            let answer = self
                .tty
                .confirm("Proceed with this commit? [Y/n/e(dit)/r(egenerate)] ")?;
            match answer {
                Answer::Yes => {
                    git::commit(&message)?;
                    say(&Color::Green.paint("Committed successfully!"));
                    return Ok(());
                }
                Answer::Regenerate => {
                    let instruction = self.tty.instruction()?;
                    say(&Color::Blue.paint("Regenerating commit message..."));
                    message = self.generate_commit_message(&diff, &instruction)?;
                }
                Answer::Edit => edit_in_place(&mut message, editor::edit),
                Answer::No | Answer::Other => return Err(Error::CommitCancelled),
            }
        }
    }
}

fn edit_in_place(target: &mut String, edit: fn(&str) -> String) {
    let edited = edit(target);
    if !edited.is_empty() {
        *target = edited;
    }
}
