# SystemCraft

[![Build](https://github.com/deresegetachew/play-npmlib/workflows/main/badge.svg)](https://github.com/deresegetachew/play-npmlib/actions/workflows/main.yaml)
[![CodeQL](https://github.com/deresegetachew/play-npmlib/workflows/CodeQLAnalyze/badge.svg)](https://github.com/deresegetachew/play-npmlib/actions/workflows/codeql.yml)
[![Release](https://github.com/deresegetachew/play-npmlib/releases/latest/badge.svg)](https://github.com/deresegetachew/play-npmlib/releases)
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

This repository is already enabled as a GitHub Template.

### Create a new repository from this template:

- On the main page of this repository, click the green **Use this template** button.
- Choose **Create a new repository**.
- Fill in the repository name and other details, then click **Create repository from template**.

After creating a repository from this template, you must complete the following setup:

- **Set the required GitHub secrets:**
  - Navigate to **Settings → Secrets and variables → Actions**.
  - Add the following secrets with appropriate values:
    - `BOT_TOKEN` (actually a GitHub Personal Access Token)
    - `NPM_TOKEN`
    - `GPG_PRIVATE_KEY`
    - `GPG_PASSPHRASE`
- **Configure branch protection and required checks:**
  - Go to **Settings → Branches → Branch protection rules**.
  - Add or edit rules for your main branch to require:
    - Status checks to pass before merging.
    - Required status checks including:
      - `Build (Node 22)`
      - `CodeQL Analyze`
- **Verify GPG key UID:**
  - Ensure that the GPG private key's UID includes a valid email address enclosed in `< >`.
  - This email must match one of your verified GitHub account emails to enable signature verification.

Following these steps will help you quickly bootstrap and maintain your project using this template repository.

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
