#!/usr/bin/env bash

set -euo pipefail

locale="${1:-}"
po_dir="${PO_DIR:-po}"
pot_file="${POT_FILE:-$po_dir/dropbeat@romanlefler.com.pot}"
po_file="$po_dir/$locale.po"

usage() {
    printf 'Usage: %s <locale>\n' "$0" >&2
    printf 'Example: %s fr\n' "$0" >&2
}

if [[ -z "$locale" ]]; then
    usage
    exit 2
fi

for command in make msginit msgfmt; do
    if ! command -v "$command" >/dev/null 2>&1; then
        printf 'Missing required command: %s\n' "$command" >&2
        exit 127
    fi
done

mkdir -p "$po_dir"

if [[ -e "$po_file" ]]; then
    printf 'Translation already exists: %s\n' "$po_file" >&2
    exit 1
fi

printf 'Generating translation template...\n'
make pot

if [[ ! -f "$pot_file" ]]; then
    printf 'POT file was not generated: %s\n' "$pot_file" >&2
    exit 1
fi

printf 'Creating translation: %s\n' "$po_file"

msginit \
    --no-translator \
    --locale="$locale" \
    --input="$pot_file" \
    --output-file="$po_file"

msgfmt --check --output-file=/dev/null "$po_file"

printf 'Created translation: %s\n' "$po_file"

