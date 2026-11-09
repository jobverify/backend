import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

globalThis.fetch = async () => { throw new Error('Unexpected global network request') }
const dd = await import('./script.js')
const fixture = name => readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8')
const record = JSON.parse(fixture('native-jobs-api.json'))[0]
const role = fixture('native-role.html')
const corporate = '<html><head><title>データ・デザイン｜3Dデータでワークフローを最適化</title></head><body><a href="https://recruit.datadesign.co.jp">採用情報</a></body></html>'
const hub = '<html><head><title>株式会社データ・デザイン採用サイト</title></head><body><h1>株式会社データデザイン採用サイト</h1><a href="/jobs/">募集要項</a><a href="/jobs/generalist">総合職</a></body></html>'
const archive = '<html><head><title>募集要項 – 株式会社データ・デザイン採用サイト</title></head><body class="post-type-archive-tj_job wp-theme-data-design-recruit-theme"><h1>募集要項</h1><a href="/jobs/generalist">総合職</a></body></html>'
const clone = value => structuredClone(value)
const withSchema = (html, change) => html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (_, a, json, b) => { const s = JSON.parse(json); change(s); return a + JSON.stringify(s) + b })
const response = (url, body, json = false, headers = {}) => ({ url, status: 200, contentType: json ? 'application/json; charset=UTF-8' : 'text/html; charset=UTF-8', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })
const transport = ({ records = [record], roleHtml = role, modify, pageSize = 100 } = {}) => {
  const requests = []
  const fetchPage = async (url, init) => {
    requests.push({ url, method: init.method })
    let r
    if (url === dd.HOMEPAGE_URL) r = response(url, corporate)
    else if (url === dd.RECRUIT_HOME_URL) r = response(url, hub)
    else if (url === dd.CAREERS_PAGE_URL) r = response(url, archive)
    else if (records.some(record => record.link === url)) {
      const posting = records.find(record => record.link === url)
      r = response(url, roleHtml.replaceAll(record.link, posting.link).replaceAll('postid-1114', 'postid-' + posting.id).replaceAll(dd.JOBS_API_URL + '/1114', dd.JOBS_API_URL + '/' + posting.id))
    }
    else if (url === 'https://job.mynavi.jp/27/pc/search/corp104502/outline.html') r = { ...response(url, '<html><title>株式会社データ・デザイン | マイナビ2027</title><body>会社概要</body></html>'), status: 403 }
    else if (url.startsWith(dd.JOBS_API_URL + '?')) {
      const page = Number(new URL(url).searchParams.get('page'))
      r = response(url, records.slice((page - 1) * pageSize, page * pageSize), true, { 'x-wp-total': String(records.length), 'x-wp-totalpages': String(Math.max(1, Math.ceil(records.length / pageSize))) })
    } else throw new Error('Unexpected public URL: ' + url)
    return modify ? modify(r, requests) : r
  }
  return { fetchPage, requests }
}

test('native full role preserves every visible criterion and keeps CMS identity distinct from requisition', () => {
  const job = dd.extractNativeJob(record, role, { now: '2026-10-27T06:00:00Z' })
  assert.equal(job.jobId, '1114')
  assert.equal(job.requisitionId, null)
  assert.equal(job.nativePostingSlug, 'generalist')
  assert.equal(job.country, 'Japan')
  assert.equal(job.city, '名古屋市')
  assert.equal(job.state, '愛知県')
  assert.equal(job.postingDate, '2026-05-01')
  assert.equal(job.closingDate, '2027-03-30')
  assert.equal(job.remoteStatus, 'On-site')
  assert.equal(job.sourceUrl, 'https://recruit.datadesign.co.jp/jobs/generalist')
  assert.equal(job.applyUrl, 'https://job.mynavi.jp/27/pc/search/corp104502/outline.html')
  assert.equal(job.applicationUrlIsGeneric, true)
  assert.equal(job.applicationUrlScope, 'company-profile')
  assert.equal(job.applicationPostingContext.nativePostingId, '1114')
  assert.equal(job.sourceClosingDateIsExact, false)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.minimumQualification, null)
  assert.equal(job.experienceRequired, null)
  assert.equal(job.requiredSkills, null)
  assert.ok(job.jobDescription.length > 2400)
  for (const expected of ['2027年3月に卒業見込みの方', '採用実績校', '39,000円(25時間分)', '年3回', '年間休日数', '120日', 'メンター制度', '入社後6カ月間（試用期間中は有期雇用）', '役員面接', '屋内禁煙']) assert.ok(job.jobDescription.includes(expected), expected)
  assert.ok(job.sourceNativeCriteria.sections.some(s => s.field === 'cf-recruitment-schools-new-grad' && s.value.includes('上智大学')))
  assert.equal(JSON.stringify(job).includes('pdf_export'), false)
  assert.equal(JSON.stringify(job).includes('_wpnonce'), false)
})

test('future explicitly typed India native roles extract real full criteria, country, dates and qualifications', () => {
  const r = clone(record)
  Object.assign(r.taro_jobs_fields_data.values, { job_location: 'Karnataka, Bengaluru', qualifications: '<p>Relevant engineering experience</p>', education_requirements: '<p>Engineering degree</p>', experience_requirements: '<p>2 years</p>', skills: '<ul><li>CAD</li><li>Python</li></ul>', requisition_id: 'DD-IN-27' })
  r.content.rendered = r.content.rendered.replace('tj-job-field__value--qualifications"></div>', 'tj-job-field__value--qualifications"><p>Relevant engineering experience</p></div>')
  for (const key of ['education_requirements', 'experience_requirements', 'skills']) {
    const field = key.replaceAll('_', '-')
    r.content.rendered += `<div class="wp-block-taro-jobs-job-field tj-job-field--${field}"><h2 class="tj-job-field__title--${field}">${key}</h2><div class="tj-job-field__value--${field}">${r.taro_jobs_fields_data.values[key]}</div></div>`
  }
  r.content.rendered += '<div class="wp-block-taro-jobs-job-field tj-job-field--requisition-id"><h2 class="tj-job-field__title--requisition-id">Requisition</h2><div class="tj-job-field__value--requisition-id">DD-IN-27</div></div>'
  const h = withSchema(role.replace(record.content.rendered, r.content.rendered), s => { s.jobLocation.address = { '@type': 'PostalAddress', addressCountry: 'IN', addressRegion: 'Karnataka', addressLocality: 'Bengaluru' } })
  const job = dd.extractNativeJob(r, h, { now: '2026-10-27T06:00:00Z' })
  assert.equal(job.country, 'India')
  assert.equal(job.location, 'Bengaluru, Karnataka, India')
  assert.equal(job.requisitionId, 'DD-IN-27')
  assert.equal(job.minimumQualification, 'Engineering degree')
  assert.equal(job.experienceRequired, '2 years')
  assert.deepEqual(job.requiredSkills, ['CAD', 'Python'])
  assert.equal(job.sourceDetailComplete, true)
  assert.ok(job.jobDescription.includes('入社後6カ月間'))
})

test('country evidence never defaults Japan or converts a contradictory, missing or foreign country into India', () => {
  for (const [country, want] of [['JP', 'Japan'], ['日本', 'Japan'], ['IN', 'India'], ['United States', 'United States'], [null, null], ['Atlantis', null]]) {
    const h = withSchema(role, s => { s.jobLocation.address.addressCountry = country })
    assert.equal(dd.extractNativeJob(record, h).country, want)
  }
  const r = clone(record); r.taro_jobs_fields_data.values.country = 'JP'
  assert.equal(dd.extractNativeJob(r, withSchema(role, s => { s.jobLocation.address.addressCountry = 'IN' })).country, null)
  const camel = clone(record); camel.taro_jobs_fields_data.values.countryCode = 'US'
  assert.equal(dd.extractNativeJob(camel, withSchema(role, s => { s.jobLocation.address.addressCountry = 'IN' })).country, null)
  const r2 = clone(record); r2.taro_jobs_fields_data.values.date_posted = ''
  assert.equal(dd.extractNativeJob(r2, withSchema(role, s => { delete s.datePosted })).postingDate, null)
})

test('full criteria decode entities once at text leaves and exclude hidden native content', () => {
  const r = clone(record)
  r.content.rendered += '<div><span><em>Keep &amp;lt;literal&amp;gt; and &lt;real&gt; &amp;amp; &#x26;#65;</em></span><p hidden>HIDDEN REQUIREMENT</p><p style="display:none">INERT</p></div>'
  const h = role.replace(record.content.rendered, r.content.rendered)
  const job = dd.extractNativeJob(r, h)
  assert.ok(job.jobDescription.includes('Keep &lt;literal&gt; and <real> &amp; &#65;'))
  assert.equal(job.jobDescription.includes('HIDDEN REQUIREMENT'), false)
  assert.equal(job.jobDescription.includes('INERT'), false)
})

test('short, mismatched, and uncertain native criteria are withheld instead of published as complete', () => {
  const shortened = clone(record); shortened.content.rendered = shortened.taro_jobs_fields_data.values.job_description
  assert.equal(dd.extractNativeJob(shortened, role).sourceDetailComplete, false)
  assert.equal(dd.extractNativeJob(shortened, role).jobDescription, null)
  const h = role.replace('</head>', '<style>.entry-content { display:var(--native-state) }</style></head>')
  assert.equal(dd.extractNativeJob(record, h).sourceDetailComplete, false)
  const custom = clone(record); custom.taro_jobs_fields_data.values.cf_unrendered_eligibility = '<p>Additional mandatory certification</p>'
  assert.equal(dd.extractNativeJob(custom, role).sourceDetailComplete, false)
  assert.throws(() => dd.extractNativeJob(record, role.replace('postid-1114', 'postid-2222')), /posting identity/i)
  assert.throws(() => dd.extractNativeJob(record, role.replace('<h1>総合職</h1>', '<h1>Different role</h1>')), /title/i)
})

test('unrelated nested decorative CSS cannot erase native visible criteria', () => {
  const css = '<style>.breadcrumb { padding: 0.5em; background-color: color-mix(in srgb, var(--color) 10%, transparent); &::before { content:""; transform:skew(-45deg); } }</style>'
  assert.equal(dd.extractNativeJob(record, role.replace('</head>', css + '</head>')).sourceDetailComplete, true)
})

test('native run closes primary inventory before the declared public profile and excludes current Japan role', async () => {
  const t = transport()
  const jobs = await dd.run({ fetchPage: t.fetchPage, now: () => '2026-10-27T06:00:00Z' })
  assert.equal(jobs.length, 0)
  const audit = jobs.nativeInventoryAudit
  assert.equal(audit.primaryNativeGlobal, 1)
  assert.equal(audit.confirmedPrimaryIndia, 0)
  assert.equal(audit.foreignPrimary, 1)
  assert.equal(audit.fullNativeDetails, 1)
  assert.equal(audit.primaryInventoryComplete, true)
  assert.equal(audit.wholeCompanyIndia, null)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.equal(audit.accessDenied, true)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(t.requests.every(r => r.method === 'GET'))
  assert.equal(t.requests.filter(r => r.url.startsWith(dd.JOBS_API_URL + '?')).length, 2)
  assert.equal(t.requests.at(-1).url, 'https://job.mynavi.jp/27/pc/search/corp104502/outline.html')
  assert.equal(t.requests.some(r => /registEntry|apply|submit|nonce/i.test(r.url)), false)
})

test('runtime returns future India data after full native checks even while additional channel remains partial', async () => {
  const h = withSchema(role, s => { s.jobLocation.address = { addressCountry: 'IN', addressRegion: 'Karnataka', addressLocality: 'Bengaluru' } })
  const t = transport({ roleHtml: h })
  const jobs = await dd.run({ fetchPage: t.fetchPage })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.ok(jobs[0].sourceDescription.includes('入社後6カ月間'))
  assert.equal(jobs.nativeInventoryAudit.fullHealthyIndia, 1)
  assert.equal(jobs.nativeInventoryAudit.eligibleIndia, 0)
  assert.equal(jobs.nativeInventoryAudit.eligibilityFilterCounts.old, 1)
})

test('native page counts and budgets are enforced before caps; repeated pages and closing changes cannot certify zero', async () => {
  const repeated = transport({ modify: r => r.url.startsWith(dd.JOBS_API_URL + '?') ? { ...r, headers: { 'x-wp-total': '101', 'x-wp-totalpages': '2' } } : r })
  await assert.rejects(dd.run({ fetchPage: repeated.fetchPage }), /pagination|count/i)
  const budget = transport({ pageSize: 1, modify: r => r.url.startsWith(dd.JOBS_API_URL + '?') ? { ...r, headers: { 'x-wp-total': '2', 'x-wp-totalpages': '2' } } : r })
  await assert.rejects(dd.run({ fetchPage: budget.fetchPage, pageSize: 1, maxPages: 1, maxJobs: 1 }), /budget/i)
  let calls = 0
  const changed = transport({ modify: r => {
    if (!r.url.startsWith(dd.JOBS_API_URL + '?') || ++calls === 1) return r
    const data = JSON.parse(r.body); data[0].modified = '2026-10-27T06:00:00'; return { ...r, body: JSON.stringify(data) }
  } })
  const jobs = await dd.run({ fetchPage: changed.fetchPage })
  assert.equal(jobs.nativeInventoryAudit.primaryInventoryComplete, false)
  assert.ok(jobs.nativeInventoryAudit.reasons.includes('closing-native-inventory-changed'))
  assert.equal(jobs.nativeInventoryAudit.lifecycleCleanupAllowed, false)
})

test('public denial, challenge and network failure stop immediately with no retry or alternate transport', async () => {
  for (const mode of [401, 403, 429, 'challenge', 'network']) {
    let calls = 0
    await assert.rejects(dd.run({ fetchPage: async url => {
      calls++
      if (mode === 'network') throw new Error('TLS failure')
      return { ...response(url, mode === 'challenge' ? '<html><title>Just a moment...</title></html>' : corporate), status: typeof mode === 'number' ? mode : 200 }
    } }), /denied|gate|TLS failure/i)
    assert.equal(calls, 1)
  }
})

test('two native pages are fully reconciled before an India output cap and duplicates fail closed', async () => {
  const second = clone(record); second.id = 2222; second.slug = 'generalist2'; second.link = 'https://recruit.datadesign.co.jp/jobs/generalist2'
  const roleHtml = withSchema(role, s => { s.jobLocation.address.addressCountry = 'IN' })
  const t = transport({ records: [record, second], roleHtml, pageSize: 1 })
  const jobs = await dd.run({ fetchPage: t.fetchPage, pageSize: 1, maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs.nativeInventoryAudit.primaryNativeGlobal, 2)
  assert.equal(jobs.nativeInventoryAudit.fullNativeDetails, 2)
  assert.equal(jobs.nativeInventoryAudit.fullHealthyIndia, 2)
  assert.equal(jobs.nativeInventoryAudit.pagesFetched, 4)
  assert.equal(jobs.nativeInventoryAudit.primaryInventoryComplete, true)
  assert.ok(jobs.nativeInventoryAudit.reasons.includes('source-job-limit'))
  const repeated = transport({ records: [record, clone(record)], pageSize: 1 })
  await assert.rejects(dd.run({ fetchPage: repeated.fetchPage, pageSize: 1 }), /duplicate native posting/i)
})

test('foreign/missing-country content and empty content cannot be counted as full healthy India', async () => {
  const h = withSchema(role, s => { delete s.jobLocation.address.addressCountry })
  const t = transport({ roleHtml: h })
  const jobs = await dd.run({ fetchPage: t.fetchPage })
  assert.equal(jobs.length, 0)
  assert.equal(jobs.nativeInventoryAudit.unknownCountry, 1)
  assert.equal(jobs.nativeInventoryAudit.fullHealthyIndia, 0)
  const bad = clone(record); bad.content.rendered = '<p>Short excerpt</p>'
  const t2 = transport({ records: [bad], roleHtml: withSchema(role, s => { s.jobLocation.address.addressCountry = 'IN' }) })
  const missing = await dd.run({ fetchPage: t2.fetchPage })
  assert.equal(missing.length, 0)
  assert.equal(missing.nativeInventoryAudit.confirmedPrimaryIndia, 1)
  assert.equal(missing.nativeInventoryAudit.fullHealthyIndia, 0)
})
