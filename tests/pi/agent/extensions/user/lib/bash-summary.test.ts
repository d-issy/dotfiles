import { describe, expect, it } from "vitest";
import {
	bashOperationDetails,
	bashOperations,
} from "#pi-user/lib/bash-summary";

describe("bashOperations", () => {
	it.each([
		["sed -n '200,255p' file", "read"],
		["sed 's/a/b/' file", "read"],
		["sed -i 's/a/b/' file", "edit"],
		["sed 's/a/b/' -i file", "edit"],
		["sed 's/a/b/' file --in-place", "edit"],
		["sed 's/a/b/' -- -i", "read"],
		["sed -i.bak 's/a/b/' file", "edit"],
		["sed -i '' 's/a/b/' file", "edit"],
		["sed -ni 's/a/b/p' file", "edit"],
		["sed --in-place=.bak 's/a/b/' file", "edit"],
		["sed -e 's/a/b/' -i file", "edit"],
		["sed -ne 's/a/b/p' -i file", "edit"],
		["sed -e 's/-i/b/' file", "read"],
		["sed -es/a/i/ file", "read"],
		["sed -- 's/a/b/' -i", "read"],
		["sed 's/a/b/' file > out", "write"],
		["sed 's/a/b/' file >> out", "edit"],
		["sed -n '1p' < file", "read"],
	])("classifies sed options and redirects: %s", (command, name) => {
		expect(bashOperationDetails(command)).toEqual([{ name, labeled: true }]);
	});
	it("preserves read labels across commands with brace-expanded path arguments", () => {
		expect(
			bashOperationDetails(
				"cat src/client/components/DashboardFilterControls.tsx; sed -n '200,255p' src/client/components/ItemDropRateStats.tsx; rg -n -A45 '^\\.(metricTabs|listControls|backgroundSwitch|stateTabs|filterOptions|positionOptions)' src/client/components/{PositionTrendPlot,RoomRatingPanel,OverlayPreview,OverlayEditor,ItemDropRateStats}.module.css; head -65 src/client/storybook/buttonInventory.tsx; rg -n 'export const' src/client/storybook/buttonInventory.tsx; rg -n 'DashboardFilterBar|DashboardPeriodControls|DashboardCategoryControls' src/client --glob '!*.stories.tsx' --glob '!*.test.*'",
			),
		).toEqual([
			{ name: "read", labeled: true },
			{ name: "read", labeled: true },
			{ name: "search", labeled: true },
			{ name: "read", labeled: true },
			{ name: "search", labeled: true },
			{ name: "search", labeled: true },
		]);
	});
	it.each([
		["cat {a,b}.txt; cat c", ["read", "read"]],
		["cat src/{a,b}.tsx | head", ["read", "read"]],
		["cat {a,b} > output", ["write"]],
		["cat a; { rm b; }", ["cat"]],
		["cat {a,$(touch b)}", ["cat"]],
		["cat {a,`touch b`}", ["cat"]],
		["{cat,rm} a", ["bash"]],
		["cat {a,b", ["cat"]],
	])("handles brace arguments conservatively: %s", (command, expected) => {
		expect(bashOperations(command)).toEqual(expected);
	});
	it.each([
		["cat data.json | jq '.items'", ["read"]],
		["jq '.items' data.json | head", ["read"]],
		["jq '.items' data.json", ["jq"]],
		["jq '.' a.json && jq '.' b.json", ["jq", "jq"]],
	])("hides jq only in pipelines: %s", (command, expected) => {
		expect(bashOperations(command)).toEqual(expected);
	});
	it.each([
		["pnpm test 2>&1 | head", ["pnpm test", "read"]],
		["git status 2>/dev/null; pnpm lint", ["git", "pnpm lint"]],
		["find . -exec cat {} +", ["find"]],
		['cat "$1"; pnpm test "$@"', ["read", "pnpm test"]],
		["python3 - <<PY\nprint('private body')", ["python"]],
		["python3 - <<< private-input", ["python"]],
		['pnpm run build "$(cat private-file)"', ["pnpm run build"]],
		["rg pattern ${ROOT:-private-path}", ["rg"]],
		["git diff `cat private-file`", ["git"]],
		["custom-tool {private,other}", ["custom-tool"]],
	])(
		"does not expose arguments on common parse failures: %s",
		(command, expected) => {
			expect(bashOperations(command)).toEqual(expected);
		},
	);

	it.each([
		["python3 - <<'PY'\nprint('hello')\nPY", ["python"]],
		[
			'python3 - <<"PY"\nprint("$x; cat a")\nPY\ngit status',
			["python", "git-read op"],
		],
		["python3 - <<-PY\n\tprint(1)\n\tPY", ["python"]],
		["python3 - <<PY | head\nprint(1)\nPY", ["python", "read"]],
		["python3 - <<PY # script\nprint(1)\nPY", ["python"]],
		["python3 script.py", ["python"]],
		["python3 -c 'print(1)'", ["python"]],
	])("hides heredoc bodies and normalizes Python: %s", (command, expected) => {
		expect(bashOperations(command)).toEqual(expected);
	});
	it("keeps Python in run details rather than labeling it", () => {
		expect(bashOperationDetails("python3 - <<PY\nprint(1)\nPY")).toEqual([
			{ name: "python", labeled: false },
		]);
	});

	it.each(["build", "run", "fmt", "develop", "flake"])(
		"shows nix %s as an unlabeled subcommand",
		(subcommand) => {
			expect(bashOperationDetails(`nix ${subcommand} .#target`)).toEqual([
				{ name: `nix ${subcommand}`, labeled: false },
			]);
		},
	);
	it.each([
		["wc -l file", [{ name: "wc", labeled: false }]],
		["find . -name '*.ts' | wc -l", [{ name: "search", labeled: true }]],
		["wc -l a | cat", [{ name: "read", labeled: true }]],
		["find . -type f", [{ name: "search", labeled: true }]],
		["find . -delete", [{ name: "find", labeled: false }]],
		["find . -exec pwd \u005c\u005c;", [{ name: "find", labeled: false }]],
		["find . -execdir pwd \u005c\u005c;", [{ name: "find", labeled: false }]],
		["find . -fprint results", [{ name: "find", labeled: false }]],
		["find . -fprintf results '%p'", [{ name: "find", labeled: false }]],
	])("classifies search and counting: %s", (command, expected) => {
		expect(bashOperationDetails(command)).toEqual(expected);
	});

	it.each([
		[
			'for f in *.ts; do cat "$f"; pnpm test "${f}"; done',
			["read", "pnpm test"],
		],
		[
			'for x in a b; do for y in c d; do rg "$x" "$y"; done; cat "$x"; done',
			["search", "read"],
		],
		['for f in a b\ndo\ncat "$f" | sort | uniq\ndone', ["read"]],
		["printf hello; echo world", []],
		["echo hello | sort | uniq", []],
		["cat a | sed 's/a/b/' | sort | uniq", ["read", "read"]],
		["sort a; uniq a; sed 's/a/b/' a", ["sort", "uniq", "read"]],
		["sort a && uniq a || sed x", ["sort", "uniq", "read"]],
		["cat a | sed -i.bak 's/a/b/' b", ["read", "edit"]],
		["cat a | sed --in-place 's/a/b/' b", ["read", "edit"]],
		["sort a | cat; uniq a", ["read", "uniq"]],
		["for x in a; do cat x", ["bash"]],

		["gh pr list; gh issue view 123", ["gh pr list", "gh issue view"]],
		["gh --repo owner/repo pr --repo other/repo view 123", ["gh pr view"]],
		["gh --repo=owner/repo issue list --state open", ["gh issue list"]],
		["gh pr; gh --help", ["gh pr", "gh"]],
		["gh --unknown value pr list", ["gh"]],
		["unknown action subaction", ["unknown"]],

		["pnpm run build --watch", ["pnpm run build"]],
		["pnpm run test:unit", ["pnpm run test:unit"]],
		["pnpm run", ["pnpm run"]],
		["pnpm run --help", ["pnpm run"]],

		[
			"fetch-data | normalize | aggregate >> report",
			["fetch-data", "normalize", "aggregate"],
		],
		[
			"/usr/bin/custom-tool a | rg foo | cat >b",
			["custom-tool", "search", "write"],
		],
		["cat '>' '>>'", ["read"]],
		["cat a>>b", ["edit"]],
		["cat a> b | head", ["write", "read"]],

		["cat a | head -n 10 | tail -n 2", ["read", "read", "read"]],
		["rg pattern .; grep pattern a", ["search", "search"]],
		[
			"pnpm lint; pnpm test; pnpm install",
			["pnpm lint", "pnpm test", "pnpm install"],
		],
		["pnpm --filter app run build", ["pnpm run build"]],
		["pnpm -C /tmp -r build", ["pnpm build"]],
		["pnpm --unknown value test", ["pnpm"]],

		["ls x; ls y", ["ls", "ls"]],
		["git status; git remote -v", ["git-read op", "git-read op"]],
		[
			"git add a && git add b; git status",
			["git add", "git add", "git-read op"],
		],
		["git diff || git log | cat", ["git-read op", "git-read op", "read"]],
		[
			"git remote add origin url; git remote remove origin",
			["git remote", "git remote"],
		],
		["git branch -D topic; git tag v1", ["git branch", "git tag"]],
		["git -C /tmp --no-pager status", ["git-read op"]],
		["git -c alias.x=status x", ["git"]],
		["git diff --output=patch", ["git diff"]],
		["git diff --ext-diff", ["git diff"]],
		["MODE=test git status", ["git-read op"]],
		["printf 'git add; ls x' && ls 'a;b'", ["ls"]],
		['printf "a; b | c"; git status', ["git-read op"]],
		["ls a\\;b; ls c", ["ls", "ls"]],
		["git status # git add a\ngit log", ["git-read op", "git-read op"]],
		["git status > out", ["git"]],
		["echo $(git status)", ["echo"]],
		["bash -c 'git status; git add a'", ["bash"]],
		["for x in a b; do git add x; done", ["git add"]],
		["printf 'unclosed", ["printf"]],
		["cat <<EOF\ngit status\nEOF", ["read"]],
		["cat source > destination", ["write"]],
		["cat source >> destination", ["edit"]],
		["cat < source", ["read"]],
	])("classifies %s without exposing arguments", (command, expected) => {
		expect(bashOperations(command)).toEqual(expected);
	});
});
