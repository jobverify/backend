import assert from 'node:assert/strict';
import test from 'node:test';
import { publicPostingDescription } from '../rewriting/publicPostingDescription.js';
import { inferExperienceFromPublicPageHtml } from '../scraper-support/utils/publicExperienceEnrichment.js';
import { createEngineersIndiaLimitedScraper } from '../scraper/engineersindialimited/script.js';
import { createPlanetSparkScraper } from '../scraper/planetspark/script.js';
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js';

const now = new Date('2026-11-03T08:00:00Z');
const prediction = { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 1,
  scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 } };
const classify = job => resolvePostScrapeClassification(job, prediction, { now, mode: 'policy' });
const flexsin = { title: 'Fresher - BD & Sales', source: 'flexsintechnologies', company: 'Flexsin Technologies',
  sourceUrl: 'https://www.flexsin.com/careers/fresher-bd-sales/', jobId: 'fresher-bd-sales', sourceDescription: null };
const tudip = { title: 'Graduate Engineering Trainee (Fresher)', source: 'tudiptechnologies', company: 'Tudip Technologies',
  sourceUrl: 'https://tudip.com/jobs/india/graduate-engineering-trainee-fresher/', jobId: 'graduate-engineering-trainee-fresher' };
const roleHtml = (job, { duplicateTitle = false, body = '' } = {}) => `<!doctype html><html><head>
  <link rel="canonical" href="${job.sourceUrl}"><meta name="description" content="Experienced professionals with 8 years of experience.">
  </head><body><nav>Experience: 12 years</nav><h1>${job.title}</h1>${duplicateTitle ? `<h1>${job.title}</h1>` : ''}
  <section><h3>About Company</h3><p>We have 20 years of industry experience.</p>
  <h3>${job.source === 'tudiptechnologies' ? 'Position Summary' : 'Job Description:'}</h3>
  <p>Join our team to support customer projects, learn our tools, and help deliver useful services.</p>
  <h4>Responsibilities:</h4><ul><li>Prepare project reports and collaborate with the team.</li></ul>
  <h4>Requirements:</h4><p>${body || 'Basic technical knowledge and willingness to learn.'}</p></section>
  <form><label>Required experience: 10 years</label><input name="experience"></form>
  <h2>Join our talent community</h2><p>We are seeking experienced professionals.</p>
  <footer>Minimum 15 years of work experience required.</footer></body></html>`;
const receipt = (job, html) => ({ status: 200, url: job.sourceUrl, html });

test('known role pages recover their own description without navigation, company history or forms', () => {
  for (const job of [flexsin, tudip]) {
    const result = publicPostingDescription(job, roleHtml(job), job.sourceUrl);
    assert.equal(result?.evidence.method, 'exact_role_visible_sections');
    assert.match(result.description, /Prepare project reports/);
    assert.doesNotMatch(result.description, /20 years|12 years|10 years|15 years|8 years|experienced professionals/);
  }
});

test('Flexsin enrichment and classification do not inherit experienced recruiting boilerplate', () => {
  const enriched = inferExperienceFromPublicPageHtml(flexsin, receipt(flexsin, roleHtml(flexsin)));
  assert.match(enriched.sourceDescription, /Basic technical knowledge/);
  const result = classify(enriched);
  assert.equal(result.resolved.jobType, 'Full-time Fresher');
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, null);
  assert.deepEqual(result.reviewReasons, []);
});

test('Tudip title captions recover full source descriptions while real employer text stays immutable', () => {
  const job = { ...tudip, sourceDescription: tudip.title, jobDescription: tudip.title };
  const enriched = inferExperienceFromPublicPageHtml(job, receipt(job, roleHtml(job, { duplicateTitle: true })));
  assert.match(enriched.sourceDescription, /Responsibilities:/);
  assert.doesNotMatch(enriched.sourceDescription, /20 years|15 years/);
  assert.equal(classify(enriched).resolved.jobType, 'Full-time Fresher');
  const original = 'Employer source: candidates must have 3 years of professional experience.';
  const preserved = inferExperienceFromPublicPageHtml({ ...job, sourceDescription: original }, receipt(job, roleHtml(job)));
  assert.equal(preserved.sourceDescription, original);
});

test('source recovery rejects title, employer, redirect and canonical mismatches', () => {
  for (const [job, html, url] of [
    [{ ...flexsin, company: 'Another employer' }, roleHtml(flexsin), flexsin.sourceUrl],
    [{ ...flexsin, title: 'Another role' }, roleHtml(flexsin), flexsin.sourceUrl],
    [flexsin, roleHtml(flexsin), 'https://www.flexsin.com/careers/'],
    [flexsin, roleHtml(flexsin).replace(`href="${flexsin.sourceUrl}"`, 'href="https://www.flexsin.com/careers/another-role/"'), flexsin.sourceUrl],
    [flexsin, roleHtml(flexsin).replace('<h1>', '<h1 hidden>'), flexsin.sourceUrl],
    [flexsin, `<template>${roleHtml(flexsin)}</template>`, flexsin.sourceUrl],
  ]) assert.equal(publicPostingDescription(job, html, url), null);
});

test('known source pages fail closed instead of inferring from unrelated whole-page text', () => {
  const drift = `<h1>${flexsin.title}</h1><p>Minimum 9 years of professional experience required.</p>`;
  for (const response of [receipt(flexsin, drift), roleHtml(flexsin),
    { ...receipt(flexsin, roleHtml(flexsin)), url: 'https://www.flexsin.com/careers/' }]) {
    const result = inferExperienceFromPublicPageHtml(flexsin, response);
    assert.deepEqual(result, flexsin);
  }
});

test('mandatory experience inside the actual fresher role still produces a conflict', () => {
  const enriched = inferExperienceFromPublicPageHtml(flexsin, receipt(flexsin,
    roleHtml(flexsin, { body: 'Minimum 3 years of professional experience required.' })));
  const result = classify(enriched);
  assert.equal(result.resolved.jobType, 'Unspecified');
  assert.ok(result.reviewReasons.includes('conflicting_role_eligibility'));
});

test('role-specific experience metadata above the description remains an employer requirement', () => {
  const html = roleHtml(flexsin).replace(`<h1>${flexsin.title}</h1>`, `<h1>${flexsin.title}</h1><p>Experience: 3 years</p>`);
  const enriched = inferExperienceFromPublicPageHtml(flexsin, receipt(flexsin, html));
  assert.match(enriched.sourceDescription, /Experience: 3 years/);
  const result = classify(enriched);
  assert.equal(result.resolved.jobType, 'Unspecified');
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 3);
});

const eilUrl = 'https://recruitment.eil.co.in/';
const eilHtml = `<html><body><h1>EIL Recruitment Portal</h1><h2>Current Openings</h2>
  <p>Recruitment of Experienced Candidates</p>
  1. SRD FOR SC, ST &amp; OBCs (Adv No:HRD/RECTT./ADVT./2026-27/04)<a>Print Application</a>
  2. FIXED TERM HIRING (Adv No:HRD/RECTT./ADVT./2026-27/02)<a>Print Application</a>
  3. RECRUITMENT FOR EXPERIENCED PERSONNEL (Adv No:HRD/RECTT./ADVT./2026-27/03)<a>Print Application</a>
  <p>Recruitment of Fresher Candidates:</p>
  1. Management Trainee (Adv No:HRD/RECTT./ADVT./2025-26/18)<a>Advertisement Details</a>
  </body></html>`;
const eilJob = { title: 'FIXED TERM HIRING', source: 'engineersindialimited', company: 'Engineers India Limited',
  sourceUrl: eilUrl, requisitionId: 'eil-hrd-rectt-advt-2026-27-02',
  applyUrl: 'https://recruitment.eil.co.in/applicnExpRecruitment/Printout_regno.aspx?adv=HRD%2FRECTT.%2FADVT.%2F2026-27%2F02' };

test('Engineers India descriptions are bound to the advertisement identity and recruitment section', () => {
  const posting = publicPostingDescription(eilJob, eilHtml, eilUrl);
  assert.equal(posting?.evidence.method, 'exact_recruitment_notice');
  assert.match(posting.description, /Recruitment of Experienced Candidates/);
  assert.match(posting.description, /ADVT\.\/2026-27\/02/);
  assert.doesNotMatch(posting.description, /SRD|PERSONNEL|Management Trainee|Print Application|2026-27\/04/);
  assert.equal(classify({ ...eilJob, sourceDescription: posting.description }).resolved.jobType, 'Contract');
  assert.equal(classify({ ...eilJob, sourceDescription: posting.description }).resolved.employerExperienceProfile.minimumYears, null);
});

test('Engineers India scraper saves each individual notice rather than a shared listing description', async () => {
  const jobs = await createEngineersIndiaLimitedScraper().run({ fetchPage: async url => ({ status: 200, url, html: eilHtml }) });
  assert.equal(jobs.length, 4);
  const expected = ['Full-time Experienced', 'Contract', 'Full-time Experienced', 'Full-time Fresher'];
  for (const [index, job] of jobs.entries()) {
    assert.equal((job.sourceDescription.match(/ADVT\.\//g) || []).length, 1);
    const result = classify(job);
    assert.equal(result.resolved.jobType, expected[index]);
    assert.deepEqual(result.sourceQualityIssues, []);
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, null);
  }
});

test('Engineers India refuses conflicting IDs, duplicate notices and unrelated titles', () => {
  for (const job of [{ ...eilJob, title: 'Another role' }, { ...eilJob, requisitionId: 'eil-hrd-rectt-advt-2026-27-09' },
    { ...eilJob, applyUrl: `${eilJob.applyUrl}&adv=HRD%2FRECTT.%2FADVT.%2F2026-27%2F09` },
    { ...eilJob, requisitionId: null, applyUrl: 'https://recruitment.eil.co.in/' }]) {
    assert.equal(publicPostingDescription(job, eilHtml, eilUrl), null);
  }
  const duplicate = eilHtml.replace('</body>', '4. FIXED TERM HIRING (Adv No:HRD/RECTT./ADVT./2026-27/02)</body>');
  assert.equal(publicPostingDescription(eilJob, duplicate, eilUrl), null);
});

const planetTitle = 'Inside Sales Associate || Fresher Hiring ||';
const planetHtml = `<html><body><h2>Explore a career @ PlanetSpark</h2><h3>Live online classes</h3>
  <h1>We're hiring for these roles</h1>
  <div class="card"><h4>Senior Engineer</h4><p>location_on Work From Home</p><p>calendar_today 3 to 5 Years</p><a>View &amp; Apply</a></div>
  <div class="card"><h4>${planetTitle}</h4><p>access_time Full time</p><p>location_on Gurgaon, Haryana</p><p>calendar_today 0 to 3 yrs</p><a>View &amp; Apply</a></div>
  <p>For job application related queries, kindly reach out to teach@planetspark.in</p></body></html>`;
const planetJob = { title: planetTitle, source: 'planetspark', company: 'PlanetSpark', sourceUrl: 'https://www.planetspark.in/careers',
  requisitionId: 'planetspark-inside-sales-associate-fresher-hiring-gurgaon-haryana-india' };

test('PlanetSpark binds requirements to the matching role and location instead of the whole careers page', async () => {
  const posting = publicPostingDescription(planetJob, planetHtml, planetJob.sourceUrl);
  assert.equal(posting?.evidence.method, 'exact_role_card');
  assert.match(posting.description, /Experience: 0 to 3 yrs/);
  assert.doesNotMatch(posting.description, /Senior Engineer|3 to 5 Years|Work From Home/);
  const jobs = await createPlanetSparkScraper().run({ fetchText: async () => planetHtml });
  const fresher = jobs.find(job => job.title === planetTitle);
  const result = classify(fresher);
  assert.equal(result.resolved.jobType, 'Full-time Fresher');
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 0);
  assert.equal(result.resolved.employerExperienceProfile.maximumYears, 3);
  assert.deepEqual(result.reviewReasons, []);
});

test('PlanetSpark refuses ambiguous cards and preserves real requirements that exclude freshers', () => {
  const duplicate = planetHtml.replace('</body>', `<div><h4>${planetTitle}</h4><p>location_on Gurgaon, Haryana</p><p>calendar_today 1 to 5 Years</p><a>View &amp; Apply</a></div></body>`);
  assert.equal(publicPostingDescription(planetJob, duplicate, planetJob.sourceUrl), null);
  const experienced = planetHtml.replace('0 to 3 yrs', '1 to 5 Years');
  const posting = publicPostingDescription(planetJob, experienced, planetJob.sourceUrl);
  const result = classify({ ...planetJob, sourceDescription: posting.description });
  assert.equal(result.resolved.jobType, 'Unspecified');
  assert.ok(result.reviewReasons.includes('conflicting_role_eligibility'));
});
