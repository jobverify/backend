# AI resume preparation and tailoring

The active worker in `resumePipeline.js` runs the pinned Qwen3-4B-Instruct-2507 Q4_K_M model locally with llama.cpp. It generates a complete LaTeX resume from the original document and entered or confirmed profile evidence. Tailoring also supplies the prepared base LaTeX and the saved job's candidate-facing requirements. Supported experience can be rewritten, selected, and ordered for the job; job requirements never become unsupported candidate claims.

Generated LaTeX passes a strict preflight and is compiled into the published PDF by Tectonic inside an isolated Docker container. Compilation has no network, host mounts, credentials, writable root filesystem, or shell escape. The PDF and downloadable TeX come from the same model output. Contact icons can be omitted while their values and link destinations are preserved.

LaTeX decoding is constrained to the cached preamble and supported document commands in `src/utils/resumeLatexFormat.js`. The model writes the candidate content and job-specific revisions within that format. It cannot introduce extra packages such as `inputenc`, `fontspec` or icon fonts. Hyperlink destinations are constrained to original source links and matching email/phone contacts, with LaTeX escapes supplied in the prompt and enforced during both generation and repair. The separate factual audit uses its JSON schema instead of the LaTeX grammar.

Body source lines end paragraphs, keeping entry headings separate from their achievements. Explicit LaTeX line breaks use the same paragraph behavior so they do not add duplicate empty rows. Verify this against the real compiler with `RESUME_COMPILER_INTEGRATION=true node --test test/resumeLatexLayout.test.js` after runtime setup.

Before publication, PDF.js inspects and renders every page. Readable text, minimum 10pt size, page boundaries, identity, contacts, employer/title/date associations, education, numbers, skills, and link destinations are checked. A separate model call audits factual support. One repair is allowed; a failed repair preserves the previous successful version. Public diagnostics contain fixed codes and counts only.

The Actions job allows 30 minutes. The worker's 28-minute deadline starts at the first workflow step, includes dependency setup, and leaves time for cleanup and saving immutable dependencies. Generation uses the remaining deadline rather than a separate eight-minute request cutoff, reserving up to three minutes for PDF compilation and factual validation. The single repair shares that generation deadline. Cold downloads and compilation warmup can take several minutes. Model weights, the verified runtime archive, and the trusted compiler image are cached; candidate documents and model responses are excluded from caches.

Base documents retain substantive source facts without a two-page target. Tailored documents must fit two readable pages while preserving protected employment and education facts. The application has no monthly Actions run cap. The existing allowance of ten tailoring requests per user per UTC day remains.

Existing `source-template:` generations are marked stale and require a fresh AI preparation or tailoring request. Their stored artifacts remain in revision history.

Install and verify the runtime on Linux x64 with Docker available, then run the real synthetic model/LaTeX/PDF benchmark:

```sh
npm run resume:setup
npm run resume:benchmark -- --output .cache/ai-resume-benchmark
```

These commands load no environment file or live database, process only synthetic data, and write QA documents beneath `.cache/`. The worker installs the same pinned dependencies automatically on an Actions cache miss. Model and runtime identities are recorded in `resume-model.json`; compiler identities and warmed dependencies are in `compiler/`.

`sourceTemplate.js` and `sourceTemplatePipeline.js` remain synthetic fixture helpers with licensed bundled fonts. They are not a generation fallback in the application worker. `benchmarkSourceResumes.js` exercises those helpers and source extraction separately from AI quality and compilation.
