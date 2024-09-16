{ config, pkgs, ... }:

let
  user = "d-issy";
  email = "12374694+d-issy@users.noreply.github.com";
  config = {
    color = {
      ui = "auto";
      diff = true;
    };
    init.defaultBranch = "main";
    commit.verbose = true;
    push.default = "current";
    pull = {
      ff = "only";
      rebase = false;
      autostash = true;
    };
    merge.conflictstyle = "diff3";
    rebase.autostash = true;
    fetch.prune = true;
    core = {
      quotePath = false;
      ignorecase = false;
      autocrlf = false;
    };
    url."git@github.com:".insteadOf = "https://github.com/";
  };
  ignores = [
    "### Windows ###"
    "$RECYCLE.BIN/"
    "*.lnk"
    "*.msix"
    "*.stackdump"
    "Thumbs.db"
    "Thumbs.db:encryptable"
    "[Dd]esktop.ini"
    "ehthumbs.db"
    "ehthumbs_vista.db"
    ""
    "### macOS ###"
    ".AppleDB"
    ".AppleDesktop"
    ".AppleDouble"
    ".DS_Store"
    ".DocumentRevisions-V100"
    ".LSOverride"
    ".Spotlight-V100"
    ".TemporaryItems"
    ".Trashes"
    ".VolumeIcon.icns"
    "._*"
    ".apdisk"
    ".com.apple.timemachine.donotpresent"
    ".fseventsd"
    "Icon"
    "Network Trash Folder"
    "Temporary Items"
    ""
    "### Linux ###"
    ".Trash-*"
    ".directory"
    ".fuse_hidden*"
    ".nfs*"
    ""
    "### Archives ###"
    "*.7z"
    "*.bz2"
    "*.bzip"
    "*.bzip2"
    "*.cab"
    "*.deb"
    "*.dmg"
    "*.egg"
    "*.gem"
    "*.gz"
    "*.gzip"
    "*.iso"
    "*.jar"
    "*.lzma"
    "*.msi"
    "*.msm"
    "*.msp"
    "*.rar"
    "*.rpm"
    "*.tar"
    "*.tgz"
    "*.txz"
    "*.xar"
    "*.xpi"
    "*.xz"
    "*.zip"
    ""
    "### Backup ###"
    "*.bak"
    "*.gho"
    "*.ori"
    "*.orig"
    "*.tmp"
    ""
    "### Dropbox ###"
    ".dropbox"
    ".dropbox.attr"
    ".dropbox.cache"
    ""
    "### LibreOffice ###"
    ".~lock.*#"
    ""
    "### MATLAB ###"
    "*.asv"
    "*.autosave"
    "*.mex*"
    "*.mlappinstall"
    "*.mltbx"
    "*.m~"
    "*.slxc"
    "codegen/"
    "helpsearch*/"
    "octave-workspace"
    "sccprj/"
    "slprj/"
    ""
    "### MicrosoftOffice ###"
    "**/nbproject/Makefile-*.mk"
    "**/nbproject/Package-*.bash"
    "**/nbproject/private/"
    "*.pidb"
    "*.resources"
    "*.userprefs"
    "*.usertasks"
    "*.xlk"
    "*.~vsd*"
    ".nb-gradle/"
    "Backup of *.doc*"
    "build/"
    "nbbuild/"
    "nbdist/"
    "test-results/"
    "~$*.doc*"
    "~$*.ppt*"
    "~$*.xls*"
    ""
    "### Vim ###"
    "!*.svg  # comment out if you don't need vector files"
    ".netrwhist"
    "Session.vim"
    "Sessionx.vim"
    "[._]*.s[a-v][a-z]"
    "[._]*.sw[a-p]"
    "[._]*.un~"
    "[._]s[a-rt-v][a-z]"
    "[._]ss[a-gi-z]"
    "[._]sw[a-p]"
    ""
    "### VirtualEnv ###"
    ".Python"
    ".venv"
    "pip-selfcheck.json"
    "pyvenv.cfg"
    ""
    "### VisualStudioCode ###"
    "!.vscode/*.code-snippets"
    "!.vscode/extensions.json"
    "!.vscode/launch.json"
    "!.vscode/settings.json"
    "!.vscode/tasks.json"
    ".history/"
    ".ionide"
    ".vscode/*"
    ""
    "### Xcode ###"
    "!*.xcodeproj/project.pbxproj"
    "!*.xcodeproj/xcshareddata/"
    "!*.xcworkspace/contents.xcworkspacedata"
    "!default.mode1v3"
    "!default.mode2v3"
    "!default.pbxuser"
    "!default.perspectivev3"
    "**/xcshareddata/WorkspaceSettings.xcsettings"
    "*.mode1v3"
    "*.mode2v3"
    "*.moved-aside"
    "*.pbxuser"
    "*.perspectivev3"
    "*.xccheckout"
    "*.xcodeproj/*"
    "*.xcscmblueprint"
    "/*.gcno"
    "DerivedData/"
    "xcuserdata/"
    ""
    "### direnv ###"
    ".direnv"
    ".envrc"
  ];

in
{
  programs.git = {
    enable = true;
    userName = user;
    userEmail = email;
    extraConfig = config;
    ignores = ignores;
    difftastic.enable = true;
  };
}
