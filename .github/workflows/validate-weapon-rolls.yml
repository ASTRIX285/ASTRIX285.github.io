name: Validate weapon rolls

# Deterministic guardrails for authored weapon rollPerks + engine integrity.
# Runs on every PR into the working branch and on manual dispatch.
# This is the mechanical half of validation — it can't rationalise and never
# hits an AI usage limit. Judgement-level review happens separately.

on:
  pull_request:
    branches: [feature/astrix-multigame-platform]
    paths:
      - 'astrix-app/data/paradox-forge/beta/**'
      - 'astrix-app/pages/guardian-workspace-v2/guardian-paradox-engine.mjs'
      - 'astrix-app/pages/guardian-workspace-v2/guardian-fixture-loader.mjs'
      - 'astrix-app/tools/**'
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout PR head
        uses: actions/checkout@v4
        with:
          fetch-depth: 0   # need base commit for the scoped-diff check

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Extract base fixture (for scoped-diff check)
        id: base
        run: |
          FIX=astrix-app/data/paradox-forge/beta/ASTRIX_Paradox_Forge_Beta_Fixtures_v1.json
          if [ -n "${{ github.event.pull_request.base.sha }}" ]; then
            git show "${{ github.event.pull_request.base.sha }}:$FIX" > /tmp/base-fixtures.json 2>/dev/null \
              && echo "have_base=true" >> "$GITHUB_OUTPUT" \
              || echo "have_base=false" >> "$GITHUB_OUTPUT"
          else
            echo "have_base=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Run self-test (engine executes for real)
        run: node astrix-app/tools/test-weapon-roll-nodes.mjs > /tmp/selftest.out
        # non-zero exit fails the job; the assertions live inside the test file

      - name: Run mechanical validation
        run: |
          if [ "${{ steps.base.outputs.have_base }}" = "true" ]; then
            node astrix-app/tools/validate-weapon-rolls.mjs --base /tmp/base-fixtures.json
          else
            node astrix-app/tools/validate-weapon-rolls.mjs
          fi
