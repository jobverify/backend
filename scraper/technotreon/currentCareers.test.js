import assert from 'node:assert/strict'
import test from 'node:test'
import { run, extractListings, hasOfficialCareersSignal } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const titles = [
  'Digital Growth &amp; Brand Strategy Aptitude Test', 'Sales &amp; Outreach Strategy Aptitude Test',
  'Innovation Protection &amp; IP Aptitude Test', 'Hardware Innovation EngineerAptitude test',
  'Smart Electronics &amp; Embedded Systems Aptitude Test', 'Talent Strategy &amp; HR Operations Aptitude Test',
]
const urls = ['marketing', 'marketing', 'legal', 'engineering', 'engineering', 'hr']
const cards = titles.map((title, index) => '<div data-ux="ContentCard"><div><h4 data-ux="ContentCardHeading" data-aid="CONTENT_HEADLINE' + (index + 1) + '_RENDERED">' + title + '</h4>'
  + '<h4 data-ux="ContentCardHeading">Incorrect stale responsive title Aptitude Test</h4></div>'
  + '<div data-ux="ContentCardText" data-aid="CONTENT_DESCRIPTION' + (index + 1) + '_RENDERED"><p><span>Role ' + (index + 1) + ' responsibilities.</span></p><p>Work with our team.</p></div>'
  + '<div><a data-ux="ContentCardButton" data-aid="CONTENT_CTA_BTN' + (index + 1) + '_RENDERED" href="https://forms.gle/' + urls[index] + '"> APPLY </a></div></div>')
const page = '<title>Careers at Technotreon | Innovation &amp; Patent Jobs in Pune</title><h1>CAREERS AT TECHNOTREON</h1>'
  + '<p>Open call for all humans who are not machines</p>' + cards.join('') + '<p>hr@technotreon.in</p>'
  + '<h2>General interest applications</h2><a href="https://forms.gle/general">Apply</a>'
const homepageUnavailable = Object.assign(new Error('DNS temporarily unavailable'), { code: 'ENOTFOUND' })
const fetchPage = async url => { if (url.endsWith('/')) throw homepageUnavailable; return page }

test('Technotreon parses all six redesigned cards using primary headings despite duplicate responsive titles and shared forms', async () => {
  assert.equal(hasOfficialCareersSignal(page), true)
  const listings = extractListings(page)
  assert.equal(listings.length, 6)
  assert.deepEqual(listings.map(job => job.title), titles.map(title => title.replaceAll('&amp;', '&')))
  assert.deepEqual(listings.map(job => job.applyUrl), urls.map(value => 'https://forms.gle/' + value))
  assert.equal(listings[3].department, 'Hardware Innovation Engineer')
  assert.ok(listings.every((job, index) => job.description === 'Role ' + (index + 1) + ' responsibilities. Work with our team.'))
  assert.ok(listings.every(observation => observation.location === 'Pune' && observation.city === 'Pune'))
  await assert.rejects(run({ fetchText: fetchPage }), /native HTTP response metadata required/)
})

test('Technotreon refuses a partial card inventory instead of borrowing the next role or generic apply form', async () => {
  for (const changed of [
    page.replace('CONTENT_CTA_BTN6_RENDERED', 'CONTENT_CTA_BTN5_RENDERED'),
    page.replace('Talent Strategy &amp; HR Operations Aptitude Test', 'Talent Strategy &amp; HR Operations'),
    page.replace('https://forms.gle/hr', 'javascript:bad()'),
    page.replace('<p><span>Role 6 responsibilities.</span></p><p>Work with our team.</p>', ''),
  ]) assert.throws(() => extractListings(changed), /incomplete.*card/i)
})

test('Technotreon refuses body-only transport failures and propagates pre-aborted source cancellation', async () => {
  await assert.rejects(run({ fetchText: async () => { throw Object.assign(new Error('Connect timeout'), { code: 'UND_ERR_CONNECT_TIMEOUT' }) } }), /native HTTP response metadata required/)
  const reason = new Error('Source stopped')
  let requests = 0
  await assert.rejects(run({ signal: AbortSignal.abort(reason), fetchText: async () => { requests++; return page } }), error => error === reason)
  assert.equal(requests, 0)
  await assert.rejects(run({ fetchText: async () => { requests++; return page } }), /native HTTP response metadata required/)
  assert.equal(requests, 0)
})
