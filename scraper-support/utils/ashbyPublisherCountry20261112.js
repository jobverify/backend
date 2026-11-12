import { createHash } from 'node:crypto'
import { readNativeDocument } from './activeNativeHtml.js'
import { readAppData, normalizeCountry } from '../shared/ashbyPairNative20261027.js'

const boards = new Map([['anyscale', 'anyscale'], ['elevenlabs', 'ElevenLabs'], ['g2', 'G2'],
  ['harvey', 'harvey'], ['ema', 'ema']])
const requestLimit = 64
const maxPageBytes = 3000000
const text = value => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : ''
const postal = value => value?.postalAddress || value || {}
const labels = values => Array.isArray(values) ? [...values].map(text).sort() : null
const sameLabels = (left, right) => Array.isArray(left) && Array.isArray(right)
  && JSON.stringify(labels(left)) === JSON.stringify(labels(right))
const emptyCountry = value => postal(value).addressCountry == null || postal(value).addressCountry === ''
const unknownPrimary = row => row?.isListed === true && emptyCountry(row.address)
  && !normalizeCountry(row.location) && !/\b(?:India|Bengaluru|Bangalore|Mumbai|Hyderabad|Pune|Chennai|Gurugram|Gurgaon|Noida|Delhi)\b/i.test(row.location || '')
const fail = reason => { throw new Error(reason) }

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(15000)]),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify native country audit)', Accept: 'text/html' },
  })
  if (Number(response.headers.get('content-length')) > maxPageBytes) fail('native-role-response-too-large')
  const chunks = []
  let bytes = 0
  if (response.body) for await (const chunk of response.body) {
    bytes += chunk.byteLength
    if (bytes > maxPageBytes) fail('native-role-response-too-large')
    chunks.push(Buffer.from(chunk))
  }
  const html = Buffer.concat(chunks, bytes).toString('utf8')
  return { status: response.status, url: response.url, html }
}

const readRolePage = (html, row, provider) => {
  const document = readNativeDocument(html)
  const appScripts = document.nodes(node => node.tag === 'script' && !node.attrs.src
    && !Object.hasOwn(node.attrs, 'nomodule')
    && /^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type || '')
    && /window\.__appData\s*=/.test(node.raw || ''))
  if (appScripts.length !== 1) fail('native-role-app-data-unavailable')
  const app = readAppData(appScripts[0].raw), posting = app?.posting
  if (app?.environment !== 'production' || app.maintenanceMode !== false || app.schedulingMaintenanceMode !== false
    || app?.organization?.hostedJobsPageSlug !== provider.boardToken || posting?.id !== row.id
    || posting.isListed !== true || posting.isConfidential !== false
    || text(posting.title) !== text(row.title) || text(posting.locationName) !== text(row.location)
    || (posting.workplaceType ?? null) !== (row.workplaceType ?? null)
    || !sameLabels(posting.secondaryLocationNames, (row.secondaryLocations || []).map(location => location.location))
    || typeof row.descriptionHtml !== 'string' || !row.descriptionHtml.trim()
    || posting.descriptionHtml !== row.descriptionHtml) fail('native-role-state-not-reconciled')
  const schemas = document.nodes(node => node.tag === 'script' && !node.attrs.src
    && /^application\/ld\+json$/i.test(node.attrs.type || '')).flatMap(node => {
    const schema = JSON.parse(node.raw || '')
    return Array.isArray(schema) ? schema : Array.isArray(schema?.['@graph']) ? schema['@graph'] : [schema]
  }).filter(schema => schema?.['@type'] === 'JobPosting')
  if (schemas.length !== 1) fail('native-role-schema-unavailable')
  const schema = schemas[0]
  if (schema.identifier?.value !== row.id || text(schema.title) !== text(row.title)
    || schema.description !== row.descriptionHtml
    || schema.identifier?.name !== app.organization.name
    || schema.hiringOrganization?.name !== app.organization.name) fail('native-role-schema-not-reconciled')
  return { posting, schema }
}

// Country scope comes from the same role's explicit Location criterion. A
// country on another office, an applicant preference, or an optional office
// list cannot turn an omitted primary/secondary country into a known country.
const explicitLocationCriterion = row => {
  const document = readNativeDocument(row.descriptionHtml)
  const nodes = document.nodes(node => /^(?:h[1-6]|p)$/i.test(node.tag))
  const locationHeadings = nodes.map((node, index) => ({ node, index }))
    .filter(({ node }) => /^Location\s*:?$/i.test(document.text(node)))
  if (text(row.location) === 'Remote' && locationHeadings.length === 1) {
    const start = locationHeadings[0].index + 1
    const following = []
    for (let index = start; index < nodes.length && !/^h[1-6]$/i.test(nodes[index].tag); index++) {
      const value = text(document.text(nodes[index]))
      if (value) following.push(value)
    }
    const match = /^This role is remote and can be executed anywhere in (?:the )?(.+)\.$/u.exec(following[0] || '')
    const country = normalizeCountry(match?.[1])
    if (country && following.slice(1).every(value =>
      /^We are an equal opportunity employer and do not discriminate on the basis of /u.test(value))) {
      return { country, criterion: following[0], method: 'native-role-remote-country-location-statement' }
    }
  }
  // A country-only Location field directly scopes a single-location role.
  // Applying it across any secondary office would require a separate proof.
  if ((row.secondaryLocations || []).length) return null
  const explicit = nodes.map((node, index) => ({ node, index, value: text(document.text(node)) }))
    .filter(({ node, value }) => node.tag === 'p' && /^Location:\s*/u.test(value))
  if (explicit.length !== 1) return null
  const precedingHeading = nodes.slice(0, explicit[0].index).findLast(node => /^h[1-6]$/i.test(node.tag))
  if (!precedingHeading || !/^Additional Information(?: for Postings)?$/u.test(document.text(precedingHeading))) return null
  const country = normalizeCountry(explicit[0].value.replace(/^Location:\s*/u, ''))
  return country ? { country, criterion: explicit[0].value, method: 'native-role-explicit-country-location' } : null
}

const fetchWithinBudget = async (fetchPage, url, signal, deadline) => {
  signal?.throwIfAborted()
  const remaining = deadline - Date.now()
  if (remaining <= 0) fail('native-country-audit-budget-exhausted')
  const timeout = AbortSignal.timeout(Math.min(15000, remaining))
  const requestSignal = AbortSignal.any([...(signal ? [signal] : []), timeout])
  let onAbort
  const cancelled = new Promise((resolve, reject) => {
    onAbort = () => reject(requestSignal.reason)
    requestSignal.addEventListener('abort', onAbort, { once: true })
    if (requestSignal.aborted) onAbort()
  })
  try {
    return await Promise.race([Promise.resolve().then(() => fetchPage(url, { signal: requestSignal })), cancelled])
  } catch (error) {
    signal?.throwIfAborted()
    if (timeout.aborted) fail(Date.now() >= deadline ? 'native-country-audit-budget-exhausted' : 'native-role-response-timeout')
    throw error
  } finally {
    requestSignal.removeEventListener('abort', onAbort)
  }
}

const checkPublishedCountries = (row, posting, schema, proof) => {
  const rawCountries = [postal(row.address).addressCountry, postal(posting.locationAddress).addressCountry,
    ...(row.secondaryLocations || []).flatMap(location => [postal(location.address).addressCountry,
      normalizeCountry(location.location)])]
  for (const location of Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]) {
    if (location?.address?.addressCountry != null) rawCountries.push(location.address.addressCountry)
  }
  for (const applicant of Array.isArray(schema.applicantLocationRequirements)
    ? schema.applicantLocationRequirements : [schema.applicantLocationRequirements]) {
    if (applicant != null) {
      if (applicant?.['@type'] !== 'Country' || !text(applicant.name)) fail('native-role-country-criteria-conflict')
      rawCountries.push(applicant.name)
    }
  }
  if (rawCountries.some(value => text(value) && normalizeCountry(value) !== proof.country)) {
    fail('native-role-country-criteria-conflict')
  }
}

export const reconcileAshbyPublisherCountries = async (payload, provider, {
  fetchPage = defaultFetchPage, signal, needsCountry = () => true, auditBudgetMs = 90000,
} = {}) => {
  const proofs = [], failures = []
  let pagesFetched = 0, requests = 0
  if (provider?.atsPlatform !== 'ashby' || boards.get(provider.source) !== provider.boardToken
    || payload?.apiVersion !== '1' || !Array.isArray(payload.jobs)) return { payload, proofs, failures, pagesFetched }
  const budget = Number.isFinite(auditBudgetMs) ? Math.min(90000, Math.max(1, auditBudgetMs)) : 90000
  const deadline = Date.now() + budget
  const records = [...payload.jobs]
  for (const [index, row] of records.entries()) {
    signal?.throwIfAborted()
    if (!unknownPrimary(row) || !needsCountry(row)) continue
    if (Date.now() >= deadline) {
      failures.push({ jobId: row.id, reason: 'native-country-audit-budget-exhausted' })
      continue
    }
    const expectedUrl = `https://jobs.ashbyhq.com/${encodeURIComponent(provider.boardToken)}/${encodeURIComponent(row.id)}`
    if (typeof row.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,255}$/i.test(row.id)
      || row.jobUrl !== expectedUrl || row.applyUrl !== `${expectedUrl}/application`) {
      failures.push({ jobId: row.id, reason: 'native-role-url-identity-not-reconciled' })
      continue
    }
    if (requests >= requestLimit) {
      failures.push({ jobId: row.id, reason: 'native-country-audit-request-cap' })
      continue
    }
    requests++
    try {
      const response = await fetchWithinBudget(fetchPage, expectedUrl, signal, deadline)
      signal?.throwIfAborted()
      pagesFetched++
      if (response?.status !== 200 || response.url !== expectedUrl || typeof response.html !== 'string'
        || Buffer.byteLength(response.html, 'utf8') > maxPageBytes
        || /verify you are human|checking your browser|captcha challenge|access denied|cf-chl-/i.test(response.html)) {
        fail('native-role-response-unavailable')
      }
      const { posting, schema } = readRolePage(response.html, row, provider)
      const criterion = explicitLocationCriterion(row)
      if (!criterion) fail('native-role-explicit-country-location-unavailable')
      checkPublishedCountries(row, posting, schema, criterion)
      const proof = { source: provider.source, jobId: row.id, locationIndex: 0, location: row.location,
        country: criterion.country, method: criterion.method, criterion: criterion.criterion,
        url: expectedUrl, sha256: createHash('sha256').update(response.html).digest('hex'),
        verifiedAt: new Date().toISOString(), originalPrimaryAddress: structuredClone(row.address ?? null) }
      proofs.push(proof)
      records[index] = { ...row,
        address: { ...(row.address || {}), postalAddress: { ...postal(row.address), addressCountry: proof.country } },
        primaryCountryScopeEvidence: { method: proof.method, source: provider.source, jobId: row.id,
          locationIndex: 0, url: expectedUrl, sha256: proof.sha256, country: proof.country,
          originalAddressCountry: postal(row.address).addressCountry ?? null },
      }
    } catch (error) {
      signal?.throwIfAborted()
      failures.push({ jobId: row.id, reason: error.message })
    }
  }
  return { payload: proofs.length ? { ...payload, jobs: records } : payload, proofs, failures, pagesFetched }
}
