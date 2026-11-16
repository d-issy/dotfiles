use std::io;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Signal {
    Interrupt,
    Terminate,
    Hangup,
    Resize,
}

impl Signal {
    fn number(self) -> i32 {
        use signal_hook::consts::{SIGHUP, SIGINT, SIGTERM, SIGWINCH};

        match self {
            Self::Interrupt => SIGINT,
            Self::Terminate => SIGTERM,
            Self::Hangup => SIGHUP,
            Self::Resize => SIGWINCH,
        }
    }

    fn from_number(number: i32) -> Option<Self> {
        [Self::Interrupt, Self::Terminate, Self::Hangup, Self::Resize]
            .into_iter()
            .find(|signal| signal.number() == number)
    }
}

/// Blocking delivery of the selected process signals.
pub struct Signals {
    inner: signal_hook::iterator::Signals,
}

impl Signals {
    pub fn new(signals: impl IntoIterator<Item = Signal>) -> io::Result<Self> {
        let numbers: Vec<i32> = signals.into_iter().map(Signal::number).collect();
        signal_hook::iterator::Signals::new(numbers).map(|inner| Self { inner })
    }
}

impl Iterator for Signals {
    type Item = Signal;

    fn next(&mut self) -> Option<Self::Item> {
        self.inner.forever().find_map(Signal::from_number)
    }
}
