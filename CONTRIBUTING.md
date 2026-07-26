# Contributing

Open an issue before changing the configuration contract, installed file
layout, publication safety gates, or Notion page replacement semantics.

For a code change:

1. Keep the plugin dependency-free unless a dependency removes more risk than
   it adds.
2. Add or update tests for configuration, installation, validation, and
   publication behavior.
3. Run `npm run check`.
4. Run both official local validators described in `README.md`.
5. Document compatibility or migration impact in the pull request.

Never use a live Notion token in tests. Network behavior must be tested with
stubbed responses.
