# systemcraft/play-npmlib

[![CI/CD](https://github.com/deresegetachew/play-npmlib/workflows/main/badge.svg)](https://github.com/deresegetachew/play-npmlib/actions/workflows/main.yaml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/deresegetachew/play-npmlib/codeql.yml?label=CodeQL&logo=github)](https://github.com/deresegetachew/play-npmlib/actions/workflows/codeql.yml)
[![GitHub release](https://img.shields.io/github/release/deresegetachew/play-npmlib.svg)](https://github.com/deresegetachew/play-npmlib/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


A monorepo TypeScript libraries playground with modern tooling and best practices.

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
git clone https://github.com/deresegetachew/play-npmlib
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

## 🔄 Release Process

This project uses [Changesets](https://github.com/changesets/changesets) for version management and publishing:

1. **Create a changeset**: Run `pnpm changeset` to create a new changeset
2. **Describe your changes**: Follow the prompts to describe your changes and specify which packages are affected
3. **Commit the changeset**: Commit the generated `.changeset/*.md` file
4. **Release**: When ready, run `pnpm release` to publish new versions

### Changeset Requirements

All pull requests that modify code must include a changeset file. This is enforced by our CI workflow. If your PR doesn't need a changeset (e.g., documentation updates, CI changes), you can skip this requirement by adding `[skip changeset check]` to your PR title or description.

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

### 🔐 Configure GitHub Secrets

Navigate to **Settings → Secrets and variables → Actions** and add:

| Secret | Description | Required For |
|--------|-------------|--------------|
| `BOT_TOKEN` | GitHub Personal Access Token with repo/workflow permissions | Automated releases & PR creation |
| `NPM_TOKEN` | NPM automation token | Package publishing |
| `GPG_PRIVATE_KEY` | ASCII-armored GPG private key | Signing commits/tags |
| `GPG_PASSPHRASE` | Passphrase for GPG key | GPG operations |

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

   ```
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
