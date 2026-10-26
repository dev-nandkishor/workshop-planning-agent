# Contributing

Thank you for your interest in the Workshop Planning Agent. This project is
released under the MIT License and welcomes focused, respectful contributions.

By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
and the Hacktoberfest Hack Day organizer's rules.

## Setup

1. Fork the repository and create a branch.
2. Create a virtual environment and install dependencies:

   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   ```

3. Ensure Ollama is running and the model is available:

   ```powershell
   ollama pull llama3.1:8b
   ```

4. Run the deterministic checks and regression suite:

   ```powershell
   python demo_tools.py
   python -m unittest discover -s tests -t . -v
   ```

5. Start the browser interface and verify a live run when changing the host,
   stream, or UI:

   ```powershell
   python web_app.py
   ```

   Open <http://127.0.0.1:5000>. Local inference may take 30–60 seconds.

## Contribution process

1. Open an issue for significant changes so the approach can be discussed.
2. Keep changes small and focused. Do not mix unrelated fixes.
3. Add or update tests when changing deterministic behaviour.
4. Update the README or submission documentation when behaviour changes.
5. Open a pull request describing the problem, the change, and the tests run.

For LLM prompt or workflow changes, include the exact command used, the model
name, and whether the live path or only mocked tests were exercised. For UI
changes, include the viewport sizes checked and whether the agent event stream
was exercised live or with a mock.

## Code standards

- Keep arithmetic and inventory facts inside `tools.py`.
- Do not add dynamic tool dispatch, `eval()`, or arbitrary function execution.
- Preserve the workflow order, allowlist, argument validation, and fail-safe
  error handling in `app.py`.
- Keep type guards strict. Do not accept booleans as integers.
- Keep the web interface same-origin and dependency-free at runtime. Do not add
  CDNs, analytics, external fonts, or remote tracking scripts.
- Render model and tool text with safe DOM text nodes; do not inject it as HTML.
- Never commit secrets, credentials, personal data, virtual environments, or
  generated model weights.

## AI-assisted contributions

AI tools may be used as development assistants, but contributors must:

- Understand the code they submit.
- Verify generated code and claims.
- Disclose substantial AI assistance in the pull request.
- Ensure generated material complies with licensing and privacy requirements.

## License

By submitting a contribution, you agree that it may be distributed under the
project's [MIT License](LICENSE).
