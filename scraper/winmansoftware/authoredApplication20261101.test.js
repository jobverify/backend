import assert from 'node:assert/strict'
import test from 'node:test'
import { APPLY_URL, CAREERS_URL, extractJobs, run } from './script.js'

// Synthetic copies of the existing legacy fixture shape; no native capture.
const legacyURL = 'https://winman.in/jobs/resumedetail.aspx'
const currentURL = 'https://winman.in/jobs/resume.aspx'
const anchor = (url, attrs = '', label = 'Apply now') => `<a ${attrs} href="${url}">${label}</a>`
const page = application => `<title>Careers for Experience Candidates - Winman Software</title>
<table id="experienced_table"><tr><th>Designation and Job Profile</th><th>Experience</th></tr>
<tr><td><h5>Senior Accountant</h5>Overseeing the finalisation of accounts.</td><td>CA Articleship completed</td></tr>
<tr><td><h5>Electrical Maintenance Supervisor</h5>Supervising maintenance of electrical systems.</td><td>2 years</td></tr></table>${application}`

for (const url of [legacyURL, currentURL]) test('Winman legacy binding preserves exact authored application ' + url, async () => {
  assert.equal(APPLY_URL, currentURL)
  const html = page(anchor(url)), parsed = extractJobs(html), calls = []
  const jobs = await run({ fetchText: async request => { calls.push(request); return html } })
  assert.deepEqual(calls, [CAREERS_URL])
  assert.deepEqual(jobs.map(job => job.title), ['Senior Accountant', 'Electrical Maintenance Supervisor'])
  for (const job of [...parsed, ...jobs]) { assert.equal(job.applyUrl, url); assert.equal(job.postingDate, null); assert.equal(job.closingDate, null) }
  for (const job of jobs) assert.equal(job.link, url)
})
test('Winman application selection changes no legacy role field beyond the authored applyUrl', () => {
  const current = extractJobs(page(anchor(currentURL)))
  const legacy = extractJobs(page(anchor(legacyURL)))
  assert.deepEqual(legacy, current.map(job => ({ ...job, applyUrl: legacyURL })))
})
test('Winman identical visible display controls corroborate one exact URL', () => {
  const jobs = extractJobs(page(anchor(legacyURL) + anchor(legacyURL)))
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].applyUrl, legacyURL)
})
test('Winman inert/raw/hidden conflicting controls cannot override a visible authored URL', () => {
  const raw = `<script>const inert = '<a href="${currentURL}" href="${legacyURL}">Apply now</a>';</script>`
    + `<template><a href="${currentURL}" href="${legacyURL}">Apply now</a></template>`
    + `<div hidden>${anchor('https://foreign.example/apply')}</div>`
    + `<style>.not-visible { display:none }</style>${anchor(currentURL, 'class="not-visible"')}`
  assert.equal(extractJobs(page(raw + anchor(legacyURL)))[0].applyUrl, legacyURL)
})
const unsupported = [
  ['missing', ''], ['href missing', '<a>Apply now</a>'], ['empty href', anchor('')],
  ['data-only button', `<button data-href="${legacyURL}">Apply now</button>`],
  ['unsupported label', anchor(legacyURL, '', 'Application information')],
  ['hidden', anchor(legacyURL, 'hidden')], ['hidden ancestor', `<div hidden>${anchor(legacyURL)}</div>`],
  ['inert', `<div inert>${anchor(legacyURL)}</div>`], ['ARIA hidden', anchor(legacyURL, 'aria-hidden="true"')],
  ['template', `<template>${anchor(legacyURL)}</template>`], ['comment', `<!--${anchor(legacyURL)}-->`],
  ['script string', `<script>const data = '${anchor(legacyURL)}';</script>`],
  ['non-JS script data', `<script type="application/ld+json">{"html":${JSON.stringify(anchor(legacyURL))}}</script>`],
  ['textarea', `<textarea>${anchor(legacyURL)}</textarea>`], ['object fallback', `<object>${anchor(legacyURL)}</object>`],
  ['inline display', anchor(legacyURL, 'style="display:none"')], ['inline opacity', anchor(legacyURL, 'style="opacity:0"')],
  ['inline visibility', anchor(legacyURL, 'style="visibility:hidden"')],
  ['stylesheet', `<style>.apply{display:none}</style>${anchor(legacyURL, 'class="apply"')}`],
  ['conditional hiding', `<style>@media print{.apply{display:none}}</style>${anchor(legacyURL, 'class="apply"')}`],
  ['escaped hiding selector', `<style>.apply\\:hidden{display:none}</style>${anchor(legacyURL, 'class="apply:hidden"')}`],
  ['foreign', anchor('https://foreign.example/apply')],
  ['foreign conflict', anchor(legacyURL) + anchor('https://foreign.example/apply')],
  ['two distinct native routes', anchor(legacyURL) + anchor(currentURL)],
  ['conflicting href attributes', `<a href="${legacyURL}" href="${currentURL}">Apply now</a>`],
  ['duplicated same href attribute', `<a href="${legacyURL}" HREF="${legacyURL}">Apply now</a>`],
  ['foreign credential authority', anchor('https://winman.in@foreign.example/jobs/resumedetail.aspx')],
  ['foreign suffix authority', anchor('https://winman.in.foreign.example/jobs/resumedetail.aspx')],
  ['HTTP variant', anchor('http://winman.in/jobs/resumedetail.aspx')], ['javascript', anchor('javascript:alert(1)')],
  ['query', anchor(legacyURL + '?role=123')], ['empty query', anchor(legacyURL + '?')],
  ['fragment', anchor(legacyURL + '#apply')], ['empty fragment', anchor(legacyURL + '#')],
  ['relative', anchor('/jobs/resumedetail.aspx')], ['protocol relative', anchor('//winman.in/jobs/resumedetail.aspx')],
  ['case normalized authority', anchor('https://WINMAN.IN/jobs/resumedetail.aspx')],
  ['dot segment normalized path', anchor('https://winman.in/jobs/../jobs/resumedetail.aspx')],
  ['encoded path', anchor('https://winman.in/jobs/resume%64etail.aspx')],
  ['entity normalized authority', anchor('https://winman&#46;in/jobs/resumedetail.aspx')],
  ['onclick override', anchor(legacyURL, 'onclick="return false"')], ['download', anchor(legacyURL, 'download')],
]
for (const [label, application] of unsupported) test('Winman rejects unqualified legacy application: ' + label, async () => {
  const html = page(application)
  assert.throws(() => extractJobs(html))
  await assert.rejects(run({ fetchText: async () => html }))
})
test('Winman current table/detail application behavior stays on its original exact route', async () => {
  const careers = `<title>Careers &#8211; Winman Software</title><table id="freshers"><a href="https://www.winmansoftware.com/more/careers/software-engineer">Software Engineer</a></table><table id="experienced"><tr><td><h4>Senior Accountant</h4><p>Oversee finalisation of accounts.</p></td><td>2 years</td></tr></table>${anchor(currentURL)}`
  const detail = `<h1 class="job-title">Software Engineer</h1><div>Winman Software India LLP</div><div>Mangalore</div><ul class="job-summary"><li>Build and test software.</li></ul><p class="qualification">B.E.</p>${anchor(currentURL)}`
  const jobs = await run({ fetchText: async url => url === CAREERS_URL ? careers : detail })
  assert.deepEqual(jobs.map(job => job.applyUrl), [currentURL, currentURL])
  await assert.rejects(run({ fetchText: async url => url === CAREERS_URL ? careers : detail.replace(currentURL, legacyURL) }), /current job detail changed/)
})
