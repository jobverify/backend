import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {nextAureconClientRequest,validateAureconWorksiteProof,AURECON_CAREERS,AURECON_CONTACT,AURECON_BOARD,AURECON_API} from '../../scraper-support/myworkday/nativeAureconWorksites.js'
import {createCurrentAureconScraper} from './currentNative.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261118.json.gz',import.meta.url))))
const urls=[
 'https://www.aurecongroup.com/content/static/index.20261116.1.js',
 'https://www.aurecongroup.com/content/static/ContactUsPageD1OZtVsm.js',
 'https://www.aurecongroup.com/content/static/contactuspaged1oztvsm.js',
 'https://www.aurecongroup.com/content/static/constantsD2LeT1o5.js',
 'https://www.aurecongroup.com/content/static/constantsd2let1o5.js',
 'https://www.aurecongroup.com/content/static/sanatiseStringXxxJfhmd.js',
 'https://www.aurecongroup.com/content/static/sanatisestringxxxjfhmd.js',
]
const context={source:'aurecon',baseUrl:AURECON_BOARD,jobsApiUrl:AURECON_API,officialCareersUrl:AURECON_CAREERS,countryProof:true}
// The captured bytes/statuses are original. Fresh clocks and the repeated
// contact envelope are replay controls, never a live stability claim.
const proof=()=>{const now=Date.now(),time=new Date(now-500).toISOString(),row=r=>({...structuredClone(r),fetchedAt:time});return{
 version:'aurecon-native-worksites-v2',source:'aurecon',boardUrl:AURECON_BOARD,jobsApiUrl:AURECON_API,officialCareersUrl:AURECON_CAREERS,directoryUrl:AURECON_CONTACT,
 attemptStartedAt:new Date(now-2000).toISOString(),attemptDeadlineAt:new Date(now+60000).toISOString(),verifiedAt:new Date(now-100).toISOString(),
 corporateResponse:row(fixture.corporateResponse),clientResponses:fixture.clientResponses.map(row),contactSnapshots:[row(fixture.contactResponse),row(fixture.contactResponse)],
}}

test('Aurecon current deployment follows only its exact reviewed main, contact module and native model dependencies',()=>{
 const input=proof(),seen=[]
 for(let i=0;i<urls.length;i++){
  assert.equal(nextAureconClientRequest(input.corporateResponse,seen),urls[i])
  seen.push(input.clientResponses[i])
 }
 assert.equal(nextAureconClientRequest(input.corporateResponse,seen),null)
 const qualified=validateAureconWorksiteProof(input,context)
 assert.equal(qualified.byLabel.get('mackay').country.alpha2Code,'AU')
 assert.equal(qualified.byLabel.get('gladstone').country.alpha2Code,'AU')
 assert.equal(qualified.byLabel.get('maroochydore').country.alpha2Code,'AU')
 assert.equal(qualified.byLabel.get('manila').country.alpha2Code,'PH')
 assert.equal(qualified.corporateReceipt.clientReceipts.length,7)
})

test('Aurecon current deployment cannot use edited programs or an unreviewed main declaration',()=>{
 for(const index of [0,2,4,6]){
  const input=proof(),row=input.clientResponses[index]
  row.body+=';';row.sha256=createHash('sha256').update(row.body).digest('hex')
  assert.throws(()=>validateAureconWorksiteProof(input,context),/Invalid current Aurecon worksite proof/)
 }
 const input=proof()
 input.corporateResponse.body=input.corporateResponse.body.replaceAll('index.20261116.1.js','unreviewed.js')
 input.corporateResponse.sha256=createHash('sha256').update(input.corporateResponse.body).digest('hex')
 assert.throws(()=>nextAureconClientRequest(input.corporateResponse),/current declared module/)
})

test('Aurecon collector preserves the current original redirects before a later public denial',async()=>{
 const input=proof(),calls=[]
 await assert.rejects(createCurrentAureconScraper().collect({fetchImpl:async url=>{
  calls.push(url)
  const row=url===AURECON_CAREERS?input.corporateResponse:input.clientResponses.find(r=>r.url===url)
  const body=row?.body??(row?.status===301?'original redirect body':'Original contact denial')
  const response=new Response(body,{status:row?.status??406,headers:{'content-type':row?.contentType??'text/html',...(row?.location?{location:row.location}:{})}})
  Object.defineProperty(response,'url',{value:url});return response
 }}),error=>error.status===406&&error.requestUrl===AURECON_CONTACT&&error.nativeEvidence.responses.length===9)
 assert.deepEqual(calls,[AURECON_CAREERS,...urls,AURECON_CONTACT])
})
