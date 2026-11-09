import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { createTetraPakScraper, extractJobDetail, SEARCH_API_URL } from '../../scraper/tetrapak/script.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/tetraPakNonvacancy20261108.json', import.meta.url), 'utf8'))
const disclaimer = 'This is not an application for a specific position.'
const genericTitle = 'Tetra Pak - Expression of Interest'
const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

// All HTML in this file is explicitly reconstructed for testing, never a raw page capture.
const detailHtml = (title, description, before = '', after = '') => `<!doctype html><html><body>${before}<main class="jobDisplayShell" itemscope itemtype="http://schema.org/JobPosting"><h1><span itemprop="title">${escapeHtml(title)}</span></h1><span itemprop="description">${description}</span></main>${after}</body></html>`
const listing = (title = genericTitle, jobId = '100869') => ({
  title, jobId, requisitionId: jobId, location: 'Pune, India', city: 'Pune', state: null,
  sourceUrl: `https://jobs.tetrapak.com/job/test/${jobId}-en_GB/`,
  applyUrl: `https://jobs.tetrapak.com/job/test/${jobId}-en_GB/`,
  postingDate: '07/09/2026', closingDate: null,
})

test('full archived employer original and every native field remain intact in the fixture', () => {
  assert.equal(fixture.id, '6aecce5fa9fac1b7370fb34f')
  assert.equal(createHash('sha256').update(fixture.originalText).digest('hex'), 'e78c0c5b86aeb53a264cbce3a13e49607b035454658f79edac71a66bd4a38201')
  assert.deepEqual(fixture.sourceFields, {
    sourceExperienceRequired: null, sourceEmploymentType: null,
    minimumQualification: null, preferredQualification: null, requiredSkills: [],
  })
})

test('full-source reconstruction excludes the confirmed generic talent community', () => {
  const detail = extractJobDetail(detailHtml(fixture.title, escapeHtml(fixture.originalText)), listing(fixture.title))
  assert.equal(detail === null, true)
})

for (const title of ['Expression of Interest', 'Tetra Pak - Expression of Interest', 'Expression of Interest — Tetra Pak', '  TETRA PAK – Expression of Interest  ']) {
  test(`visible disclaimer excludes only the anchored generic title: ${title}`, () => {
    assert.equal(extractJobDetail(detailHtml(title, `<p>${disclaimer}</p>`), listing(title)) === null, true)
  })
}

test('visible formatting inside the own disclaimer remains a confirmed pool', () => {
  assert.equal(extractJobDetail(detailHtml(genericTitle, '<p>This is <strong>not</strong> an application for a specific position.</p>'), listing()) === null, true)
})

const retentionCases = [
  ['generic title alone', detailHtml(genericTitle, '<p>Join our talent community for future opportunities.</p>'), listing()],
  ['named real role', detailHtml('Project Engineer', `<p>${disclaimer}</p>`), listing('Project Engineer')],
  ['named EOI suffix', detailHtml('Expression of Interest - Automation Engineer', `<p>${disclaimer}</p>`), listing('Expression of Interest - Automation Engineer')],
  ['named EOI prefix', detailHtml('Process Engineer - Expression of Interest', `<p>${disclaimer}</p>`), listing('Process Engineer - Expression of Interest')],
  ['extra title scope', detailHtml('Tetra Pak - Expression of Interest - India', `<p>${disclaimer}</p>`), listing('Tetra Pak - Expression of Interest - India')],
  ['unexpanded EOI shorthand', detailHtml('EOI', `<p>${disclaimer}</p>`), listing('EOI')],
  ['named detail versus generic listing', detailHtml('Project Engineer', `<p>${disclaimer}</p>`), listing()],
  ['generic detail versus named listing', detailHtml(genericTitle, `<p>${disclaimer}</p>`), listing('Project Engineer')],
  ['missing description', `<h1><span itemprop="title">${genericTitle}</span></h1>`, listing()],
  ['missing detail title', `<span itemprop="description">${disclaimer}</span>`, listing()],
  ['truncated detail description', `<span itemprop="title">${genericTitle}</span><span itemprop="description">${disclaimer}`, listing()],
  ['truncated outer description', `<span itemprop="title">${genericTitle}</span><span itemprop="description"><span>${disclaimer}</span>`, listing()],
  ['first closing span precedes disclaimer', detailHtml(genericTitle, `<span>Welcome to our community.</span><p>${disclaimer}</p>`), listing()],
  ['comment-only disclaimer', detailHtml(genericTitle, `<p>Future opportunities.</p><!-- ${disclaimer} -->`), listing()],
  ['script-only disclaimer', detailHtml(genericTitle, `<p>Future opportunities.</p><script>${JSON.stringify(disclaimer)}</script>`), listing()],
  ['style-only disclaimer', detailHtml(genericTitle, `<p>Future opportunities.</p><style>.notice::after { content: "${disclaimer}"; }</style>`), listing()],
  ['template-only disclaimer', detailHtml(genericTitle, `<p>Future opportunities.</p><template><p>${disclaimer}</p></template>`), listing()],
  ['hidden disclaimer', detailHtml(genericTitle, `<p hidden>${disclaimer}</p>`), listing()],
  ['aria-hidden disclaimer', detailHtml(genericTitle, `<p aria-hidden="true">${disclaimer}</p>`), listing()],
  ['inline invisible disclaimer', detailHtml(genericTitle, `<p style="display: none">${disclaimer}</p>`), listing()],
  ['attribute-only disclaimer', detailHtml(genericTitle, `<p data-note="${disclaimer}">Future opportunities.</p>`), listing()],
  ['footer-only disclaimer', detailHtml(genericTitle, '<p>Future opportunities.</p>', '', `<footer>${disclaimer}</footer>`), listing()],
  ['footer inside description', detailHtml(genericTitle, `<p>Future opportunities.</p><footer>${disclaimer}</footer>`), listing()],
  ['related card inside description', detailHtml(genericTitle, `<div class="related-jobs"><p>${disclaimer}</p></div>`), listing()],
  ['related itemprop outside description', detailHtml(genericTitle, '<p>Future opportunities.</p>', '', `<aside class="related-jobs"><span itemprop="description">${disclaimer}</span></aside>`), listing()],
  ['commented itemprop before own description', detailHtml(genericTitle, '<p>Future opportunities.</p>', `<!-- <span itemprop="description">${disclaimer}</span> -->`), listing()],
  ['script itemprop before own description', detailHtml(genericTitle, '<p>Future opportunities.</p>', `<script>const card = '<span itemprop="description">${disclaimer}</span>';</script>`), listing()],
  ['template itemprop before own description', detailHtml(genericTitle, '<p>Future opportunities.</p>', `<template><span itemprop="description">${disclaimer}</span></template>`), listing()],
  ['footer itemprop before own description', detailHtml(genericTitle, '<p>Future opportunities.</p>', `<footer><span itemprop="description">${disclaimer}</span></footer>`), listing()],
  ['related itemprop before own description', detailHtml(genericTitle, '<p>Future opportunities.</p>', `<div class="relatedJobs"><span itemprop="description">${disclaimer}</span></div>`), listing()],
  ['itemprop-looking attribute markup', detailHtml(genericTitle, '<p>Future opportunities.</p>', `<div data-template='<span itemprop="description">${disclaimer}</span>'></div>`), listing()],
  ['ambiguous second visible description', detailHtml(genericTitle, '<p>Future opportunities.</p>', '', `<span itemprop="description">${disclaimer}</span>`), listing()],
  ['whole-page disclaimer outside itemprop', detailHtml(genericTitle, '<p>Future opportunities.</p>', '', `<p>${disclaimer}</p>`), listing()],
  ['commented generic title before named detail', detailHtml('Project Engineer', `<p>${disclaimer}</p>`, `<!-- <span itemprop="title">${genericTitle}</span> -->`), listing()],
]
for (const [name, html, summary] of retentionCases) {
  test(`retains ${name}`, () => assert.equal(extractJobDetail(html, summary) !== null, true))
}

test('retained real vacancy preserves every existing detail field', () => {
  const summary = { ...listing('Contract Project Engineer', '96289'), state: 'Maharashtra', experienceRequired: '3 years', closingDate: '08/01/2026' }
  assert.deepEqual(extractJobDetail(detailHtml(summary.title, '<p>Build packaging systems.</p><ul><li>Deliver projects.</li></ul>'), summary), {
    title: 'Contract Project Engineer', location: 'Pune, India', city: 'Pune', state: 'Maharashtra',
    jobId: '96289', requisitionId: '96289', employmentType: 'Contract', experienceRequired: '3 years',
    jobDescription: 'Build packaging systems. - Deliver projects.', minimumQualification: null,
    preferredQualification: null, requiredSkills: ['Deliver projects.'], postingDate: '07/09/2026',
    closingDate: '08/01/2026', applyUrl: 'https://jobs.tetrapak.com/job/test/96289-en_GB/',
    sourceUrl: 'https://jobs.tetrapak.com/job/test/96289-en_GB/',
  })
})

const apiRow = (title, id) => ({ response: {
  id, unifiedStandardTitle: title, unifiedUrlTitle: title.replaceAll(' ', '-'),
  sfstd_jobLocation_obj: ['Pune'], jobLocationShort: ['Pune, IND'],
  unifiedStandardStart: '07/09/2026', unifiedStandardEnd: null,
} })
const runPages = async (pages, maxJobs) => {
  const requestedPages = []
  const jobs = await createTetraPakScraper().run({
    maxPages: pages.length + 1, maxJobs, now: () => '2026-11-08T00:00:00.000Z',
    fetchJson: async (url, options) => {
      assert.equal(url, SEARCH_API_URL)
      const page = JSON.parse(options.body).pageNumber
      requestedPages.push(page)
      assert.ok(pages[page], 'Pagination must stop at the advertised raw listing total')
      return { totalJobs: pages.flat().length, jobSearchResult: pages[page] }
    },
    fetchText: async (url) => {
      if (url.includes('/100869-') || url.includes('/100870-')) return detailHtml(genericTitle, escapeHtml(fixture.originalText))
      assert.equal(url, 'https://jobs.tetrapak.com/job/Project-Engineer/96289-en_GB/')
      return detailHtml('Project Engineer', '<p>Deliver packaging projects.</p>')
    },
  })
  return { jobs, requestedPages }
}

test('pool before real vacancy does not consume maxJobs=1 on one page', async () => {
  const { jobs } = await runPages([[apiRow(genericTitle, '100869'), apiRow('Project Engineer', '96289')]], 1)
  assert.deepEqual(jobs.map(({ title, jobId }) => ({ title, jobId })), [{ title: 'Project Engineer', jobId: '96289' }])
})

test('all-pool first page continues to a real next-page vacancy with maxJobs=1', async () => {
  const { jobs, requestedPages } = await runPages([[apiRow(genericTitle, '100869'), apiRow(genericTitle, '100870')], [apiRow('Project Engineer', '96289')]], 1)
  assert.deepEqual(jobs.map(({ title, jobId }) => ({ title, jobId })), [{ title: 'Project Engineer', jobId: '96289' }])
  assert.deepEqual(requestedPages, [0, 1])
  assert.equal(jobs[0].company, 'Tetra Pak')
  assert.equal(jobs[0].scrapedAt, '2026-11-08T00:00:00.000Z')
})

test('all-pool final page still terminates using raw listing counts', async () => {
  const { jobs, requestedPages } = await runPages([[apiRow(genericTitle, '100869'), apiRow(genericTitle, '100870')]], null)
  assert.equal(jobs.length, 0)
  assert.deepEqual(requestedPages, [0])
})
