use crate::cli::Args;
use crate::config::Config;
use crate::display::{FZF_LINE_OPTIONS, format_header, format_lines, js_parse_int};
use crate::error::Result;
use crate::fzf::Picker;
use crate::library::{Item, channel, find_alias};

pub fn select_item<'a>(
    config: &Config,
    list: &[Item<'a>],
    args: &Args,
    picker: &mut impl Picker,
) -> Result<Option<Item<'a>>> {
    let mut candidates = list.to_vec();
    let mut channel_name = None;
    let mut query = args.query.clone();
    if args.expand {
        if let Some(alias) = find_alias(list, &query) {
            return Ok(Some(alias));
        }
        let narrowed = channel(list, &query);
        channel_name = narrowed.name;
        candidates = narrowed.items;
        query = narrowed.query;
    }
    let select_one = if channel_name.is_some() && query.is_empty() {
        "--no-select-1"
    } else {
        "--select-1"
    };
    let fzf_args: Vec<String> = config
        .fzf
        .options
        .iter()
        .map(String::as_str)
        .chain(FZF_LINE_OPTIONS)
        .chain([select_one, "--header"])
        .chain([format_header(&candidates, channel_name.as_deref()).as_str()])
        .chain(["--query", &query])
        .map(str::to_string)
        .collect();
    let output = picker.pick(&fzf_args, &format_lines(&candidates).join("\n"))?;
    if output.code != 0 {
        return Ok(None);
    }
    let index = js_parse_int(output.stdout.split('\n').next().unwrap_or(""));
    Ok(index
        .and_then(|index| usize::try_from(index).ok())
        .and_then(|index| candidates.get(index).copied()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{Entry, FzfConfig, Section};
    use crate::fzf::Output;
    use crate::library::items;

    fn config() -> Config {
        Config {
            fzf: FzfConfig {
                command: "fzf".to_string(),
                ..FzfConfig::default()
            },
            sections: vec![Section {
                tags: vec!["nix apply".to_string()],
                entries: vec![Entry {
                    description: "apply configuration".to_string(),
                    alias: Some("switch".to_string()),
                    command: "nix run .#apply".to_string(),
                }],
                ..Section::default()
            }],
        }
    }

    fn complete(config: &Config, query: &str) -> (Option<String>, Vec<Vec<String>>) {
        let args = Args {
            config: "test.json".to_string(),
            query: query.to_string(),
            expand: true,
        };
        let list = items(config, None);
        let mut calls = Vec::new();
        let item = select_item(
            config,
            &list,
            &args,
            &mut |fzf_args: &[String], input: &str| {
                calls.push(fzf_args.to_vec());
                Ok(Output {
                    code: 0,
                    stdout: format!("{}\n", input.split('\n').next().unwrap_or("")),
                })
            },
        )
        .unwrap();
        (item.map(|item| item.entry.command.clone()), calls)
    }

    fn tail(args: &[String]) -> &[String] {
        &args[args.len() - 2..]
    }

    #[test]
    fn auto_selects_a_command_matching_a_query_without_a_channel() {
        let (command, calls) = complete(&config(), "apply");
        assert_eq!(calls.len(), 1);
        let args = &calls[0];
        assert!(args.contains(&"--select-1".to_string()));
        assert_eq!(tail(args), ["--query", "apply"]);
        let nth = args.iter().position(|arg| arg == "--nth").unwrap();
        assert_eq!(args[nth..nth + 2], ["--nth", "2"]);
        assert_eq!(command.as_deref(), Some("nix run .#apply"));
    }

    #[test]
    fn searches_for_a_command_after_removing_its_channel_from_the_query() {
        let (command, calls) = complete(&config(), "nix apply");
        assert_eq!(calls.len(), 1);
        assert!(calls[0].contains(&"--select-1".to_string()));
        assert_eq!(tail(&calls[0]), ["--query", "apply"]);
        assert_eq!(command.as_deref(), Some("nix run .#apply"));
    }

    #[test]
    fn keeps_the_picker_open_for_a_channel_containing_only_one_entry() {
        let mut config = config();
        config.fzf.options = vec!["--select-1".to_string()];
        let (_, calls) = complete(&config, "nix");
        assert_eq!(calls.len(), 1);
        let args = &calls[0];
        let last = |name: &str| args.iter().rposition(|arg| arg == name).unwrap();
        assert!(last("--no-select-1") > last("--select-1"));
        assert_eq!(tail(args), ["--query", ""]);
    }

    #[test]
    fn expands_exact_aliases_without_opening_the_picker() {
        let (command, calls) = complete(&config(), "switch");
        assert!(calls.is_empty());
        assert_eq!(command.as_deref(), Some("nix run .#apply"));
    }
}
