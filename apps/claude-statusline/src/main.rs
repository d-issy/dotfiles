use chrono::{Datelike, Local, TimeZone, Timelike};
use serde_json::Value;
use std::io::Read;
use std::process::{Command, Stdio};

const DIM: &str = "\x1b[2m";
const GREEN: &str = "\x1b[32m";
const YELLOW: &str = "\x1b[33m";
const RED: &str = "\x1b[31m";
const CYAN: &str = "\x1b[36m";
const RESET: &str = "\x1b[0m";

const WEEKDAYS: [&str; 7] = ["日", "月", "火", "水", "木", "金", "土"];
const DEFAULT_CONTEXT_SIZE: i64 = 200_000;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Level {
    Ok,
    Warn,
    Critical,
}

impl Level {
    fn from_thresholds(value: i64, ok_max: i64, warn_max: i64) -> Self {
        if value <= ok_max {
            Self::Ok
        } else if value <= warn_max {
            Self::Warn
        } else {
            Self::Critical
        }
    }

    fn color(self) -> &'static str {
        match self {
            Self::Ok => GREEN,
            Self::Warn => YELLOW,
            Self::Critical => RED,
        }
    }
}

fn format_tokens(n: i64) -> String {
    match n {
        1_000_000 => "1M".to_string(),
        1_000_001.. => {
            let tenths = (n + 50_000) / 100_000;
            format!("{}.{}M", tenths / 10, tenths % 10)
        }
        1000.. => format!("{}K", (n + 500) / 1000),
        _ => n.to_string(),
    }
}

fn fmt_reset<Tz: TimeZone>(reset: i64, now: i64, tz: &Tz) -> Option<String> {
    let at = tz.timestamp_opt(reset, 0).single()?;
    let today = tz.timestamp_opt(now, 0).single()?;
    let clock = format!("{:02}:{:02}", at.hour(), at.minute());
    if at.date_naive() == today.date_naive() {
        Some(clock)
    } else {
        let weekday = WEEKDAYS[at.weekday().num_days_from_sunday() as usize];
        Some(format!("{weekday} {clock}"))
    }
}

struct UsageLimit {
    label: &'static str,
    used: Option<i64>,
    reset: Option<i64>,
}

impl UsageLimit {
    fn render<Tz: TimeZone>(&self, now: i64, tz: &Tz) -> Option<String> {
        let used = self.used?;
        let level = Level::from_thresholds(used, 50, 80);
        let color = level.color();
        let label = self.label;
        let mut seg = format!("{DIM}{label}{RESET}{color}{used}%{RESET}");
        if level != Level::Ok
            && let Some(at) = self.reset.and_then(|r| fmt_reset(r, now, tz))
        {
            seg.push_str(&format!(" {color}{at}{RESET}"));
        }
        Some(seg)
    }
}

struct Status {
    model: String,
    effort: String,
    context_size: i64,
    context_used: i64,
    five_hour: UsageLimit,
    seven_day: UsageLimit,
}

/// jq's `//`: null, false and missing all fall through to the default.
fn field<'a>(v: &'a Value, path: &[&str]) -> Option<&'a Value> {
    path.iter()
        .try_fold(v, |cur, key| cur.get(key))
        .filter(|v| !matches!(v, Value::Null | Value::Bool(false)))
}

fn text(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

fn floor_int(v: Option<&Value>) -> Option<i64> {
    v.and_then(Value::as_f64).map(|f| f.floor() as i64)
}

fn epoch(v: Option<&Value>) -> Option<i64> {
    match v? {
        Value::Number(n) => n.as_f64().map(|f| f as i64),
        Value::String(s) => s.parse().ok(),
        _ => None,
    }
}

impl Status {
    /// With an unparsable document every field is empty, as the old jq pipeline left them.
    fn empty() -> Self {
        let limit = |label| UsageLimit {
            label,
            used: None,
            reset: None,
        };
        Self {
            model: String::new(),
            effort: String::new(),
            context_size: 0,
            context_used: 0,
            five_hour: limit("5h "),
            seven_day: limit("7d "),
        }
    }

    fn from_json(v: &Value) -> Self {
        let usage =
            |key: &str| floor_int(field(v, &["context_window", "current_usage", key])).unwrap_or(0);
        let limit = |label, key: &str| UsageLimit {
            label,
            used: field(v, &["rate_limits", key, "used_percentage"])
                .and_then(Value::as_f64)
                .map(|f| f.round() as i64),
            reset: epoch(field(v, &["rate_limits", key, "resets_at"])),
        };
        Self {
            model: field(v, &["model", "display_name"]).map_or("Unknown".to_string(), text),
            effort: field(v, &["effort", "level"]).map_or(String::new(), text),
            context_size: floor_int(field(v, &["context_window", "context_window_size"]))
                .unwrap_or(DEFAULT_CONTEXT_SIZE),
            context_used: usage("input_tokens")
                + usage("cache_creation_input_tokens")
                + usage("cache_read_input_tokens"),
            five_hour: limit("5h ", "five_hour"),
            seven_day: limit("7d ", "seven_day"),
        }
    }

    fn parse(input: &str) -> Self {
        serde_json::from_str(input)
            .ok()
            .map_or_else(Self::empty, |v| Self::from_json(&v))
    }

    fn used_tenths_of_percent(&self) -> i64 {
        if self.context_size > 0 {
            (self.context_used * 1000 + self.context_size / 2) / self.context_size
        } else {
            0
        }
    }

    fn render<Tz: TimeZone>(&self, branch: &str, now: i64, tz: &Tz) -> String {
        let mut out = self.model.replacen(" context)", ")", 1);
        if !self.effort.is_empty() {
            out.push_str(&format!("{DIM}:{RESET}{}", self.effort));
        }
        if !branch.is_empty() {
            out.push_str(&format!(" {DIM}|{RESET} {CYAN}{branch}{RESET}"));
        }

        if self.context_used != 0 {
            let tenths = self.used_tenths_of_percent();
            let color = Level::from_thresholds(tenths, 500, 800).color();
            out.push_str(&format!(
                " {DIM}|{RESET} {color}{}{RESET}{DIM}/{}{RESET} {color}({}.{}%){RESET}",
                format_tokens(self.context_used),
                format_tokens(self.context_size),
                tenths / 10,
                tenths % 10,
            ));
        }

        let limits: Vec<String> = [&self.five_hour, &self.seven_day]
            .into_iter()
            .filter_map(|limit| limit.render(now, tz))
            .collect();
        if !limits.is_empty() {
            out.push_str(&format!(" {DIM}|{RESET} {}", limits.join(" ")));
        }
        out
    }
}

fn render<Tz: TimeZone>(input: &str, branch: &str, now: i64, tz: &Tz) -> String {
    Status::parse(input).render(branch, now, tz)
}

fn git_branch() -> String {
    Command::new("git")
        .args(["branch", "--show-current"])
        .stderr(Stdio::null())
        .output()
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
    let now = chrono::Utc::now().timestamp();
    println!(
        "{}",
        render(&String::from_utf8_lossy(&raw), &git_branch(), now, &Local)
    );
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
            UsageLimit {
                label: "5h ",
                used: Some(50),
                reset: Some(now + 60)
            }
            .render(now, &Utc)
            .unwrap_or_default(),
            format!("{DIM}5h {RESET}{GREEN}50%{RESET}")
        );
        assert_eq!(
            UsageLimit {
                label: "5h ",
                used: Some(51),
                reset: Some(now + 60)
            }
            .render(now, &Utc)
            .unwrap_or_default(),
            format!("{DIM}5h {RESET}{YELLOW}51%{RESET} {YELLOW}22:14{RESET}")
        );
        assert_eq!(
            UsageLimit {
                label: "7d ",
                used: Some(81),
                reset: None
            }
            .render(now, &Utc)
            .unwrap_or_default(),
            format!("{DIM}7d {RESET}{RED}81%{RESET}")
        );
        assert_eq!(
            UsageLimit {
                label: "7d ",
                used: None,
                reset: None
            }
            .render(now, &Utc)
            .unwrap_or_default(),
            ""
        );
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
