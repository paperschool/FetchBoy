# Contributing to FetchBoy

## Conventional Commits

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages. This allows automatic changelog generation and semantic versioning.

### Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (formatting)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files

### Examples

```
feat(auth): add OAuth2 support
fix(request): handle timeout errors properly
docs(readme): update installation instructions
feat(ui): add dark mode toggle
fix(collection): prevent duplicate collection names
```

### Breaking Changes

For breaking changes, add `BREAKING CHANGE:` in the body or footer:

```
feat(auth)!: change authentication API

BREAKING CHANGE: The auth module now uses a different token format.
Users need to update their integration.
```

## Release Process

1. All changes are merged to `main` branch
2. The release workflow automatically:
   - Generates changelog from commits
   - Bumps version (major/minor/patch based on commit types)
   - Creates Git tag
   - Builds Tauri app
   - Creates GitHub Release with changelog

## Manual Changelog Generation

To generate changelog locally:

```bash
yarn changelog:generate
```

This will:
- Read git history since last tag
- Parse conventional commits
- Generate CHANGELOG.md
- Update src/data/changelog.json for the app
