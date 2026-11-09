import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import test, { before, after } from 'node:test'
import { inferExperienceFromPublicPageHtml, enrichJobWithPublicExperience } from '../utils/publicExperienceEnrichment.js'

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/taroPumpsDetailScope20261108.json', import.meta.url), 'utf8'))
const compact = value => String(value ?? '').replace(/\s+/g, ' ').trim()
let networkAttempts = 0
let originalFetch
before(() => {
  originalFetch = globalThis.fetch
  globalThis.fetch = async () => { networkAttempts++; throw new Error('External network forbidden in Taro detail tests') }
})
after(() => {
  globalThis.fetch = originalFetch
  assert.equal(networkAttempts, 0)
})
const call = (html, override = {}, responseOverride = {}) => {
  const job = { ...fixture.inputJob, ...override }
  const before = structuredClone(job)
  const out = inferExperienceFromPublicPageHtml(job, { status: 200, url: job.sourceUrl, html, ...responseOverride })
  assert.deepEqual(job, before, 'source input must remain unchanged')
  return out
}
const own = (out, expectedText = fixture.ownRoleText, experience = null) => {
  assert.equal(compact(out.sourceDescription), compact(expectedText), 'preserve the complete own role, excluding hiring biographies')
  assert.equal(compact(out.jobDescription), compact(expectedText))
  assert.equal(out.experienceRequired ?? null, experience)
  assert.equal(out.sourceExperienceRequired ?? null, experience)
  assert.equal(out.publicExperienceChecked, true)
  assert.doesNotMatch(out.sourceDescription, /Renukadevi|14\+ years|Post recruitment|More Information About the Hiring Team/)
}
const rejected = out => {
  assert.equal(out.sourceDescription ?? null, null)
  assert.equal(out.jobDescription ?? null, null)
  assert.equal(out.experienceRequired ?? null, null)
  assert.equal(out.sourceExperienceRequired ?? null, null)
  assert.equal(out.publicExperienceChecked ?? false, false)
}
const edit = (html, from, to) => {
  assert(html.includes(from), 'controlled reconstruction edit must match')
  const result = html.replace(from, to)
  assert.notEqual(result, html)
  return result
}

test('fixture retains the complete archived original and every native source field, with no raw HTML claim', () => {
  const row = fixture.sourceRecord
  assert.equal(row.id, '6aecce25a9fac1b7370fb1bc')
  assert.equal(row.originalText.length, 6538)
  assert.equal(crypto.createHash('sha256').update(row.originalText, 'utf8').digest('hex'), 'c2e9d9f362917826a3b08ceda76c6aa3f6bca65e6ddcaeab3b191eff93c2ebfb')
  assert.deepEqual(row.sourceFields, {
    sourceExperienceRequired: '1+ years', sourceEmploymentType: null,
    minimumQualification: null, preferredQualification: null, requiredSkills: [],
  })
  assert.equal(fixture.rawArchivedHtmlAvailable, false)
  assert.equal(fixture.reconstructedHtml, true)
  assert.equal(fixture.investigationControls.length, 12)
  assert.equal(fixture.ownRoleText.length, 1801)
})

test('exact Taro role recovers its complete own body and excludes all four recruiter biographies', () => {
  own(call(fixture.fullPageHtml))
})

test('own-role-only bounded main retains unquantified motor-design experience without inventing years', () => {
  own(call(fixture.ownOnlyPageHtml))
})

test('own required three-to-five years survive lower hiring-team years', () => {
  own(call(fixture.numericPageHtml), fixture.numericOwnRoleText, '3-5 years')
})

test('native applicant years remain distinct from the unquantified own body', () => {
  own(call(fixture.fullPageHtml, { experienceRequired: '2-4 years', sourceExperienceRequired: '2-4 years' }), fixture.ownRoleText, '2-4 years')
})

const negativeControls = [
  ['bio-only page', () => [fixture.bioOnlyPageHtml]],
  ['flat text without structural own-role boundaries', () => [fixture.flatPageHtml]],
  ['mismatching visible title', () => [edit(fixture.fullPageHtml, '<h1>Assistant Engineer - Design (Electrical)</h1>', '<h1>Unrelated Sales Manager</h1>')]],
  ['duplicate visible role titles', () => [edit(fixture.fullPageHtml, '<body>', '<body><h1>Assistant Engineer - Design (Electrical)</h1>')]],
  ['mismatching response URL', () => [fixture.fullPageHtml, {}, { url: 'https://www.texmo.com/career-details?id=999999&title=Other' }]],
  ['unsuccessful response', () => [fixture.fullPageHtml, {}, { status: 503 }]],
  ['missing query ID', () => {
    const url = new URL(fixture.inputJob.sourceUrl); url.searchParams.delete('id')
    return [fixture.fullPageHtml, { sourceUrl: url.href, applyUrl: url.href }]
  }],
  ['duplicate query IDs', () => {
    const url = new URL(fixture.inputJob.sourceUrl); url.searchParams.append('id', '541133')
    return [fixture.fullPageHtml, { sourceUrl: url.href, applyUrl: url.href }]
  }],
  ['missing job and requisition IDs', () => [fixture.fullPageHtml, { jobId: null, requisitionId: null }]],
  ['mismatching job ID', () => [fixture.fullPageHtml, { jobId: '999999' }]],
  ['mismatching requisition ID', () => [fixture.fullPageHtml, { requisitionId: '999999' }]],
  ['mismatching query title', () => {
    const url = new URL(fixture.inputJob.sourceUrl); url.searchParams.set('title', 'Sales Manager')
    return [fixture.fullPageHtml, { sourceUrl: url.href, applyUrl: url.href }]
  }],
  ['duplicate query titles', () => {
    const url = new URL(fixture.inputJob.sourceUrl); url.searchParams.append('title', fixture.inputJob.title)
    return [fixture.fullPageHtml, { sourceUrl: url.href, applyUrl: url.href }]
  }],
  ['wrong source host', () => {
    const url = new URL(fixture.inputJob.sourceUrl); url.hostname = 'careers.unrelated.example'
    return [fixture.fullPageHtml, { sourceUrl: url.href, applyUrl: url.href }]
  }],
  ['wrong employer metadata', () => [fixture.fullPageHtml, { company: 'Unrelated Employer' }]],
  ['conflicting canonical URL', () => [edit(fixture.fullPageHtml, '<head>', '<head><link rel="canonical" href="https://www.texmo.com/career-details?id=999999">')]],
  ['duplicate own Job Description sections', () => [edit(fixture.fullPageHtml, '<main>', '<main><h2>Job Description</h2><p>Other role.</p>')]],
  ['duplicate hiring-team boundaries', () => [edit(fixture.fullPageHtml, '</body>', '<h2>More Information About the Hiring Team</h2></body>')]],
  ['inline hiring-team label without a structural boundary', () => [
    edit(fixture.fullPageHtml, '<h2>More Information About the Hiring Team</h2>', '<p>More Information About the Hiring Team</p>'),
  ]],
  ['hiring team appears before own description', () => [edit(fixture.fullPageHtml, '<main>', '<h2>More Information About the Hiring Team</h2><main>').replace('<section><h2>More Information About the Hiring Team</h2>', '<section>')]],
  ['hidden own title', () => [edit(fixture.fullPageHtml, '<h1>', '<h1 hidden>')]],
  ['hidden Job Description heading', () => [edit(fixture.fullPageHtml, '<h2>Job Description</h2>', '<h2 hidden>Job Description</h2>')]],
]
for (const [name, build] of negativeControls) {
  test('Taro detail rejects ' + name + ' without whole-page experience fallback', () => {
    rejected(call(...build()))
  })
}

test('unverified plain-string responses cannot promote Taro numeric or canonical evidence', () => {
  const job = structuredClone(fixture.inputJob)
  rejected(inferExperienceFromPublicPageHtml(job, fixture.fullPageHtml))
  assert.deepEqual(job, fixture.inputJob)
})

for (const [name, opaque] of [
  ['comment', '<!-- <h1>Other</h1><h2>Job Description</h2><p>1+ years of recruitment.</p> -->'],
  ['script', '<script>const fake = "<h1>Other</h1><h2>Job Description</h2><p>1+ years of recruitment.</p>";</script>'],
  ['style', '<style>.fake:after { content: "<h1>Other</h1><h2>Job Description</h2><p>1+ years of recruitment.</p>"; }</style>'],
  ['hidden subtree', '<div hidden><h1>Other</h1><h2>Job Description</h2><p>1+ years of recruitment.</p></div>'],
  ['inert template', '<template><h1>Other</h1><h2>Job Description</h2><p>1+ years of recruitment.</p></template>'],
]) {
  test('Taro own-role extraction ignores fake identities and years in ' + name, () => {
    own(call(edit(fixture.fullPageHtml, '<main>', opaque + '<main>')))
  })
}

test('quoted greater-than attributes cannot enter the selected own role', () => {
  own(call(edit(fixture.fullPageHtml, '<div>', '<div title="comparison x > y">')))
})

test('one consistent requisition ID is sufficient when job ID is absent', () => {
  own(call(fixture.fullPageHtml, { jobId: null }))
})

const splitSections = () => {
  const at = fixture.ownRoleText.indexOf(' Requirements ')
  assert(at > 0)
  const first = fixture.ownRoleText.slice(0, at).replace(/^Job Description\s*/, '')
  const last = fixture.ownRoleText.slice(at).trim()
  const start = fixture.fullPageHtml.indexOf('<main>')
  const end = fixture.fullPageHtml.indexOf('</main>') + '</main>'.length
  return fixture.fullPageHtml.slice(0, start)
    + '<main><div><h2>Job Description</h2><p>' + first + '</p></div><div><p>' + last + '</p></div></main>'
    + fixture.fullPageHtml.slice(end)
}

test('split section wrappers cannot truncate the own requirements before the structural team boundary', () => {
  own(call(splitSections()))
})

test('own-only role container includes sibling requirements outside the heading wrapper', () => {
  const html = splitSections().split('<section><h2>More Information About the Hiring Team</h2>')[0] + '</body></html>'
  own(call(html))
})

test('unbounded related-job content makes a role-only container ambiguous', () => {
  rejected(call(edit(fixture.ownOnlyPageHtml, '</main>', '<h2>Related Jobs</h2><p>Recruiter needs 1+ years of experience.</p></main>')))
})

test('injected detail enrichment recovers future ingestion safely with one fetch and no browser', async () => {
  let calls = 0
  let browserCalls = 0
  const job = structuredClone(fixture.inputJob)
  const before = structuredClone(job)
  const out = await enrichJobWithPublicExperience(job, {
    fetchText: async url => { calls++; assert.equal(url, job.sourceUrl); return { status: 200, url, html: fixture.fullPageHtml } },
    fetchBrowserText: async () => { browserCalls++; throw new Error('No browser expected') },
  })
  assert.equal(calls, 1)
  assert.equal(browserCalls, 0)
  assert.deepEqual(job, before)
  own(out)
})

test('already-saved canonical original and native years are preserved without retrospective cleanup', () => {
  const job = {
    ...fixture.inputJob, sourceDescription: fixture.sourceRecord.originalText,
    jobDescription: fixture.sourceRecord.originalText,
    experienceRequired: '1+ years', sourceExperienceRequired: '1+ years',
  }
  const before = structuredClone(job)
  const out = inferExperienceFromPublicPageHtml(job, { status: 200, url: job.sourceUrl, html: fixture.fullPageHtml })
  assert.deepEqual(job, before)
  assert.equal(out.sourceDescription, fixture.sourceRecord.originalText)
  assert.equal(out.sourceExperienceRequired, '1+ years')
})

test('unrelated provider generic enrichment retains its existing behavior', () => {
  const url = 'https://careers.unrelated.example/jobs/cloud-engineer'
  const out = call('<html><body><h1>Cloud Engineer</h1><h2>Required Experience</h2><p>5 years of professional cloud engineering experience.</p></body></html>',
    { source: 'unrelated-example', company: 'Unrelated Example', title: 'Cloud Engineer', sourceUrl: url, applyUrl: url })
  assert.equal(out.experienceRequired, '5 years')
})
