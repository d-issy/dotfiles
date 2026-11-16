use crate::bash::is_space;

const COMMIT_PROMPT: &str = "Generate a git commit message for the following staged changes.

Rules:
- Use Conventional Commits format: type(scope): description
- Types: feat, fix, update, remove, docs, ci, test, chore, refactor
- Scope is optional, derive from file paths if clear
- Title: concise (under 50 chars)
- Body: optional, only if needed. Use short bullet points (2-4 items max)

IMPORTANT: Respond with ONLY the commit message itself. No explanation, no reasoning, no code blocks, no signatures (like \"Generated with Pi\" or \"Co-Authored-By\").

Staged changes:";

const BRANCH_PROMPT: &str = "Generate a git branch name for the following staged changes.

Rules:
- Use kebab-case (lowercase with hyphens)
- Keep it short and descriptive (2-4 words)
- No prefix like feature/ or fix/

IMPORTANT: Respond with ONLY the branch name itself. No explanation, no reasoning, no formatting.

Staged changes:";

fn build(header: &str, body: &[u8], body_terminator: &[u8], instruction: &str) -> Vec<u8> {
    let mut prompt = [header.as_bytes(), b"\n\n", body, body_terminator].concat();
    if !instruction.is_empty() {
        prompt.extend(format!("\nAdditional instruction: {instruction}\n").bytes());
    }
    prompt
}

pub fn commit(diff: &[u8], instruction: &str) -> Vec<u8> {
    build(COMMIT_PROMPT, diff, b"\n", instruction)
}

pub fn branch(stat: &[u8], instruction: &str) -> Vec<u8> {
    build(BRANCH_PROMPT, stat, b"", instruction)
}

/// First non-fence, non-blank line with quotes and backticks removed and
/// whitespace runs collapsed to hyphens.
pub fn sanitize_branch_name(output: &str) -> String {
    let line = output
        .split('\n')
        .find(|l| {
            let t = l.trim_start_matches(is_space);
            !t.starts_with("```") && !t.chars().all(is_space)
        })
        .unwrap_or("");
    let line: String = line
        .chars()
        .filter(|c| !matches!(c, '`' | '"' | '\''))
        .collect();
    line.split(is_space)
        .filter(|word| !word.is_empty())
        .collect::<Vec<_>>()
        .join("-")
        .trim_matches('-')
        .to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn commit_prompt_layout() {
        let p = String::from_utf8(commit(b"DIFF", "")).unwrap();
        assert!(p.starts_with(
            "Generate a git commit message for the following staged changes.\n\nRules:\n"
        ));
        assert!(p.ends_with("Staged changes:\n\nDIFF\n"));
        let p = String::from_utf8(commit(b"DIFF", "be brief")).unwrap();
        assert!(p.ends_with("Staged changes:\n\nDIFF\n\nAdditional instruction: be brief\n"));
    }

    #[test]
    fn branch_prompt_layout() {
        let p = String::from_utf8(branch(b" a | 1 +\n", "")).unwrap();
        assert!(p.ends_with("Staged changes:\n\n a | 1 +\n"));
        let p = String::from_utf8(branch(b" a | 1 +\n", "x")).unwrap();
        assert!(p.ends_with("Staged changes:\n\n a | 1 +\n\nAdditional instruction: x\n"));
    }

    #[test]
    fn sanitizes_branch_names() {
        assert_eq!(sanitize_branch_name("add-login\n"), "add-login");
        assert_eq!(
            sanitize_branch_name("```\n  \n`Add Login Page`\n```\n"),
            "Add-Login-Page"
        );
        assert_eq!(
            sanitize_branch_name("  \"it's  a\tname\"  \nsecond"),
            "its-a-name"
        );
        assert_eq!(sanitize_branch_name("---x---"), "x");
        assert_eq!(sanitize_branch_name("   \n```"), "");
        assert_eq!(sanitize_branch_name(""), "");
    }
}
