use crate::js;

struct Elapsed {
    seconds: f64,
    minutes: f64,
    hours: f64,
}

impl Elapsed {
    fn from_ms(ms: f64) -> Self {
        let seconds = (ms / 1000.0).floor().max(0.0);
        let minutes = (seconds / 60.0).floor();
        Self {
            seconds,
            minutes,
            hours: (minutes / 60.0).floor(),
        }
    }
}

fn num(value: f64) -> String {
    js::number_to_string(value)
}

fn two_digits(value: f64) -> String {
    format!("{:0>2}", num(value))
}

pub fn format_age(ms: f64) -> String {
    let Elapsed {
        seconds,
        minutes,
        hours,
    } = Elapsed::from_ms(ms);
    if seconds < 60.0 {
        format!("{}s", num(seconds))
    } else if minutes < 60.0 {
        format!("{}m", num(minutes))
    } else if hours < 48.0 {
        format!("{}h", num(hours))
    } else {
        format!("{}d", num((hours / 24.0).floor()))
    }
}

/// Compact duration such as `45s`, `12m05s`, or `1h05m`.
pub fn format_duration(ms: f64) -> String {
    let Elapsed {
        seconds,
        minutes,
        hours,
    } = Elapsed::from_ms(ms);
    if seconds < 60.0 {
        format!("{}s", num(seconds))
    } else if minutes < 60.0 {
        format!("{}m{}s", num(minutes), two_digits(seconds % 60.0))
    } else if hours < 48.0 {
        format!("{}h{}m", num(hours), two_digits(minutes % 60.0))
    } else {
        format!(
            "{}d{}h",
            num((hours / 24.0).floor()),
            two_digits(hours % 24.0)
        )
    }
}

pub fn format_turn_time(elapsed: Option<f64>) -> String {
    elapsed.map_or_else(|| "-".to_string(), format_duration)
}

/// Local `HH:MM:SS`, or `NaN:NaN:NaN` outside the JavaScript `Date` range.
pub fn format_clock(time: f64) -> String {
    dot::time::local_clock(time).unwrap_or_else(|| "NaN:NaN:NaN".into())
}

/// Parse durations like `30m`, `2h`, or `1d` into milliseconds; bare numbers
/// are minutes.
pub fn parse_duration(value: &str) -> Option<f64> {
    let value = js::trim(value);
    let digits_end = value
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(value.len());
    let (number, unit) = value.split_at(digits_end);
    if number.is_empty() {
        return None;
    }
    let scale = match unit {
        "s" => 1000.0,
        "" | "m" => 60_000.0,
        "h" => 3_600_000.0,
        "d" => 86_400_000.0,
        _ => return None,
    };
    Some(number.parse::<f64>().ok()? * scale)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_durations() {
        assert_eq!(parse_duration("30"), Some(1_800_000.0));
        assert_eq!(parse_duration("2h"), Some(7_200_000.0));
        assert_eq!(parse_duration("1d"), Some(86_400_000.0));
        assert_eq!(parse_duration("soon"), None);
    }

    #[test]
    fn formats_durations() {
        for (ms, text) in [
            (45_000.0, "45s"),
            (725_000.0, "12m05s"),
            (3_900_000.0, "1h05m"),
            (180_000_000.0, "2d02h"),
        ] {
            assert_eq!(format_duration(ms), text, "formats {ms} ms");
        }
    }
}
