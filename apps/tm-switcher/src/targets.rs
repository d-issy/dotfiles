use std::collections::BTreeSet;
use std::path::Path;

pub const SESSION_FORMAT: &str = "#{session_id}\t#{session_name}";
pub const PATH_FORMAT: &str = "#{session_id}\u{1f}#{@repo_path}\u{1f}#{session_path}";

pub fn repo_rows(list: &str, include_parents: bool) -> String {
    let mut paths = BTreeSet::new();
    for path in list.lines().filter(|path| !path.is_empty()) {
        paths.insert(path.to_string());
        if include_parents
            && let Some(parent) = Path::new(path).parent()
            && !parent.as_os_str().is_empty()
        {
            paths.insert(parent.to_string_lossy().into_owned());
        }
    }
    paths
        .into_iter()
        .map(|path| format!("repo\t{path}\t{path}\n"))
        .collect()
}

pub fn session_rows(list: &str) -> String {
    list.lines()
        .filter_map(|line| {
            let (id, name) = line.split_once('\t')?;
            (!id.is_empty()).then(|| format!("session\t{id}\t{name}\n"))
        })
        .collect()
}

// An empty saved path falls back to session_path. A nonempty saved path is
// authoritative even when it no longer exists, matching the shell implementation.
pub fn session_for_repo(list: &str, repo: &Path) -> Option<String> {
    list.lines().find_map(|line| {
        let mut fields = line.splitn(3, '\u{1f}');
        let id = fields.next()?;
        let saved = fields.next()?;
        let initial = fields.next()?;
        let path = if saved.is_empty() { initial } else { saved };
        if id.is_empty() || path.is_empty() {
            return None;
        }
        (Path::new(path).canonicalize().ok().as_deref() == Some(repo)).then(|| id.to_string())
    })
}

pub fn session_name(repo: &str, mut exists: impl FnMut(&str) -> bool) -> String {
    let base = Path::new(repo)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("/");
    let base = base.replace(['.', ':'], "_");
    if !exists(&base) {
        return base;
    }
    let digest = dot::hash::sha256_hex(repo.as_bytes());
    let hashed = format!("{base}-{}", &digest[..10]);
    let mut name = hashed.clone();
    let mut index = 1;
    while exists(&name) {
        name = format!("{hashed}-{index}");
        index += 1;
    }
    name
}

#[derive(Debug, PartialEq, Eq)]
pub enum Selection {
    Session(String),
    Repo(String),
}

impl Selection {
    pub fn parse(output: &str) -> Option<Self> {
        let mut fields = output.trim_end_matches('\n').splitn(3, '\t');
        let kind = fields.next()?;
        let target = fields.next()?.to_string();
        if target.is_empty() {
            return None;
        }
        match kind {
            "session" => Some(Self::Session(target)),
            "repo" => Some(Self::Repo(target)),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sorts_deduplicates_and_optionally_includes_orgs() {
        let list = "/code/org/z\n/code/org/a\n/code/org/z\n\n";
        assert_eq!(
            repo_rows(list, true),
            "repo\t/code/org\t/code/org\nrepo\t/code/org/a\t/code/org/a\nrepo\t/code/org/z\t/code/org/z\n"
        );
        assert_eq!(repo_rows("/code/a\n", false), "repo\t/code/a\t/code/a\n");
    }

    #[test]
    fn session_candidates_preserve_spaces_and_skip_missing_fields() {
        assert_eq!(
            session_rows("$1\tname with spaces\ninvalid\n$2\tother\n"),
            "session\t$1\tname with spaces\nsession\t$2\tother\n"
        );
    }

    #[test]
    fn normalizes_names_and_uses_the_existing_sha256_suffix_sequence() {
        assert_eq!(session_name("/code/a.b:c", |_| false), "a_b_c");
        let repo = "/code/a.b:c";
        let hash = dot::hash::sha256_hex(repo.as_bytes());
        let mut tried = Vec::new();
        let name = session_name(repo, |name| {
            tried.push(name.to_string());
            tried.len() < 4
        });
        assert_eq!(
            tried,
            [
                "a_b_c".to_string(),
                format!("a_b_c-{}", &hash[..10]),
                format!("a_b_c-{}-1", &hash[..10]),
                format!("a_b_c-{}-2", &hash[..10])
            ]
        );
        assert_eq!(name, tried[3]);
    }

    #[test]
    fn validates_selection_kind_and_target() {
        assert_eq!(Selection::parse(""), None);
        assert_eq!(Selection::parse("session\t\tname"), None);
        assert_eq!(Selection::parse("unknown\tvalue"), None);
        assert_eq!(
            Selection::parse("session\t$1\tname\n"),
            Some(Selection::Session("$1".into()))
        );
        assert_eq!(
            Selection::parse("repo\t/a b\t/a b\n"),
            Some(Selection::Repo("/a b".into()))
        );
    }
}
