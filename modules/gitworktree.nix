{ config, lib, pkgs, ... }:

with lib;
{
  options = { };
  config = {
    programs.nushell.extraConfig = ''
      # Main worktree function with environment
      export def --env wt [] {
        let current_dir = (pwd)
        
        # Check if we're in a git repo
        if (git rev-parse --git-dir | complete | get exit_code) != 0 {
          print "Error: Not in a git repository"
          return
        }
        
        # Get worktrees list first to find main repo
        let worktrees_raw = (git worktree list | complete | get stdout | lines | where { |line| not ($line | is-empty) })
        
        if ($worktrees_raw | is-empty) {
          print "No worktrees found"
          return
        }
        
        # Extract main repo path (first entry in git worktree list)
        let main_repo_path = ($worktrees_raw | get 0 | parse --regex '^([^\s]+)' | get capture0.0)
        
        # Detect repo structure from main repo path
        let home_path = $env.HOME
        let code_pattern = $"($home_path)/code/github.com"
        
        if not ($main_repo_path | str starts-with $code_pattern) {
          print "Error: Main repo not in ~/code/github.com/[username]/[repo] structure"
          return
        }
        
        # Extract repo info from main repo path
        let relative_path = ($main_repo_path | str replace $code_pattern "")
        let path_parts = ($relative_path | str trim --left --char "/" | split row "/")
        
        if ($path_parts | length) < 2 {
          print "Error: Invalid repository path structure"
          return
        }
        
        let username = ($path_parts | get 0)
        let repo_name = ($path_parts | get 1)
        let worktree_base = $"($code_pattern)/($username)/worktree"
        
        # Parse worktree paths
        let worktree_paths = ($worktrees_raw | each { |line| 
          $line | parse --regex '^([^\s]+)' | get capture0.0
        })
        
        # Set environment variables for fzf keybindings (tmux.nix pattern)
        $env.WT_MAIN_PATH = $main_repo_path
        $env.WT_REPO_NAME = $repo_name  
        $env.WT_WORKTREE_BASE = $worktree_base
        
        # Use fzf with keybindings (allow new branch input with --print-query)
        mut target = (
          $worktree_paths 
          | str join "\n"
          | fzf
            --header='Ctrl+A: new from branch | Ctrl+D: delete | Type new branch name and press Enter'
            --bind='ctrl-a:reload(nu --login -c "wt-list-branches-env")'
            --bind='ctrl-d:execute(nu --login -c "wt-delete-env {}")+reload(nu --login -c "wt-list-env")'
            --print-query
          | complete | get "stdout" | str trim
        )
        
        # Handle fzf output with --print-query (first line is query, second is selection)
        let fzf_lines = ($target | lines)
        if ($fzf_lines | length) == 0 {
          return
        }
        
        # If only one line, user typed something and pressed Enter without selecting
        if ($fzf_lines | length) == 1 {
          $target = ($fzf_lines | get 0)
        } else {
          # If two lines, second line is the selection, use that preferentially
          let selection = ($fzf_lines | get 1)
          if ($selection | is-empty) {
            # No selection, use the query (first line) as new branch
            $target = ($fzf_lines | get 0)
          } else {
            # Use selection
            $target = $selection
          }
        }
        
        if ($target | is-empty) { 
          return 
        }
        
        # Check if target is a worktree path or branch name (tmux.nix pattern)
        if ($target | path exists) {
          # Target is a worktree path, change to it
          cd $target
        } else {
          # Target is a branch name, create worktree from it
          cd $main_repo_path
          
          # Clean branch name (remove origin/ prefix if present)
          let clean_branch = ($target | str replace "origin/" "")
          let safe_branch_name = ($clean_branch | str replace --all "/" "-")
          let worktree_path = $"($worktree_base)/($repo_name)-($safe_branch_name)"
          
          # Ensure worktree base directory exists
          mkdir $worktree_base
          
          # Check if local branch exists
          let branch_exists = (git show-ref --verify --quiet $"refs/heads/($clean_branch)" | complete | get exit_code) == 0
          
          if $branch_exists {
            # Create worktree from existing local branch
            git worktree add $worktree_path $clean_branch
          } else {
            # Check if it's a remote branch that can be tracked
            let remote_branch_exists = (git show-ref --verify --quiet $"refs/remotes/($target)" | complete | get exit_code) == 0
            
            if $remote_branch_exists {
              # Create worktree tracking remote branch
              git worktree add -b $clean_branch $worktree_path $target
            } else {
              # Create new branch from current HEAD (main branch)
              git worktree add -b $clean_branch $worktree_path
            }
          }
          
          # Change to new worktree
          cd $worktree_path
        }
      }

      # Helper function to list worktree paths
      export def wt-list-paths [main_repo_path: string] {
        cd $main_repo_path
        let worktrees_raw = (git worktree list | complete | get stdout | lines | where { |line| not ($line | is-empty) })
        let worktree_paths = ($worktrees_raw | each { |line| 
          $line | parse --regex '^([^\s]+)' | get capture0.0
        })
        $worktree_paths | str join "\n"
      }

      # Helper function for fzf preview
      export def wt-preview [worktree_path: string] {
        if not ($worktree_path | path exists) {
          print "Path not found"
          return
        }
        
        cd $worktree_path
        
        # Show branch info and recent commits
        let branch_info = (git branch --show-current 2>/dev/null | complete | get stdout | str trim)
        let commit_info = (git log --oneline -5 2>/dev/null | complete | get stdout)
        let status_info = (git status --porcelain 2>/dev/null | complete | get stdout)
        
        mut preview = $"Branch: ($branch_info)\n\nRecent commits:\n($commit_info)"
        
        if not ($status_info | is-empty) {
          $preview = $preview + $"\n\nStatus:\n($status_info)"
        }
        
        print $preview
      }

      # Function to create new worktree
      export def wt-create [main_repo_path: string, repo_name: string, worktree_base: string, branch_name?: string] {
        cd $main_repo_path
        
        # Get branch name from parameter or user input
        mut final_branch_name = ""
        if ($branch_name | is-empty) {
          print "Enter branch name for new worktree:"
          $final_branch_name = (input | str trim)
        } else {
          $final_branch_name = $branch_name
        }
        
        if ($final_branch_name | is-empty) {
          print "Branch name cannot be empty"
          return
        }
        
        # Create worktree directory name (replace / with -)
        let safe_branch_name = ($final_branch_name | str replace --all "/" "-")
        let worktree_path = $"($worktree_base)/($repo_name)-($safe_branch_name)"
        
        # Ensure worktree base directory exists
        mkdir $worktree_base
        
        # Check if branch exists
        let branch_exists = (git show-ref --verify --quiet $"refs/heads/($final_branch_name)" | complete | get exit_code) == 0
        
        if $branch_exists {
          # Create worktree from existing local branch
          git worktree add $worktree_path $final_branch_name
        } else {
          # Check if it's a remote branch that can be tracked
          let remote_branch_exists = (git show-ref --verify --quiet $"refs/remotes/origin/($final_branch_name)" | complete | get exit_code) == 0
          
          if $remote_branch_exists {
            # Create worktree tracking remote branch
            git worktree add -b $final_branch_name $worktree_path $"origin/($final_branch_name)"
          } else {
            # Create new branch from current HEAD
            git worktree add -b $final_branch_name $worktree_path
          }
        }
        
        print $"Worktree created: ($worktree_path)"
      }

      # Function to delete worktree
      export def --env wt-delete [main_repo_path: string, worktree_path: string] {
        if ($worktree_path == $main_repo_path) {
          print "Cannot delete main repository"
          return
        }
        
        # Check if we're currently in the worktree we want to delete
        let current_dir = (pwd)
        let should_move_first = ($worktree_path == $current_dir)
        
        # Move to main repo first (always safe)
        cd $main_repo_path
        
        # Remove worktree
        git worktree remove $worktree_path --force
        
        # Ensure we stay in main repo after deletion
        cd $main_repo_path
        
        print $"Worktree deleted: ($worktree_path)"
      }

      # Environment-based functions for fzf keybindings (tmux.nix pattern)
      export def wt-list-branches-env [] {
        if ($env.WT_MAIN_PATH? | is-empty) {
          print "Environment variables not set"
          return
        }
        
        cd $env.WT_MAIN_PATH
        # List only local branches (no remotes)
        let local_branches = (git branch --format='%(refname:short)' | lines)
        
        # Output as text for fzf (not table format)
        $local_branches | sort | str join "\n"
      }

      export def --env wt-delete-env [worktree_path: string] {
        if ($env.WT_MAIN_PATH? | is-empty) {
          print "Environment variables not set"
          return
        }
        
        # Prevent deletion of main repository
        if ($worktree_path == $env.WT_MAIN_PATH) {
          print "Cannot delete main repository"
          return
        }
        
        # Check if we're currently in the worktree we want to delete
        let current_dir = (pwd)
        let should_move_first = ($worktree_path == $current_dir)
        
        # If deleting current worktree, move to main first
        if $should_move_first {
          cd $env.WT_MAIN_PATH
        }
        
        # Check if this is main/master branch worktree and prevent deletion
        cd $worktree_path
        let branch_name = (git branch --show-current 2>/dev/null | complete | get stdout | str trim)
        if ($branch_name in ["main", "master"]) {
          print $"Cannot delete main branch worktree: ($branch_name)"
          # Return to main if we moved
          if $should_move_first {
            cd $env.WT_MAIN_PATH
          }
          return
        }
        
        # Move back to main before deletion (always safe)
        cd $env.WT_MAIN_PATH
        
        wt-delete $env.WT_MAIN_PATH $worktree_path
        
        # Ensure we're in a safe directory after deletion
        cd $env.WT_MAIN_PATH
      }

      export def wt-list-env [] {
        if ($env.WT_MAIN_PATH? | is-empty) {
          print "Environment variables not set"
          return
        }
        
        wt-list-paths $env.WT_MAIN_PATH
      }
    '';
  };
}