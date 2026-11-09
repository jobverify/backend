import assert from 'node:assert/strict'
import test from 'node:test'
import { readNativeDocument } from '../scraper-support/utils/activeNativeHtml.js'
import { literalRecruitmentPageData, phenomRecruitmentLinks, phenomRecruitmentRole } from '../scraper-support/utils/recruitmentPageData.js'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../scraper-support/utils/verifiedRecruitment.js'

const config = { refNum: 'EXAMPLE1', siteType: 'external', baseDomain: 'https://example.test', baseUrl: 'https://example.test/us/en/', widgetApiEndpoint: 'https://example.test/widgets' }
const siteConfig = { status: 'success', data: { refNum: 'EXAMPLE1', urlMap: { 'search-results': 'search-results' } } }
const html = (app = config, ddo = { siteConfig }) => `<script>var phApp = phApp || ${JSON.stringify(app)}; phApp.ddo = ${JSON.stringify(ddo)};</script>`
const document = content => readNativeDocument(content)

test('reads top-level literal Phenom configuration and its published search route', () => {
  const data = literalRecruitmentPageData(document(html()), 'phApp')
  assert.equal(data.config.refNum, 'EXAMPLE1')
  assert.deepEqual(phenomRecruitmentLinks(document(html()), 'https://example.test/us/en/').links, ['https://example.test/us/en/search-results'])
})

for (const [label, content] of [
  ['comment', `<!-- ${html()} -->`], ['hidden', `<div hidden>${html()}</div>`], ['template', `<template>${html()}</template>`],
  ['string', `<script>const example = ${JSON.stringify(html())};</script>`],
  ['deferred function', `<script>function example(){var phApp=${JSON.stringify(config)};phApp.ddo=${JSON.stringify({siteConfig})};}</script>`],
]) test('does not use ' + label + ' as active page configuration', () => {
  assert.equal(literalRecruitmentPageData(document(content), 'phApp'), null)
})

for (const content of [
  `<script>var phApp = getConfig();</script>`,
  `<script>var phApp = {refNum:'EXAMPLE1',refNum:'OTHER'};</script>`,
  html() + html(),
  `<script>var phApp = {...other};</script>`,
  `<script>var phApp = {refNum:'EXAMPLE1',baseUrl:location.href};</script>`,
]) test('rejects ambiguous or executable configuration ' + content.slice(0, 60), () => {
  assert.throws(() => literalRecruitmentPageData(document(content), 'phApp'), /literal|ambiguous|duplicate/i)
})

test('refuses cross-origin or mismatched Phenom account declarations', () => {
  for (const app of [{ ...config, baseUrl: 'https://other.test/us/en/' }, { ...config, widgetApiEndpoint: 'https://other.test/widgets' }, { ...config, refNum: 'OTHER' }]) {
    assert.throws(() => phenomRecruitmentLinks(document(html(app)), 'https://example.test/us/en/'), /Phenom/)
  }
})

test('discovers only published external native role URLs without treating locale as country evidence', () => {
  const applyUrl = 'https://example.wd1.myworkdayjobs.com/External/job/London/Engineer_R1/apply'
  const ddo = { siteConfig, eagerLoadRefineSearch: { status: 200, hits: 1, totalHits: 1, data: { jobs: [{ jobId: 'R1', title: 'Engineer', siteType: 'external', visibilityType: 'External', applyUrl, country: 'United Kingdom' }] } } }
  const result = phenomRecruitmentLinks(document(html({ ...config, country: 'in' }, ddo)), 'https://example.test/us/en/search-results')
  assert.deepEqual(result.nativeRoles, [applyUrl])
  assert.equal(result.reportedTotal, 1)
  assert.equal(result.countryProof, false)
  ddo.eagerLoadRefineSearch.data.jobs[0].visibilityType = 'Internal'
  assert.deepEqual(phenomRecruitmentLinks(document(html(config, ddo)), 'https://example.test/us/en/search-results').nativeRoles, [])
})

test('on CXS 422 resolves the same account from the current published Workday configuration', async () => {
  const root = 'https://vhr-example.wd1.myworkdayjobs.com/External'
  const source = { source: 'example', companyName: 'Example', companyDomain: 'example.test', companyCareerPage: 'https://example.test/careers' }
  const calls = []
  const result = await createVerifiedRecruitmentScraper(source).run({ fetchPage: async url => ({ status: 200, url,
    html: url === root ? '<script>window.workday = window.workday || {tenant:"vhr_example",siteId:"External",locale:"ja-JP"};</script>' : `<h1>Example Careers</h1><a href="${root}">Jobs</a>` }),
    fetchJson: async url => {
      calls.push(url)
      if (url.includes('/vhr-example/')) throw Error('Recruitment HTTP 422')
      assert.equal(url, 'https://vhr-example.wd1.myworkdayjobs.com/wday/cxs/vhr_example/External/jobs')
      return { total: 0, jobPostings: [] }
    } })
  assert.equal(result.length, 0)
  assert.equal(calls.length, 2)
  assert.equal(result[RECRUITMENT_OBSERVATIONS].nativeInventoryReads[0].kind, 'workday')
  assert.equal(result[RECRUITMENT_OBSERVATIONS].nativeAccountConfiguration.tenant, 'vhr_example')
})

test('a different Workday account or site cannot authorize a retry', async () => {
  for (const settings of [{tenant:'different',siteId:'External'}, {tenant:'vhr_example',siteId:'Other'}]) {
    let requests = 0
    await assert.rejects(createVerifiedRecruitmentScraper({source:'example',companyName:'Example',companyDomain:'example.test',companyCareerPage:'https://example.test/careers'}).run({
      fetchPage: async url => ({status:200,url,html:url.includes('myworkdayjobs.com') ? `<script>window.workday=${JSON.stringify(settings)};</script>` : '<h1>Example Careers</h1><a href="https://vhr-example.wd1.myworkdayjobs.com/External">Jobs</a>'}),
      fetchJson: async () => { requests++; throw Error('Recruitment HTTP 422') },
    }), error => error.failureKind === 'coverage_gap')
    assert.equal(requests, 1)
  }
})

test('Workday reads only literal routing fields without evaluating unrelated geo-IP expressions', () => {
  const result = literalRecruitmentPageData(document('<script>window.workday=window.workday||{tenant:"vhr_example",siteId:"External",geoIpCountryCode:window.location?"IN":"US"};</script>'), 'workday')
  assert.deepEqual(result.config,{tenant:'vhr_example',siteId:'External'})
  assert.throws(()=>literalRecruitmentPageData(document('<script>window.workday={tenant:getTenant(),siteId:"External"};</script>'),'workday'),/literal/)
})

test('an active HTTP 200 Forbidden Access page remains an access failure', async () => {
  await assert.rejects(createVerifiedRecruitmentScraper({source:'example',companyName:'Example',companyDomain:'example.test',companyCareerPage:'https://example.test/careers'}).run({
    fetchPage: async url => ({status:200,url,html:'<title>Forbidden Access</title><p class="status-code">FORBIDDEN ACCESS</p><p>Sorry, you do not have access to this page.</p>'}),
  }), error => error.recruitmentObservations.failures.some(f=>/access.denied/i.test(f.message)))
})

const fullDescription='<p>Develop reliable production software, collaborate on technical designs, maintain distributed systems, investigate incidents and improve the performance and availability of our services.</p>'
const nativeRole={jobId:'R1',title:'Engineer',siteType:'external',visibilityType:'External',country:'India',companyName:'Example',description:fullDescription,uniqueValue:{jobId:'R1',refNum:'EXAMPLE1',siteType:'external'},postedDate:'2026-11-01T00:00:00Z'}
const roleDocument=(job=nativeRole)=>document(html({...config,pageName:'job'},{siteConfig,jobDetail:{status:200,hits:1,totalHits:1,data:{job}}}))
test('reads full native Phenom role data with exact account and public role identity',()=>{
  const role=phenomRecruitmentRole(roleDocument(),'https://example.test/us/en/job/R1/Engineer')
  assert.equal(role.description,fullDescription)
  assert.equal(role.employer.name,'Example')
  assert.equal(role.country,'India')
  assert.equal(role.posted,nativeRole.postedDate)
  assert.deepEqual(role.record,nativeRole)
})
for(const [label,changes]of [['other account',{uniqueValue:{...nativeRole.uniqueValue,refNum:'OTHER'}}],['changed identity',{jobId:'R2'}],['internal role',{visibilityType:'Internal'}],['inferred country',{country:'Bengaluru'}],['contradictory native countries',{standardisedCountry:'United States'}]])test('refuses Phenom '+label,()=>{
  assert.throws(()=>phenomRecruitmentRole(roleDocument({...nativeRole,...changes}),'https://example.test/us/en/job/R1/Engineer'),/Phenom/)
})
