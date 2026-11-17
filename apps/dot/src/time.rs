use std::{cell::RefCell, ops::RangeInclusive, time::Instant};

use tz::{DateTime, TimeZone, TimeZoneRef, UtcDateTime, datetime::FoundDateTimeKind};

// Keep the calendar bounds used by the existing timestamp parser and formatter.
const CALENDAR_YEARS: RangeInclusive<i32> = -262_143..=262_142;

fn utc_date(seconds: i64) -> Option<UtcDateTime> {
    let date = UtcDateTime::from_timespec(seconds, 0).ok()?;
    CALENDAR_YEARS.contains(&date.year()).then_some(date)
}

fn with_local_zone<T>(f: impl FnOnce(TimeZoneRef<'_>) -> T) -> T {
    thread_local! {
        static ZONE: RefCell<Option<(Instant, TimeZone)>> = const { RefCell::new(None) };
    }
    ZONE.with(|cache| {
        let mut cache = cache.borrow_mut();
        // Match the old clock's polling interval without rereading zoneinfo for each row.
        if cache
            .as_ref()
            .is_some_and(|(loaded, _)| loaded.elapsed().as_secs() >= 1)
        {
            *cache = None;
        }
        let (_, zone) = cache.get_or_insert_with(|| {
            let zone = std::env::var("TZ")
                .ok()
                .and_then(|name| TimeZone::from_posix_tz(&name).ok())
                .or_else(|| TimeZone::local().ok())
                .unwrap_or_else(TimeZone::utc);
            (Instant::now(), zone)
        });
        f(zone.as_ref())
    })
}

/// Time zone used when projecting an instant into calendar fields.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Zone {
    Local,
    Utc,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Date {
    pub year: i32,
    pub month: u32,
    pub day: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DateParts {
    pub date: Date,
    pub weekday_sunday: u32,
    pub hour: u32,
    pub minute: u32,
    pub second: u32,
}

fn date_parts(date: DateTime) -> DateParts {
    DateParts {
        date: Date {
            year: date.year(),
            month: u32::from(date.month()),
            day: u32::from(date.month_day()),
        },
        weekday_sunday: u32::from(date.week_day()),
        hour: u32::from(date.hour()),
        minute: u32::from(date.minute()),
        second: u32::from(date.second()),
    }
}

impl Zone {
    pub fn at_seconds(self, seconds: i64) -> Option<DateParts> {
        let utc = utc_date(seconds)?;
        let project = |zone: TimeZoneRef<'_>| utc.project(zone).ok().map(date_parts);
        match self {
            Self::Local => with_local_zone(project),
            Self::Utc => project(TimeZoneRef::utc()),
        }
    }

    pub fn at_millis(self, millis: i64) -> Option<DateParts> {
        self.at_seconds(millis.div_euclid(1000))
    }
}

/// Current Unix time in seconds.
pub fn now_seconds() -> i64 {
    UtcDateTime::now()
        .expect("system time is out of range")
        .unix_time()
}

/// Local `HH:MM:SS`, truncating fractional milliseconds like JavaScript's `Date`.
pub fn local_clock(millis: f64) -> Option<String> {
    let millis = millis.trunc();
    if !millis.is_finite() || millis.abs() > 8.64e15 {
        return None;
    }
    let date = Zone::Local.at_millis(millis as i64)?;
    Some(format!(
        "{:02}:{:02}:{:02}",
        date.hour, date.minute, date.second
    ))
}

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

fn local_offset_seconds(naive: UtcDateTime, zone: TimeZoneRef<'_>) -> Option<i32> {
    let candidates = DateTime::find(
        naive.year(),
        naive.month(),
        naive.month_day(),
        naive.hour(),
        naive.minute(),
        naive.second(),
        0,
        zone,
    )
    .ok()?;
    // In a repeated hour choose the first valid instant. In a skipped hour
    // keep using the offset at the wall time interpreted as UTC.
    for candidate in candidates.into_inner() {
        if let FoundDateTimeKind::Normal(date) = candidate {
            return Some(date.local_time_type().ut_offset());
        }
    }
    Some(
        zone.find_local_time_type(naive.unix_time())
            .ok()?
            .ut_offset(),
    )
}

/// `Date.parse` for the ISO 8601 forms V8 accepts. Date-only strings are UTC
/// and date-times without an offset are local time; like V8, any day 1-31 is
/// accepted and overflows into the next month.
pub fn parse_iso_millis(text: &str) -> Option<f64> {
    let mut scanner = Scanner::new(text);
    let year = year(&mut scanner)?;
    let (mut month, mut day) = (1, 1);
    if scanner.eat(b'-') {
        month = scanner.digits(2)? as u8;
        if scanner.eat(b'-') {
            day = scanner.digits(2)?;
        }
    }
    if !CALENDAR_YEARS.contains(&year) || !(1..=31).contains(&day) {
        return None;
    }
    let month_start = UtcDateTime::new(year, month, 1, 0, 0, 0, 0).ok()?;
    let midnight = month_start.unix_time() + i64::from(day - 1) * 86_400;
    if scanner.at_end() {
        return Some((utc_date(midnight)?.unix_time() * 1000) as f64);
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
    if minute > 59 || second > 59 || hour > 24 || (hour == 24 && minute + second + millis != 0) {
        return None;
    }
    let seconds = midnight + i64::from(hour * 3600 + minute * 60 + second);
    let naive = utc_date(seconds)?;
    let offset_seconds = match offset {
        UtcOffset::Minutes(minutes) => minutes * 60,
        UtcOffset::LocalTime => {
            i64::from(with_local_zone(|zone| local_offset_seconds(naive, zone))?)
        }
    };
    Some(((seconds - offset_seconds) * 1000 + i64::from(millis)) as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utc_fields_preserve_dates_across_epoch_and_midnight() {
        let before_epoch = Zone::Utc.at_millis(-1).unwrap();
        assert_eq!(
            before_epoch.date,
            Date {
                year: 1969,
                month: 12,
                day: 31
            }
        );
        assert_eq!(
            (before_epoch.hour, before_epoch.minute, before_epoch.second),
            (23, 59, 59)
        );
        assert_eq!(before_epoch.weekday_sunday, 3);

        let epoch = Zone::Utc.at_seconds(0).unwrap();
        assert_eq!(
            epoch.date,
            Date {
                year: 1970,
                month: 1,
                day: 1
            }
        );
        assert_eq!((epoch.hour, epoch.minute, epoch.second), (0, 0, 0));
        assert_eq!(epoch.weekday_sunday, 4);
        assert_eq!(Zone::Utc.at_seconds(86_399).unwrap().date, epoch.date);
        assert_ne!(Zone::Utc.at_seconds(86_400).unwrap().date, epoch.date);
        assert_eq!(Zone::Utc.at_seconds(i64::MAX), None);
        assert_eq!(Zone::Utc.at_millis(i64::MIN), None);
    }

    #[test]
    fn local_clock_rejects_invalid_dates_and_truncates_fractional_millis() {
        for millis in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY, 8.64e15 + 1.0] {
            assert_eq!(local_clock(millis), None);
        }
        assert_eq!(local_clock(-0.9), local_clock(0.9));
        let clock = local_clock(0.0).unwrap();
        assert_eq!(clock.len(), 8);
        assert_eq!(&clock[2..3], ":");
        assert_eq!(&clock[5..6], ":");
    }

    #[test]
    fn iso_offsets_cross_epoch_without_losing_fraction_precision() {
        assert_eq!(
            parse_iso_millis("1970-01-01T00:30:00+01:00"),
            Some(-1_800_000.0)
        );
        assert_eq!(parse_iso_millis("1969-12-31T23:59:59.9999Z"), Some(-1.0));
        assert_eq!(parse_iso_millis("1970-01-01T00:00:00.1Z"), Some(100.0));
        assert_eq!(parse_iso_millis("-000000-01-01"), None);
    }

    #[test]
    fn local_offsets_preserve_gap_and_repeated_hour_handling() {
        let zone = TimeZone::from_posix_tz("EST5EDT,M3.2.0,M11.1.0").unwrap();
        let skipped = UtcDateTime::new(2026, 3, 8, 2, 30, 0, 0).unwrap();
        let repeated = UtcDateTime::new(2026, 11, 1, 1, 30, 0, 0).unwrap();
        assert_eq!(
            local_offset_seconds(skipped, zone.as_ref()),
            Some(-5 * 3600)
        );
        assert_eq!(
            local_offset_seconds(repeated, zone.as_ref()),
            Some(-4 * 3600)
        );
    }

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
            ("+010000-01-01T00:00:00Z", Some(253_402_300_800_000.0)),
            ("2025-02-31", Some(1_740_960_000_000.0)),
            ("2025-01-01T24:00:00Z", Some(1_735_776_000_000.0)),
            ("2025-02-32", None),
            ("2025-01-01T24:00:01Z", None),
            ("2026-11-15T13:13:60Z", None),
            ("2026-11-15T13:13:06Z ", None),
            ("2026-11-15T13:13:06.Z", None),
            ("soon", None),
        ] {
            assert_eq!(parse_iso_millis(text), expected, "{text}");
        }
    }
}
