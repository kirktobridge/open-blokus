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
  // Plain-node .mjs tooling (e.g. the doc-debt hook script) — the TS files get
  // their globals via the TS parser; bare ESM needs node's declared explicitly.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  // Variant separation (P55). `BOARD_SIZE`, `COLOR_ORDER` and `CORNERS` are the
  // *Classic* constants; the variant-aware readers are `boardSizeOf`, `playColorsOf`
  // and `startCellOf` in src/game/modes.ts. Reading a Classic constant from code that
  // has to work on a Duo board is the one class of bug that stays green through
  // vitest, typecheck and lint at once (P54 found the AI harness doing exactly that),
  // so inside the variant-sensitive trees it is a lint error instead.
  //
  // This guards the *constant-import* path; the required `size`/`variant` parameters
  // on the rules-core helpers guard the *function-call* path. Different holes.
  //
  // Genuinely Classic-only code takes a file-level disable **with the reason stated** —
  // that comment is the only place a "this is Classic by design" intent is recorded.
  {
    files: [
      'src/game/ai/**',
      'src/client/board/**',
      'src/client/advisor/**',
      'src/client/drama.ts',
      'src/game/recap.ts',
      'src/game/share.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/types', '**/modes', '**/constants'],
              importNames: ['BOARD_SIZE', 'COLOR_ORDER', 'CORNERS'],
              message:
                'Classic-only constant in variant-sensitive code — use boardSizeOf / playColorsOf / startCellOf from game/modes, or disable this rule for the file and say why it is Classic by design (P55).',
            },
          ],
        },
      ],
    },
  },
);
