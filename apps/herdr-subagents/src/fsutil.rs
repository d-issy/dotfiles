use crate::error::{Error, Result, die};
use std::collections::hash_map::RandomState;
use std::ffi::OsString;
use std::fs;
use std::hash::{BuildHasher, Hasher};
use std::io::{self, Write};
use std::os::unix::fs::{DirBuilderExt, MetadataExt, OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};

const TEMP_SUFFIX_ALPHABET: &[u8] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

pub fn path_with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut text = OsString::from(path);
    text.push(suffix);
    PathBuf::from(text)
}

pub fn create_private_dir(directory: &Path) -> io::Result<()> {
    fs::DirBuilder::new().mode(0o700).create(directory)
}

pub fn ensure_private_directory(directory: &Path) -> Result<()> {
    if create_private_dir(directory).is_ok() {
        return Ok(());
    }
    // Never trust pre-existing paths under a shared temporary directory.
    let owned_directory = fs::symlink_metadata(directory)
        .ok()
        .filter(|meta| meta.is_dir() && meta.uid() == rustix::process::geteuid().as_raw());
    let Some(meta) = owned_directory else {
        return die(format!(
            "state directory must be owned by the current user and not be a symlink: {}",
            directory.display()
        ));
    };
    if meta.permissions().mode() & 0o7777 != 0o700 {
        return die(format!(
            "state directory must have mode 700: {}",
            directory.display()
        ));
    }
    Ok(())
}

fn random_suffix() -> String {
    let mut seed = RandomState::new().build_hasher().finish();
    let base = TEMP_SUFFIX_ALPHABET.len();
    (0..6)
        .map(|_| {
            let digit = usize::try_from(seed % base as u64).unwrap_or(0);
            seed /= base as u64;
            TEMP_SUFFIX_ALPHABET[digit] as char
        })
        .collect()
}

/// Writes through a randomized exclusive `0600` sibling file and renames it over `path`.
pub fn write_private_atomically(path: &Path, content: &str) -> Result<()> {
    for _ in 0..100 {
        let next = path_with_suffix(path, &format!(".{}", random_suffix()));
        let file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&next);
        let mut file = match file {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return die(format!("cannot create {}: {error}", next.display())),
        };
        let result = file
            .write_all(content.as_bytes())
            .and_then(|()| file.flush())
            .and_then(|()| fs::rename(&next, path));
        if let Err(error) = result {
            let _ = fs::remove_file(&next);
            return die(format!("cannot write {}: {error}", path.display()));
        }
        return Ok(());
    }
    die("cannot create a temporary manifest file")
}

pub fn read_file(path: &Path) -> Result<String> {
    fs::read_to_string(path).map_err(|error| Error::Message(format!("{}: {error}", path.display())))
}
