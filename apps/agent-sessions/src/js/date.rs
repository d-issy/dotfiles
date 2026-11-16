use chrono::{Days, Local, NaiveDate, NaiveDateTime, NaiveTime, Offset, TimeZone};

struct Scanner<'a> {
    bytes: &'a [u8],
    pos: usize,
}

impl<'a> Scanner<'a> {
    fn new(text: &'a str) -> Self {
        Self {
            bytes: text.as_bytes(),
            pos: 0,
        }
    }

    fn at_end(&self) -> bool {
        self.pos == self.bytes.len()
    }

    fn eat_any(&mut self, set: &[u8]) -> Option<u8> {
        let byte = *self.bytes.get(self.pos).filter(|byte| set.contains(byte))?;
        self.pos += 1;
        Some(byte)
    }

    fn eat(&mut self, byte: u8) -> bool {
        self.eat_any(&[byte]).is_some()
    }

    fn digit_run(&mut self) -> &'a [u8] {
        let start = self.pos;
        while self.bytes.get(self.pos).is_some_and(u8::is_ascii_digit) {
            self.pos += 1;
        }
        &self.bytes[start..self.pos]
    }

    fn digits(&mut self, count: usize) -> Option<u32> {
        let slice = self.bytes.get(self.pos..self.pos + count)?;
        if !slice.iter().all(u8::is_ascii_digit) {
            return None;
        }
        self.pos += count;
        Some(
            slice
                .iter()
                .fold(0, |value, digit| value * 10 + u32::from(digit - b'0')),
        )
    }
}

/// Milliseconds from a fraction, using only its first three digits as V8 does.
fn fraction_millis(digits: &[u8]) -> u32 {
    (0..3).fold(0, |millis, index| {
        millis * 10 + digits.get(index).map_or(0, |digit| u32::from(digit - b'0'))
    })
}

fn year(scanner: &mut Scanner) -> Option<i32> {
    match scanner.eat_any(b"+-") {
        None => i32::try_from(scanner.digits(4)?).ok(),
        Some(sign) => {
            let value = i32::try_from(scanner.digits(6)?).ok()?;
            match sign {
                b'-' if value == 0 => None,
                b'-' => Some(-value),
                _ => Some(value),
            }
        }
    }
}

enum UtcOffset {
    LocalTime,
    Minutes(i64),
}

fn utc_offset(scanner: &mut Scanner) -> Option<UtcOffset> {
    match scanner.eat_any(b"Z+-") {
        None => Some(UtcOffset::LocalTime),
        Some(b'Z') => Some(UtcOffset::Minutes(0)),
        Some(sign) => {
            let hours = scanner.digits(2)?;
            scanner.eat(b':');
            let minutes = scanner.digits(2)?;
            if hours > 23 || minutes > 59 {
                return None;
            }
            let total = i64::from(hours * 60 + minutes);
            Some(UtcOffset::Minutes(if sign == b'-' {
                -total
            } else {
                total
            }))
        }
    }
}

fn local_offset_millis(naive: &NaiveDateTime) -> i64 {
    let offset = match Local.from_local_datetime(naive).earliest() {
        Some(local) => local.offset().fix(),
        None => Local.offset_from_utc_datetime(naive).fix(),
    };
    i64::from(offset.local_minus_utc()) * 1000
}

/// `Date.parse` for the ISO 8601 forms V8 accepts. Date-only strings are UTC
/// and date-times without an offset are local time; like V8, any day 1-31 is
/// accepted and overflows into the next month.
pub fn date_parse(text: &str) -> Option<f64> {
    let mut scanner = Scanner::new(text);
    let year = year(&mut scanner)?;
    let (mut month, mut day) = (1, 1);
    if scanner.eat(b'-') {
        month = scanner.digits(2)?;
        if scanner.eat(b'-') {
            day = scanner.digits(2)?;
        }
    }
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    let date =
        NaiveDate::from_ymd_opt(year, month, 1)?.checked_add_days(Days::new(u64::from(day - 1)))?;
    if scanner.at_end() {
        return Some(date.and_time(NaiveTime::MIN).and_utc().timestamp_millis() as f64);
    }
    scanner.eat_any(b"Tt ")?;
    let hour = scanner.digits(2)?;
    if !scanner.eat(b':') {
        return None;
    }
    let minute = scanner.digits(2)?;
    let (mut second, mut millis) = (0, 0);
    if scanner.eat(b':') {
        second = scanner.digits(2)?;
        if scanner.eat_any(b".,").is_some() {
            let fraction = scanner.digit_run();
            if fraction.is_empty() {
                return None;
            }
            millis = fraction_millis(fraction);
        }
    }
    let offset = utc_offset(&mut scanner)?;
    if !scanner.at_end() {
        return None;
    }
    let (date, hour) = match hour {
        24 if minute == 0 && second == 0 && millis == 0 => (date.succ_opt()?, 0),
        24 => return None,
        _ => (date, hour),
    };
    let naive = NaiveDateTime::new(
        date,
        NaiveTime::from_hms_milli_opt(hour, minute, second, millis)?,
    );
    let utc = naive.and_utc().timestamp_millis();
    let millis = match offset {
        UtcOffset::Minutes(minutes) => utc - minutes * 60_000,
        UtcOffset::LocalTime => utc - local_offset_millis(&naive),
    };
    Some(millis as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_iso_timestamps() {
        // Expected values come from Node's Date.parse.
        for (text, expected) in [
            ("2026-11-15T13:13:06.042Z", Some(1_794_748_386_042.0)),
            ("2026-11-15T13:13:06.042+01:00", Some(1_794_744_786_042.0)),
            ("2026-11-15T13:13:06+0100", Some(1_794_744_786_000.0)),
            ("2026-11-15T13:13:06.1234Z", Some(1_794_748_386_123.0)),
            ("2025-01-02", Some(1_735_776_000_000.0)),
            ("2026", Some(1_767_225_600_000.0)),
            ("+002026-11-15T00:00:00Z", Some(1_794_700_800_000.0)),
            ("2025-02-31", Some(1_740_960_000_000.0)),
            ("2025-01-01T24:00:00Z", Some(1_735_776_000_000.0)),
            ("2025-02-32", None),
            ("2025-01-01T24:00:01Z", None),
            ("2026-11-15T13:13:60Z", None),
            ("2026-11-15T13:13:06Z ", None),
            ("2026-11-15T13:13:06.Z", None),
            ("soon", None),
        ] {
            assert_eq!(date_parse(text), expected, "{text}");
        }
    }
}
