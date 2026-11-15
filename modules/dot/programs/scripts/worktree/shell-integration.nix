{ pkgs, worktreeBin }:

{
  nushell = ''
    def --env --wrapped worktree [...args: string] {
      let cd_file = (^${pkgs.coreutils}/bin/mktemp | str trim)
      let caller_pwd = $env.PWD
      let safe_pwd = ($caller_pwd | path dirname)

      cd $safe_pwd
      let exit_code = (try {
        with-env { WORKTREE_CD_FILE: $cd_file, WORKTREE_CALLER_PWD: $caller_pwd } {
          ^${worktreeBin} ...$args
        }
        0
      } catch {
        $env.LAST_EXIT_CODE
      })
      if ($cd_file | path exists) {
        let target = (open --raw $cd_file | str trim)
        if not ($target | is-empty) {
          cd $target
        } else if ($caller_pwd | path exists) {
          cd $caller_pwd
        }
        ^${pkgs.coreutils}/bin/rm -f $cd_file
      } else if ($caller_pwd | path exists) {
        cd $caller_pwd
      }
      if $exit_code != 0 {
        error make { msg: $"worktree exited with status ($exit_code)" }
      }
    }
  '';
  zsh = ''
    worktree() {
      local cd_file caller_pwd exit_code target
      cd_file="$(${pkgs.coreutils}/bin/mktemp)" || return 1
      caller_pwd="$PWD"

      {
        cd "''${caller_pwd:h}" || return 1
        WORKTREE_CD_FILE="$cd_file" WORKTREE_CALLER_PWD="$caller_pwd" ${worktreeBin} "$@"
        exit_code=$?
      } always {
        if [[ -e "$cd_file" ]]; then
          target="$(<"$cd_file")"
          if [[ -n "$target" ]]; then
            cd "$target"
          elif [[ -d "$caller_pwd" ]]; then
            cd "$caller_pwd"
          fi
          ${pkgs.coreutils}/bin/rm -f "$cd_file"
        elif [[ -d "$caller_pwd" ]]; then
          cd "$caller_pwd"
        fi
      }
      return $exit_code
    }
  '';
}
