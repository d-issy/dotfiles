use crate::library::{Variable, regex};
use regex::{Captures, Regex};
use serde_json::Value;
use std::collections::HashSet;

pub struct Candidates {
    /// Lines shown as a fixed fzf header (e.g. a table heading).
    pub headers: Vec<String>,
    pub values: Vec<String>,
}

fn display(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::String(text) => Some(text.clone()),
        Value::Number(number) => Some(match (number.as_i64(), number.as_u64(), number.as_f64()) {
            (Some(integer), _, _) => integer.to_string(),
            (_, Some(integer), _) => integer.to_string(),
            (_, _, Some(float)) if float.fract() == 0.0 => format!("{float:.0}"),
            _ => number.to_string(),
        }),
        Value::Bool(flag) => Some(flag.to_string()),
        Value::Array(_) | Value::Object(_) => Some(value.to_string()),
    }
}

/// Walks a path such as "changes[].name": "." separates keys and "[]" expands
/// every element of an array.
pub fn json_values(data: &Value, path: &str) -> Vec<String> {
    let mut current: Vec<&Value> = vec![data];
    for segment in path.split('.').filter(|part| !part.is_empty()) {
        let (key, iterate) = match segment.strip_suffix("[]") {
            Some(key) => (key, true),
            None => (segment, false),
        };
        current = current
            .into_iter()
            .flat_map(|value| {
                let next = if key.is_empty() {
                    Some(value)
                } else {
                    value.as_object().and_then(|object| object.get(key))
                };
                match (iterate, next) {
                    (false, next) => next.into_iter().collect(),
                    (true, Some(Value::Array(items))) => items.iter().collect(),
                    (true, _) => Vec::new(),
                }
            })
            .collect();
    }
    current.into_iter().filter_map(display).collect()
}

fn split(output: &str, variable: &Variable) -> Result<Vec<String>, String> {
    if let Some(path) = &variable.json {
        return Ok(serde_json::from_str::<Value>(output)
            .map(|data| json_values(&data, path))
            .unwrap_or_default());
    }
    let separator = regex(variable.separator.as_deref().unwrap_or("\\r?\\n"))?;
    Ok(separator
        .split(output)
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string)
        .collect())
}

/// Expands `$$`, `$&`, `` $` ``, `$'`, `$1`..`$99` like a JavaScript replacement string.
fn expand(template: &str, captures: &Captures, haystack: &str) -> String {
    let whole = captures.get(0).expect("group 0 always participates");
    let groups = captures.len() - 1;
    let chars: Vec<char> = template.chars().collect();
    let mut out = String::new();
    let mut index = 0;
    while index < chars.len() {
        let c = chars[index];
        let next = chars.get(index + 1).copied();
        if c != '$' {
            out.push(c);
            index += 1;
            continue;
        }
        match next {
            Some('$') => {
                out.push('$');
                index += 2;
            }
            Some('&') => {
                out.push_str(whole.as_str());
                index += 2;
            }
            Some('`') => {
                out.push_str(&haystack[..whole.start()]);
                index += 2;
            }
            Some('\'') => {
                out.push_str(&haystack[whole.end()..]);
                index += 2;
            }
            Some(first) if first.is_ascii_digit() => {
                let one = first.to_digit(10).unwrap_or(0) as usize;
                let two = chars
                    .get(index + 2)
                    .and_then(|c| c.to_digit(10))
                    .map(|second| one * 10 + second as usize);
                let (number, width) = match two {
                    Some(two) if (1..=groups).contains(&two) => (two, 3),
                    _ if (1..=groups).contains(&one) => (one, 2),
                    _ => (0, 0),
                };
                if width == 0 {
                    out.push('$');
                    index += 1;
                } else {
                    out.push_str(captures.get(number).map_or("", |m| m.as_str()));
                    index += width;
                }
            }
            _ => {
                out.push('$');
                index += 1;
            }
        }
    }
    out
}

fn transform(values: Vec<String>, variable: &Variable) -> Result<Vec<String>, String> {
    let mut result = values;
    if let Some(pattern) = &variable.r#match {
        let pattern = regex(pattern)?;
        result = result
            .iter()
            .filter_map(|value| {
                let captures = pattern.captures(value)?;
                let picked = captures.get(1).or_else(|| captures.get(0))?;
                Some(picked.as_str().to_string())
            })
            .collect();
    }
    for replacement in &variable.replace {
        let pattern: Regex = regex(&replacement.from)?;
        result = result
            .iter()
            .map(|value| {
                pattern
                    .replace_all(value, |captures: &Captures| {
                        expand(&replacement.to, captures, value)
                    })
                    .into_owned()
            })
            .collect();
    }
    if variable.unique {
        let mut seen = HashSet::new();
        result.retain(|value| seen.insert(value.clone()));
    }
    if variable.sort {
        result.sort_by_cached_key(|value| value.encode_utf16().collect::<Vec<u16>>());
    }
    Ok(result)
}

/// Turns a variable's static values or command output into fzf candidates.
pub fn parse_candidates(variable: &Variable, output: &str) -> Result<Candidates, String> {
    let lines = if variable.values.is_empty() {
        split(output, variable)?
    } else {
        variable.values.clone()
    };
    let headers = variable.headers.min(lines.len());
    Ok(Candidates {
        headers: lines[..headers].to_vec(),
        values: transform(lines[headers..].to_vec(), variable)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::Replacement;
    use serde_json::json;

    fn variable() -> Variable {
        Variable {
            command: Some("cmd".to_string()),
            ..Variable::default()
        }
    }

    fn values(variable: &Variable, output: &str) -> Vec<String> {
        parse_candidates(variable, output).unwrap().values
    }

    #[test]
    fn splits_lines_and_drops_blanks_by_default() {
        assert_eq!(values(&variable(), "a\n\nb\r\n"), ["a", "b"]);
    }

    #[test]
    fn uses_static_values_without_output() {
        let variable = Variable {
            command: None,
            values: vec!["0".to_string(), "9".to_string()],
            ..Variable::default()
        };
        assert_eq!(values(&variable, ""), ["0", "9"]);
    }

    #[test]
    fn splits_on_a_custom_separator() {
        let variable = Variable {
            separator: Some("\\s+".to_string()),
            ..variable()
        };
        assert_eq!(
            values(&variable, "build test lint\n"),
            ["build", "test", "lint"]
        );
    }

    #[test]
    fn keeps_the_first_capture_of_matching_lines_unique_and_sorted() {
        let output = [
            "# comment",
            "test: build",
            "build:",
            "CC := gcc",
            ".PHONY: build",
            "build: deps",
        ]
        .join("\n");
        let variable = Variable {
            r#match: Some("^([a-z0-9][^:\\s]*)\\s*:([^=]|$)".to_string()),
            unique: true,
            sort: true,
            ..variable()
        };
        assert_eq!(values(&variable, &output), ["build", "test"]);
    }

    #[test]
    fn rewrites_values_with_replacements() {
        let variable = Variable {
            r#match: Some("^(.*)\\.py$".to_string()),
            replace: vec![Replacement {
                from: "/".to_string(),
                to: ".".to_string(),
            }],
            ..variable()
        };
        assert_eq!(
            values(&variable, "pkg/sub/mod.py\nmain.py\nREADME.md\n"),
            ["pkg.sub.mod", "main"]
        );
    }

    #[test]
    fn expands_replacement_groups_like_javascript() {
        let variable = Variable {
            replace: vec![Replacement {
                from: "(a)(b)".to_string(),
                to: "$2$1$$$&$3".to_string(),
            }],
            ..variable()
        };
        assert_eq!(values(&variable, "xaby"), ["xba$ab$3y"]);
    }

    #[test]
    fn separates_header_lines_before_transforming() {
        let variable = Variable {
            headers: 1,
            r#match: Some("^(\\w+)".to_string()),
            ..variable()
        };
        let result = parse_candidates(&variable, "CONTAINER ID   IMAGE\nabc   nginx\n").unwrap();
        assert_eq!(result.headers, ["CONTAINER ID   IMAGE"]);
        assert_eq!(result.values, ["abc"]);
    }

    #[test]
    fn reads_values_from_json_output() {
        let variable = Variable {
            json: Some("changes[].name".to_string()),
            ..variable()
        };
        assert_eq!(
            values(&variable, r#"{"changes":[{"name":"a"},{"name":"b"}]}"#),
            ["a", "b"]
        );
        assert!(values(&variable, "not json").is_empty());
    }

    #[test]
    fn walks_json_keys_and_arrays() {
        let data = json!({ "a": { "b": [1, 2] }, "list": [{ "x": "p" }, { "y": "q" }] });
        assert_eq!(json_values(&data, "a.b[]"), ["1", "2"]);
        assert_eq!(json_values(&data, "list[].x"), ["p"]);
        assert_eq!(json_values(&json!([3, 4]), "[]"), ["3", "4"]);
        assert!(json_values(&data, "missing[].x").is_empty());
    }
}
