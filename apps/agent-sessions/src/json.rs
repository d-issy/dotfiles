//! JSON helpers mirroring JavaScript semantics (`JSON.stringify`, `Date.parse`,
//! property order, and number formatting).

use std::sync::LazyLock;

use chrono::{Local, NaiveDate, NaiveDateTime, NaiveTime, Offset, TimeZone};
use serde_json::{Map, Value};

use crate::text::js_trim;
use crate::types::JsonObject;

static EMPTY: LazyLock<JsonObject> = LazyLock::new(Map::new);

pub fn str_of(value: Option<&Value>) -> Option<&str> {
    value.and_then(Value::as_str)
}

pub fn obj_of(value: Option<&Value>) -> &JsonObject {
    value.and_then(Value::as_object).unwrap_or(&EMPTY)
}

pub fn arr_of(value: Option<&Value>) -> &[Value] {
    value.and_then(Value::as_array).map_or(&[], Vec::as_slice)
}

/// Non-empty string (JavaScript truthiness for a string field).
pub fn truthy_str(value: Option<&Value>) -> Option<&str> {
    str_of(value).filter(|text| !text.is_empty())
}

pub fn parse_json_line(line: &str) -> Option<JsonObject> {
    if js_trim(line).is_empty() {
        return None;
    }
    match serde_json::from_str::<Value>(line) {
        Ok(Value::Object(map)) => Some(map),
        _ => None,
    }
}

pub fn parse_time(value: Option<&Value>) -> Option<f64> {
    match value? {
        Value::Number(number) => number.as_f64(),
        Value::String(text) => date_parse(text),
        _ => None,
    }
}

fn digits(bytes: &[u8], pos: &mut usize, count: usize) -> Option<u32> {
    let slice = bytes.get(*pos..*pos + count)?;
    if !slice.iter().all(u8::is_ascii_digit) {
        return None;
    }
    *pos += count;
    std::str::from_utf8(slice).ok()?.parse().ok()
}

/// `Date.parse` for ISO 8601 date-time strings (the format agents write).
/// Date-only forms are UTC; date-times without an offset are local time.
pub fn date_parse(text: &str) -> Option<f64> {
    let bytes = text.as_bytes();
    let mut pos = 0;
    let year: i32 = match bytes.first()? {
        sign @ (b'+' | b'-') => {
            pos += 1;
            let value = i32::try_from(digits(bytes, &mut pos, 6)?).ok()?;
            if *sign == b'-' {
                if value == 0 {
                    return None;
                }
                -value
            } else {
                value
            }
        }
        _ => i32::try_from(digits(bytes, &mut pos, 4)?).ok()?,
    };
    let mut month = 1;
    let mut day = 1;
    if bytes.get(pos) == Some(&b'-') {
        pos += 1;
        month = digits(bytes, &mut pos, 2)?;
        if bytes.get(pos) == Some(&b'-') {
            pos += 1;
            day = digits(bytes, &mut pos, 2)?;
        }
    }
    // Like V8, any day 1-31 is accepted and overflows into the next month.
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    let date = NaiveDate::from_ymd_opt(year, month, 1)?
        .checked_add_days(chrono::Days::new(u64::from(day - 1)))?;
    if pos == bytes.len() {
        return Some(date.and_time(NaiveTime::MIN).and_utc().timestamp_millis() as f64);
    }
    if !matches!(bytes.get(pos), Some(b'T' | b't' | b' ')) {
        return None;
    }
    pos += 1;
    let hour = digits(bytes, &mut pos, 2)?;
    if bytes.get(pos) != Some(&b':') {
        return None;
    }
    pos += 1;
    let minute = digits(bytes, &mut pos, 2)?;
    let mut second = 0;
    let mut millis = 0;
    if bytes.get(pos) == Some(&b':') {
        pos += 1;
        second = digits(bytes, &mut pos, 2)?;
        if matches!(bytes.get(pos), Some(b'.' | b',')) {
            pos += 1;
            let start = pos;
            while bytes.get(pos).is_some_and(u8::is_ascii_digit) {
                pos += 1;
            }
            if pos == start {
                return None;
            }
            let fraction = &text[start..pos.min(start + 3)];
            millis = format!("{fraction:0<3}").parse().ok()?;
        }
    }
    let offset_minutes: Option<i64> = match bytes.get(pos) {
        None => None,
        Some(b'Z') => {
            pos += 1;
            Some(0)
        }
        Some(sign @ (b'+' | b'-')) => {
            let negative = *sign == b'-';
            pos += 1;
            let hours = i64::from(digits(bytes, &mut pos, 2)?);
            if bytes.get(pos) == Some(&b':') {
                pos += 1;
            }
            let minutes = i64::from(digits(bytes, &mut pos, 2)?);
            if hours > 23 || minutes > 59 {
                return None;
            }
            let total = hours * 60 + minutes;
            Some(if negative { -total } else { total })
        }
        Some(_) => return None,
    };
    if pos != bytes.len() {
        return None;
    }
    let (date, hour) = if hour == 24 {
        if minute != 0 || second != 0 || millis != 0 {
            return None;
        }
        (date.succ_opt()?, 0)
    } else {
        (date, hour)
    };
    let time = NaiveTime::from_hms_milli_opt(hour, minute, second, millis)?;
    let naive = NaiveDateTime::new(date, time);
    let utc = naive.and_utc().timestamp_millis();
    let millis = match offset_minutes {
        Some(offset) => utc - offset * 60_000,
        None => {
            let offset = match Local.from_local_datetime(&naive).earliest() {
                Some(local) => local.offset().fix(),
                None => Local.offset_from_utc_datetime(&naive).fix(),
            };
            utc - i64::from(offset.local_minus_utc()) * 1000
        }
    };
    Some(millis as f64)
}

/// `Number.prototype.toString()` for a double.
pub fn js_num(value: f64) -> String {
    if value.is_nan() {
        return "NaN".into();
    }
    if value.is_infinite() {
        return if value > 0.0 { "Infinity" } else { "-Infinity" }.into();
    }
    if value == 0.0 {
        return "0".into();
    }
    let sign = if value < 0.0 { "-" } else { "" };
    // Shortest round-trip digits and exponent, e.g. "1.2345e-7".
    let sci = format!("{:e}", value.abs());
    let (mantissa, exponent) = sci.split_once('e').unwrap_or((&sci, "0"));
    let digits: String = mantissa.chars().filter(char::is_ascii_digit).collect();
    let k = digits.len() as i64;
    let n = exponent.parse::<i64>().unwrap_or(0) + 1;
    let body = if k <= n && n <= 21 {
        format!("{digits}{}", "0".repeat((n - k) as usize))
    } else if 0 < n && n <= 21 {
        let (head, tail) = digits.split_at(n as usize);
        format!("{head}.{tail}")
    } else if -6 < n && n <= 0 {
        format!("0.{}{digits}", "0".repeat((-n) as usize))
    } else {
        let exp = n - 1;
        let exp_sign = if exp < 0 { "-" } else { "+" };
        let (head, tail) = digits.split_at(1);
        if tail.is_empty() {
            format!("{head}e{exp_sign}{}", exp.abs())
        } else {
            format!("{head}.{tail}e{exp_sign}{}", exp.abs())
        }
    };
    format!("{sign}{body}")
}

fn is_array_index(key: &str) -> bool {
    if key.is_empty() || !key.bytes().all(|byte| byte.is_ascii_digit()) {
        return false;
    }
    if key.len() > 1 && key.starts_with('0') {
        return false;
    }
    key.parse::<u64>()
        .is_ok_and(|index| index < u64::from(u32::MAX))
}

/// Object entries in JavaScript property order: array indices ascending first,
/// then the remaining keys in insertion order.
pub fn js_entries(map: &JsonObject) -> Vec<(&String, &Value)> {
    let mut indices: Vec<(u64, (&String, &Value))> = map
        .iter()
        .filter(|(key, _)| is_array_index(key))
        .map(|entry| (entry.0.parse().unwrap_or(0), entry))
        .collect();
    indices.sort_by_key(|(index, _)| *index);
    indices
        .into_iter()
        .map(|(_, entry)| entry)
        .chain(map.iter().filter(|(key, _)| !is_array_index(key)))
        .collect()
}

fn quote(text: &str, out: &mut String) {
    out.push('"');
    for char in text.chars() {
        match char {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

fn stringify_into(value: &Value, out: &mut String) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(flag) => out.push_str(if *flag { "true" } else { "false" }),
        Value::Number(number) => match number.as_f64() {
            Some(float) if float.is_finite() => out.push_str(&js_num(float)),
            _ => out.push_str("null"),
        },
        Value::String(text) => quote(text, out),
        Value::Array(items) => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                stringify_into(item, out);
            }
            out.push(']');
        }
        Value::Object(map) => {
            out.push('{');
            for (index, (key, item)) in js_entries(map).into_iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                quote(key, out);
                out.push(':');
                stringify_into(item, out);
            }
            out.push('}');
        }
    }
}

/// `JSON.stringify(value)` for a parsed JSON value.
pub fn js_stringify(value: &Value) -> String {
    let mut out = String::new();
    stringify_into(value, &mut out);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn formats_numbers_like_javascript() {
        assert_eq!(js_num(1.0), "1");
        assert_eq!(js_num(-2.5), "-2.5");
        assert_eq!(js_num(1e21), "1e+21");
        assert_eq!(js_num(1.5e-7), "1.5e-7");
        assert_eq!(js_num(0.000_001), "0.000001");
        assert_eq!(js_num(123_456_789_012.0), "123456789012");
    }

    #[test]
    fn stringifies_like_javascript() {
        let value: Value =
            serde_json::from_str(r#"{"b":1.0,"2":"x\u0001","a":[true,null],"1":{}}"#).unwrap();
        assert_eq!(
            js_stringify(&value),
            r#"{"1":{},"2":"x\u0001","b":1,"a":[true,null]}"#
        );
        assert_eq!(js_stringify(&json!("q\"")), r#""q\"""#);
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
