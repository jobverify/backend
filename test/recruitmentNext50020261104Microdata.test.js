import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativeDocument} from '../scraper-support/utils/activeNativeHtml.js'
import {recruitmentMicrodataPostings} from '../scraper-support/utils/recruitmentMicrodata.js'
import {createVerifiedRecruitmentScraper,RECRUITMENT_OBSERVATIONS} from '../scraper-support/utils/verifiedRecruitment.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/recruitmentNext50020261104/volvo-native-street-address.json.gz',import.meta.url))))
const url='https://example.test/job/Bangalore/1371387055/'
const description='Develop reliable production software services, collaborate with engineering teams on API designs, investigate incidents, and improve service performance and availability.'
const html=(street,{visible=street,country=null,extra=''}={})=>`<div itemscope itemtype="http://schema.org/JobPosting">
 <meta itemprop="hiringOrganization" content="Example"><h1><span itemprop="title">Software Engineer</span></h1>
 <span itemprop="jobLocation" itemscope><span itemprop="address" itemscope>
 <meta itemprop="streetAddress" content="${street}">${country===null?'':`<meta itemprop="addressCountry" content="${country}">`}
 </span></span><span class="jobGeoLocation">${visible}</span><div itemprop="description">${description}</div>${extra}</div>`
const parse=body=>recruitmentMicrodataPostings(readNativeDocument(body),url,{html:body})[0]
const bhp=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/recruitmentGoal20261104/bhp-country-only-quality.json.gz',import.meta.url))))

test('BHP own country-only worksite labels establish India without inventing a city',()=>{
 const roles=bhp.packets.filter(q=>q.requestedURL.includes('/job/'))
 assert.equal(roles.length,2)
 for(const q of roles){assert.equal(createHash('sha256').update(q.text).digest('hex'),q.bodySHA256);const row=recruitmentMicrodataPostings(readNativeDocument(q.text),q.finalURL,{html:q.text})[0]
  assert.deepEqual(row.nativeMicrodataIssues,[]);assert.equal(row.jobLocation[0].address.addressCountry,'India');assert.equal(row.jobLocation[0].address.addressLocality,null)
  assert.equal(row.jobLocation[0].address.streetAddress,'India');assert.equal(row.jobLocation[0].address.nativeAddressCountry,null);assert.equal(row.hiringOrganization.name,'BHP Career Portal');assert.ok(row.description.includes('About BHP'))
 }
})
test('matching full country-only worksite names normalize without a city or postal guess',()=>{
 for(const country of ['India','Indonesia','Canada','Australia','United Kingdom']){const row=parse(html(country));assert.deepEqual(row.nativeMicrodataIssues,[],country);assert.equal(row.jobLocation[0].address.addressCountry,country);assert.equal(row.jobLocation[0].address.addressLocality,null);assert.equal(row.jobLocation[0].address.streetAddress,country)}
})
test('country-only short codes, placeholders and city names cannot supply a normalized country',()=>{
 for(const label of ['IN','In','IND','USA','CA','Unknown','Bangalore','Gurgaon','']){const row=parse(html(label));assert.ok(row.nativeMicrodataIssues.length,label);assert.notEqual(row.jobLocation[0].address.addressCountry,'India',label)}
})
test('country-only worksite country requires every own visible label to agree',()=>{
 for(const body of [html('India',{visible:'France'}),html('India',{extra:'<span class="jobGeoLocation">France</span>'}),html('India',{country:'US'}),html('India').replace('class="jobGeoLocation"','hidden class="jobGeoLocation"'),html('Unknown',{extra:'<aside itemscope><span class="jobGeoLocation">India</span></aside>'})])assert.ok(parse(body).nativeMicrodataIssues.length)
})
test('country-only India proof survives registered-style collection with city left unknown',async()=>{
 const source={source:'example',companyName:'Example',companyDomain:'example.test',companyCareerPage:'https://example.test/careers'}
 const jobs=await createVerifiedRecruitmentScraper(source).run({fetchPage:async requested=>({status:200,url:requested,html:requested===url?html('India'):`<h1>Example Careers</h1><a href="${url}">Software Engineer</a>`})})
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].city,null);assert.equal(jobs[0].sourceDescription,description);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
test('country-only structured JobPosting also leaves city unknown instead of inventing Remote',async()=>{
 const posting={'@type':'JobPosting',title:'Software Engineer',url,description,hiringOrganization:{name:'Example'},jobLocation:{address:{addressCountry:'India'}}}
 const body=`<h1>Software Engineer</h1><div>${description}</div><script type="application/ld+json">${JSON.stringify(posting)}</script>`
 const source={source:'example',companyName:'Example',companyDomain:'example.test',companyCareerPage:'https://example.test/careers'}
 const jobs=await createVerifiedRecruitmentScraper(source).run({fetchPage:async requested=>({status:200,url:requested,html:requested===url?body:`<h1>Example Careers</h1><a href="${url}">Software Engineer</a>`})})
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].city,null);assert.equal(jobs[0].location,'India');assert.deepEqual(jobs[0].nativeSourceRecord,posting)
})
test('stylesheet-hidden country-only labels cannot establish worksite country',()=>{
 const body='<style>.jobGeoLocation{display:none}</style>'+html('India')
 const row=parse(body);assert.ok(row.nativeMicrodataIssues.length);assert.notEqual(row.jobLocation[0].address.addressCountry,'India')
})
test('country-only normalization needs the original stylesheet context',()=>{
 const row=recruitmentMicrodataPostings(readNativeDocument(html('India')),url)[0];assert.ok(row.nativeMicrodataIssues.length);assert.notEqual(row.jobLocation[0].address.addressCountry,'India')
})
test('a CSS-hidden country-only label cannot become a complete collected India role',async()=>{
 const body='<style>.jobGeoLocation{display:none}</style>'+html('India'),source={source:'example',companyName:'Example',companyDomain:'example.test',companyCareerPage:'https://example.test/careers'}
 const jobs=await createVerifiedRecruitmentScraper(source).run({fetchPage:async requested=>({status:200,url:requested,html:requested===url?body:`<h1>Example Careers</h1><a href="${url}">Software Engineer</a>`})})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-country-only-visible-worksite-unqualified'))
})
test('a changed anti-framing program cannot authorize ignoring its body-hiding stylesheet',()=>{
 const q=bhp.packets.find(q=>q.requestedURL.includes('/job/')),body=q.text.replace('self === top','self !== top');assert.notEqual(body,q.text);const row=recruitmentMicrodataPostings(readNativeDocument(body),q.finalURL,{html:body})[0];assert.ok(row.nativeMicrodataIssues.length);assert.notEqual(row.jobLocation[0].address.addressCountry,'India')
})
test('reviewed anti-framing removal cannot ignore a second country-hiding stylesheet',()=>{
 const q=bhp.packets.find(q=>q.requestedURL.includes('/job/')),body=q.text.replace('</head>','<style>.jobGeoLocation{display:none}</style></head>');assert.notEqual(body,q.text);const row=recruitmentMicrodataPostings(readNativeDocument(body),q.finalURL,{html:body})[0];assert.ok(row.nativeMicrodataIssues.length);assert.notEqual(row.jobLocation[0].address.addressCountry,'India')
})

test('the captured Volvo role owns its visible full worksite and retains the exact street address while resolving its country',()=>{
 assert.equal(createHash('sha256').update(capture.html).digest('hex'),capture.bodySHA256)
 const row=recruitmentMicrodataPostings(readNativeDocument(capture.html),capture.url)[0]
 assert.deepEqual(row.nativeMicrodataIssues,[])
 assert.equal(row.jobLocation[0].address.addressCountry,'India')
 assert.equal(row.jobLocation[0].address.streetAddress,'Bangalore, IN, 562122')
 assert.equal(row.jobLocation[0].address.addressLocality,'Bangalore')
 assert.equal(row.hiringOrganization.name,'Volvo Group')
 assert.ok(row.description.length>1000)
})

test('an own visible native street address can supply an explicit country name or a corroborated India code and PIN',()=>{
 for(const street of ['Bangalore, IN, 562122','Bengaluru, Karnataka, India, 560001','Bangalore, India']){
  const row=parse(html(street))
  assert.deepEqual(row.nativeMicrodataIssues,[])
  assert.equal(row.jobLocation[0].address.addressCountry,'India')
  assert.equal(row.jobLocation[0].address.streetAddress,street)
 }
})

test('an Indiana state, a missing PIN, an unknown city or a shortened Indonesian country cannot supply India',()=>{
 for(const street of ['Indianapolis, IN, 46204','Bangalore, IN','Bangalore, In, 562122','Jakarta, IN, 562122','Unknown place, IN, 562122','Bangalore, IN, 000000']){
  const row=parse(html(street))
  assert.notEqual(row.jobLocation[0].address.addressCountry,'India',street)
  assert.ok(row.nativeMicrodataIssues.length,street)
 }
})

test('unrelated, hidden, mismatched or conflicting workplace fields cannot donate country proof',()=>{
 const valid='Bangalore, IN, 562122'
 for(const body of [
  html(valid,{visible:'Mumbai, IN, 400001'}),
  html(valid).replace(`<span class="jobGeoLocation">${valid}</span>`,`<span hidden class="jobGeoLocation">${valid}</span>`),
  html('Unknown location',{extra:`<aside itemscope><span class="jobGeoLocation">${valid}</span></aside>`}),
  html(valid,{country:'US'}),
 ])assert.ok(parse(body).nativeMicrodataIssues.length)
})

test('an ordinary street address preserves an already explicit native country without requiring an RMK worksite label',()=>{
 for(const country of ['India','United States']){
  const body=html('100 Corporate Drive',{country}).replace(/<span class="jobGeoLocation">[^<]*<\/span>/,'')
  const row=parse(body)
  assert.deepEqual(row.nativeMicrodataIssues,[])
  assert.equal(row.jobLocation[0].address.addressCountry,country)
  assert.equal(row.jobLocation[0].address.streetAddress,'100 Corporate Drive')
 }
})

test('registered-style collection returns the proven India role and retains incomplete company scope',async()=>{
 const source={source:'example',companyName:'Example',companyDomain:'example.test',companyCareerPage:'https://example.test/careers'}
 const jobs=await createVerifiedRecruitmentScraper(source).run({fetchPage:async requested=>({status:200,url:requested,
  html:requested===url?html('Bangalore, IN, 562122'):`<h1>Example Careers</h1><a href="${url}">Software Engineer</a>`})})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].city,'Bangalore')
 assert.equal(jobs[0].sourceDescription,description)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(jobs[RECRUITMENT_OBSERVATIONS].returnedIndiaJobs,1)
})
