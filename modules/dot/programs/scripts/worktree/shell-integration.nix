{ pkgs, worktreeBin }:

{
  nushell = ''
    def --env --wrapped worktree [...args: string] {
      let cd_file = (^${pkgs.coreutils}/bin/mktemp | str trim)
      let caller_pwd = $env.PWD
      let safe_pwd = ($caller_pwd | path dirname)

      cd $safe_pwd
      with-env { WORKTREE_CD_FILE: $cd_file, WORKTREE_CALLER_PWD: $caller_pwd } {
        do -i { ^${worktreeBin} ...$args }
      }
      let exit_code = $env.LAST_EXIT_CODE
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
        return
      }
    }
  '';
}
