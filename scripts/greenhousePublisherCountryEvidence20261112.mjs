import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { readNativeDocument, decodeNativeEntities } from '../scraper-support/utils/activeNativeHtml.js'
import { validatePublicPostingScope } from '../scraper-support/utils/publishingGapAts.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

// Read-only public publisher investigation. This does not run persistence or
// alter source rows, country values, descriptions, counts, or completeness.
const sha256 = value => createHash('sha256').update(value).digest('hex')
const fixturePath = 'test/test-data/native-pagination-provider-responses-20261112.json.gz'
const outputPath = 'test/test-data/greenhouse-country-publisher-originals-20261112.json.gz'
const summaryPath = '../reports/partial-success-repairs-2026-11-12/greenhouse-country-publisher-evidence-20261112.json'
const originalBytes = fs.readFileSync(fixturePath)
const original = JSON.parse(gunzipSync(originalBytes))
const sources = [
  { source: 'tenstorrent', boardToken: 'tenstorrent', roleIds: [5198062007, 5202618007, 5275381007] },
  { source: 'razorpay', boardToken: 'razorpaysoftwareprivatelimited' },
].map(source => {
  const response = original.responses.find(row => row.requestedUrl.includes('/boards/' + source.boardToken + '/jobs'))
  const payload = JSON.parse(response.body)
  return { ...source, originalRequestedUrl: response.requestedUrl, originalResponseSha256: sha256(response.body),
    originalTotal: payload.meta.total,
    originalRows: payload.jobs.filter(row => !source.roleIds || source.roleIds.includes(row.id)) }
})
const targets = sources.flatMap(source => [
  { source: source.source, kind: 'listing', url: source.originalRequestedUrl },
  { source: source.source, kind: 'offices', url: 'https://boards-api.greenhouse.io/v1/boards/' + source.boardToken + '/offices' },
  ...source.originalRows.map(row => ({ source: source.source, kind: 'role', id: row.id, url: row.absolute_url })),
])
let results = new Array(targets.length)
let next = 0
let capture, capturedBytes
if (process.argv.includes('--analyze-existing')) {
  capturedBytes = fs.readFileSync(outputPath)
  capture = JSON.parse(gunzipSync(capturedBytes))
  results = capture.responses
} else {
  await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < targets.length) {
    const index = next++, target = targets[index], requestedAt = new Date().toISOString()
    try {
      const response = await fetch(target.url, { redirect: 'manual', signal: AbortSignal.timeout(25000),
        headers: { Accept: target.kind === 'role' ? 'text/html' : 'application/json', 'User-Agent': 'Mozilla/5.0 (Jobverify public publisher evidence)' } })
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length > 5000000) throw Error('Public response exceeds evidence byte budget')
      results[index] = { ...target, requestedUrl: target.url, method: 'GET', requestBody: null,
        finalUrl: response.url, status: response.status, contentType: response.headers.get('content-type'),
        redirectLocation: response.headers.get('location'),
        requestedAt, completedAt: new Date().toISOString(), bodyBytes: bytes.length, bodySha256: sha256(bytes), body: bytes.toString('utf8') }
    } catch (error) {
      results[index] = { ...target, requestedAt, completedAt: new Date().toISOString(), error: error.message }
    }
    console.log(JSON.stringify({ source: target.source, kind: target.kind, id: target.id ?? null,
      status: results[index].status ?? null, bytes: results[index].bodyBytes ?? null, error: results[index].error ?? null }))
  }
  }))
  capture = { observedAt: new Date().toISOString(), originalFixture: { path: fixturePath, sha256: sha256(originalBytes), observedAt: original.observedAt }, sources, responses: results }
  capturedBytes = gzipSync(JSON.stringify(capture))
  fs.writeFileSync(outputPath, capturedBytes)
}
const text = value => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : ''
const plain = html => { const doc = readNativeDocument(html); return doc.text(doc.nodes(() => true)[0]) }
const criteriaKey = html => plain(html).replace(/\s/gu, '')
const parseRole = (response, source) => {
  if (!response.body || response.status !== 200) return { id: response.id, status: response.status, error: response.error }
  const doc = readNativeDocument(response.body)
  const originalRow = source.originalRows.find(row => row.id === response.id)
  const stateScripts = doc.nodes(node => node.tag === 'script' && node.raw?.startsWith('window.__remixContext = '))
  const state = stateScripts.length === 1 ? JSON.parse(stateScripts[0].raw
    .replace(/^window\.__remixContext\s*=\s*/u, '').replace(/;\s*$/u, '')) : null
  const route = state?.state?.loaderData?.['routes/$url_token_.jobs_.$job_post_id']
  const post = route?.jobPost
  const visibleDescriptions = doc.nodes(node => (node.attrs.class || '').split(/\s/u).includes('job__description'))
  const originalDescription = criteriaKey(decodeNativeEntities(originalRow.content))
  const stateDescription = post ? criteriaKey([post.introduction, post.content, post.conclusion].filter(Boolean).join('')) : null
  const visibleDescription = visibleDescriptions.length === 1 ? doc.text(visibleDescriptions[0]).replace(/\s/gu, '') : null
  const headings = doc.nodes(node => /^h[1-6]$/u.test(node.tag)).map(node => ({ tag: node.tag, text: doc.text(node) }))
  const roleTitles = doc.nodes(node => node.tag === 'h1' && (node.attrs.class || '').split(/\s/u).includes('section-header'))
  const currentListing = JSON.parse(results.find(row => row.source === source.source && row.kind === 'listing').body)
  const currentRow = currentListing.jobs.find(row => row.id === response.id)
  const schemas = doc.nodes(node => node.tag === 'script' && /application\/ld\+json/i.test(node.attrs.type || '')).flatMap(node => {
    try { const parsed = JSON.parse(node.raw); return Array.isArray(parsed) ? parsed : parsed?.['@graph'] || [parsed] }
    catch { return [] }
  })
  const jobPostings = schemas.filter(schema => schema?.['@type'] === 'JobPosting').map(schema => {
    const { description, ...rest } = schema
    return { ...rest, descriptionBytes: typeof description === 'string' ? description.length : null,
      descriptionSha256: typeof description === 'string' ? sha256(description) : null }
  })
  const paragraphs = doc.nodes(node => /^(?:h[1-6]|p)$/i.test(node.tag)).map(node => doc.text(node)).filter(Boolean)
  return { id: response.id, status: response.status, responseSha256: response.bodySha256,
    requestedUrl: response.requestedUrl, finalUrl: response.finalUrl, requestedAt: response.requestedAt, completedAt: response.completedAt,
    originalNativeRecordSha256: sha256(JSON.stringify(originalRow)),
    exactOriginalRecordStillListed: Boolean(currentRow && JSON.stringify(currentRow) === JSON.stringify(originalRow)),
    originalWorkplaceSet: { location: originalRow.location, offices: originalRow.offices, metadata: originalRow.metadata },
    nativeRoleState: post ? { jobPostId: route.jobPostId, boardToken: route.urlToken, title: post.title,
      nativePostingUrl: post.public_url, workplaceLabel: post.job_post_location,
      geographyFields: Object.fromEntries(Object.entries(post).filter(([key]) => /country|location|office|region|workplace|address/iu.test(key))) } : null,
    reconciliation: {
      nativeIdentity: route?.jobPostId === String(originalRow.id) && route?.urlToken === source.boardToken && post?.public_url === originalRow.absolute_url,
      nativeTitle: text(post?.title) === text(originalRow.title) && roleTitles.length === 1
        && text(doc.text(roleTitles[0])) === text(originalRow.title),
      nativeWorkplaceLabel: post?.job_post_location === originalRow.location.name,
      fullCriteriaInRoleState: originalDescription === stateDescription,
      fullCriteriaVisible: originalDescription === visibleDescription,
      fullCriteriaSha256: sha256(originalDescription),
    }, headings,
    jobPostings, locationStatements: paragraphs.filter(value => /\b(?:this role is remote|based (?:out of|in)|location\s*:|country|work from|workplace)\b/i.test(value)) }
}
const summary = { observedAt: capture.observedAt, capturePath: outputPath, captureSha256: sha256(capturedBytes),
  originalFixture: capture.originalFixture,
  sources: capture.sources.map(source => ({ source: source.source, boardToken: source.boardToken, originalTotal: source.originalTotal,
    conclusion: 'Publisher country/workplace scope remains unresolved; retain incomplete inventory and forbid lifecycle cleanup.',
    nativeScopeReasons: validatePublicPostingScope(JSON.parse(results.find(row => row.source === source.source && row.kind === 'listing').body).jobs,
      'greenhouse', { ...getScraperCatalog().find(provider => provider.source === source.source), boardToken: source.boardToken }),
    roles: results.filter(row => row.source === source.source && row.kind === 'role').map(row => parseRole(row, source)),
    offices: results.filter(row => row.source === source.source && row.kind === 'offices').map(row => ({ status: row.status, bodySha256: row.bodySha256,
      definitions: row.body ? JSON.parse(row.body).offices.map(({ id, name, location, child_ids, parent_id }) => ({ id, name, location, child_ids, parent_id })) : null })),
    listing: results.filter(row => row.source === source.source && row.kind === 'listing').map(row => ({ status: row.status, bodySha256: row.bodySha256, total: row.body ? JSON.parse(row.body).meta?.total : null })),
  })) }
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify({ capturePath: outputPath, captureSha256: summary.captureSha256, summaryPath,
  responses: results.length, successful: results.filter(row => row.status === 200).length,
  typedAddressRoles: summary.sources.map(source => ({ source: source.source, roles: source.roles.length,
    withJobPosting: source.roles.filter(row => row.jobPostings?.length).length })) }))
