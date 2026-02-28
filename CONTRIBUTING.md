# Contributing to PhishDefender

Thank you for your interest in contributing. This document explains how to get involved.

---

## Code of Conduct

By participating in this project you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Ways to Contribute

- Report bugs or unexpected behaviour via [GitHub Issues](https://github.com/abhimanyu60/phish-defender/issues)
- Suggest features or improvements
- Submit pull requests for bug fixes or new features
- Improve documentation

---

## Development Setup

1. Fork the repository and clone your fork:

   ```bash
   git clone https://github.com/<your-username>/phish-defender.git
   cd phish-defender
   ```

2. Set up the backend (see [README.md](README.md#2-backend-setup)).

3. Set up the frontend (see [README.md](README.md#3-frontend-setup)).

4. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## Pull Request Guidelines

- Keep pull requests focused — one feature or fix per PR.
- Write clear commit messages that explain **why**, not just what changed.
- Make sure the backend starts without errors (`uvicorn app.main:app --reload`).
- Make sure the frontend builds without errors (`npm run build`).
- Update documentation (README, docstrings, comments) if your change affects behaviour or configuration.
- Reference any related issues in your PR description (e.g. `Closes #42`).

---

## Reporting Bugs

When filing a bug report, include:

- Operating system and version
- Python version / Node.js version
- Steps to reproduce
- Expected behaviour
- Actual behaviour (including any error messages or stack traces)

---

## Suggesting Features

Open a GitHub Issue with the label `enhancement`. Describe:

- The problem you are trying to solve
- Your proposed solution or approach
- Any alternatives you considered

---

## Commit Style

Follow [Conventional Commits](https://www.conventionalcommits.org/) where possible:

```
feat: add bulk-export endpoint
fix: handle missing sender header gracefully
docs: update Azure setup instructions
refactor: extract classifier into separate module
```

---

## License

By submitting a pull request you agree that your contribution will be licensed under the [MIT License](LICENSE).
