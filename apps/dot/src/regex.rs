use std::fmt;
use std::ops::Index;

#[derive(Debug)]
pub struct Error(String);

impl fmt::Display for Error {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl std::error::Error for Error {}

#[derive(Clone, Debug)]
pub struct Regex(regex::Regex);

impl Regex {
    pub fn new(pattern: &str) -> Result<Self, Error> {
        regex::Regex::new(pattern)
            .map(Self)
            .map_err(|error| Error(error.to_string()))
    }

    pub fn is_match(&self, text: &str) -> bool {
        self.0.is_match(text)
    }

    pub fn split<'a>(&'a self, text: &'a str) -> impl Iterator<Item = &'a str> + 'a {
        self.0.split(text)
    }

    pub fn captures<'a>(&self, text: &'a str) -> Option<Captures<'a>> {
        self.0.captures(text).map(Captures::from_inner)
    }

    pub fn captures_iter<'a>(&'a self, text: &'a str) -> impl Iterator<Item = Captures<'a>> + 'a {
        self.0.captures_iter(text).map(Captures::from_inner)
    }

    /// Replaces each match with text computed from its capture groups.
    pub fn replace_all(
        &self,
        text: &str,
        mut replacement: impl FnMut(&Captures<'_>) -> String,
    ) -> String {
        self.0
            .replace_all(text, |captures: &regex::Captures<'_>| {
                replacement(&Captures::from_inner_ref(captures))
            })
            .into_owned()
    }

    /// Replaces every match, treating dollar signs as literal text.
    pub fn replace_all_literal(&self, text: &str, replacement: &str) -> String {
        self.0
            .replace_all(text, regex::NoExpand(replacement))
            .into_owned()
    }

    /// Replaces the first match, treating dollar signs as literal text.
    pub fn replace_literal(&self, text: &str, replacement: &str) -> String {
        self.0
            .replace(text, regex::NoExpand(replacement))
            .into_owned()
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Match<'a> {
    text: &'a str,
    start: usize,
    end: usize,
}

impl<'a> Match<'a> {
    pub fn as_str(&self) -> &'a str {
        self.text
    }

    pub fn start(&self) -> usize {
        self.start
    }

    pub fn end(&self) -> usize {
        self.end
    }
}

#[derive(Clone, Debug)]
pub struct Captures<'a> {
    groups: Vec<Option<Match<'a>>>,
}

impl<'a> Captures<'a> {
    fn from_inner(captures: regex::Captures<'a>) -> Self {
        Self::from_inner_ref(&captures)
    }

    fn from_inner_ref(captures: &regex::Captures<'a>) -> Self {
        Self {
            groups: captures
                .iter()
                .map(|group| {
                    group.map(|group| Match {
                        text: group.as_str(),
                        start: group.start(),
                        end: group.end(),
                    })
                })
                .collect(),
        }
    }

    pub fn get(&self, index: usize) -> Option<Match<'a>> {
        self.groups.get(index).copied().flatten()
    }

    pub fn len(&self) -> usize {
        self.groups.len()
    }

    pub fn is_empty(&self) -> bool {
        self.groups.is_empty()
    }
}

impl Index<usize> for Captures<'_> {
    type Output = str;

    fn index(&self, index: usize) -> &Self::Output {
        self.get(index)
            .expect("capture group did not match")
            .as_str()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn captures_keep_byte_offsets_and_unmatched_groups() {
        let pattern = Regex::new("(β)(x)?").unwrap();
        let captures = pattern.captures("aβz").unwrap();
        let matched = captures.get(0).unwrap();
        assert_eq!(matched.as_str(), "β");
        assert_eq!((matched.start(), matched.end()), (1, 3));
        assert_eq!(&captures[1], "β");
        assert_eq!(captures.len(), 3);
        assert!(!captures.is_empty());
        assert!(captures.get(2).is_none());
        assert!(captures.get(3).is_none());
    }

    #[test]
    fn splits_and_matches_without_exposing_the_engine() {
        let pattern = Regex::new("[,;]").unwrap();
        assert!(pattern.is_match("a,b"));
        assert!(!pattern.is_match("ab"));
        assert_eq!(
            pattern.split("a,,b;").collect::<Vec<_>>(),
            ["a", "", "b", ""]
        );
        assert_eq!(pattern.captures_iter("a,b;c").count(), 2);
        assert!(Regex::new("(").is_err());
    }

    #[test]
    fn distinguishes_literal_replacements_from_capture_callbacks() {
        let pattern = Regex::new("(a)").unwrap();
        assert_eq!(pattern.replace_literal("banana", "$1"), "b$1nana");
        assert_eq!(pattern.replace_all_literal("banana", "$1"), "b$1n$1n$1");
        assert_eq!(
            pattern.replace_all("banana", |captures| format!("[{}]", &captures[1])),
            "b[a]n[a]n[a]"
        );
    }
}
