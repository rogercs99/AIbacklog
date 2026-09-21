#!/usr/bin/env bash
set -euo pipefail
mkdir -p _restore/runtime _restore/prefix _restore/mariadb _restore/www
for z in $(printf '%s\n' habbo-runtime-part-*.zip | sort); do unzip -jo "$z" -d _restore/runtime >/dev/null; done
cat $(find _restore/runtime -type f -name 'runtime.part*' | sort) > habbo-2009-dual-linux-RUNTIME-20260921.zip
for z in $(printf '%s\n' habbo-wineprefix-part-*.zip | sort); do unzip -jo "$z" -d _restore/prefix >/dev/null; done
cat $(find _restore/prefix -type f -name 'wineprefix.part*' | sort) > habbo-2009-dual-linux-WINEPREFIX-20260921.tar.gz
for z in $(find backend-parts -maxdepth 1 -name 'habbo-mariadb-part-*.zip' | sort); do unzip -jo "$z" -d _restore/mariadb >/dev/null; done
cat $(find _restore/mariadb -type f -name 'mariadb.part*' | sort) > mariadb-11.5.2-linux-systemd-x86_64.tar.gz
for z in $(find www-parts -maxdepth 1 -name 'habbo-www-part-*.zip' | sort); do unzip -jo "$z" -d _restore/www >/dev/null; done
cat $(find _restore/www -type f -name 'www.part*' | sort) > havana_www_10_09_2024.7z
echo 'Restore assembly complete. Read LATEST_20260921_1911.md before execution.'
