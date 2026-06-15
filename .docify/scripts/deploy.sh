#!/usr/bin/env bash
set -euo pipefail
shopt -s dotglob

PROJECT_ROOT=$(pwd)
DOCIFY_DIR="$PROJECT_ROOT/.docify"

if [ ! -d "$DOCIFY_DIR" ]; then
    echo "Error: .docify/ directory not found in $PROJECT_ROOT"
    exit 1
fi

echo "Deploying docify to $PROJECT_ROOT..."

# Initialize tool directories
mkdir -p "$PROJECT_ROOT/.opencode"
mkdir -p "$PROJECT_ROOT/.gemini"
mkdir -p "$PROJECT_ROOT/.agents/skills"

# Helper to deploy symlinks recursively (copy on top for directories)
deploy_symlink_recursive() {
    local src="$1"
    local dest="$2"
    if [ -d "$src" ]; then
        mkdir -p "$dest"
        for item in "$src"/*; do
            [ -e "$item" ] || continue
            deploy_symlink_recursive "$item" "$dest/$(basename "$item")"
        done
    else
        if [ -e "$dest" ] || [ -L "$dest" ]; then
            read -p "Target $dest already exists. Overwrite? (y/n): " confirm
            if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
                echo "Skipping $dest"
                return
            fi
            rm -f "$dest"
        fi
        ln -sr "$src" "$dest"
    fi
}

# 1. Deploy OpenCode config (Symlinks copy on top)
for item in "$PROJECT_ROOT/.docify/opencode"/*; do
    [ -e "$item" ] || continue
    deploy_symlink_recursive "$item" "$PROJECT_ROOT/.opencode/$(basename "$item")"
done

# 2. Deploy Gemini CLI config (Symlinks copy on top)
for item in "$PROJECT_ROOT/.docify/gemini"/*; do
    [ -e "$item" ] || continue
    deploy_symlink_recursive "$item" "$PROJECT_ROOT/.gemini/$(basename "$item")"
done

# 3. Deploy skills (Symlinks copy on top)
for item in "$PROJECT_ROOT/.docify/agents/skills"/*; do
    [ -e "$item" ] || continue
    deploy_symlink_recursive "$item" "$PROJECT_ROOT/.agents/skills/$(basename "$item")"
done

echo "Deployment completed successfully."
