#!/bin/bash

# Alternative approach: Create a clean branch and cherry-pick commits

echo "Creating a clean branch without secrets..."
echo ""

# Step 1: Create a new branch from before the problematic commit
echo "Step 1: Creating new branch from clean history..."
git checkout -b clean-main 200b6c1  # This is the commit before ec9e0fe

# Step 2: Cherry-pick all commits after ec9e0fe (skipping ec9e0fe itself)
echo ""
echo "Step 2: Cherry-picking clean commits..."

# List of commits to cherry-pick (all after ec9e0fe)
COMMITS=(
    "90d67a3"  # refactor: update email templates to use extracted components
    "e8100d2"  # refactor: extract email components for better reusability
    "b55ada3"  # docs: update documentation for Phase 2 refactoring
    "92f276d"  # test: add comprehensive tests for AWS run-now handler
    "28d41e3"  # fix: correct TypeScript generic arrow function syntax in metrics
    "633856f"  # feat: add multi-tier OpenAI model configuration
    "fdabe38"  # feat: implement saga pattern for complex workflows
    "3d7f407"  # feat: add advanced utility functions
    "e85905e"  # refactor: update digest processor with improved architecture
    "0810b99"  # chore: minor improvements and linting updates
    "aaca011"  # build: update dependencies and test scripts
    "dcb09b4"  # docs: add comprehensive technical documentation
    "854f413"  # fix: update build script to use new build commands
    "d0f403a"  # feat: update to latest OpenAI models (o4-mini and gpt-5)
    "ef6b4f0"  # chore: remove obsolete function directories
    "1ce1dcb"  # chore: update bun.lock with latest dependencies
    "f54953f"  # fix: update deploy script to require platform selection
    "2761bbf"  # feat: add platform identifier to email templates and stagger schedules
    "f46eed4"  # feat: add Next.js frontend with Clerk auth and TanStack suite
)

for COMMIT in "${COMMITS[@]}"; do
    echo "Cherry-picking $COMMIT..."
    git cherry-pick $COMMIT || {
        echo "⚠️  Conflict in $COMMIT - please resolve and continue"
        echo "After resolving, run: git cherry-pick --continue"
        exit 1
    }
done

echo ""
echo "✅ Clean branch created!"
echo ""
echo "Step 3: Replace main branch"
echo "----------------------------------------"
echo "To replace the main branch with this clean version:"
echo ""
echo "# Force update local main"
echo "git branch -f main clean-main"
echo "git checkout main"
echo ""
echo "# Force push to remote"
echo "git push origin main --force"
echo ""
echo "⚠️  This will rewrite history on the remote!"