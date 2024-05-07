#!/bin/bash

cd $(dirname $0)

targets=(
	"user.js"
	"chrome"
)

function get_profile_dir() {
	user=$(whoami)
	if [ -d /mnt/c/Users/$(whoami)/AppData/Roaming/Mozilla/Firefox ]; then # windows on wsl
		firefox_dir="/mnt/c/Users/$(whoami)/AppData/Roaming/Mozilla/Firefox"
	elif [ -d ${HOME}/Library/Application\ Support/Firefox ]; then # macOS
		firefox_dir="${HOME}/Library/Application Support/Firefox"
	elif [ -d ${HOME}/.mozilla/firefox ]; then # Others
		firefox_dir="${HOME}/.mozilla/firefox"
	else
		echo "not found"
		exit 1
	fi

	inifile=${firefox_dir}/installs.ini
	if [ ! -f "${inifile}" ]; then
		echo "cannot find firefox profile automatically"
		exit 1
	fi

	profile_dir=${firefox_dir}/$(grep '^Default=' ${inifile} | cut -d= -f2 | tr -d '\r')
	if [ ! -d "${profile_dir}" ]; then
		echo "cannot find firefox profile automatically"
		exit 1
	fi
	echo ${profile_dir}
}

function show_diff() {
	profile_dir=$(get_profile_dir)
	for target in ${targets[@]}; do
		if [ -d ${target} ]; then
			for file in $(ls ${target}); do
				diff --color=auto -u ${profile_dir}/${target}/${file} ${target}/${file} 2>/dev/null || (
					echo ${target}/${file}:
					cat ${target}/${file}
					echo
				)
			done
		elif [ -f ${target} ]; then
			diff --color=auto -u ${profile_dir}/${target} ${target} 2>/dev/null || (
				echo ${target}:
				cat ${target}
				echo
			)
		fi
	done
}

profile_dir=$(get_profile_dir)
echo "profile_dir: ${profile_dir}"
show_diff
read -p "Do you want to install the config files? [y/N]: " yn
if [[ ! $yn =~ ^[Yy]$ ]]; then
	exit 0
fi

echo Coping files...
for target in ${targets[@]}; do
	if [ -d ${target} ]; then
		mkdir -p ${profile_dir}/${target}
		cp -vr ${target}/* ${profile_dir}/${target}
	elif [ -f ${target} ]; then
		cp -vr ${target} ${profile_dir}/${target}
	fi
done
echo Done!!!
