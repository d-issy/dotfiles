use chrono::{Datelike, Local, TimeZone, Timelike};
use serde_json::Value;
use std::io::Read;
use std::process::Command;

const DIM: &str = "\x1b[2m";
const GREEN: &str = "\x1b[32m";
const YELLOW: &str = "\x1b[33m";
const RED: &str = "\x1b[31m";
const CYAN: &str = "\x1b[36m";
const RESET: &str = "\x1b[0m";

const WEEKDAYS: [&str; 7] = ["日", "月", "火", "水", "木", "金", "土"];

fn format_tokens(n: i64) -> String {
    if n == 1_000_000 {
        "1M".to_string()
    } else if n >= 1_000_000 {
        let t = (n + 50_000) / 100_000;
        format!("{}.{}M", t / 10, t % 10)
    } else if n >= 1000 {
        format!("{}K", (n + 500) / 1000)
    } else {
        n.to_string()
    }
}

/// Local reset time as HH:MM, prefixed with the weekday when it is not today.
/// Returns None when the epoch is not representable.
fn fmt_reset<Tz: TimeZone>(reset: i64, now: i64, tz: &Tz) -> Option<String> {
    let at = tz.timestamp_opt(reset, 0).single()?;
    let today = tz.timestamp_opt(now, 0).single()?;
    let clock = format!("{:02}:{:02}", at.hour(), at.minute());
    if at.date_naive() == today.date_naive() {
        Some(clock)
    } else {
        let wday = at.weekday().num_days_from_sunday() as usize;
        Some(format!("{} {clock}", WEEKDAYS[wday]))
    }
}

fn usage_seg<Tz: TimeZone>(
    used: Option<i64>,
    label: &str,
    reset: Option<i64>,
    now: i64,
    tz: &Tz,
) -> String {
    let Some(used) = used else {
        return String::new();
    };
    let color = if used <= 50 {
        GREEN
    } else if used <= 80 {
        YELLOW
    } else {
        RED
    };
    let mut seg = format!("{DIM}{label}{RESET}{color}{used}%{RESET}");
    if color != GREEN
        && let Some(at) = reset.and_then(|r| fmt_reset(r, now, tz))
    {
        seg.push_str(&format!(" {color}{at}{RESET}"));
    }
    seg
}

/// jq `//`: null, false and missing fall through to the default.
fn field<'a>(v: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut cur = v;
    for key in path {
        cur = cur.get(key)?;
    }
    match cur {
        Value::Null | Value::Bool(false) => None,
        other => Some(other),
    }
}

fn to_text(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

fn floor_int(v: Option<&Value>, default: i64) -> i64 {
    match v.and_then(Value::as_f64) {
        Some(f) => f.floor() as i64,
        None => default,
    }
}

fn epoch(v: Option<&Value>) -> Option<i64> {
    match v? {
        Value::Number(n) => n.as_f64().map(|f| f as i64),
        Value::String(s) => s.parse().ok(),
        _ => None,
    }
}

fn render<Tz: TimeZone>(input: &str, branch: &str, now: i64, tz: &Tz) -> String {
    // An unparsable document leaves every field empty, as the jq pipeline did.
    let parsed: Option<Value> = serde_json::from_str(input).ok();
    let (model, effort, context_size, current, used5, used7, reset5, reset7);
    match &parsed {
        Some(v) => {
            model = field(v, &["model", "display_name"]).map_or("Unknown".to_string(), to_text);
            effort = field(v, &["effort", "level"]).map_or(String::new(), to_text);
            context_size = floor_int(
                field(v, &["context_window", "context_window_size"]),
                200_000,
            );
            let usage = |k: &str| floor_int(field(v, &["context_window", "current_usage", k]), 0);
            current = usage("input_tokens")
                + usage("cache_creation_input_tokens")
                + usage("cache_read_input_tokens");
            let pct = |k: &str| {
                field(v, &["rate_limits", k, "used_percentage"])
                    .and_then(Value::as_f64)
                    .map(|f| f.round() as i64)
            };
            used5 = pct("five_hour");
            used7 = pct("seven_day");
            reset5 = epoch(field(v, &["rate_limits", "five_hour", "resets_at"]));
            reset7 = epoch(field(v, &["rate_limits", "seven_day", "resets_at"]));
        }
        None => {
            model = String::new();
            effort = String::new();
            context_size = 0;
            current = 0;
            used5 = None;
            used7 = None;
            reset5 = None;
            reset7 = None;
        }
    }
    let model = model.replacen(" context)", ")", 1);

    let total_used = current;
    let pct10 = if context_size > 0 {
        (total_used * 1000 + context_size / 2) / context_size
    } else {
        0
    };
    let used_pct = format!("{}.{}", pct10 / 10, pct10 % 10);

    let mut out = model;
    if !effort.is_empty() {
        out.push_str(&format!("{DIM}:{RESET}{effort}"));
    }
    if !branch.is_empty() {
        out.push_str(&format!(" {DIM}|{RESET} {CYAN}{branch}{RESET}"));
    }

    if total_used != 0 {
        let color = if pct10 <= 500 {
            GREEN
        } else if pct10 <= 800 {
            YELLOW
        } else {
            RED
        };
        out.push_str(&format!(
            " {DIM}|{RESET} {color}{}{RESET}{DIM}/{}{RESET} {color}({used_pct}%){RESET}",
            format_tokens(total_used),
            format_tokens(context_size),
        ));
    }

    let five = usage_seg(used5, "5h ", reset5, now, tz);
    let seven = usage_seg(used7, "7d ", reset7, now, tz);
    if !five.is_empty() || !seven.is_empty() {
        out.push_str(&format!(" {DIM}|{RESET}"));
        if !five.is_empty() {
            out.push(' ');
            out.push_str(&five);
        }
        if !seven.is_empty() {
            out.push(' ');
            out.push_str(&seven);
        }
    }
    out
}

fn git_branch() -> String {
    Command::new("git")
        .args(["branch", "--show-current"])
        .stderr(std::process::Stdio::null())
        .output()
        .ok()
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .trim_end_matches('\n')
                .to_string()
        })
        .unwrap_or_default()
}

fn main() {
    let mut raw = Vec::new();
    let _ = std::io::stdin().read_to_end(&mut raw);
    let input = String::from_utf8_lossy(&raw);
    let now = chrono::Utc::now().timestamp();
    println!("{}", render(&input, &git_branch(), now, &Local));
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    const GOLDEN_FULL: &str = "Opus 5 (1M)\x1b[2m:\x1b[0mhigh \x1b[2m|\x1b[0m \x1b[36mmain\x1b[0m \x1b[2m|\x1b[0m \x1b[33m751K\x1b[0m\x1b[2m/1M\x1b[0m \x1b[33m(75.1%)\x1b[0m \x1b[2m|\x1b[0m \x1b[2m5h \x1b[0m\x1b[33m62%\x1b[0m \x1b[33m23:13\x1b[0m \x1b[2m7d \x1b[0m\x1b[31m92%\x1b[0m \x1b[31m日 13:20\x1b[0m";
    const GOLDEN_MINIMAL: &str = "Unknown \x1b[2m|\x1b[0m \x1b[36mmain\x1b[0m";

    #[test]
    fn tokens() {
        assert_eq!(format_tokens(0), "0");
        assert_eq!(format_tokens(999), "999");
        assert_eq!(format_tokens(1000), "1K");
        assert_eq!(format_tokens(1499), "1K");
        assert_eq!(format_tokens(1500), "2K");
        assert_eq!(format_tokens(200_000), "200K");
        assert_eq!(format_tokens(999_999), "1000K");
        assert_eq!(format_tokens(1_000_000), "1M");
        assert_eq!(format_tokens(1_050_000), "1.1M");
        assert_eq!(format_tokens(1_049_999), "1.0M");
        assert_eq!(format_tokens(2_500_000), "2.5M");
    }

    #[test]
    fn reset_today_and_other_day() {
        let now = 1_700_000_000; // 2023-11-14 22:13:20 UTC (Tue)
        assert_eq!(fmt_reset(now + 600, now, &Utc).as_deref(), Some("22:23"));
        assert_eq!(
            fmt_reset(now + 86_400, now, &Utc).as_deref(),
            Some("水 22:13")
        );
        assert_eq!(
            fmt_reset(now + 4 * 86_400, now, &Utc).as_deref(),
            Some("土 22:13")
        );
    }

    #[test]
    fn usage_colors() {
        let now = 1_700_000_000;
        assert_eq!(
            usage_seg(Some(50), "5h ", Some(now + 60), now, &Utc),
            format!("{DIM}5h {RESET}{GREEN}50%{RESET}")
        );
        assert_eq!(
            usage_seg(Some(51), "5h ", Some(now + 60), now, &Utc),
            format!("{DIM}5h {RESET}{YELLOW}51%{RESET} {YELLOW}22:14{RESET}")
        );
        assert_eq!(
            usage_seg(Some(81), "7d ", None, now, &Utc),
            format!("{DIM}7d {RESET}{RED}81%{RESET}")
        );
        assert_eq!(usage_seg(None, "7d ", None, now, &Utc), "");
    }

    #[test]
    fn golden_full() {
        let input = r#"{"model":{"display_name":"Opus 5 (1M context)"},"effort":{"level":"high"},"context_window":{"context_window_size":1000000,"current_usage":{"input_tokens":1200,"cache_creation_input_tokens":300000,"cache_read_input_tokens":450000}},"rate_limits":{"five_hour":{"used_percentage":62.4,"resets_at":1700003600},"seven_day":{"used_percentage":91.6,"resets_at":1700400000}}}"#;
        assert_eq!(render(input, "main", 1_700_000_000, &Utc), GOLDEN_FULL);
    }

    #[test]
    fn golden_minimal() {
        assert_eq!(render("{}", "main", 1_700_000_000, &Utc), GOLDEN_MINIMAL);
    }
}
