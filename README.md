# systemcraft/systemcraft-stack-npmlib

[![CI/CD](https://github.com/deresegetachew/systemcraft-stack-npmlib/workflows/main/badge.svg)](https://github.com/deresegetachew/systemcraft-stack-npmlib/actions/workflows/main.yaml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/deresegetachew/systemcraft-stack-npmlib/codeql.yml?label=CodeQL&logo=github)](https://github.com/deresegetachew/systemcraft-stack-npmlib/actions/workflows/codeql.yml)
[![GitHub release](https://img.shields.io/github/release/deresegetachew/systemcraft-stack-npmlib.svg)](https://github.com/deresegetachew/systemcraft-stack-npmlib/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-ready TypeScript library template with automated workflows, modern tooling, and best practices. Build standalone or multi-package npm libraries with zero configuration overhead.

## ✨ Features

### 🏗️ **Flexible Architecture**

- **Standalone Libraries**: Create single-package npm libraries
- **Monorepo Support**: Build multi-package libraries with shared tooling
- **TypeScript First**: Full TypeScript support with optimized build pipeline
- **Modern Tooling**: PNPM workspace management with efficient dependency handling

### 🤖 **Automated Template Synchronization**

- **Always Up-to-Date**: Template automatically syncs with periodic PRs
- **Zero Maintenance**: Latest best practices and security updates delivered automatically
- **Customizable Sync**: Configure which files to exclude from template updates
- **Conflict Resolution**: Smart merging with manual review for conflicts

### 🛡️ **Built-in Security & Quality**

- **Dependabot Integration**: Automated dependency updates with PR reviews
- **CodeQL Analysis**: Advanced security scanning with PR comments
- **Test Coverage Reports**: Automatic coverage analysis and PR feedback
- **GPG Commit Signing**: Cryptographically signed releases for authenticity

### 🚀 **Production-Ready CI/CD**

- **Automated Publishing**: Changesets-powered semantic versioning and npm publishing
- **Build & Test Pipeline**: Comprehensive testing with Node.js 22
- **Release Automation**: Automatic GitHub releases with changelog generation
- **Branch Protection**: Enforced code review and status checks

### 📋 **Developer Experience**

- **Changeset Validation**: Enforced changelog entries for all changes
- **Label-based Workflows**: Skip validations with PR labels when needed
- **Build Artifacts**: Optimized TypeScript compilation and bundling
- **Clear Error Messages**: Helpful validation and setup guidance

### 🔧 **Template-Specific Features**

- **Configurable Git Identity**: Template-provided composite action for organizational commit signing
- **Template Auto-Sync**: Automated PRs to keep downstream repos updated with template changes
- **Reusable Actions**: Pre-built composite actions for common CI/CD tasks
- **GPG-Signed Automation**: Template handles GPG setup for signed releases and sync commits

## 📦 Packages

This monorepo contains the following packages:

- **[@systemcraft/lib-one](./packages/lib-one)** - Core library functionality
- **[@systemcraft/lib-two](./packages/lib-two)** - Additional utilities and helpers

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher recommended)
- pnpm (v10.17.1 or higher)

### Installation

```bash
# Clone the repository
git clone https://github.com/deresegetachew/systemcraft-stack-npmlib
cd systemcraft

# Install dependencies
pnpm install
```

### Development

```bash
# Build all packages
pnpm run build

# Run tests
pnpm run test

```

## 🏗️ Project Structure

```text
systemcraft/
├── packages/
│   ├── lib-one/          # Core library
│   └── lib-two/          # Utilities library
├── .github/
│   └── actions/          # Custom GitHub Actions
├── .changeset/           # Changeset configuration
├── package.json          # Root package configuration
├── pnpm-workspace.yaml   # Workspace configuration
└── tsconfig.base.json    # Shared TypeScript config
```

## 📋 Available Scripts

- `pnpm release` - Publish packages using changesets

## � Coverage Reports

This project automatically collects and aggregates test coverage reports from all packages in the monorepo. The coverage collection system expects each package to generate a standard `coverage-summary.json` file in its `coverage/` directory.

### Coverage Requirements

For the automated coverage collection to work properly, each package must:

1. **Generate coverage in the standard location**: `packages/<package-name>/coverage/coverage-summary.json`
2. **Use NYC/Istanbul format**: The coverage file should follow the standard NYC (Istanbul) coverage summary format with totals for:
   - Lines
   - Statements
   - Branches
   - Functions

### Coverage Collection Script

The `.github/scripts/collect-coverage.js` script automatically:

- Recursively searches for `coverage/coverage-summary.json` files under `./packages`
- Copies coverage summaries, LCOV reports, and HTML reports to `coverage-artifacts/`
- Generates a consolidated Markdown report with coverage percentages for all packages
- Creates a machine-readable index file for CI/CD integration

The coverage reports are automatically included in pull request comments and GitHub Actions job summaries, providing immediate feedback on test coverage changes.

## �🔄 Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for version management and publishing:

1. **Create a changeset**: Run `pnpm changeset` to create a new changeset
2. **Describe your changes**: Follow the prompts to describe your changes and specify which packages are affected
3. **Commit the changeset**: Commit the generated `.changeset/*.md` file
4. **Release**: When ready, run `pnpm release` to publish new versions

### Changeset Requirements

All pull requests that modify code must include a changeset file. This is enforced by our CI workflow. If your PR doesn't need a changeset (e.g., documentation updates, CI changes), you can skip this requirement by:

- Adding `[skip changeset check]` to your PR title or description, **OR**
- Applying the `[skip changeset check]` label to your PR

**Note**: Both the label name and skip text use square brackets `[...]` for consistency.

## 🧩 Using as a Template

This repository is configured as a GitHub Template, making it easy to create new TypeScript monorepo projects with modern CI/CD pipelines.

### 🚀 Quick Setup

1. **Create Repository from Template**
   - Click the green **"Use this template"** button on GitHub
   - Choose **"Create a new repository"**
   - Fill in your repository name and settings

2. **Initial Customization**
   ```bash
   # Clone your new repository
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd YOUR_REPO_NAME
   
   # Install dependencies
   pnpm install
   ```

3. **Update Project Files** ⚠️
   - **README.md**: Update title, badge URLs, and package descriptions
   - **LICENSE**: Update copyright holder name and year
   - **package.json**: Update name, description, author, and repository URLs
   - **packages/*/package.json**: Update package names and scopes

### � Prepare Workflow & Automatic Labels

This repository uses a **Prepare workflow** (`prepare.yml`) that runs before all other workflows to handle setup tasks. The workflow automatically creates required labels for the repository.

#### Automatically Created Labels

The following labels are automatically created when PRs are opened:

| Label | Color | Description | Usage |
|-------|--------|-------------|--------|
| `[template-sync]` | Blue (`b9e3ff`) | Changes from the template repo | Applied to template synchronization PRs |
| `[skip changeset check]` | Red (`ff4d4f`) | Skip the changeset validation check | Apply to PRs that don't need changesets |

#### Workflow Architecture

1. **Prepare Workflow** (`prepare.yml`) - Preparation and setup
   - **Triggers**: PR events (opened, synchronize, reopened), pushes to main, manual dispatch
   - **Purpose**: Creates required labels, handles preparation tasks
   - **Permissions**: Content write access for label management
   - **Extensible**: Ready for future setup needs

2. **Main Workflow** (`main.yml`) - Core CI/CD pipeline
   - **Triggers**:
     - After Prepare workflow completes (via `workflow_run`)
     - Direct push to main branch
     - PR events (opened, reopened, synchronize, labeled, unlabeled)
   - **Architecture**:
     - Runs independently on PR events for immediate feedback
     - Also runs after Prepare workflow completion for guaranteed setup
     - Handles both preparation-dependent and direct trigger scenarios
   - **Jobs**: Build, test, changeset validation, publishing

#### Why This Architecture?

- **Immediate Feedback**: Main workflow runs directly on PR events for fast CI feedback
- **Guaranteed Setup**: Also runs after Prepare workflow to ensure labels exist
- **Label Responsiveness**: Re-runs immediately when labels are added/removed
- **Flexible Triggering**: Works both independently and as a dependent workflow
- **No Race Conditions**: Multiple trigger paths ensure robust execution

**Why square brackets `[...]`?**  
We use square brackets in label names for visual distinction and to prevent accidental matches with regular text in PR titles/descriptions.

### Composite Actions

The template includes reusable composite actions for common workflow tasks:

| Action | Purpose | Inputs | Usage |
|---------|---------|--------|--------|
| `setup-node-pnpm` | Sets up Node.js with pnpm and caching | `node-version` | Used in all workflows for consistent environment setup |
| `require-changeset` | Validates PRs require changesets unless skipped | `skip-label` | Used in main workflow for changeset enforcement |
| `setup-ci-git-identity` | Complete git setup with identity validation, GPG key import, and signing configuration | `git-user-name`, `git-user-email`, `gpg-private-key`, `gpg-passphrase` (all required), `purpose` (optional) | Used in main and template-sync workflows for signed git commits |

### 🔐 Configure GitHub Secrets

Navigate to **Settings → Secrets and variables → Actions** and add:

| Secret | Description | Required For |
|--------|-------------|--------------|
| `BOT_TOKEN` | GitHub Personal Access Token with repo/workflow permissions | Automated releases & PR creation |
| `NPM_TOKEN` | NPM automation token | Package publishing |
| `GPG_PRIVATE_KEY` | ASCII-armored GPG private key | Signing release commits and template sync commits |
| `GPG_PASSPHRASE` | Passphrase for GPG key | GPG operations for all signed commits |

### 🔄 Template Synchronization Configuration

This repository includes an automated template synchronization workflow that keeps downstream repositories in sync with template updates. The template sync is configured using **repository variables** (not secrets) that can be customized per repository.

#### Template Sync Variables

Navigate to **Settings → Secrets and variables → Actions → Variables** and configure:

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `TEMPLATE_SYNC_ENABLED` | `true` | Enable/disable template synchronization |
| `TEMPLATE_EXCLUDE` | `packages .changeset .changesets LICENSE LICENSES node_modules` | Space-separated paths to exclude from sync |
| `TARGET_BRANCH` | `main` | Target branch for sync PRs |
| `SYNC_BRANCH` | `chore/sync-template` | Branch name for sync PRs |
| `TEMPLATE_SYNC_LABEL` | `template-sync` | Label to apply to sync PRs |
| `CI_GPG_USER_NAME` | **Required** | Git user name for all automated commits (releases and template sync) |
| `CI_GPG_USER_EMAIL` | **Required** | Git user email for all automated commits (releases and template sync) |

#### How Template Sync Works

The workflow automatically:

1. **Runs weekly** (Mondays at 07:00 UTC) or can be triggered manually
2. **Fetches the latest template** from `deresegetachew/systemcraft-stack-npmlib@main`
3. **Syncs files** while excluding configured paths (packages, changesets, licenses, etc.)
4. **Creates/updates a PR** with the changes

#### Customizing Template Sync

**To disable template sync completely:**

```bash
# Set via GitHub UI: Settings → Secrets and variables → Actions → Variables
TEMPLATE_SYNC_ENABLED = false
```

**To exclude additional paths:**

```bash
# Add custom paths to the default exclusions
TEMPLATE_EXCLUDE = packages .changeset .changesets LICENSE LICENSES node_modules custom-folder config.local.json
```

**To change the target branch:**

```bash
TARGET_BRANCH = develop
SYNC_BRANCH = chore/sync-template-to-develop
```

This enables automated pull requests when the template repository is updated, helping keep your derived repositories in sync with the latest improvements and security updates while preserving your custom packages and configuration.

#### Git Identity Configuration

**⚠️ REQUIRED**: You must configure git identity for GPG-signed release commits.

**Mandatory configuration**:

```bash
# Set via Repository Variables (Settings → Secrets and variables → Actions → Variables)
CI_GPG_USER_NAME = "Your Full Name"      # Must match your GPG key name
CI_GPG_USER_EMAIL = "your@email.com"     # Must match your GPG key UID email
```

**Critical Requirements**:

- ✅ **Name**: Must match the name in your GPG key
- ✅ **Email**: Must match an email in your GPG key's UID
- ✅ **Verified**: Email must be verified in your GitHub account
- ❌ **Missing Config**: Workflow will fail with helpful error message

**Why This Matters**:

- Ensures GPG signatures show as "Verified" on GitHub
- Prevents commits being attributed to template author
- Maintains proper audit trail for releases

#### Template Sync Identity (Optional)

For template sync commits, you can optionally customize the bot identity:



### 🛡️ Setup Branch Protection

Go to **Settings → Branches → Branch protection rules**:

1. **Add rule for main branch**
2. **Enable required status checks:**
   - ✅ `build (22)` - Build and test job
   - ✅ `analyze` - CodeQL security analysis
3. **Additional recommended settings:**
   - Require branches to be up to date
   - Include administrators
   - Allow force pushes (for release automation)

### 🔧 Verify Setup

After configuration, test your setup:

```bash
# Create a test changeset
pnpm changeset

# Push changes to trigger CI
git add . && git commit -m "test: verify CI setup"
git push origin main
```

Check that:

- ✅ CI workflows run successfully
- ✅ Status checks appear and pass
- ✅ GPG signatures are verified (look for "Verified" badge on commits)

> **💡 Pro Tip**: The GPG key email must match a verified email in your GitHub account for signature verification to work.

## 🛠️ Development Tools

- **TypeScript** - Type-safe JavaScript development
- **tsup** - Fast TypeScript bundler
- **pnpm** - Fast, disk space efficient package manager
- **Changesets** - Version management and changelog generation

## � GitHub Secrets Configuration

This repository uses several GitHub secrets for automated publishing, signing, and authentication. These secrets need to be configured in your GitHub repository settings under **Settings → Secrets and variables → Actions**.

### Required Secrets

| Secret Name | Description | Used For |
|-------------|-------------|----------|
| `GPG_PRIVATE_KEY` | Private GPG key for signing commits and tags | Signing release commits and tags during automated publishing |
| `GPG_PASSPHRASE` | Passphrase for the GPG private key | Unlocking the GPG key during CI operations |
| `BOT_TOKEN` | GitHub Personal Access Token (PAT) with appropriate permissions (named BOT_TOKEN in this repo) | Pushing signed commits/tags and creating release PRs |
| `NPM_TOKEN` | NPM authentication token | Publishing packages to npm registry |

### Setting up the Secrets

1. **GPG_PRIVATE_KEY**: Export your GPG private key in ASCII armor format:

   ```bash
   gpg --armor --export-secret-key "your-key-id" > private-key.asc
   ```

   ⚠️ **Important:** Your GPG key must include a UID with a valid email in angle brackets, e.g.:

   ```text
   uid   CI Bot <email@email.com>
   ```

   If your UID only contains a name without `<email>`, GitHub will not be able to verify signatures and will show commits as "Unverified". Make sure the email matches one of your verified GitHub account emails.

   Copy the contents of `private-key.asc` into this secret.

2. **GPG_PASSPHRASE**: The passphrase you used when creating your GPG key.

3. **BOT_TOKEN**: Create a GitHub Personal Access Token (PAT) with the following permissions :
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
   
4. **NPM_TOKEN**: Create an npm automation token:
   - Go to npmjs.com → Account → Access Tokens
   - Create a new token with "Automation" type

### Automatic Secrets

The following secrets are automatically provided by GitHub and don't need manual configuration:

- `GITHUB_TOKEN`: Automatically provided by GitHub Actions for repository operations

### Security Notes

- Never commit these secrets to your repository
- Regularly rotate your tokens and keys
- Use the principle of least privilege when setting up token permissions
- Monitor your repository's security audit logs for any unauthorized access

## �📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Add a changeset: `pnpm changeset`
5. Commit your changes: `git commit -am 'Add some feature'`
6. Push to the branch: `git push origin feature/my-feature`
7. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

If you have any questions or need help, please:

1. Check the existing [issues](../../issues)
2. Create a new issue if needed
3. Reach out to the maintainers

---
