import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { readNativeDocument } from '../scraper-support/utils/activeNativeHtml.js'
import { declaredPyjamaRecruitment, readPyjamaRecruitment } from '../scraper-support/utils/recruitmentPyjama.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-pyjama-kukufm-20261111.json.gz', import.meta.url))))
const captures = new Map(fixture.responses.map(response => {
  const body = Buffer.from(response.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'), response.sha256)
  return [response.requestedURL, { ...response, html: body.toString('utf8') }]
}))
const publisherURL = 'https://kukuapp.in/careers/open-roles/'
const boardURL = 'https://app.pyjamahr.com/careers?company=Kuku%20FM&company_uuid=8B92017E1E&isHeaderVisible=true&is_careers_page=true'
const listURL = 'https://api.pyjamahr.com/api/career/jobs/?company_uuid=8B92017E1E&page=1&is_careers_page=true'
const firstDetailURL = 'https://api.pyjamahr.com/api/career/jobs/425673/?company_uuid=8B92017E1E&is_careers_page=false'
const firstRoleURL = 'https://app.pyjamahr.com/careers?company=Kuku%20FM&job_id=425673&company_uuid=8B92017E1E&utm_source=DIRECT&source=DIRECT&isHeaderVisible=true'
const ids = [425673, 425392, 425389, 425354, 424561]
const config = { source: 'kukufm', companyName: 'Kuku FM', companyDomain: 'kukuapp.in',
  companyCareerPage: publisherURL, officialHomepageUrl: 'https://kukuapp.in/' }
const page = (url, html = captures.get(url).html) => ({ status: 200, url, html })
const nativeModel = html => JSON.parse(readNativeDocument(html).nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__')[0].raw)
const editModel = (html, edit) => {
  const raw = readNativeDocument(html).nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__')[0].raw
  const data = JSON.parse(raw); edit(data)
  return html.replace(raw, JSON.stringify(data))
}
const descriptor = html => declaredPyjamaRecruitment(page(publisherURL, html), config)
const replay = (changes = {}) => {
  const jobs = [], records = [], inventories = [], unresolved = [], exclusions = [], calls = [], counts = new Map()
  const read = async (url, init = {}, format = 'page') => {
    calls.push({ url, init, format }); const count = (counts.get(url) || 0) + 1; counts.set(url, count)
    const capture = captures.get(url); assert.ok(capture, 'Unadvertised request: ' + url)
    let response = { status: capture.status, url: capture.finalURL, html: capture.html }
    response = changes.response?.(url, response, count, format) ?? response
    return format === 'json' ? JSON.parse(response.html) : response
  }
  return { jobs, records, inventories, unresolved, exclusions, calls, options: {
    readPage: read, readRenderer: (url, init) => read(url, init, 'renderer'), readJson: (url, init) => read(url, init, 'json'),
    permit: () => {}, matchingEmployer: name => name === 'Kuku FM', addJob: row => jobs.push(row),
    recordRead: row => records.push(row), inventoryRead: row => inventories.push(row),
    unresolved: reason => unresolved.push(reason), exclude: row => exclusions.push(row),
    maxPages: 8, maxDetails: 5, now: '2026-11-11T03:30:00.000Z',
    canRead: () => calls.length < 48, remainingRequests: () => 48 - calls.length, ...changes.options,
  } }
}
const changeFirstRoleEvidence = mutate => (url, response, count, format) => {
  if (format === 'json') {
    const payload = JSON.parse(response.html)
    if (url === firstDetailURL) mutate(payload)
    else if (new URL(url).pathname === '/api/career/jobs/') {
      const row = payload.results.find(row => row.id === ids[0])
      if (row) mutate(row)
    }
    return { ...response, html: JSON.stringify(payload) }
  }
  return url === firstRoleURL ? { ...response, html: editModel(response.html, model => mutate(model.props.pageProps.job)) } : response
}

test('current corporate handoff and native SSR bind five real Kuku FM India jobs while retaining all 79 native observations', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Captured Pyjama tests forbid uncontrolled HTTP'))
  const r = replay(), declared = descriptor()
  assert.ok(declared, 'The active current corporate Pyjama handoff must be discovered')
  await readPyjamaRecruitment(declared, r.options)
  assert.deepEqual(r.jobs.map(job => Number(job.id)), ids)
  assert.equal(r.records.length, 79)
  assert.equal(r.inventories[0].reportedTotal, 79)
  assert.equal(r.inventories[0].pagesFetched, 8)
  assert.equal(r.inventories[0].sourceScopeComplete, false)
  assert.equal(r.inventories[0].listingComplete, false)
  assert.equal(r.inventories[0].lifecycleCleanupAllowed, false)
  for (const job of r.jobs) {
    const original = JSON.parse(captures.get('https://api.pyjamahr.com/api/career/jobs/' + job.id + '/?company_uuid=8B92017E1E&is_careers_page=false').html)
    assert.ok(job.description.startsWith(original.description), 'Full original HTML must remain intact')
    for (const skill of original.skill) assert.ok(job.description.includes(skill), 'Published skill must remain available')
    assert.deepEqual(job.record.nativeDetail, original)
    assert.deepEqual(job.record.publicRoleSSRJob, original)
    assert.equal(job.employer.name, 'Kuku FM')
    assert.equal(job.employerBinding.legalEmployer, null)
    assert.equal(job.legalEmployer, null)
    assert.equal(job.posted, null, 'Creation time must not be invented as publication')
    assert.equal(job.closing, original.valid_through)
    assert.equal(job.record.nativeCreatedAt, original.created_at)
    assert.equal(job.record.nativeClosingContext.currentPublisherHandoffRechecked, true)
    assert.equal(job.record.nativeClosingContext.allSelectedListingPagesRechecked, true)
    assert.equal(r.calls.filter(call => call.url === job.url).length, 2)
  }
  assert.ok(r.calls.length <= 48)
})

for (const [name, change] of [
  ['a hidden corporate iframe', html => html.replace('<iframe ', '<iframe hidden ')],
  ['a different board company label', html => html.replace('company=Kuku%20FM', 'company=Unrelated')],
  ['an unbound recruiting hostname', html => html.replace('app.pyjamahr.com/careers', 'other.example/careers')],
]) test('does not bind ' + name, () => {
  assert.equal(descriptor(change(captures.get(publisherURL).html)), null)
})

test('native SSR employer identity must match the exact current corporate handoff', async () => {
  const r = replay({ response: (url, response) => url === boardURL
    ? { ...response, html: editModel(response.html, model => { model.props.pageProps.companyDetails.name = 'Another Employer' }) } : response })
  await assert.rejects(readPyjamaRecruitment(descriptor(), r.options), /employer|company.*identity/i)
  assert.equal(r.jobs.length, 0)
})

for (const [name, mutate, expected] of [
  ['a different detail ID', row => { row.id = 1 }, /identity/i],
  ['an unrelated employer domain', row => { row.email_domain = 'other.example' }, /employer|domain/i],
  ['an explicit conflicting country', row => { row.country = 'United States' }, /country/i],
  ['a missing full description', row => { row.description = '' }, /description|criteria/i],
  ['an internal role', row => { row.published_internally = true }, /internal|public/i],
]) test('rejects ' + name + ' before staged jobs are exposed', async () => {
  const r = replay({ response: (url, response) => {
    if (url !== firstDetailURL) return response
    const row = JSON.parse(response.html); mutate(row); return { ...response, html: JSON.stringify(row) }
  } })
  await assert.rejects(readPyjamaRecruitment(descriptor(), r.options), expected)
  assert.equal(r.jobs.length, 0)
})

test('complete public SSR role content must reconcile with the native detail API', async () => {
  const r = replay({ response: (url, response) => url === firstRoleURL
    ? { ...response, html: editModel(response.html, model => { model.props.pageProps.job.description += '<p>Changed native criterion</p>' }) } : response })
  await assert.rejects(readPyjamaRecruitment(descriptor(), r.options), /SSR.*(?:detail|content)|detail.*SSR/i)
  assert.equal(r.jobs.length, 0)
})

test('a public application link cannot change native employer accounts', async () => {
  const r = replay({ response: (url, response) => url === firstRoleURL
    ? { ...response, html: response.html.replace('company_uuid=8B92017E1E&amp;utm_source=DIRECT&amp;source=DIRECT&amp;isHeaderVisible=true&amp;apply_now=true',
      'company_uuid=OTHER&amp;utm_source=DIRECT&amp;source=DIRECT&amp;isHeaderVisible=true&amp;apply_now=true') } : response })
  await assert.rejects(readPyjamaRecruitment(descriptor(), r.options), /application|Apply/i)
  assert.equal(r.jobs.length, 0)
})

test('native expired roles are observed and excluded without inventing an empty source', async () => {
  const expiry = '2026-11-10T03:30:00.000000+05:30'
  const r = replay({ response: (url, response) => {
    if (url === firstDetailURL) { const row = JSON.parse(response.html); row.valid_through = expiry; return { ...response, html: JSON.stringify(row) } }
    if (url === firstRoleURL) return { ...response, html: editModel(response.html, model => { model.props.pageProps.job.valid_through = expiry }) }
    return response
  } })
  await readPyjamaRecruitment(descriptor(), r.options)
  assert.equal(r.jobs.length, 4)
  assert.equal(r.records.length, 79)
  assert.ok(r.exclusions.some(row => row.reason === 'native-role-expired' && Number(row.id) === 425673))
  assert.equal(r.inventories[0].listingComplete, false)
})

test('publisher company country metadata cannot qualify explicitly foreign native jobs', async () => {
  const r = replay({ response: (url, response, count, format) => {
    if (format !== 'json' || !new URL(url).pathname.endsWith('/api/career/jobs/')) return response
    const payload = JSON.parse(response.html); for (const row of payload.results) row.country = 'United States'
    return { ...response, html: JSON.stringify(payload) }
  } })
  await readPyjamaRecruitment(descriptor(), r.options)
  assert.equal(r.jobs.length, 0)
  assert.equal(r.records.length, 79)
  assert.equal(r.inventories[0].listingComplete, false)
})

for (const [name, change, expected] of [
  ['a foreign next page', payload => { payload.next = 'https://other.example/jobs?page=2' }, /pagination|next.*page/i],
  ['a cycling next page', payload => { payload.next = listURL }, /pagination|next.*page/i],
]) test('rejects ' + name + ' without reading it', async () => {
  const r = replay({ response: (url, response) => {
    if (url !== listURL) return response
    const payload = JSON.parse(response.html); change(payload); return { ...response, html: JSON.stringify(payload) }
  } })
  await assert.rejects(readPyjamaRecruitment(descriptor(), r.options), expected)
  assert.equal(r.jobs.length, 0)
})

test('closing native detail drift invalidates the complete staged result', async () => {
  const r = replay({ response: (url, response, count) => {
    if (url !== firstDetailURL || count !== 2) return response
    const row = JSON.parse(response.html); row.created_at = '2026-11-07T12:45:28.736770+05:30'
    return { ...response, html: JSON.stringify(row) }
  } })
  await assert.rejects(readPyjamaRecruitment(descriptor(), r.options), /closing.*(?:detail|role)|native.*changed/i)
  assert.equal(r.jobs.length, 0)
})

test('closing native listing drift invalidates the complete staged result', async () => {
  const r = replay({ response: (url, response, count) => {
    if (url !== listURL || count !== 2) return response
    const payload = JSON.parse(response.html); payload.results[0].location = 'Another location'
    return { ...response, html: JSON.stringify(payload) }
  } })
  await assert.rejects(readPyjamaRecruitment(descriptor(), r.options), /closing.*listing|listing.*changed/i)
  assert.equal(r.jobs.length, 0)
})

test('closing native board employer drift invalidates the complete staged result', async () => {
  const r = replay({ response: (url, response, count) => url === boardURL && count === 2
    ? { ...response, html: editModel(response.html, model => { model.props.pageProps.companyDetails.uuid = '0000000000' }) } : response })
  await assert.rejects(readPyjamaRecruitment(descriptor(), r.options), /company.*identity|board.*changed|employer/i)
  assert.equal(r.jobs.length, 0)
})

test('closing corporate handoff drift invalidates the complete staged result', async () => {
  const r = replay({ response: (url, response) => url === publisherURL
    ? { ...response, html: response.html.replace('company_uuid=8B92017E1E', 'company_uuid=0000000000') } : response })
  await assert.rejects(readPyjamaRecruitment(descriptor(), r.options), /closing.*publisher|handoff/i)
  assert.equal(r.jobs.length, 0)
})

test('unreviewed active native renderer code cannot authorize API or public-role derivation', async () => {
  const r = replay({ response: (url, response, count, format) => format === 'renderer'
    ? { ...response, html: response.html + '\n// changed' } : response })
  await assert.rejects(readPyjamaRecruitment(descriptor(), r.options), /renderer/i)
  assert.equal(r.jobs.length, 0)
})

test('the read budget reserves all closing checks before selecting native details', async () => {
  const r = replay({ options: { canRead: () => r.calls.length < 32, remainingRequests: () => 32 - r.calls.length } })
  await readPyjamaRecruitment(descriptor(), r.options)
  assert.deepEqual(r.jobs.map(job => Number(job.id)), [425673, 425392])
  assert.equal(r.records.length, 79)
  assert.ok(r.unresolved.includes('native-detail-budget-reached'))
  assert.ok(r.calls.length <= 32)
})

test('an already depleted read budget refuses work before invoking transport', async () => {
  const r = replay({ options: { canRead: () => false, remainingRequests: () => 0 } })
  await assert.rejects(readPyjamaRecruitment(descriptor(), r.options), /budget/i)
  assert.equal(r.calls.length, 0)
})

test('a 16-request wrapper with three prior reads can retain one real role and an explicitly partial native prefix', async () => {
  const r = replay({ options: { maxPages: 6, maxDetails: 8,
    canRead: () => r.calls.length < 13, remainingRequests: () => 13 - r.calls.length } })
  await readPyjamaRecruitment(descriptor(), r.options)
  assert.deepEqual(r.jobs.map(job => Number(job.id)), [425673])
  assert.equal(r.records.length, 10)
  assert.equal(r.inventories[0].reportedTotal, 79)
  assert.equal(r.inventories[0].pagesFetched, 1)
  assert.equal(r.inventories[0].listingComplete, false)
  assert.ok(r.unresolved.includes('native-listing-budget-reached'))
  assert.ok(r.calls.length <= 13)
  assert.equal(r.jobs[0].record.nativeClosingContext.allSelectedListingPagesRechecked, true)
})

test('complete criteria preserve every current native screening question, mandatory flag, answer choice and question label', async () => {
  const r = replay()
  await readPyjamaRecruitment(descriptor(), r.options)
  for (const id of [425392, 425389, 425354]) {
    const job = r.jobs.find(job => Number(job.id) === id)
    const doc = readNativeDocument(job.description), description = doc.text(doc.nodes(node => node.tag === 'root')[0])
    assert.ok(job.record.nativeDetail.job_screening_questions.length > 0)
    for (const question of job.record.nativeDetail.job_screening_questions) {
      assert.ok(description.includes(question.question), 'Missing exact native question: ' + question.question)
      assert.ok(description.includes(question.label), 'Missing exact native question label')
      assert.ok(description.includes('Mandatory ' + question.mandatory), 'Missing native mandatory flag')
      for (const choice of question.choices) assert.ok(description.includes(choice), 'Missing native answer choice')
    }
  }
  assert.ok(r.jobs.find(job => Number(job.id) === 425392).description.includes('Will you be able to join us from 23rd November?'))
  assert.ok(r.jobs.find(job => Number(job.id) === 425354).description.includes('Can you join us from 12th November?'))
})

for (const [name, mutate] of [
  ['a missing screening envelope', detail => { delete detail.job_screening_questions }],
  ['a new screening question type', detail => { detail.job_screening_questions = [{ uuid: '1234567890', name: 'upload', label: 'Upload', question: 'Supply a portfolio', choices: [], mandatory: true, maximum_range: null, minimum_range: null, open_range: null }] }],
  ['a changed mandatory value type', detail => { detail.job_screening_questions = [{ uuid: '1234567890', name: 'single_text', label: 'Single Line text', question: 'Supply a portfolio', choices: [], mandatory: 'true', maximum_range: null, minimum_range: null, open_range: null }] }],
  ['an unreviewed numeric screening range', detail => { detail.job_screening_questions = [{ uuid: '1234567890', name: 'single_text', label: 'Single Line text', question: 'Supply a portfolio', choices: [], mandatory: true, maximum_range: 5, minimum_range: null, open_range: null }] }],
  ['an additional unreviewed screening criterion', detail => { detail.job_screening_questions = [{ uuid: '1234567890', name: 'single_text', label: 'Single Line text', question: 'Supply a portfolio', choices: [], mandatory: true, maximum_range: null, minimum_range: null, open_range: null, restriction: 'Published criterion requires review' }] }],
]) test('rejects ' + name + ' rather than dropping application criteria', async () => {
  const r = replay({ response: changeFirstRoleEvidence(mutate) })
  await assert.rejects(readPyjamaRecruitment(descriptor(), r.options), /screening|question|criteria/i)
  assert.equal(r.jobs.length, 0)
})

test('an explicit foreign primary location cannot agree with typed India on all public role surfaces', async () => {
  const r = replay({ response: changeFirstRoleEvidence(role => { role.location = 'New York, United States' }) })
  await assert.rejects(readPyjamaRecruitment(descriptor(), r.options), /country|location/i)
  assert.equal(r.jobs.length, 0)
})

test('typed India remains the country proof when a primary city has no written country and additional locations remain unresolved', async () => {
  const r = replay({ response: changeFirstRoleEvidence(role => {
    role.location = 'Mumbai'; role.other_locations = ['New York, United States']
  }) })
  await readPyjamaRecruitment(descriptor(), r.options)
  assert.equal(r.jobs[0].location, 'Mumbai')
  assert.equal(r.jobs[0].record.nativeDetail.country, 'India')
  assert.equal(r.jobs[0].record.sourceAdditionalLocationCountryScopeUnresolved, true)
  assert.equal(r.inventories[0].sourceScopeComplete, false)
})

for (const [name, field, value] of [
  ['a nonexistent closing calendar day', 'valid_through', '2027-02-30T12:45:28.736770+05:30'],
  ['a nonexistent creation calendar day', 'created_at', '2026-02-29T12:45:28.736770+05:30'],
  ['an invalid native clock time', 'valid_through', '2027-01-05T24:45:28.736770+05:30'],
  ['an invalid native UTC offset', 'valid_through', '2027-01-05T12:45:28.736770+15:00'],
  ['an unreviewed native date fraction', 'valid_through', '2027-01-05T12:45:28.7367701+05:30'],
]) test('rejects ' + name + ' instead of normalizing a different native date', async () => {
  const r = replay({ response: changeFirstRoleEvidence(role => { role[field] = value }) })
  await assert.rejects(readPyjamaRecruitment(descriptor(), r.options), /date|calendar|offset/i)
  assert.equal(r.jobs.length, 0)
})

test('a real leap day and native six-digit fraction with UTC offset remain exact source dates', async () => {
  const expiry = '2028-02-29T12:45:28.736770+05:30'
  const r = replay({ response: changeFirstRoleEvidence(role => { role.valid_through = expiry }) })
  await readPyjamaRecruitment(descriptor(), r.options)
  assert.equal(r.jobs[0].closing, expiry)
  assert.equal(r.jobs[0].posted, null)
  assert.equal(r.jobs[0].record.nativeValidThrough, expiry)
})
