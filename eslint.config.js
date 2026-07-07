import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // design_handoff_* holds static design mockups (HTML + vendored browser JS), not
  // app source — linting it is meaningless, same as docs.
  { ignores: ['dist', 'docs', 'coverage', 'design_handoff_*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Enables react-hooks/rules-of-hooks + exhaustive-deps (the client code relies on
  // these — its `eslint-disable react-hooks/*` comments need the plugin registered).
  reactHooks.configs['recommended-latest'],
  // Dev/tooling scripts legitimately interface with untyped external APIs (the V8
  // inspector protocol, raw JSONL) — `any` is pragmatic there.
  {
    files: ['scripts/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
