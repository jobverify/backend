import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readCurrentHome,readCurrentJobsPage,readCurrentConsumer,nativeApplicationURL} from './currentProtocol20261120.js'

const f=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-research-20261120.json.gz',import.meta.url)))),body=name=>Buffer.from(f.responses.find(p=>p.researchName===name).bodyBase64,'base64').toString(),home=body('salesforce-corporate-final-next'),jobs=body('salesforce-current-jobs-final-next'),client=body('salesforce-declared-careers-client-next'),replace=(s,a,b)=>{assert.equal(s.split(a).length,2,'Exact unique genuine mutation target '+a);return s.replace(a,b)}

test('Salesforce genuine discovery originals retain eight bounded original HTTP bodies and declared redirects',()=>{assert.equal(f.responses.length,8);for(const p of f.responses){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(b.length,p.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),p.sha256)}assert.deepEqual(f.responses.slice(0,5).map(p=>p.status),[301,302,200,302,200])})
test('Salesforce exact current corporate publisher links its own careers job page and active PROD consumer',()=>{const a=readCurrentHome(home),b=readCurrentJobsPage(jobs);assert.equal(a.jobsURL,'https://www.salesforce.com/company/careers/jobs/');assert.equal(b.environment,'prod');assert.equal(b.clientURL,'https://c.salesforce.com/digital/xsf/components/v1-stable/careers.js');assert.equal(b.rendererExecuted,false)})
test('Salesforce connected native current consumer declares prod primary/full JSON and same-record Apply suffix without executing UI',()=>{const p=readCurrentConsumer(client,readCurrentJobsPage(jobs));assert.equal(p.primaryURL,'https://a.sfdcstatic.com/digital/xsf/careers/prod/jobs_1.json');assert.equal(p.fullURL,'https://a.sfdcstatic.com/digital/xsf/careers/prod/jobs_2.json');assert.equal(p.primaryFullMerge,'native-full-overrides-same-id;append-new-full-id');assert.equal(p.rendererExecuted,false);assert.equal(p.wholeBuildPinned,false)})
for(const[kind,a,b]of[
  ['native primary feed','/jobs_1.json','/other_jobs.json'],
  ['native full feed','/jobs_2.json','/other_full.json'],
  ['native feed owner','https://a.sfdcstatic.com/digital/xsf/careers/','https://other.invalid/careers/'],
  ['actual full fetch selection','await t(e.jobsPrimary,e.jobsFull)','await t(e.jobsPrimary,e.jobsFullBackup)'],
  ['actual fetch binding','const t=await fetch(e);','const t=await fetch("https://other.invalid/jobs.json");'],
  ['actual payload model','"Report_Entry"in e','"Other_Entry"in e'],
  ['actual same-record application','href:oa(l.externalJobPostingSite)','href:"https://other.invalid/apply"'],
  ['native published country projection','e.Countries??e.countries','e.Regions??e.regions'],
  ['native original publication field','o=pt(e.External_Job_Posting_Start_Date)','o=pt(e.Fetch_Timestamp)'],
  ['native external application mapper','c=pt(e.External_Job_Posting_Site)','c="https://other.invalid/foreign"'],
  ['actual rendering provider','children:d.jsx(bt,{children:d.jsx(xa,{})})','children:d.jsx(xa,{})']
])test('Salesforce actual current consumer disconnect cannot borrow an unused declaration: '+kind,()=>{assert.throws(()=>readCurrentConsumer(replace(client,a,b),readCurrentJobsPage(jobs)),/native|consumer|protocol|current|feed|application|binding|model/i)})
test('Salesforce changed Apply helper semantics cannot borrow a same-role authored source URL',()=>{const changed=replace(client,'return n.toLowerCase().endsWith("/apply")?n:`${n}/apply`','return "https://other.invalid/apply"');assert.throws(()=>readCurrentConsumer(changed,readCurrentJobsPage(jobs)),/native|consumer|application|protocol/i)})
test('Salesforce unrelated client analytics and styles remain outside relevant data consumer semantics',()=>{const p=readCurrentConsumer(client+';globalThis.unrelatedCareersAnalytics={color:"purple",version:2};',readCurrentJobsPage(jobs));assert.equal(p.primaryURL,'https://a.sfdcstatic.com/digital/xsf/careers/prod/jobs_1.json')})
test('Salesforce supplied QA environment is held before any alternate feed can be acquired',()=>{assert.throws(()=>readCurrentJobsPage(replace(jobs,'"env":"PROD"','"env":"QA"')),/environment|prod|native|publisher/i)})
test('Salesforce disconnected active career module cannot borrow earlier raw native module URL',()=>{const d=document(jobs),n=d.nodes(n=>n.tag==='script'&&n.attrs.src==='https://c.salesforce.com/digital/xsf/components/v1-stable/careers.js')[0],changed=jobs.slice(0,n.start)+jobs.slice(n.start,n.openEnd).replace(n.attrs.src,'https://other.invalid/careers.js')+jobs.slice(n.openEnd);assert.throws(()=>readCurrentJobsPage(changed),/native|client|publisher|consumer/i)})
test('Salesforce native same-JR authored Workday URL has the exact own current Apply suffix and no activation claim',()=>{const url='https://salesforce.wd12.myworkdayjobs.com/External_Career_Site/job/India---Bangalore/Native-Role_JR326098';assert.equal(nativeApplicationURL(url,'JR326098'),url+'/apply');assert.equal(nativeApplicationURL(url+'/apply','JR326098'),url+'/apply');assert.throws(()=>nativeApplicationURL(url,'JR999999'),/native|application|requisition/i);assert.throws(()=>nativeApplicationURL(url.replace('salesforce.wd12.myworkdayjobs.com','other.invalid'),'JR326098'),/native|application|owner/i)})

for(const[kind,a,b]of[
 ['actual native data wrapper','v=e=>({jobs:e,pageInfo:','v=e=>({jobs:[],pageInfo:'],
 ['actual publication context','value:{jobsData:t,i18n:b,loading:h','value:{jobsData:null,i18n:b,loading:h'],
 ['actual Apply disabled','id:"js-apply-external",href:','id:"js-apply-external",disabled:true,href:'],
 ['actual Apply publication flag','id:"js-apply-external",href:','id:"js-apply-external","data-is-published":false,href:'],
 ['actual own role hidden','id:"js-job-detail","data-id":','id:"js-job-detail",hidden:true,"data-id":']
])test('Salesforce connected actual native publication cannot be replaced or explicitly disabled '+kind,()=>{assert.throws(()=>readCurrentConsumer(replace(client,a,b),readCurrentJobsPage(jobs)),/native|consumer|application|publication|wrapper|owner|disabled/i)})
test('Salesforce explicitly hidden current HTML rendering root cannot publish an unused raw client',()=>{const d=document(jobs),n=d.nodes(n=>n.attrs.id==='main-content')[0],changed=jobs.slice(0,n.start)+jobs.slice(n.start,n.openEnd).replace('id="main-content"','id="main-content" class="d-none"')+jobs.slice(n.openEnd);assert.throws(()=>readCurrentJobsPage(changed),/native|content|publisher|disabled|hidden/i)})
