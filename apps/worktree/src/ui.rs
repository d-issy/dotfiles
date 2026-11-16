pub use dot::color::Color;

pub fn warning_line(message: &str) -> String {
    format!("{} {message}", Color::Yellow.paint("Warning:"))
}

pub fn warn(message: &str) {
    eprintln!("{}", warning_line(message));
}
