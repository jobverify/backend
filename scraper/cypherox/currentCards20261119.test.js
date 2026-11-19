import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { run, CAREERS_URL } from './script.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261119/current.json.gz', import.meta.url))))
const hash = value => createHash('sha256').update(value).digest('hex')
assert.equal(hash(fixture.html), fixture.htmlSHA256)
assert.equal(hash(fixture.client), fixture.clientSHA256)
const replay = ({ html = fixture.html, client = fixture.client, closingHTML = html, stylesheets = fixture.stylesheets } = {}) => {
  let pages = 0
  return { fetchText: async url => {
    if (url === CAREERS_URL) return ++pages < 3 ? html : closingHTML
    if (Object.hasOwn(stylesheets, url)) return stylesheets[url]
    assert.equal(url, 'https://www.cypherox.com/assets/js/script.js?v=20261114')
    return client
  } }
}

test('Cypherox retains ten native card roles and bounded full criteria after JobPosting graph removal', async () => {
  const jobs = await run(replay())
  assert.equal(jobs.length, 10)
  assert.equal(jobs[0].title, 'WordPress Developer')
  assert.ok(jobs.every(job => job.company === 'Cypherox Technologies'))
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, 'Rajkot')
  assert.equal(jobs.at(-1).city, 'Ahmedabad')
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 10)
  assert.ok(jobs.every(job => job.jobDescription.length > 500 && job.sourceUrl === CAREERS_URL && job.applyUrl === CAREERS_URL))
  assert.ok(!jobs[0].jobDescription.includes('Odoo Developer'))
  assert.ok(!jobs.at(-1).jobDescription.includes('Meet Our People'))
  assert.equal(jobs[0].requisitionId, null)
  assert.equal(jobs.nativeCollectionEvidence.nativeOpeningRecords.length, 10)
  assert.equal(jobs.nativeCollectionEvidence.closingMatches, true)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const location of ['Rajkot, Canada', 'Remote', 'Rajkot / London', 'Ahmedabad Worldwide']) {
  test('Cypherox rejects the entire native location ' + location, async () => {
    const html = fixture.html.replace('fw-normal career-location">Rajkot', 'fw-normal career-location">' + location)
    await assert.rejects(run(replay({ html })), /native location/)
  })
}

test('Cypherox requires the exact reviewed active application client and native role-bound form', async () => {
  await assert.rejects(run(replay({ client: fixture.client + '\nwindow.extraHiringRoute="/other";' })), /client/)
  await assert.rejects(run(replay({ html: fixture.html.replace('name="apply_for_role"', 'name="other_role"') })), /application/)
  await assert.rejects(run(replay({ html: fixture.html.replace('id="career-location-post"', 'id="other-location-post"') })), /application/)
  await assert.rejects(run(replay({ html: fixture.html.replace('<form id="career-form"', '<form action="https://other-employer.test/apply" id="career-form"') })), /application/)
  await assert.rejects(run(replay({ html: fixture.html.replace('class="primary-btn career-form-btn"', 'onclick="window.location.href=\'/other-employer\'" class="primary-btn career-form-btn"') })), /activation|application/)
})

test('Cypherox rejects a closing inventory or full-criteria change instead of mixing snapshots', async () => {
  const changed = fixture.html.replace('Maintain well documented and reusable code', 'Maintain code and perform a new additional duty')
  assert.notEqual(changed, fixture.html)
  await assert.rejects(run(replay({ closingHTML: changed })), /closing/)
})

test('Cypherox ignores inert fake roles and never promotes an all-inert native inventory to empty', async () => {
  const inert = fixture.html.replace('<div class="career-area-block">', '<template><div class="career-area-block">').replace('<!-- Meet Our People', '</template><!-- Meet Our People')
  await assert.rejects(run(replay({ html: inert })), /native|careers page/)
})

for (const statement of [
  'This position is closed and we are no longer accepting applications.',
  'Work Country: Canada.',
  'Employer: Other Company.',
]) {
  test('Cypherox refuses contradictory role criteria: ' + statement, async () => {
    const html = fixture.html.replace('<div class="card-text text-white mb-0 at-tab">', '<div class="card-text text-white mb-0 at-tab"><p>' + statement + '</p>')
    await assert.rejects(run(replay({ html })), /closed|country|employer/)
  })
}

test('Cypherox refuses changed authored presentation and an unusable candidate email control', async () => {
  const html = fixture.html.replace('</head>', '<style>.card-text{display:none!important}</style></head>')
  await assert.rejects(run(replay({ html })), /presentation|style/)
  await assert.rejects(run(replay({ html: fixture.html.replace('name="email"', 'name="email" readonly') })), /application/)
  const key = 'https://www.cypherox.com/assets/css/styles.css?v=20261114'
  await assert.rejects(run(replay({ stylesheets: { ...fixture.stylesheets,
    [key]: fixture.stylesheets[key] + '\n.card-text{display:none!important}' } })), /presentation/)
})

test('Cypherox cannot bypass its current card contract by adding a legacy JobPosting graph', async () => {
  const graph = JSON.stringify({ '@context': 'https://schema.org', '@graph': [0, 1].map(index => ({
    '@type': 'JobPosting', '@id': CAREERS_URL + '#alternate-' + index,
    title: 'Alternate role ' + index, description: 'Conflicting alternate feed',
    jobLocation: { address: { addressLocality: 'Toronto', addressCountry: 'CA' } },
  })) })
  const html = fixture.html.replace('</head>', '<script type="application/ld+json">' + graph + '</script></head>')
  await assert.rejects(run(replay({ html })), /alternate|JobPosting/)
})
