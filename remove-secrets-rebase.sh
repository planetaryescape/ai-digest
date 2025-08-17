#!/bin/bash

echo "Removing secrets from git history using interactive rebase"
echo "==========================================================="
echo ""

# First, let's identify the problematic commit
PROBLEM_COMMIT="ec9e0fec127772bea219667a3f1b69c5c360e708"
PARENT_COMMIT="200b6c1" # commit before the problematic one

echo "The problematic commit with secrets is: ec9e0fe"
echo "We'll rebase from its parent: $PARENT_COMMIT"
echo ""

# Create a backup branch
echo "Creating backup branch..."
git branch backup-main-$(date +%Y%m%d-%H%M%S)

echo ""
echo "Starting interactive rebase to remove the problematic commit..."
echo "When the editor opens:"
echo "1. Find the line with 'ec9e0fe feat: major dependency updates and AI SDK v5 migration'"
echo "2. Delete that entire line (or change 'pick' to 'drop')"
echo "3. Save and exit the editor"
echo ""
read -p "Press Enter to continue..."

# Start interactive rebase
GIT_SEQUENCE_EDITOR="sed -i '' '/ec9e0fe/d'" git rebase -i $PARENT_COMMIT --rebase-merges

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Rebase completed successfully!"
    echo ""
    echo "The problematic commit has been removed from history."
    echo "Now you need to force push to update the remote:"
    echo ""
    echo "  git push origin main --force"
    echo ""
    echo "⚠️  WARNING: This will rewrite history on the remote!"
    echo "Make sure to inform any collaborators."
else
    echo ""
    echo "❌ Rebase had conflicts or failed."
    echo "You may need to:"
    echo "1. Resolve any conflicts"
    echo "2. Run: git rebase --continue"
    echo "Or abort with: git rebase --abort"
fi