//! Behaviour of the original Bash script that output parity depends on.

use std::io::{self, Write};
use std::iter::Peekable;
use std::str::Bytes;

pub fn is_space(c: char) -> bool {
    matches!(c, ' ' | '\t' | '\n' | '\x0b' | '\x0c' | '\r')
}

pub use dot::shell::strip_trailing_newlines as strip_command_substitution_newlines;

pub fn say(s: &str) {
    let mut out = io::stdout();
    let _ = out.write_all(&echo_e(s));
    let _ = out.flush();
}

fn take_number(bytes: &mut Peekable<Bytes<'_>>, radix: u32, max_digits: usize) -> Option<u32> {
    let mut value = None;
    for _ in 0..max_digits {
        let Some(digit) = bytes.peek().and_then(|b| char::from(*b).to_digit(radix)) else {
            break;
        };
        bytes.next();
        value = Some(value.unwrap_or(0) * radix + digit);
    }
    value
}

pub fn echo_e(s: &str) -> Vec<u8> {
    let mut bytes = s.bytes().peekable();
    let mut out = Vec::with_capacity(s.len() + 1);
    while let Some(b) = bytes.next() {
        if b != b'\\' {
            out.push(b);
            continue;
        }
        let Some(escape) = bytes.next() else {
            out.push(b'\\');
            break;
        };
        match escape {
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
            b'0' => out.push((take_number(&mut bytes, 8, 3).unwrap_or(0) & 0xff) as u8),
            b'x' | b'u' | b'U' => {
                let max_digits = match escape {
                    b'x' => 2,
                    b'u' => 4,
                    _ => 8,
                };
                match take_number(&mut bytes, 16, max_digits) {
                    None => out.extend([b'\\', escape]),
                    Some(v) if escape == b'x' => out.push((v & 0xff) as u8),
                    Some(v) => {
                        if let Some(ch) = char::from_u32(v) {
                            out.extend(ch.encode_utf8(&mut [0; 4]).bytes());
                        }
                    }
                }
            }
            other => out.extend([b'\\', other]),
        }
    }
    out.push(b'\n');
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn echo_e_handles_escapes() {
        assert_eq!(echo_e("a\\tb"), b"a\tb\n");
        assert_eq!(echo_e("a\\\\b"), b"a\\b\n");
        assert_eq!(echo_e("a\\cb"), b"a");
        assert_eq!(echo_e("\\033[0m"), b"\x1b[0m\n");
        assert_eq!(echo_e("\\x41\\q"), b"A\\q\n");
        assert_eq!(echo_e("plain"), b"plain\n");
    }
}
