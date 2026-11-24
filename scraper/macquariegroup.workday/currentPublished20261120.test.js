import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'

const own = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-own-research-20261120.json.gz', import.meta.url)))).responses
const country = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-form-research-20261120.json.gz', import.meta.url)))).responses
const complete = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-publication-20261120.json.gz', import.meta.url))))
const html = record => Buffer.from(record.bodyBase64, 'base64').toString('utf8')
const at = '2026-11-20T13:45:00.000Z'
const current = await import('./currentPublished20261120.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('currentPublished20261120.js')) return null
  throw error
})
const parser = name => { assert.equal(typeof current?.[name], 'function', 'Missing current native parser ' + name); return current[name] }
const once = (text, before, after) => { assert.equal(text.split(before).length - 1, 1, 'exact native mutation target'); return text.replace(before, after) }
const roleBase = () => parser('readCurrentIndex')(html(country[1]), country[1].requestedUrl, at).rows.find(row => row.nativePublicJobId === '25001')
const addRole = addition => once(html(own[2]), '</main>', addition + '</main>')
const meta = (source, property, content) => {
  const expression = new RegExp('(<meta[^>]*property="' + property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*content=")[^"]*(")', 'g')
  assert.equal([...source.matchAll(expression)].length, 1, 'actual current metadata target')
  return source.replace(expression, '$1' + content + '$2')
}
const changeNode = (source, predicate, change) => {
  const d = document(source), nodes = d.nodes(predicate)
  assert.ok(nodes.length > 0, 'actual native mutation node exists')
  const node = nodes[0], original = d.outer(node), changed = change(original)
  assert.notEqual(changed, original, 'actual native bytes change')
  return source.slice(0, node.start) + changed + source.slice(node.end)
}

test('own India careers handoff is taken from its current exact native link', () => {
  const publication = parser('readCurrentCorporate')(html(own[0]), at)
  assert.equal(publication.url, 'https://recruitment.macquarie.com/en_US/careers/SearchJobs/?10671=%5B871433%5D&10671_format=21337&10672=%5B13477958%5D&10672_format=21338&listFilterMode=1&jobRecordsPerPage=9&')
  assert.equal(publication.sourceLegalEmployer, null)
})

test('actual public form retains selected India and clears the city filter', () => {
  const form = parser('readCurrentForm')(html(own[1]), own[1].requestedUrl, at)
  assert.equal(form.url, 'https://recruitment.macquarie.com/en_US/careers/SearchJobs')
  assert.equal(form.method, 'POST')
  assert.equal(form.body, 'jobSort=&jobSortDirection=&listFilterMode=true&search=&10671%5B%5D=871433&action=search')
  assert.equal(form.country.label, 'India')
  assert.equal(new URLSearchParams(form.body).has('10672[]'), false)
})

test('explicit selected India scope qualifies current rows and holds the future posted card', () => {
  const publication = parser('readCurrentIndex')(html(country[1]), country[1].requestedUrl, at)
  assert.equal(publication.observedCards, 9)
  assert.equal(publication.rows.length, 8)
  assert.equal(publication.held.length, 1)
  assert.equal(publication.held[0].nativePublicJobId, '24195')
  assert.match(publication.held[0].reason, /future/)
  assert.equal(publication.country.label, 'India')
  assert.equal(publication.nextURLs.length, 1)
  assert.ok(publication.rows.every(row => row.country === 'India' && row.sourceDetailComplete === false && row.sourceLegalEmployer === null && row.requisitionId === null))
  assert.equal(publication.rows.find(row => row.nativePublicJobId === '25001').postingDate, '2026-11-19T00:00:00.000Z')
})

test('same native detail preserves public ID date criteria and exact application without inventing formal requisition', () => {
  const row = parser('readCurrentIndex')(html(country[1]), country[1].requestedUrl, at).rows.find(row => row.nativePublicJobId === '25001')
  const role = parser('readCurrentRole')(html(own[2]), row, at)
  assert.equal(role.nativePublicJobId, '25001')
  assert.equal(role.title, 'Manager')
  assert.equal(role.country, 'India')
  assert.equal(role.location, 'Hyderabad Office')
  assert.equal(role.requisitionId, null)
  assert.equal(role.sourceLegalEmployer, null)
  assert.equal(role.sourceDetailComplete, false)
  assert.equal(role.postingDate, '2026-11-19T00:00:00.000Z')
  assert.match(role.jobDescription, /Python and SQL/)
  assert.equal(role.applyUrl, 'https://recruitment.macquarie.com/en_US/careers/ApplicationMethods?jobId=25001&record=25001')
})

for (const id of ['24770', '24797', '24504', '23269']) test('actual double-encoded native title metadata retains the same visible role ' + id, () => {
  const originalRow = complete.phases[0].rows.find(row => row.id === id)
  const page = complete.responses.find(record => record.phase.startsWith('opening-native-page-') && html(record).includes(originalRow.url))
  const row = parser('readCurrentIndex')(html(page), page.requestedUrl, at).rows.find(row => row.nativePublicJobId === id)
  const detail = complete.responses.find(record => record.phase === 'opening-role-' + id)
  const result = parser('readCurrentRole')(html(detail), row, at)
  assert.equal(result.nativePublicJobId, id)
  assert.equal(result.title, originalRow.title)
  assert.ok(result.jobDescription)
})

test('own current OG publisher title conflict constrains the actual handoff', () => {
  assert.throws(() => parser('readCurrentCorporate')(meta(html(own[0]), 'og:title', 'Other Company Careers'), at))
})

test('own current OG publisher URL conflict constrains the actual handoff', () => {
  assert.throws(() => parser('readCurrentCorporate')(meta(html(own[0]), 'og:url', 'https://other.example/careers'), at))
})

test('actual native index OG URI cannot point to another publisher', () => {
  assert.throws(() => parser('readCurrentIndex')(meta(html(country[1]), 'og:url', 'https://other.example/jobs'), country[1].requestedUrl, at))
})

for (const [label, value] of [['Employer', 'Other Company'], ['Country', 'Canada'], ['Posting status', 'withdrawn'], ['Application URL', 'https://other.example/apply']]) test('same-role semantic leaf label constrains native criteria: ' + label, () => {
  assert.throws(() => parser('readCurrentRole')(addRole('<section><span>' + label + '</span><span>' + value + '</span></section>'), roleBase(), at))
})

test('nested current WebPage mainEntity country contradiction cannot be ignored', () => {
  const model = { '@context': 'https://schema.org', '@type': 'WebPage', url: own[2].requestedUrl, mainEntity: { '@type': 'JobPosting', title: 'Manager', url: own[2].requestedUrl, hiringOrganization: { '@type': 'Organization', name: 'Macquarie Group' }, jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: 'Canada', addressLocality: 'Toronto' } } } }
  assert.throws(() => parser('readCurrentRole')(addRole('<script type="application/ld+json">' + JSON.stringify(model) + '</script>'), roleBase(), at))
})

test('same native current publisher Organization name cannot change employer', () => {
  const model = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Other Company', url: 'https://recruitment.macquarie.com' }
  assert.throws(() => parser('readCurrentRole')(addRole('<script type="application/ld+json">' + JSON.stringify(model) + '</script>'), roleBase(), at))
})

test('native selected country label cannot become Canada while the old URI remains India', () => {
  assert.throws(() => parser('readCurrentIndex')(once(html(country[1]), '>India</option>', '>Canada</option>'), country[1].requestedUrl, at))
})

test('native selected country option must remain bound to the current query value', () => {
  assert.throws(() => parser('readCurrentIndex')(once(html(country[1]), 'value="871433" selected="1"', 'value="999999" selected="1"'), country[1].requestedUrl, at))
})

test('the country-only result cannot silently retain an additional city filter', () => {
  const altered = changeNode(html(country[1]), node => node.tag === 'select' && node.attrs.name === '10672[]', raw => raw.replace('</select>', '<option selected="1" value="13477958">Hyderabad</option></select>'))
  assert.throws(() => parser('readCurrentIndex')(altered, country[1].requestedUrl, at))
})

test('actual Next cannot jump its native offset', () => {
  const altered = changeNode(html(country[1]), node => node.tag === 'a' && (node.attrs.class ?? '').split(/\s+/).includes('paginationNextLink'), raw => raw.replace('jobOffset=9', 'jobOffset=18'))
  assert.throws(() => parser('readCurrentIndex')(altered, country[1].requestedUrl, at))
})

test('actual current public search submit cannot change its action', () => {
  const altered = changeNode(html(own[1]), node => node.tag === 'button' && node.attrs.name === 'action', raw => raw.replace('<button', '<button formaction="https://other.example/search"'))
  assert.throws(() => parser('readCurrentForm')(altered, own[1].requestedUrl, at))
})

test('a disabled current selected Countries control cannot supply scope', () => {
  const altered = changeNode(html(own[1]), node => node.tag === 'select' && node.attrs.name === '10671[]', raw => raw.replace('<select', '<select disabled'))
  assert.throws(() => parser('readCurrentForm')(altered, own[1].requestedUrl, at))
})

test('actual role title publication false constrains the native role', () => {
  const altered = once(html(own[2]), 'class="title title--11"', 'class="title title--11" data-is-published="false"')
  assert.throws(() => parser('readCurrentRole')(altered, roleBase(), at))
})

test('actual canonical application alias cannot be foreign', () => {
  const altered = once(html(own[2]), 'rel="canonical"', 'rel="canonical" data-application-uri="https://other.example/apply"')
  assert.throws(() => parser('readCurrentRole')(altered, roleBase(), at))
})

test('the first actual native Apply publicID cannot be hidden by another valid link', () => {
  const altered = changeNode(html(own[2]), node => node.tag === 'a' && node.attrs.href?.includes('/ApplicationMethods?jobId=25001'), raw => raw.replace('jobId=25001', 'jobId=999999'))
  assert.throws(() => parser('readCurrentRole')(altered, roleBase(), at))
})

test('the role native Additional office location cannot change to Mumbai', () => {
  const altered = changeNode(html(own[2]), node => (node.attrs.class ?? '').split(/\s+/).includes('field--location'), raw => raw.replace('Hyderabad', 'Mumbai'))
  assert.throws(() => parser('readCurrentRole')(altered, roleBase(), at))
})

test('a same-country semantic workplace still constrains the native city', () => {
  assert.throws(() => parser('readCurrentRole')(addRole('<section><span>Location</span><span>Mumbai, India</span></section>'), roleBase(), at))
})

test('a consistent semantic India workplace preserves the existing partial', () => {
  assert.equal(parser('readCurrentRole')(addRole('<section><span>Location</span><span>Hyderabad, India</span></section>'), roleBase(), at).nativePublicJobId, '25001')
})

test('identity-only same-role JobPosting need not repeat the proven selected country', () => {
  const model = { '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Manager', url: own[2].requestedUrl, hiringOrganization: { '@type': 'Organization', name: 'Macquarie Group' } }
  assert.equal(parser('readCurrentRole')(addRole('<script type="application/ld+json">' + JSON.stringify(model) + '</script>'), roleBase(), at).nativePublicJobId, '25001')
})

test('separate consistent typed India and Canada alternatives preserve the India partial', () => {
  const model = { '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Manager', url: own[2].requestedUrl, hiringOrganization: { '@type': 'Organization', name: 'Macquarie Group' }, jobLocation: [{ '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: 'India', addressLocality: 'Hyderabad' } }, { '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: 'Canada', addressLocality: 'Toronto' } }] }
  const result = parser('readCurrentRole')(addRole('<script type="application/ld+json">' + JSON.stringify(model) + '</script>'), roleBase(), at)
  assert.equal(result.country, 'India')
  assert.equal(result.originalStructuredModels[0].jobLocation[1].address.addressCountry, 'Canada')
})

test('a genuine optional structured root key order does not pin a model', () => {
  const model = { url: own[2].requestedUrl, title: 'Manager', hiringOrganization: { name: 'Macquarie Group', '@type': 'Organization' }, '@type': 'JobPosting', '@context': 'https://schema.org' }
  assert.equal(parser('readCurrentRole')(addRole('<script type="application/ld+json">' + JSON.stringify(model) + '</script>'), roleBase(), at).nativePublicJobId, '25001')
})

test('an unrelated client release does not replace current server publication authority', () => {
  assert.equal(parser('readCurrentRole')(addRole('<script>/* unrelated release */ window.nativeUnrelated={release:"fresh"}</script>'), roleBase(), at).nativePublicJobId, '25001')
})

test('malformed complete native structured JSON cannot become an optional outage', () => {
  assert.throws(() => parser('readCurrentRole')(addRole('<script type="application/ld+json">{"@context":</script>'), roleBase(), at))
})

test('explicitly cleared nested schema context cannot borrow its old parent meaning', () => {
  const model = { '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Manager', hiringOrganization: { '@context': null, '@type': 'Organization', name: 'Macquarie Group' } }
  assert.throws(() => parser('readCurrentRole')(addRole('<script type="application/ld+json">' + JSON.stringify(model) + '</script>'), roleBase(), at))
})

test('future actual structured posting date constrains an otherwise current card', () => {
  const model = { '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Manager', datePosted: '2026-11-23' }
  assert.throws(() => parser('readCurrentRole')(addRole('<script type="application/ld+json">' + JSON.stringify(model) + '</script>'), roleBase(), at))
})

test('actual role closing date expiry constrains otherwise valid publication', () => {
  const altered = once(html(own[2]), 'class="title title--11"', 'class="title title--11" data-valid-through="2026-11-19"')
  assert.throws(() => parser('readCurrentRole')(altered, roleBase(), at))
})
