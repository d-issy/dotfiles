# Include the whole repository and exclude secrets and generated dependency noise,
# even when the command is run from a subdirectory.
[
  ":(top)"
  ":(top,exclude,glob)**/.env*"
  ":(top,exclude,glob)**/*.pem"
  ":(top,exclude,glob)**/*.key"
  ":(top,exclude,glob)**/*.lock"
  ":(top,exclude,glob)**/package-lock.json"
  ":(top,exclude,glob)**/pnpm-lock.yaml"
  ":(top,exclude,glob)**/go.sum"
  ":(top,exclude,glob)**/flake.lock"
]
