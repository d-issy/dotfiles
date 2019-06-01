# git brach
gc () {
    local branch=$(git branch -vv | fzf --prompt='branch>' --reverse --height 30 | awk '{print $1}' | sed "s/.* //")
    [ -z "$branch" ] && return
    git checkout "$branch"
}
