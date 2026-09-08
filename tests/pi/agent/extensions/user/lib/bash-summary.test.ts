import { describe, expect, it } from "vitest";
import { bashOperations } from "#pi-user/lib/bash-summary";

describe("bashOperations", () => {
	it.each([
		["ls x; ls y", ["ls", "ls"]],
		["git status; git remote -v", ["git-read op", "git-read op"]],
		[
			"git add a && git add b; git status",
			["git add", "git add", "git-read op"],
		],
		["git diff || git log | cat", ["git-read op", "git-read op", "cat"]],
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
		["printf 'git add; ls x' && ls 'a;b'", ["printf", "ls"]],
		['printf "a; b | c"; git status', ["printf", "git-read op"]],
		["ls a\\;b; ls c", ["ls", "ls"]],
		["git status # git add a\ngit log", ["git-read op", "git-read op"]],
		["git status > out", ["complex command"]],
		["echo $(git status)", ["complex command"]],
		["bash -c 'git status; git add a'", ["bash"]],
		[
			"for x in a b; do git add x; done",
			["complex command", "complex command", "complex command"],
		],
		["printf 'unclosed", ["complex command"]],
		["cat <<EOF\ngit status\nEOF", ["complex command"]],
	])("classifies %s without exposing arguments", (command, expected) => {
		expect(bashOperations(command)).toEqual(expected);
	});
});
