import assert from 'node:assert/strict'
import test from 'node:test'
import * as nisum from '../../scraper/nisum/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
const { createNisumScraper, extractIndiaJobsFromJobPostingsPayload, extractWidgetConfig,
  readNisumDescription, normalizeNisumDate, safeNisumUrl } = nisum

const config = { apiKey: 'public-test-widget', careerPortalId: 'public-test-portal' }
const widget = `<script src="https://jobsapi.ceipal.com/APISource/widget.js" data-ceipal-api-key="${config.apiKey}" data-ceipal-career-portal-id="${config.careerPortalId}"></script>`
const home = '<title>Nisum</title><a href="https://www.nisum.com/careers">Careers</a><h1>Building Success Together</h1>'
const careers = '<title>Global Careers | Nisum</title><h1>Careers</h1><p>Where Do You Want To Start Your Career?</p><a href="/careers/careers-india">India</a>'
const india = `<title>Careers India | Nisum</title><h1>Careers in India</h1><div id="current-openings"></div>${widget}`
const widgetClient = `var api_url = "https://careerapi.ceipal.com/"; var requestReferer = normalizeRefererHost(); $.ajax({url: api_url + "careerPortalWidget/", type: "GET", data: {apikey: apikey, cp_id: career_portal_id}, beforeSend: function(xhr) {xhr.setRequestHeader('X-Referer-Host', requestReferer)}}); function normalizeRefererHost(){return 'https://jobsapi.ceipal.com/';}`
const iframe = `https://jobsapi.ceipal.com/APISource/v3/index.html?bgcolor=0019fff&api_key=${config.apiKey}&cp_id=${config.careerPortalId}&job_id=`
const app = `const api_url = "https://careerapi.ceipal.com/"; var ajax_url = api_url + api_key + "/"; var api_prerequisites = ajax_url; fdata.append('page', page); fdata.append('api_key', api_key); fdata.append('method', "CareerPortalJobPostings"); fdata.append('cp_id', cp_id); fdata.append('from_career_portal', 1); $.ajax({url: api_prerequisites + 'CareerPortalJobPostings/?page=' + page, type: "POST", data: fdata});`
const fixture = ({ gate = {status:400,success:0,message:'Bot access is not allowed'}, deniedAt, listingStatus = 400 } = {}) => {
  const calls = []
  const fetchPage = async (url, init = {}) => {
    calls.push({url,method:init.method || 'GET',body:init.body,headers:init.headers})
    if (calls.length === deniedAt) return {status:403,url,text:'denied'}
    let text
    if (url === 'https://www.nisum.com/') text = home
    else if (url === 'https://www.nisum.com/careers') text = careers
    else if (url === 'https://www.nisum.com/careers/careers-india') text = india
    else if (url === 'https://jobsapi.ceipal.com/APISource/widget.js') text = widgetClient
    else if (new URL(url).pathname === '/careerPortalWidget/') text = JSON.stringify({html:`<iframe id="careers_api_source" src="${iframe}"></iframe>`})
    else if (url === iframe) text = '<script src="js/app.min.js"></script>'
    else if (url === 'https://jobsapi.ceipal.com/APISource/v3/js/app.min.js') text = app
    else if (/\/CareerPortalJobPostings\//.test(url)) return {status:listingStatus,url,text:JSON.stringify(gate)}
    else throw new Error('Unexpected fixture request')
    return {status:200,url,text}
  }
  return {calls,fetchPage,fetchText:async()=>{throw new Error('Legacy fixture transport must not access the network')},sleep:async()=>{},now:()=> '2026-10-27T03:39:25.243Z'}
}

test('Nisum preserves source HTML and comparison text while excluding invisible markup', () => {
  const html = '<h2>Requirements</h2><ul><li>Use 5 < 10 and 12 > 3.</li><li>C++ &amp; C#</li></ul><script>fake text</script><p hidden>hidden requirements</p>'
  const description = readNisumDescription(html)
  assert.match(description, /5 < 10 and 12 > 3/)
  assert.match(description, /Requirements\n/)
  assert.match(description, /C\+\+ & C#/)
  assert.doesNotMatch(description, /fake text|hidden requirements/)
  assert.doesNotThrow(() => readNisumDescription('&#99999999999; text'))
})

test('Nisum listing mapping is partial and does not invent country, requisition, work model or publication', () => {
  const native = {job_id:7,public_job_title:'Engineer',country:'India',city:'Hyderabad',created:'09/07/2026',modified:'2026-10-26',public_job_desc:'<h2>Work</h2><p>5 < 10 &amp; C++</p>',apply_job:'https://candidateportal.ceipal.com/login/test-job',campus_portal_job_details_url:'https://candidateportal.ceipal.com/job-details/test-job'}
  const rows = extractIndiaJobsFromJobPostingsPayload({results:[native,{...native,job_id:8,country:''},{...native,job_id:9,country:'United States'}]})
  assert.equal(rows.length,1)
  const row=rows[0]
  assert.equal(row.requisitionId,null)
  assert.equal(row.workplaceType,null)
  assert.equal(row.postingDate,null)
  assert.equal(row.originalPostingDate,null)
  assert.equal(row.nativeCreatedDate,'09/07/2026')
  assert.equal(row.modifiedDate,'2026-10-26')
  assert.equal(row.jobDescriptionHtml,native.public_job_desc)
  assert.equal(row.nativePostingFields.public_job_desc,native.public_job_desc)
  assert.match(row.jobDescription,/5 < 10/)
  assert.equal(row.sourceListingComplete,false)
  assert.equal(row.sourceDetailComplete,false)
  assert.equal(row.closingDate,null)
  assert.equal(extractIndiaJobsFromJobPostingsPayload({results:[{...native,remote_opportunities:''}]})[0].workplaceType,null)
  assert.equal(extractIndiaJobsFromJobPostingsPayload({results:[{...native,remote_opportunities:0}]})[0].workplaceType,'On-site')
  assert.equal(extractIndiaJobsFromJobPostingsPayload({results:[{...native,id:'opaque-native-record',created:'2026-10-27'}]})[0].requisitionId,null)
  assert.equal(extractIndiaJobsFromJobPostingsPayload({results:[{...native,created:'2026-10-27'}]})[0].postingDate,null)
})

test('Nisum dates require an explicit valid ISO source date, never a slash-date guess', () => {
  for (const value of ['09/07/2026','13/02/2026','2026-02-30','yesterday','']) assert.equal(normalizeNisumDate(value),null)
  assert.equal(normalizeNisumDate('2026-10-27'),'2026-10-27')
})

test('Nisum only binds one active widget from the official page', () => {
  assert.deepEqual(extractWidgetConfig(india),config)
  for (const value of [`<!--${widget}-->`,`<template>${widget}</template>`,`<div hidden>${widget}</div>`,`${widget}${widget}`]) assert.equal(extractWidgetConfig(value),null)
  assert.deepEqual(extractWidgetConfig(`<style>html {opacity:0}</style>${india}`),config)
})

test('Nisum safely labels public endpoint metadata without widget keys or query values', () => {
  const safe=safeNisumUrl(`https://careerapi.ceipal.com/${config.apiKey}/CareerPortalJobPostings/?cp_id=${config.careerPortalId}&page=1`)
  assert.doesNotMatch(safe,/public-test-widget|public-test-portal|page=1/)
  assert.match(safe,/CareerPortalJobPostings/)
})

test('Nisum follows the current advertised v3 chain and stops on the native bot gate', async () => {
  const options=fixture(), evidence=[]
  const jobs=await createNisumScraper().run({...options,onSourceEvidence:value=>evidence.push(value)})
  assert.equal(jobs.length,0)
  assert.equal(options.calls.length,8)
  assert.equal(options.calls.at(-1).method,'POST')
  assert.equal(options.calls.at(-1).body.get('method'),'CareerPortalJobPostings')
  assert.equal(options.calls.at(-1).headers?.Origin,undefined)
  assert.equal(options.calls.at(-1).headers?.Referer,undefined)
  const inventory=readInventoryEvidence(jobs)
  assert.equal(inventory.status,'coverage-gap')
  assert.equal(inventory.listingComplete,false)
  assert.equal(inventory.reportedTotal,null)
  assert.equal(inventory.indiaFacetCount,null)
  assert.match(inventory.reason,/bot-access-denied/)
  assert.equal(evidence[0].sourceExtractionImplemented,false)
  assert.equal(evidence[0].nativeGlobalCount,null)
  assert.equal(evidence[0].nativeIndiaCount,null)
  assert.equal(evidence[0].fullDescriptionCount,null)
  assert.doesNotMatch(JSON.stringify(evidence),/public-test-widget|public-test-portal/)
})

test('Nisum stops immediately on every native or first-party 401/403/429 boundary', async () => {
  for (let deniedAt=1;deniedAt<=8;deniedAt++) {
    const options=fixture({deniedAt}), jobs=await createNisumScraper().run(options)
    assert.equal(options.calls.length,deniedAt)
    assert.match(readInventoryEvidence(jobs).reason,/access-denied-403/)
  }
  for (const status of [401,429]) {
    const options=fixture({listingStatus:status}), jobs=await createNisumScraper().run(options)
    assert.equal(options.calls.length,8)
    assert.match(readInventoryEvidence(jobs).reason,new RegExp(`access-denied-${status}`))
  }
})

test('Nisum never reports successful summary rows as verified full native extraction', async () => {
  const options=fixture({listingStatus:200,gate:{count:0,num_pages:1,page_number:1,results:[]}})
  const jobs=await createNisumScraper().run(options)
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.match(readInventoryEvidence(jobs).reason,/native-detail-and-inventory-unverified/)
  assert.equal(options.calls.length,8)
})

test('Nisum registered catalog uses the hardened source and keeps the coverage gap through decoration', async () => {
  const provider=getScraperCatalog().find(value=>value.source==='nisum')
  assert.equal(provider.sourceExtractionImplemented,false)
  assert.equal(provider.nativeExtractionVerified,false)
  assert.equal(provider.fullInventoryVerified,false)
  assert.equal(provider.ceipalApiKey,null)
  assert.equal(provider.ceipalCareerPortalId,null)
  const jobs=await createCatalogScraper(provider).run(fixture())
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
