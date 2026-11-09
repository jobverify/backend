import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { run } from './script.js'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-applications-http-20261030.json.gz', import.meta.url))))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const rows = fixture.responses.map(row => {
  const body = Buffer.from(row.bodyBase64, 'base64')
  assert.equal(sha(body), row.receipt.sha256)
  assert.equal(body.length, row.receipt.bytes)
  return { ...row, text: body.toString('utf8') }
})
const corporate = rows.find(row => row.receipt.url === 'https://codemonk.io/careers')
const applications = rows.filter(row => row.receipt.url.includes('/apply?source=DIRECT'))
const nextData = html => JSON.parse(html.match(/<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1])
const byId = new Map()
for (const row of applications) {
  const props = nextData(row.text).props.pageProps
  if (!byId.has(props.jobDetails.uuid)) byId.set(props.jobDetails.uuid, { ...row, props })
}
const intern = '334DFAE413'
const currentQuestion = 'Have you worked as a Business Analyst, coordinating with stakeholders and creating BRDs, FRDs, user stories, or similar requirement documents? (This role focuses on requirements for software/product development, not Data Analytics or reporting.)'
globalThis.fetch = async () => { throw Error('Network disabled for CodeMonk native application tests') }

const execute = async ({ mutate, unavailable, runner = run, ...options } = {}) => {
  const requests = [], audits = []
  const jobs = await runner({
    fetchText: async (url, init) => {
      requests.push(String(url))
      if (url === corporate.receipt.url) return corporate.text
      const response = applications.find(row => row.receipt.url === url)
      assert.ok(response, 'Only authentic declared application URLs may be requested')
      if (unavailable?.(url)) throw Error('Native application unavailable')
      return mutate ? mutate(response.text, url, init) : response.text
    }, onAudit: audit => audits.push(audit), ...options,
  })
  return { jobs, audit: audits.at(-1), requests }
}
const mutateProps = edit => (html, url) => html.replace(/(<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/, (_all, open, literal, close) => {
  const data = JSON.parse(literal)
  edit(data, url)
  return open + JSON.stringify(data) + close
})

test('current native mandatory question replaces the stale screening output while preserving both originals', async () => {
  const { jobs, audit, requests } = await execute()
  const job = jobs.find(row => row.jobId === intern)
  assert.equal(job.sourceScreeningQuestions.find(row => row.uuid === 'F74574D41D').question, currentQuestion)
  assert.match(job.sourceCorporateScreeningQuestions.find(row => row.uuid === 'F74574D41D').question, /^Do you have prior experience/)
  assert.ok(job.sourceCriteriaDifferences.some(row => row.path.endsWith('/F74574D41D/question') && row.native === currentQuestion))
  assert.equal(requests.length, 9)
  assert.equal(new Set(requests).size, 9)
  assert.equal(audit.nativeApplications.length, 8)
})

test('all eight complete raw native form definitions, selected mandatory links and role props are retained', async () => {
  const { jobs } = await execute()
  assert.equal(jobs.length, 8)
  for (const job of jobs) {
    const expected = byId.get(job.jobId)
    assert.equal(job.sourceNativeApplication.originalNativeHTML, expected.text)
    assert.deepEqual(job.sourceNativeApplication.rawPageProps, expected.props)
    assert.deepEqual(job.sourceNativeCurrentRecord, expected.props.jobDetails)
    assert.deepEqual(job.sourceNativeApplicationFieldDefinitions, expected.props.applicationFormFields)
    assert.deepEqual(job.sourceNativeJobApplicationFields, expected.props.jobApplicationFormFields)
    assert.deepEqual(job.sourceScreeningQuestions, expected.props.jobDetails.job_screening_questions)
    assert.equal(job.sourceApplicationFields.length, expected.props.jobApplicationFormFields.length)
    assert.equal(job.sourceDeclaredCriteriaCopyComplete, true)
    assert.equal(job.sourceNativeApplicationActivationVerified, false)
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.postingDate, null)
    assert.equal(job.closingDate, null)
  }
})

test('listing-only data cannot claim complete details when native applications are unavailable', async () => {
  const { jobs, audit } = await execute({ unavailable: () => true })
  assert.equal(jobs.length, 8)
  assert.ok(jobs.every(row => row.sourceDetailComplete === false && row.sourceDeclaredCriteriaCopyComplete === false))
  assert.ok(jobs.every(row => row.jobDescription.length > 0 && row.sourceCorporateScreeningQuestions.length > 0))
  assert.equal(audit.nativeApplications.filter(row => row.error).length, 8)
})

test('one unavailable application retains the other seven complete criterion copies and the affected raw listing', async () => {
  const { jobs } = await execute({ unavailable: url => url === byId.get(intern).receipt.url })
  assert.equal(jobs.length, 8)
  assert.equal(jobs.filter(row => row.sourceDeclaredCriteriaCopyComplete).length, 7)
  assert.equal(jobs.find(row => row.jobId === intern).sourceDeclaredCriteriaCopyComplete, false)
  assert.ok(jobs.find(row => row.jobId === intern).sourceNativeRecord.job_screening_questions.length > 0)
})

test('foreign account props cannot supply current native screening or completeness', async () => {
  const { jobs } = await execute({ mutate: mutateProps(data => { data.props.pageProps.companyDetails.id = 13056 }) })
  assert.ok(jobs.every(row => row.sourceNativeApplication.bound === false && row.sourceDeclaredCriteriaCopyComplete === false))
  assert.ok(jobs.every(row => row.sourceDetailComplete === false))
})

test('changed query identity cannot bind an unrelated native application to a corporate vacancy', async () => {
  const { jobs } = await execute({ mutate: mutateProps(data => { data.query.jobId = 'unrelated-role' }) })
  assert.ok(jobs.every(row => row.sourceNativeApplication.bound === false))
  assert.ok(jobs.every(row => row.sourceDeclaredCriteriaCopyComplete === false))
})

test('native required flags with unknown types stay raw and revoke criterion completeness', async () => {
  const { jobs } = await execute({ mutate: mutateProps(data => { data.props.pageProps.jobDetails.job_screening_questions[0].mandatory = 'true' }) })
  assert.ok(jobs.every(row => row.sourceDetailComplete === false && row.sourceDeclaredCriteriaCopyComplete === false))
  assert.ok(jobs.every(row => row.sourceNativeApplication.rawPageProps.jobDetails.job_screening_questions[0].mandatory === 'true'))
})

test('unknown native conditional criteria survive without a complete-copy claim', async () => {
  const { jobs } = await execute({ mutate: mutateProps(data => { data.props.pageProps.jobDetails.job_screening_questions[0].unreviewed_rule = { required: true } }) })
  assert.ok(jobs.every(row => row.sourceDeclaredCriteriaCopyComplete === false))
  assert.ok(jobs.every(row => row.sourceNativeApplication.rawPageProps.jobDetails.job_screening_questions[0].unreviewed_rule.required))
})

test('missing selected native field definitions do not silently drop a mandatory control', async () => {
  const { jobs } = await execute({ mutate: mutateProps(data => { data.props.pageProps.applicationFormFields = [] }) })
  assert.ok(jobs.every(row => row.sourceDeclaredCriteriaCopyComplete === false))
  assert.ok(jobs.every(row => row.sourceNativeJobApplicationFields.length > 0))
})

test('unreviewed native input contracts remain raw instead of silently completing criteria', async () => {
  const { jobs } = await execute({ mutate: mutateProps(data => { data.props.pageProps.applicationFormFields[0].input_type = 'UNREVIEWED_LICENSE_CONTROL' }) })
  assert.ok(jobs.every(row => row.sourceDeclaredCriteriaCopyComplete === false))
  assert.ok(jobs.every(row => row.sourceNativeApplication.rawPageProps.applicationFormFields[0].input_type === 'UNREVIEWED_LICENSE_CONTROL'))
})

test('unsafe native numeric criteria cannot be qualified after JSON precision loss', async () => {
  const { jobs } = await execute({ mutate: mutateProps(data => { data.props.pageProps.jobDetails.max_salary = Number.MAX_SAFE_INTEGER + 1 }) })
  assert.ok(jobs.every(row => row.sourceDeclaredCriteriaCopyComplete === false))
  assert.ok(jobs.every(row => row.sourceNativeApplication.originalNativeHTML.includes('9007199254740992')))
})

test('hidden native description branches stay preserved without a complete criterion-copy claim', async () => {
  const { jobs } = await execute({ mutate: mutateProps(data => { data.props.pageProps.jobDetails.description = '<div hidden>' + data.props.pageProps.jobDetails.description + '</div>' }) })
  assert.ok(jobs.every(row => row.sourceDeclaredCriteriaCopyComplete === false))
  assert.ok(jobs.every(row => row.sourceNativeCurrentRecord.description.startsWith('<div hidden>')))
})

test('native primary country and explicit foreign location cannot reconcile to India', async () => {
  const { jobs } = await execute({ mutate: mutateProps(data => { data.props.pageProps.jobDetails.location = 'Austin, Texas, United States' }) })
  assert.ok(jobs.every(row => row.country === null && row.sourceDeclaredCriteriaCopyComplete === false))
  assert.ok(jobs.every(row => row.sourceNativeCurrentRecord.country === 'India'))
  assert.ok(jobs.every(row => row.sourceNativeCurrentRecord.location === 'Austin, Texas, United States'))
})

test('unresolved native geography cannot reenter the public India filter through the older corporate location', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'codemonk')
  const { jobs } = await execute({ runner: createCatalogScraper(provider).run,
    mutate: mutateProps(data => { data.props.pageProps.jobDetails.location = 'Austin, Texas, United States' }) })
  assert.ok(jobs.every(row => row.country === null && isIndiaJob(row) === false))
  assert.ok(jobs.every(row => row.sourceNativeRecord.location.endsWith('India') && row.sourceNativeCurrentRecord.location.endsWith('United States')))
})

for (const [name, edit] of [
  ['nullable placeholder contains an unknown schema', data => { data.props.pageProps.applicationFormFields[0].placeholder = { mandatory_license: 'License X' } }],
  ['layout grid contains an unknown schema', data => { data.props.pageProps.applicationFormFields[0].grid = { mandatory_license: 'License X' } }],
  ['employment type contains an unknown schema', data => { data.props.pageProps.jobDetails.job_type = { mandatory_license: 'License X' } }],
  ['salary visibility is not boolean', data => { data.props.pageProps.jobDetails.is_salary_visible = 'hidden' }],
  ['remote flag contradicts on-site workplace', data => { data.props.pageProps.jobDetails.remote = true }],
]) test(name + ' preserves raw data and revokes the reviewed-copy contract', async () => {
  const { jobs } = await execute({ mutate: mutateProps(edit) })
  assert.ok(jobs.every(row => row.sourceDeclaredCriteriaCopyComplete === false))
  assert.ok(jobs.every(row => row.sourceNativeApplication.schemaComplete === false && row.sourceDetailComplete === false))
})

for (const key of ['mandatory', '\\u006dandatory']) test('decoded duplicate JSON key ' + key + ' cannot silently weaken mandatory screening', async () => {
  const { jobs } = await execute({ mutate: html => html.replace('"mandatory":true', '"mandatory":true,"' + key + '":false') })
  assert.ok(jobs.every(row => row.sourceDeclaredCriteriaCopyComplete === false))
  assert.ok(jobs.every(row => row.sourceNativeApplication.bound === false))
  assert.ok(jobs.every(row => row.sourceNativeApplication.schemaIssues.some(issue => issue.startsWith('duplicate-native-json-key:'))))
  assert.ok(jobs.every(row => row.sourceNativeApplication.originalNativeHTML.includes('"mandatory":true,"' + key + '":false')))
})

test('contradictory native role country cannot borrow India from company billing country or corporate location', async () => {
  const { jobs } = await execute({ mutate: mutateProps(data => { data.props.pageProps.jobDetails.country = 'United States' }) })
  assert.ok(jobs.every(row => row.country === null && row.sourceDeclaredCriteriaCopyComplete === false))
  assert.ok(jobs.every(row => row.sourceNativeApplication.rawPageProps.companyDetails.country === 'Premium India'))
  assert.ok(jobs.every(row => row.sourceNativeRecord.country === 'India'))
})

test('inactive native JSON blocks remain raw and cannot be treated as activated form criteria', async () => {
  const { jobs } = await execute({ mutate: html => html.replace('id="__NEXT_DATA__"', 'hidden id="__NEXT_DATA__"') })
  assert.ok(jobs.every(row => row.sourceDeclaredCriteriaCopyComplete === false))
  assert.ok(jobs.every(row => row.sourceNativeApplication.originalNativeHTML.includes('hidden id="__NEXT_DATA__"')))
})

test('native HTML scripts are preserved as text and never executed', async () => {
  delete globalThis.__codemonkApplicationScript
  const { jobs } = await execute({ mutate: html => html.replace('</body>', '<script>globalThis.__codemonkApplicationScript = true</script></body>') })
  assert.equal(globalThis.__codemonkApplicationScript, undefined)
  assert.ok(jobs.every(row => row.sourceNativeApplication.originalNativeHTML.includes('__codemonkApplicationScript')))
  assert.ok(jobs.every(row => row.sourceDetailComplete === false))
})

test('registered execution keeps complete country/source/zero authority unresolved after native criterion reads', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'codemonk')
  const { jobs } = await execute({ runner: createCatalogScraper(provider).run })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(jobs.length, 8)
})

test('caller abort during a native application read propagates instead of returning partial success', async () => {
  const controller = new AbortController(), reason = Error('Stop native application')
  await assert.rejects(execute({ signal: controller.signal, mutate: html => { controller.abort(reason); return html } }), error => error === reason)
})

test('audit callback failure still propagates after native criteria preservation', async () => {
  const reason = Error('Audit failed')
  await assert.rejects(execute({ onAudit: () => { throw reason } }), error => error === reason)
})
