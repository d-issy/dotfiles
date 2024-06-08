#!/bin/bash

cd $(dirname $0)

function get_firefox_dir() {
	wsl_windows_path="/mnt/c/Users/$(whoami)/AppData/Roaming/Mozilla/Firefox"
	macos_path="${HOME}/Library/Application Support/Firefox"
	linux_path="${HOME}/.mozilla/firefox"

	if [ -d "${wsl_windows_path}" ]; then
		echo "${wsl_windows_path}"
	elif [ -d "${macos_path}" ]; then
		echo "${macos_path}"
	elif [ -d "${linux_path}" ]; then
		echo "${linux_path}"
	else
		exit 1
	fi
}

function get_profile_dir() {
	firefox_dir="$(get_firefox_dir)"
	inifile="${firefox_dir}/installs.ini"

	profile_name=$(grep '^Default=' "${inifile}" | cut -d= -f2 | tr -d '\r')
	profile_dir="${firefox_dir}/${profile_name}"

	[ -d "${profile_dir}" ] && echo "${profile_dir}"
}

profile_dir=$(get_profile_dir)
echo "profile_dir: ${profile_dir}"

diff --color -u "${profile_dir}/user.js" user.js
diff --color -u "${profile_dir}/chrome/userChrome.css" chrome/userChrome.css

read -p "Do you want to install the config files? [y/N]: " yn
if [[ ! $yn =~ ^[Yy]$ ]]; then
	exit 0
fi

mkdir -p "${profile_dir}"/chrome
cp -v user.js "${profile_dir}"/user.js
cp -v chrome/userChrome.css "${profile_dir}"/chrome/userChrome.css

if [ ! -f ".done.search" ]; then
	# set default search engine to bing
	cp -v search.json.mozlz4 "${profile_dir}/search.json.mozlz4"
	touch ".done.search"
fi
