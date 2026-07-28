# Release checklist

No item in the external publication section may be performed without the
owner's explicit approval.

## Source candidate

- [ ] `npm run check` passes.
- [ ] Official plugin validation passes.
- [ ] Official skill validation passes.
- [ ] Manifest, package, and release version match.
- [ ] README examples match the installer output.
- [ ] English and Korean installation paths are tested.
- [ ] No token, page ID, private content, or local user path is present.
- [ ] Setup UI binds only to loopback and does not use browser storage.
- [ ] GitHub secrets are passed through stdin, not command arguments or files.
- [ ] Required-reviewer plan-limit fallback is narrow, tested, and visibly
      reports reduced protection; its retry body omits all protection-rule
      fields.
- [ ] GitHub login/refresh opens the browser device flow, copies the code,
      reports progress immediately, and has a bounded timeout.
- [ ] The configured canonical branch, not a hard-coded branch, gates publishing.
- [ ] License, privacy, terms, support, security, and contribution files are
      reviewed.

## Local acceptance

- [ ] Add the plugin to a local marketplace.
- [ ] Start a new task with the plugin enabled.
- [ ] Run direct and indirect activation prompts.
- [ ] Run one negative prompt that should not activate the skill.
- [ ] Install into a disposable target repository.
- [ ] Validate filled example documents.
- [ ] Run a Notion API preflight with non-production pages.
- [ ] Perform one explicitly approved test publication and rerun it to verify
      idempotency.

## External publication — approval required

- [ ] Create the standalone `Yeon-sik/notion-project-docs` repository.
- [ ] Push the reviewed source candidate.
- [ ] Enable branch protection and private vulnerability reporting.
- [ ] Confirm public policy and support URLs.
- [ ] Create a signed `v0.1.0` release and source archive.
- [x] Prepare five positive and three negative skill evaluation prompts.
- [ ] Execute and record all cases in `docs/EVALUATIONS.md`.
- [ ] Prepare listing copy, screenshots, logo, release notes, and availability.
- [ ] Verify the intended OpenAI Platform developer identity.
- [ ] Submit the skills-only plugin for review.
- [ ] Publish only after the owner approves the final listing and review result.
