import assert from 'node:assert/strict'
import test from 'node:test'
import {run,CURRENT_CAREERS_URL,OPENINGS_API_URL} from '../scraper/ixigo/script.js'

const opening={jobVacancyId:'1234567890',companyIdentifier:'ixigo',companyName:'ixigo',vacancyName:'Engineer',location:'Gurugram',countryAbbreviation:'in',countryName:'India',refNumber:'REF123',releasedDate:1793687209589}
const description='<p>Design production services, collaborate on technical designs, investigate incidents, improve operational reliability and build software for customers across the travel industry.</p>'
const detail={id:opening.jobVacancyId,name:opening.vacancyName,refNumber:opening.refNumber,company:{identifier:'ixigo',name:'ixigo'},location:{country:'in',city:'Gurugram'},active:true,visibility:'PUBLIC',postingUrl:'https://jobs.smartrecruiters.com/ixigo/744000159303068-engineer',applyUrl:'https://jobs.smartrecruiters.com/ixigo/744000159303068-engineer?oga=true',jobAd:{sections:{jobDescription:{text:description},qualifications:{text:'<p>Professional software engineering experience.</p>'}}}}
const page='<title>ixigo careers</title><p>Join our team of 250+ passionate folks</p><h1>we are changing the way India travels.</h1><div>Open roles</div>'
async function collect(changes={},status=200){
 const requests=[]
 const jobs=await run({fetchPage:async url=>{requests.push(url);return {url,status:url.includes('/v1/')?status:200,html:url===CURRENT_CAREERS_URL?page:url===OPENINGS_API_URL?JSON.stringify({data:{results:[opening],numFound:1}}):JSON.stringify({...detail,...changes})}}}).catch(e=>{if(e.failureKind==='coverage_gap')return [];throw e})
 return {jobs,requests}
}
test('ixigo binds its first-party opening to the same active public native role and retains its full description',async()=>{
 const {jobs,requests}=await collect()
 assert.equal(jobs.length,1)
 assert.ok(jobs[0].sourceDescription.includes(description))
 assert.equal(jobs[0].sourceUrl,detail.postingUrl)
 assert.equal(jobs[0].applyUrl,detail.applyUrl)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].nativeSourceRecord.detail.id,opening.jobVacancyId)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(jobs[0].applicationVisited,false)
 assert.deepEqual(requests,[CURRENT_CAREERS_URL,OPENINGS_API_URL,'https://api.smartrecruiters.com/v1/companies/ixigo/postings/'+opening.jobVacancyId,OPENINGS_API_URL])
})
for(const [label,changes]of [
 ['other role',{id:'9999999999'}],['changed title',{name:'Other Engineer'}],['changed requisition',{refNumber:'OTHER'}],
 ['other employer',{company:{name:'Other',identifier:'other'}}],['foreign country',{location:{country:'us'}}],
 ['unknown country',{location:{city:'Gurugram'}}],['inactive role',{active:false}],['private role',{visibility:'PRIVATE'}],
 ['teaser-only description',{jobAd:{sections:{companyDescription:{text:description},jobDescription:{text:'Apply now'}}}}],
 ['other publisher URL',{postingUrl:'https://jobs.smartrecruiters.com/other/744000159303068-engineer'}],
 ['unsafe public URL',{postingUrl:'https://jobs.smartrecruiters.com@other.test/ixigo/744000159303068-engineer'}],
])test('ixigo native details reject '+label,async()=>{assert.equal((await collect(changes)).jobs.length,0)})
test('a denied ixigo native detail cannot become a usable India record',async()=>{assert.equal((await collect({},403)).jobs.length,0)})
