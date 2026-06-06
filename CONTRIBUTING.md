# FluentLoop contribution workflow

FluentLoop uses small, single-purpose pull requests so the default branch stays
runnable throughout development.

## Branches

- `feature/<name>` for one user-facing capability
- `fix/<name>` for one defect
- `test/<name>` for test-only improvements
- `docs/<name>` for documentation-only changes
- `chore/<name>` for repository and tooling maintenance

Create every branch from the latest `main`. Pull requests must target `main`
unless the PR description explicitly explains a temporary dependency.

## Commits and pull requests

Each commit should describe one understandable step. Each pull request must:

1. Implement or modify one feature.
2. Explain the feature, implementation, tests, impact, dependencies, and limits.
3. Pass `npm run check`.
4. Keep `main` runnable after merge.

Third-party libraries, APIs, and reused code must be documented in the pull
request and README when applicable.
