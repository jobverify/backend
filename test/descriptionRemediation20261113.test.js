import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRewriteInput, buildDescriptionSourceUpdate } from '../src/services/jobDescriptionPolicy.js';
import { buildSourceDescriptionDisplay, publicDescriptionFields } from '../src/utils/jobDescriptionDisplay.js';
import { assessDescriptionRewrite, rewriteCandidates } from '../rewriting/runner.js';
import { validateProsePart, validateProseRewrite } from '../rewriting/prose.js';

// Bounded reproductions of the employer-source fragments in the supplied run.
const configuration = '{"onboarding Config":{"disable Pre Population":false},"view Mode":{"field Label":"Duration"},"edit Mode":{"required":false,"type":"date_range"}}';
const introduction = 'Build reliable Python services with our engineering team. Review customer needs, maintain automated tests, document technical decisions, and investigate production issues with product managers.';
const collapsed = introduction + ' Responsibilities: • Build Python 3.11 services. • Maintain automated tests. Required qualifications: At least 2 years of Python experience is required. Preferred qualifications: AWS is preferred, not required. Application details: Apply at https://example.test/jobs/engineer?source=careers.';
const payload = text => text.replace(/^#{1,6}[ \t]+/gm, '').replace(/\s+/g, ' ').trim();

test('configuration appended to genuine prose is rejected before inference and source fallback', async () => {
  const sourceDescription = introduction + '\n\n' + configuration;
  const input = buildRewriteInput({ title: 'Engineer', company: 'Employer', sourceDescription });
  assert.deepEqual(assessDescriptionRewrite(input, 'prose'), { ok: false, reason: 'non_job_source_content' });
  const job = { _id: 'configuration', status: 'active', title: 'Engineer', company: 'Employer', sourceDescription,
    sourceContentHash: input.inputHash, descriptionRewrite: { status: 'pending', inputHash: input.inputHash } };
  const writes = [];
  const stats = await rewriteCandidates([job], { deadline: Date.now() + 10000,
    client: { format: 'prose', generate: () => assert.fail('configuration must not consume inference') },
    update: async (_filter, update) => { writes.push(update); return { matchedCount: 1 }; } });
  assert.equal(stats.published, 0);
  assert.equal(stats.skipped, 1);
  assert.ok(writes.every(update => update.$set.description === undefined));
});

test('new contaminated input retains evidence without making configuration display text', () => {
  const sourceDescription = introduction + '\n\n' + configuration;
  const update = buildDescriptionSourceUpdate({ title: 'Engineer', sourceDescription }, null, { mode: 'publish' });
  assert.equal(update.sourceDescription, sourceDescription);
  assert.equal(update.description, null);
  assert.equal(update.descriptionRewrite.status, 'skipped');
  assert.equal(update.descriptionRewrite.reason, 'non_job_source_content');
});

test('a direct prose validation call cannot publish preserved application configuration', () => {
  const sourceDescription = introduction + '\n\n' + configuration;
  const input = buildRewriteInput({ title: 'Engineer', sourceDescription });
  const checked = validateProseRewrite({ inputHash: input.inputHash, parts: [{ source: sourceDescription, text: sourceDescription }] }, input, 'stop');
  assert.equal(checked.ok, false);
  assert.equal(checked.reason, 'non_job_source_content');
});

test('engineering prose mentioning form configuration and JSON remains eligible', () => {
  const sourceDescription = 'Build application forms and document their JSON API. Review field labels, maintain onboarding configuration, and test required fields with the engineering team.';
  assert.equal(assessDescriptionRewrite(buildRewriteInput({ title: 'Engineer', sourceDescription }), 'prose').ok, true);
});

test('collapsed employer headings and bullets become readable without changing source payload', () => {
  const display = buildSourceDescriptionDisplay(collapsed);
  assert.equal(display.descriptionFormat, 'plain');
  assert.match(display.description, /(?:^|\n\n)(?:## )?Responsibilities:\n/);
  assert.match(display.description, /\n[•-] Build Python 3\.11 services\./);
  assert.match(display.description, /\n[•-] Maintain automated tests\./);
  assert.match(display.description, /\n\n(?:## )?Required qualifications:\n/);
  assert.match(display.description, /\n\n(?:## )?Preferred qualifications:\n/);
  assert.equal(payload(display.description), payload(collapsed));
  assert.match(display.description, /https:\/\/example\.test\/jobs\/engineer\?source=careers\./);
  assert.deepEqual(buildSourceDescriptionDisplay(display.description), display);
});

test('published descriptions receive display-only layout recovery while retaining accepted wording', () => {
  const job = { description: collapsed, sourceDescription: 'Original wording must never replace the accepted rewrite.',
    descriptionFormat: 'markdown', descriptionRewrite: { status: 'published' } };
  const before = structuredClone(job);
  const fields = publicDescriptionFields(job);
  assert.match(fields.description, /\n\n(?:## )?Responsibilities:/);
  assert.equal(payload(fields.description), payload(collapsed));
  assert.deepEqual(job, before);
});

test('already readable Markdown is not replaced by the original source', () => {
  const description = '## Responsibilities\n\n- Build Python services.\n- Maintain automated tests.\n\n## Preferred qualifications\n\nAWS is preferred, not required.';
  assert.deepEqual(publicDescriptionFields({ description, descriptionFormat: 'markdown', sourceDescription: collapsed }), {});
});

test('layout recovery never separates a wrapped condition from its duty', () => {
  const source = 'Responsibilities:\n- Travel only\n  when the client requests it.\n- Support Python 3.11 services.';
  const display = buildSourceDescriptionDisplay(source);
  assert.match(display.description, /Travel only\n  when the client requests it\./);
  assert.equal(validateProsePart(source, display.description), null);
});

test('plain dense prose gains paragraph boundaries without changing technical identifiers or wording', () => {
  const source = 'Build Python 3.11 services and use List<T> when documenting API contracts. '.repeat(18).trim();
  const display = buildSourceDescriptionDisplay(source);
  assert.match(display.description, /\n\n/);
  assert.equal(payload(display.description), payload(source));
  assert.equal(validateProsePart(source, display.description), null);
});

test('published source contamination cannot leak through the public description read path', () => {
  const fields = publicDescriptionFields({ description: introduction + '\n\n' + configuration,
    descriptionFormat: 'markdown', descriptionRewrite: { status: 'published' } });
  assert.deepEqual(fields, { description: '', descriptionFormat: 'plain' });
});

test('native hyphen lists recover item boundaries while keeping versions, quantities, and wording', () => {
  const source = 'Responsibilities: - Plan OCR/ICR projects - Implement Python 3.11 services - Maintain HTTP/2 interfaces - Review 2020 - 2024 records.';
  const display = buildSourceDescriptionDisplay(source);
  assert.equal((display.description.match(/\n- /g) || []).length, 4);
  assert.match(display.description, /2020 - 2024/);
  assert.equal(payload(display.description), payload(source));
});

test('complete source lines do not collapse back into one paragraph', () => {
  const source = 'Lead a platform engineering team of approximately 30 people.\nPartner with colleagues to define the roadmap.\nDocument decisions only when the review has finished.';
  const display = buildSourceDescriptionDisplay(source);
  assert.match(display.description, /people\.\n\nPartner/);
  assert.match(display.description, /roadmap\.\n\nDocument/);
  assert.equal(payload(display.description), payload(source));
});

test('collapsed source heading labels remain attached to required and preferred facts', () => {
  const source = 'Key Responsibilities Build Python services Required Qualifications At least 2 years of Python experience Preferred Qualifications AWS experience is preferred';
  const display = buildSourceDescriptionDisplay(source);
  assert.match(display.description, /Key Responsibilities\n\nBuild/);
  assert.match(display.description, /Required Qualifications\n\nAt least 2/);
  assert.match(display.description, /Preferred Qualifications\n\nAWS/);
  assert.equal(payload(display.description), payload(source));
  assert.equal(validateProsePart(source, display.description), null);
  assert.notEqual(validateProsePart(source, display.description.replace('2 years', '5 years')), null);
  assert.notEqual(validateProsePart(source, display.description.replace('Preferred Qualifications', 'Required Qualifications')), null);
});

test('a recovered role summary ends the preceding skills scope in final assembly', () => {
  const source = 'Location: Bangalore / Hybrid Primary Skills: SQL, Python Job Summary We are looking for a Data Engineer to build reliable services with our team.';
  const display = buildSourceDescriptionDisplay(source).description;
  assert.equal(validateProsePart(source, display), null);
  assert.notEqual(validateProsePart(source, display.replace('Job Summary', 'Required Qualifications')), null);
});

test('native diamond bullets gain boundaries without dropping skill names', () => {
  const source = 'Skills ◆ Data Collection Analyze trends. ◆ Action Planning Develop plans. ◆ Reporting Prepare reports.';
  const display = buildSourceDescriptionDisplay(source);
  assert.equal((display.description.match(/\n◆ /g) || []).length, 3);
  assert.equal(payload(display.description), payload(source));
});

test('preserved inline lists validate consistently with recovered list boundaries', () => {
  for (const source of [
    'This role is part of finance - reporting and Analytics team. - Interprets data and turns it into information which can offer ways to improve a business, thus affecting business decisions. - These include storing data, creating reports, analyzing reports, creating custom reporting tools and sharing findings with various company departments using tools like Tableau, SQL, ETL(Alteryx etc) and Advanced Excel.. - Examine the unique needs and concerns of a business to develop relevant Reports and procedures for preparing business reports.',
    '• Should have experience with Autosar Application and RTE • Should have experience with DaVinci Configurator Classic • Should have experience with DaVinci Developer Classic • Hands on experience in Mode Management Stack ( viz. BswM and EcuM).',
  ]) {
    const display = buildSourceDescriptionDisplay(source).description;
    assert.equal(validateProsePart(source, display), null);
    assert.notEqual(validateProsePart(source, display.replace('experience', 'no experience').replace('can offer', 'will offer')), null);
  }
});

test('inline links, literal metadata, and approximate quantities do not disable paragraph recovery', () => {
  const source = 'Req ID 87608 | Chennai, India. We work with ~30 colleagues. ' + 'Build Python services with the engineering team. '.repeat(30) + 'See [the role](https://example.test/role) for details.';
  const display = buildSourceDescriptionDisplay(source);
  assert.match(display.description, /\n\n/);
  assert.match(display.description, /\[the role\]\(https:\/\/example\.test\/role\)/);
  assert.equal(payload(display.description), payload(source));
});

test('displaying employer HTML retains an application anchor destination', () => {
  const display = buildSourceDescriptionDisplay('<p>Build Python services.</p><p>Apply <a href="https://example.test/careers?id=42&amp;lang=en">through our careers page</a>.</p>');
  assert.match(display.description, /https:\/\/example\.test\/careers\?id=42&lang=en/);
});

test('formatting preserves headings and bullet-like text inside inline code and links', () => {
  const source = 'Read `Required Skills Python • Java • SQL` and [Required Skills Python • Java • SQL](https://example.test/skills) before applying.';
  assert.equal(buildSourceDescriptionDisplay(source).description, source);
});

test('employer links inside HTML lists retain the exact destination', () => {
  const display = buildSourceDescriptionDisplay('<ul><li>Apply <a href="https://example.test/apply?id=42&amp;lang=en">on our careers page</a>.</li></ul>');
  assert.match(display.description, /https:\/\/example.test\/apply\?id=42&lang=en/);
});

for (const job of JSON.parse(readFileSync(new URL('./test-data/descriptionFormatting20261113.json', import.meta.url), 'utf8'))) {
  test(`current ${job.company} description gains idempotent formatting without replacing its wording`, () => {
    const fields = publicDescriptionFields(job);
    assert.equal(typeof fields.description, 'string');
    assert.notEqual(fields.description, job.description);
    assert.equal(payload(fields.description), payload(job.description));
    assert.deepEqual(publicDescriptionFields({ ...job, ...fields }), {});
  });
}
