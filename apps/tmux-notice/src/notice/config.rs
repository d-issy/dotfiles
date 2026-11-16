use crate::error::Error;
use dot::config::Object;
use dot::json::{self, Decode, Value};
use dot::regex::Regex;
use std::collections::BTreeMap;
use std::fmt;

#[derive(Default, Clone, Copy, PartialEq, Eq, Debug)]
pub enum TitleMode {
    #[default]
    Current,
    Name,
    Notice,
    None,
}

impl fmt::Display for TitleMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Current => "current",
            Self::Name => "name",
            Self::Notice => "notice",
            Self::None => "none",
        })
    }
}

pub struct PaneTitle {
    pub enable: bool,
    pub template: String,
}

impl Default for PaneTitle {
    fn default() -> Self {
        Self {
            enable: false,
            template: "{icon} {title}".to_string(),
        }
    }
}

impl PaneTitle {
    pub fn render(&self, icon: &str, title: &str, name: &str) -> String {
        self.template
            .replace("{icon}", icon)
            .replace("{title}", title)
            .replace("{name}", name)
    }
}

#[derive(Default)]
pub struct Notice {
    pub icons: Vec<String>,
    pub title: Option<String>,
    pub session_notification_indicator_color: Option<String>,
    pub title_mode: TitleMode,
    pub title_strip_patterns: Vec<String>,
    pub pane_title: PaneTitle,
}

const DEFAULT_ICON: &str = "•";

impl Notice {
    pub fn first_icon(&self) -> &str {
        self.icons.first().map_or(DEFAULT_ICON, String::as_str)
    }

    pub fn joined_icons(&self) -> String {
        if self.icons.is_empty() {
            DEFAULT_ICON.to_string()
        } else {
            self.icons.join("|")
        }
    }

    fn strip(&self, value: &str) -> Result<String, Error> {
        let mut out = value.to_string();
        for pattern in &self.title_strip_patterns {
            let re = Regex::new(pattern).map_err(|source| Error::InvalidPattern {
                pattern: pattern.clone(),
                source,
            })?;
            // First match only, like jq's `sub`.
            out = re.replace_literal(&out, "");
        }
        Ok(out)
    }

    pub fn derive_title(&self, current: &str, name: &str) -> Result<String, Error> {
        let fallback = self.title.as_deref().unwrap_or(name);
        match self.title_mode {
            TitleMode::None => Ok(String::new()),
            TitleMode::Name => self.strip(name),
            TitleMode::Notice => self.strip(fallback),
            TitleMode::Current => {
                let stripped = self.strip(current)?;
                if stripped.is_empty() {
                    self.strip(fallback)
                } else {
                    Ok(stripped)
                }
            }
        }
    }
}

#[derive(Default)]
pub struct Config {
    pub fallback: Notice,
    pub notices: BTreeMap<String, Notice>,
}

impl Config {
    pub fn load() -> Result<Self, Error> {
        let path = std::env::var("TMUX_NOTICE_CONFIG").map_err(|_| Error::ConfigEnvMissing)?;
        let text = std::fs::read_to_string(&path).map_err(|source| Error::ConfigRead {
            path: path.clone(),
            source,
        })?;
        json::from_str(&text).map_err(|source| Error::ConfigParse { path, source })
    }

    pub fn notice(&self, name: &str) -> &Notice {
        self.notices.get(name).unwrap_or(&self.fallback)
    }
}

impl Decode for TitleMode {
    fn decode(value: Value) -> Result<Self, json::Error> {
        match String::decode(value)?.as_str() {
            "current" => Ok(Self::Current),
            "name" => Ok(Self::Name),
            "notice" => Ok(Self::Notice),
            "none" => Ok(Self::None),
            other => Err(json::Error::new(format!("unknown title mode `{other}`"))),
        }
    }
}

impl Decode for PaneTitle {
    fn decode(value: Value) -> Result<Self, json::Error> {
        let mut object = Object::new(value)?;
        let defaults = Self::default();
        Ok(Self {
            enable: object.field_or("enable", defaults.enable)?,
            template: object.field_or("template", defaults.template)?,
        })
    }
}

impl Decode for Notice {
    fn decode(value: Value) -> Result<Self, json::Error> {
        let mut object = Object::new(value)?;
        let defaults = Self::default();
        Ok(Self {
            icons: object.field_or("icons", defaults.icons)?,
            title: object.field_or("title", defaults.title)?,
            session_notification_indicator_color: object.field_or(
                "sessionNotificationIndicatorColor",
                defaults.session_notification_indicator_color,
            )?,
            title_mode: object.field_or("titleMode", defaults.title_mode)?,
            title_strip_patterns: object
                .field_or("titleStripPatterns", defaults.title_strip_patterns)?,
            pane_title: object.field_or("paneTitle", defaults.pane_title)?,
        })
    }
}

impl Decode for Config {
    fn decode(value: Value) -> Result<Self, json::Error> {
        let mut object = Object::new(value)?;
        let defaults = Self::default();
        Ok(Self {
            fallback: object.field_or("fallback", defaults.fallback)?,
            notices: object.field_or("notices", defaults.notices)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn notice(json: &str) -> Notice {
        json::from_str(json).unwrap()
    }

    #[test]
    fn title_modes() {
        let n = notice(
            r#"{"titleMode":"current","titleStripPatterns":["^pi - ","\\s+$"],"title":"Fallback"}"#,
        );
        assert_eq!(n.derive_title("pi - work  ", "done").unwrap(), "work");
        assert_eq!(n.derive_title("pi - ", "done").unwrap(), "Fallback");
        let n = notice(r#"{"titleMode":"name","titleStripPatterns":["^x-"]}"#);
        assert_eq!(n.derive_title("cur", "x-done").unwrap(), "done");
        let n = notice(r#"{"titleMode":"notice","title":"Hello"}"#);
        assert_eq!(n.derive_title("cur", "done").unwrap(), "Hello");
        let n = notice(r#"{"titleMode":"notice"}"#);
        assert_eq!(n.derive_title("cur", "done").unwrap(), "done");
        let n = notice(r#"{"titleMode":"none","title":"x"}"#);
        assert_eq!(n.derive_title("cur", "done").unwrap(), "");
        let n = notice("{}");
        assert_eq!(n.derive_title("cur", "done").unwrap(), "cur");
    }

    #[test]
    fn strip_replaces_first_match_only() {
        let n = notice(r#"{"titleStripPatterns":["a"]}"#);
        assert_eq!(n.strip("banana").unwrap(), "bnana");
    }

    #[test]
    fn invalid_pattern_is_an_error() {
        let n = notice(r#"{"titleStripPatterns":["("]}"#);
        assert_eq!(n.strip("x").unwrap_err().exit_code(), 5);
    }

    #[test]
    fn template_rendering() {
        let pane_title = PaneTitle {
            enable: true,
            template: "{icon} {title} [{name}]".to_string(),
        };
        assert_eq!(pane_title.render("•", "T", "done"), "• T [done]");
    }

    #[test]
    fn icons() {
        let n = notice(r#"{"icons":["a","b"]}"#);
        assert_eq!(n.first_icon(), "a");
        assert_eq!(n.joined_icons(), "a|b");
        let n = notice(r#"{"icons":[]}"#);
        assert_eq!(n.first_icon(), "•");
        assert_eq!(n.joined_icons(), "•");
        assert_eq!(notice("{}").first_icon(), "•");
    }
}

#[cfg(test)]
mod decode_tests {
    use super::*;

    #[test]
    fn preserves_notice_defaults_and_optional_nulls() {
        let notice: Notice =
            json::from_str(r#"{"title":null,"paneTitle":{"enable":true},"unknown":1}"#).unwrap();
        assert_eq!(notice.title, None);
        assert_eq!(notice.title_mode, TitleMode::Current);
        assert!(notice.pane_title.enable);
        assert_eq!(notice.pane_title.template, "{icon} {title}");
        assert!(json::from_str::<Config>("{}").unwrap().notices.is_empty());
    }

    #[test]
    fn rejects_wrong_types_and_invalid_title_modes() {
        for invalid in [
            "null",
            r#"{"icons":null}"#,
            r#"{"titleMode":"Current"}"#,
            r#"{"titleMode":null}"#,
            r#"{"paneTitle":{"enable":1}}"#,
        ] {
            assert!(json::from_str::<Notice>(invalid).is_err(), "{invalid}");
        }
    }
}
