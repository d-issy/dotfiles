use crate::herdr::Herdr;
use signal_hook::consts::{SIGINT, SIGTERM};
use signal_hook::iterator::Signals;
use std::fs;
use std::path::PathBuf;
use std::process;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::thread;

#[derive(Default)]
struct State {
    armed: bool,
    created: Vec<String>,
}

/// Panes created by an in-progress start, shared with the signal thread so an interrupt can close them.
#[derive(Clone, Default)]
pub struct Rollback(Arc<Mutex<State>>);

impl Rollback {
    fn state(&self) -> MutexGuard<'_, State> {
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn arm(&self) {
        self.state().armed = true;
    }

    pub fn disarm(&self) {
        self.state().armed = false;
    }

    pub fn record(&self, pane: &str) {
        self.state().created.push(pane.to_string());
    }

    pub fn run(&self, herdr: &Herdr) {
        let mut state = self.state();
        for pane in state.created.iter().rev() {
            herdr.close_pane_quietly(pane);
        }
        state.created.clear();
        state.armed = false;
    }

    fn run_if_armed(&self, herdr: &Herdr) {
        if self.state().armed {
            self.run(herdr);
        }
    }
}

pub fn install_handlers(rollback: Rollback, herdr: Herdr, lock: PathBuf) {
    let Ok(mut signals) = Signals::new([SIGINT, SIGTERM]) else {
        return;
    };
    thread::spawn(move || {
        if let Some(signal) = signals.forever().next() {
            rollback.run_if_armed(&herdr);
            let _ = fs::remove_dir(&lock);
            process::exit(if signal == SIGINT { 130 } else { 143 });
        }
    });
}
