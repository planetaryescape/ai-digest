#!/bin/bash

# Script to remove secrets from git history using BFG Repo-Cleaner
# BFG is faster and safer than git filter-branch

echo "This script will help you remove secrets from git history using BFG Repo-Cleaner"
echo ""
echo "Step 1: Install BFG (if not already installed)"
echo "----------------------------------------"
echo "On macOS: brew install bfg"
echo "Or download from: https://rtyley.github.io/bfg-repo-cleaner/"
echo ""
read -p "Press Enter when BFG is installed..."

echo ""
echo "Step 2: Create a backup of your repository"
echo "----------------------------------------"
cd ..
cp -r ai-digest ai-digest-backup
echo "✅ Backup created at ../ai-digest-backup"
cd ai-digest

echo ""
echo "Step 3: Remove sensitive files from history"
echo "----------------------------------------"

# Create a file with paths to remove
cat > secrets-to-remove.txt << 'EOF'
.env.aws
terraform/aws/terraform.tfstate
terraform/aws/terraform.tfstate.backup
terraform/aws/terraform.tfvars
terraform/azure/terraform.tfstate
terraform/azure/terraform.tfstate.backup
terraform/azure/terraform.tfvars
EOF

echo "Files to be removed from history:"
cat secrets-to-remove.txt
echo ""

read -p "Continue with removal? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted"
    exit 1
fi

# Run BFG to remove files
echo "Running BFG to remove files..."
bfg --delete-files "{.env.aws,terraform.tfstate,terraform.tfstate.backup,terraform.tfvars}" --no-blob-protection .

# Clean up the repository
echo ""
echo "Cleaning up repository..."
git reflog expire --expire=now --all && git gc --prune=now --aggressive

echo ""
echo "✅ History cleaned!"
echo ""
echo "Step 4: Force push to remote"
echo "----------------------------------------"
echo "Run these commands to update the remote repository:"
echo ""
echo "git push origin --force --all"
echo "git push origin --force --tags"
echo ""
echo "⚠️  WARNING: This will overwrite the remote history!"
echo "Make sure to inform any collaborators - they will need to re-clone the repository."

# Clean up
rm secrets-to-remove.txt