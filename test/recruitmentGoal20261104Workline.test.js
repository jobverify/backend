import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {declaredRoleDescription,readDescriptionPDF} from '../scraper/fullertonindia/nativeDetails.js'
import {createFullertonIndiaScraper,REDIRECTED_HOMEPAGE_URL,CAREERS_URL,JOBS_BOARD_ENTRY_URL,JOBS_BOARD_URL,buildDetailUrl} from '../scraper/fullertonindia/script.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/workline-native-role.json',import.meta.url)))
const bytes=fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/workline-native-description.pdf',import.meta.url))
const pdfReceipt=JSON.parse(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/workline-native-description-receipt.json',import.meta.url)))
const {record,page}=fixture
test('the current Workline role binds its visible ID, title, placement, PRF and published viewer to the complete native PDF',async()=>{
 const declared=declaredRoleDescription(page,record),pdf=await readDescriptionPDF(bytes)
 assert.equal(declared.filename,new URL(pdfReceipt.requestedURL).searchParams.get('filename'))
 assert.equal(pdf.sha256,pdfReceipt.bodySHA256)
 assert.equal(pdf.pages.length,4)
 assert.ok(pdf.text.length>7000)
 assert.ok(pdf.text.includes('Purpose of the Job:'))
 assert.ok(pdf.text.includes('No. of years of relevant experience:'))
})
for(const [name,change,htmlChange]of [
 ['other PRF',{PRFCode:108640}],['other requisition',{Req_No:'OTHER'}],['other title',{Position_Name:'Other Manager'}],
 ['other placement',{LOCATIONNAME:'Other City'}],['other file',{JobSpecificationFile:'Other.pdf'}],
 ['other public token',{TrackToken:'00000000-0000-0000-0000-000000000000'}],
 ['unpublished viewer',{},value=>value.replace('PDFJS.getDocument(url)','otherViewer(url)')],
 ['application operation',{},value=>value.replace('ModeFlag=V&filename=','ModeFlag=A&filename=')],
 ['other role publisher',{},value=>value.replaceAll('SMFG India Credit','Other Employer')],
])test('Workline rejects '+name,()=>{
 assert.throws(()=>declaredRoleDescription({...page,html:htmlChange?htmlChange(page.html):page.html},{...record,...change}),/Workline/)
})
async function run({records=[record],detailStatus=200}={}){
 const calls=[]
 const jobs=await createFullertonIndiaScraper().run({
  fetchPage:async url=>{calls.push(url);return url===REDIRECTED_HOMEPAGE_URL?{url,status:200,html:'<title>SMFG India Credit: Leading Financial Company for Loans</title><a href="/careers.aspx">Careers</a>'}
   :url===CAREERS_URL?{url,status:200,html:'<title>SMFG India Credit Careers - Current Job Openings &amp; Employee Testimonials</title><p>Careers - SMFG India Credit Explore Jobs Upload Your Profile</p><a href="https://app52.workline.hr/Candidate/GeneralOpening.aspx">Jobs</a>'}
   :url===JOBS_BOARD_ENTRY_URL?{url:JOBS_BOARD_URL,status:200,html:'<title>SMFG - Workline - Possibilities Infinite</title><p>Begin your search for greater opportunities Search Jobs Post Resume</p><script src="GeneralOpenings.js"></script>'}
   :{...page,url,status:detailStatus}},
  fetchJson:async()=>({d:{obj1:JSON.stringify(records),obj2:'[]'}}),
  fetchPDF:async url=>{calls.push(url);return bytes},
 })
 return {jobs,calls}
}
test('the executable returns the own full PDF and preserves its original native record without visiting applications',async()=>{
 const {jobs,calls}=await run(),pdf=await readDescriptionPDF(bytes)
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].sourceDescription,pdf.text)
 assert.equal(jobs[0].country,'India')
 assert.deepEqual(jobs[0].nativeSourceRecord.listing,record)
 assert.equal(jobs[0].sourceScopeComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(calls.includes(buildDetailUrl(record)))
 assert.equal(calls.some(url=>url.includes('SignIn')||url.includes('DirectApply')),false)
})
for(const value of [undefined,'','United States','Indiana'])test('Workline cannot default an unqualified country '+value+' to India',async()=>{
 const {jobs,calls}=await run({records:[{...record,Country_Name:value}]})
 assert.equal(jobs.length,0)
 assert.equal(calls.some(url=>url.includes('/CandidatePortal/')||url.includes('/CanPRFApply.aspx')),false)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
test('a denied native role cannot be replaced by listing metadata',async()=>{
 await assert.rejects(run({detailStatus:403}),error=>error.failureKind==='coverage_gap')
})
test('a native description must be complete PDF bytes',async()=>{
 await assert.rejects(readDescriptionPDF(Buffer.from('<html>Apply now</html>')),/PDF bytes/)
})
