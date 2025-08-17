#!/bin/bash

# Script to remove sensitive files from git history
# This uses git filter-branch to rewrite history

echo "⚠️  WARNING: This will rewrite git history!"
echo "Make sure you have a backup of your repository"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted"
    exit 1
fi

# Files to remove from history
FILES_TO_REMOVE=(
    ".env.aws"
    "terraform/aws/terraform.tfstate"
    "terraform/aws/terraform.tfstate.backup"
    "terraform/aws/terraform.tfvars"
    "terraform/azure/terraform.tfstate"
    "terraform/azure/terraform.tfstate.backup"
    "terraform/azure/terraform.tfvars"
)

echo "Removing sensitive files from git history..."

for FILE in "${FILES_TO_REMOVE[@]}"; do
    echo "Removing $FILE from history..."
    git filter-branch --force --index-filter \
        "git rm --cached --ignore-unmatch $FILE" \
        --prune-empty --tag-name-filter cat -- --all
done

echo ""
echo "✅ History cleaned!"
echo ""
echo "⚠️  IMPORTANT: You will need to force push to update the remote repository:"
echo "git push origin --force --all"
echo "git push origin --force --tags"
echo ""
echo "⚠️  WARNING: This will overwrite the remote history. Make sure:"
echo "1. You have informed any collaborators"
echo "2. They will need to re-clone or rebase their local copies"
echo "3. You have a backup of the repository"