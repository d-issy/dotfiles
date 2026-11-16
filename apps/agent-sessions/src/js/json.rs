use std::fmt::Write;

use dot::json::{Map, Value};

/// `Number.prototype.toString()`.
pub fn number_to_string(value: f64) -> String {
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
    let scientific = format!("{:e}", value.abs());
    let (mantissa, exponent) = scientific.split_once('e').unwrap_or((&scientific, "0"));
    let digits: String = mantissa.chars().filter(char::is_ascii_digit).collect();
    let k = digits.len();
    let n = exponent.parse::<isize>().unwrap_or(0) + 1;
    let body = match usize::try_from(n) {
        Ok(n) if k <= n && n <= 21 => format!("{digits}{}", "0".repeat(n - k)),
        Ok(n) if 0 < n && n <= 21 => {
            let (head, tail) = digits.split_at(n);
            format!("{head}.{tail}")
        }
        _ if -6 < n && n <= 0 => format!("0.{}{digits}", "0".repeat(n.unsigned_abs())),
        _ => {
            let exponent = n - 1;
            let exponent_sign = if exponent < 0 { "-" } else { "+" };
            let (head, tail) = digits.split_at(1);
            let fraction = if tail.is_empty() {
                String::new()
            } else {
                format!(".{tail}")
            };
            format!(
                "{head}{fraction}e{exponent_sign}{}",
                exponent.unsigned_abs()
            )
        }
    };
    format!("{sign}{body}")
}

fn array_index(key: &str) -> Option<u32> {
    let canonical = !key.is_empty()
        && key.bytes().all(|byte| byte.is_ascii_digit())
        && (key.len() == 1 || !key.starts_with('0'));
    key.parse::<u32>()
        .ok()
        .filter(|index| canonical && *index < u32::MAX)
}

/// Entries in JavaScript property order: array indices ascending, then the
/// remaining keys in insertion order.
pub fn property_order(map: &Map) -> Vec<(&String, &Value)> {
    let mut indexed: Vec<_> = map
        .iter()
        .filter_map(|entry| array_index(entry.0).map(|index| (index, entry)))
        .collect();
    indexed.sort_by_key(|(index, _)| *index);
    indexed
        .into_iter()
        .map(|(_, entry)| entry)
        .chain(map.iter().filter(|(key, _)| array_index(key).is_none()))
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
            c if u32::from(c) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", u32::from(c));
            }
            c => out.push(c),
        }
    }
    out.push('"');
}

fn write_value(value: &Value, out: &mut String) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(flag) => out.push_str(if *flag { "true" } else { "false" }),
        Value::Number(number) => match number.as_f64() {
            Some(float) if float.is_finite() => out.push_str(&number_to_string(float)),
            _ => out.push_str("null"),
        },
        Value::String(text) => quote(text, out),
        Value::Array(items) => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_value(item, out);
            }
            out.push(']');
        }
        Value::Object(map) => {
            out.push('{');
            for (index, (key, item)) in property_order(map).into_iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                quote(key, out);
                out.push(':');
                write_value(item, out);
            }
            out.push('}');
        }
    }
}

/// `JSON.stringify`.
pub fn stringify(value: &Value) -> String {
    let mut out = String::new();
    write_value(value, &mut out);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use dot::json::json;

    #[test]
    fn formats_numbers_like_javascript() {
        assert_eq!(number_to_string(1.0), "1");
        assert_eq!(number_to_string(-2.5), "-2.5");
        assert_eq!(number_to_string(1e21), "1e+21");
        assert_eq!(number_to_string(1.5e-7), "1.5e-7");
        assert_eq!(number_to_string(0.000_001), "0.000001");
        assert_eq!(number_to_string(123_456_789_012.0), "123456789012");
    }

    #[test]
    fn stringifies_like_javascript() {
        let value: Value =
            dot::json::from_str(r#"{"b":1.0,"2":"x\u0001","a":[true,null],"1":{}}"#).unwrap();
        assert_eq!(
            stringify(&value),
            r#"{"1":{},"2":"x\u0001","b":1,"a":[true,null]}"#
        );
        assert_eq!(stringify(&json!("q\"")), r#""q\"""#);
    }
}
