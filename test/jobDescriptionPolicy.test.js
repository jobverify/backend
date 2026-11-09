import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDescriptionSourceUpdate, buildRewriteInput, validateRewrite } from '../src/services/jobDescriptionPolicy.js';

const job = { title: 'Software Engineer', company: 'Example', sourceDescription: 'Role overview: Build Python services for customer applications. Responsibilities: Design reliable APIs and maintain Python services. Required qualifications: At least 2 years of software development experience is required. Preferred qualifications: AWS experience is nice to have.' };

test('empty markup from newly eligible jobs cannot replace existing employer content', () => {
  for (const sourceDescription of ['<p>&nbsp;<br></p>', '&#160;&#xA0;', '<!-- no details --><script>ignored()</script>']) {
    assert.deepEqual(buildDescriptionSourceUpdate({ ...job, sourceDescription }, job), {});
  }
});
const paragraph = (text, evidence) => ({ text, evidence, style: 'paragraph' });
const output = () => ({ sections: [
  { key: 'overview', items: [paragraph('Build Python services for customer applications.', 'Build Python services for customer applications.')] },
  { key: 'responsibilities', items: [paragraph('Design reliable APIs and maintain Python services.', 'Design reliable APIs and maintain Python services.')] },
  { key: 'required_qualifications', items: [paragraph('At least 2 years of software development experience is required.', 'At least 2 years of software development experience is required.')] },
  { key: 'preferred', items: [paragraph('AWS experience is nice to have.', 'AWS experience is nice to have.')] },
] });

test('rewrite input hash ignores scraping time and display text, but changes with source facts', () => {
  const first = buildRewriteInput(job);
  assert.equal(buildRewriteInput({ ...job, description: 'Generated text', scrapedAt: new Date() }).inputHash, first.inputHash);
  assert.notEqual(buildRewriteInput({ ...job, sourceDescription: job.sourceDescription.replace('2 years', '3 years') }).inputHash, first.inputHash);
});

test('validated sections become a readable Markdown description', () => {
  const result = validateRewrite(output(), buildRewriteInput(job), 'stop');
  assert.equal(result.ok, true);
  assert.match(result.description, /## Responsibilities\n\nDesign reliable APIs/);
  assert.match(result.description, /## Preferred qualifications and skills/);
});

test('numeric fabrication is rejected even when evidence exists', () => {
  const result = output(); result.sections[2].items[0].text = 'At least 10 years of software development experience is required.';
  assert.equal(validateRewrite(result, buildRewriteInput(job), 'stop').reason, 'unsupported_number');
});

test('preferred experience cannot be promoted to a mandatory requirement', () => {
  const result = output(); result.sections[3].key = 'required_skills';
  assert.equal(validateRewrite(result, buildRewriteInput(job), 'stop').reason, 'preferred_promoted');
});

test('new benefits and unsupported claims are rejected', () => {
  const result = output(); result.sections[0].items[0].text += ' Enjoy guaranteed promotions and free medical insurance.';
  assert.equal(validateRewrite(result, buildRewriteInput(job), 'stop').reason, 'unsupported_claim');
});

test('evidence must occur in the employer source', () => {
  const result = output(); result.sections[0].items[0].evidence = 'This role offers remote work and guaranteed promotions.';
  assert.equal(validateRewrite(result, buildRewriteInput(job), 'stop').reason, 'invalid_evidence');
});

test('repeated paragraphs, malformed shapes and truncated completions never publish', () => {
  const result = output(); result.sections[1].items.push(result.sections[1].items[0]);
  assert.equal(validateRewrite(result, buildRewriteInput(job), 'stop').reason, 'repetition');
  assert.equal(validateRewrite({ sections: [] }, buildRewriteInput(job), 'stop').ok, false);
  assert.equal(validateRewrite(output(), buildRewriteInput(job), 'length').reason, 'truncated');
});

test('missing source descriptions cannot be regenerated from a title alone', () => {
  assert.equal(buildRewriteInput({ title: 'Engineer', sourceDescription: null, description: 'A generated role overview.' }).eligible, false);
});


test('preferred headings and wording preserve the optional nature of evidence', () => {
  const sourceJob = { ...job, sourceDescription: job.sourceDescription.replace('AWS experience is nice to have.', 'Cloud expertise with AWS.') };
  const result = output();
  result.sections[3] = { key: 'required_skills', items: [paragraph('Cloud expertise with AWS is mandatory.', 'Cloud expertise with AWS.')] };
  assert.equal(validateRewrite(result, buildRewriteInput(sourceJob), 'stop').ok, false);
  const optional = output(); optional.sections[3].items[0].text = 'AWS experience is mandatory.';
  assert.equal(validateRewrite(optional, buildRewriteInput(job), 'stop').ok, false);
});

test('a rewrite must retain supplied requirements instead of publishing an overview alone', () => {
  const result = output(); result.sections = result.sections.slice(0, 1);
  assert.equal(validateRewrite(result, buildRewriteInput(job), 'stop').reason, 'missing_requirements');
});

test('sensitive numeric and negated statements cannot change relationships', () => {
  const sourceJob = { ...job, sourceDescription: job.sourceDescription + ' Applicants must have 2 years in Python and 5 years in Java. No experience with AWS is required.' };
  const swapped = output(); swapped.sections[2].items = [paragraph('Applicants must have 5 years in Python and 2 years in Java.', 'Applicants must have 2 years in Python and 5 years in Java.')];
  assert.equal(validateRewrite(swapped, buildRewriteInput(sourceJob), 'stop').ok, false);
});


test('numeric relationships cannot swap technologies with the same numeric sequence', () => {
  const original = 'Applicants must have 2 years of Python experience and 5 years of Java experience.';
  const sourceJob = { ...job, sourceDescription: job.sourceDescription.replace('At least 2 years of software development experience is required.', original) };
  const result = output(); result.sections[2].items = [paragraph('Applicants must have 2 years of Java experience and 5 years of Python experience.', original)];
  assert.equal(validateRewrite(result, buildRewriteInput(sourceJob), 'stop').ok, false);
});

test('individual mandatory statements cannot disappear while their section remains', () => {
  const sourceJob = { ...job, sourceDescription: job.sourceDescription + ' A university degree in computer science is mandatory.' };
  assert.equal(validateRewrite(output(), buildRewriteInput(sourceJob), 'stop').reason, 'missing_requirements');
});

test('standalone plain and HTML preferred headings cannot promote their bullets', () => {
  for (const heading of ['Preferred qualifications\n', '<h3>Preferred qualifications</h3>']) {
    const sourceJob = { ...job, sourceDescription: job.sourceDescription.replace('Preferred qualifications: AWS experience is nice to have.', heading + 'Cloud experience with AWS.\nTerraform experience is nice to have.') };
    const result = output();
    result.sections.push({ key: 'required_skills', items: [paragraph('Cloud experience with AWS.', 'Cloud experience with AWS.')] });
    result.sections[3].items = [paragraph('Terraform experience is nice to have.', 'Terraform experience is nice to have.')];
    assert.equal(validateRewrite(result, buildRewriteInput(sourceJob), 'stop').reason, 'preferred_promoted');
  }
});

test('a single fabricated technology cannot use paraphrase tolerance', () => {
  for (const technology of ['Rust', 'Go', 'R', 'C#']) {
    const result = output(); result.sections[0].items[0].text = 'Build Python and ' + technology + ' services for customer applications.';
    assert.equal(validateRewrite(result, buildRewriteInput(job), 'stop').reason, 'unsupported_claim');
  }
});


test('unchanged legacy provenance initializes a baseline without historical backfill', () => {
  const legacy = { ...job, description: job.sourceDescription, employmentType: 'Full-time', experienceRequired: 'At least 2 years of experience' };
  delete legacy.sourceDescription;
  const incoming = { ...job, sourceEmploymentType: 'Full-time', sourceExperienceRequired: legacy.experienceRequired };
  const update = buildDescriptionSourceUpdate(incoming, legacy, { mode: 'publish' });
  assert.equal(update.descriptionRewrite.status, 'baseline');
  assert.equal(update.sourceContentHash, buildRewriteInput(incoming).inputHash);
  const changed = buildDescriptionSourceUpdate({ ...incoming, sourceExperienceRequired: 'At least 3 years of experience' }, legacy, { mode: 'publish' });
  assert.equal(changed.descriptionRewrite.status, 'pending');
});

test('source hashes preserve line boundaries used to interpret required and preferred facts',()=>{
 const a=buildRewriteInput({title:'Engineer',sourceDescription:'Build reliable software for customer services.\nRequirements:\nA Computer Science degree is required.\nPreferred Experience:\nAWS cloud development experience.'});
 const b=buildRewriteInput({title:'Engineer',sourceDescription:'Build reliable software for customer services. Requirements: A Computer Science degree is required. Preferred Experience: AWS cloud development experience.'});
 assert.notEqual(a.inputHash,b.inputHash);
});
test('hash-format migration does not backfill an unchanged preserved employer source',()=>{
 const job={title:'Engineer',company:'Example',description:'Responsibilities: Build reliable Python applications for customer services. Requirements: A Computer Science degree and software development experience are required for this role.'};
 const existing={...job,sourceDescription:job.description,description:'Published display wording',sourceContentHash:'old-normalized-source-hash',descriptionRewrite:{status:'published',inputHash:'old-normalized-source-hash',attempts:1}};
 const update=buildDescriptionSourceUpdate(job,existing,{mode:'publish'});assert.equal(update.description,undefined);assert.equal(update.descriptionRewrite,undefined);assert.equal(update['descriptionRewrite.inputHash'],update.sourceContentHash);assert.equal(update.sourceContentHashVersion,2);
});
