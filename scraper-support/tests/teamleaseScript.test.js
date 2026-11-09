import assert from 'node:assert/strict'
import test from 'node:test'
import * as teamlease from '../../scraper/teamlease/script.js'

// Synthetic contract cases. Genuine public responses are tested separately in
// teamleaseCurrentInventory20261106.test.js; these are not historical captures.
const date='2026-11-06T09:30:00.000Z'
const payload=[
 {id:5001,link:'https://group.teamlease.com/jobs/sales-manager-staffing-5/',title:{rendered:'Sales Manager - Staffing'},
  content:{protected:false,rendered:'<p>Lead enterprise staffing growth for the west region.</p><ul><li>Drive regional sales targets.</li><li>Manage strategic client relationships.</li></ul>'},
  class_list:['type-awsm_job_openings','status-publish','job-category-sales','job-location-mumbai','job-type-full-time']},
 {id:5002,link:'https://group.teamlease.com/jobs/recruitment-specialist-2/',title:{rendered:'Recruitment Specialist'},
  content:{protected:false,rendered:'<p>Support hiring operations for key client accounts.</p><ul><li>Coordinate interviews across teams.</li><li>Maintain accurate candidate records.</li></ul>'},
  class_list:['type-awsm_job_openings','status-publish','job-category-operations','job-location-bengaluru','job-type-full-time']},
]
const detail=row=>`<!doctype html><html><head><link rel="canonical" href="${row.link}">
<script type="application/ld+json">${JSON.stringify({'@type':'JobPosting',title:row.title.rendered,description:row.content.rendered,datePosted:'2026-11-01T00:00:00Z',validThrough:'2026-11-20T00:00:00Z',hiringOrganization:{name:'TeamLease Services Limited',sameAs:'https://group.teamlease.com'}})}</script></head>
<body class="single-awsm_job_openings postid-${row.id}"><div class="new-page-banner-content"><h3>${row.title.rendered}</h3></div>
<form action="https://marcom.teamlease.com/form/submit?formId=12" method="post"><input name="unrelated-contact"></form>
<main><div class="awsm-job-single-wrap"><div class="awsm-job-entry-content entry-content">${row.content.rendered}</div>
<form id="awsm-application-form" class="awsm-application-form" method="post"><input type="hidden" name="awsm_job_id" value="${row.id}"><input type="hidden" name="action" value="awsm_applicant_form_submission"><input type="file" name="awsm_file"></form>
</div></main></body></html>`
const archive=`<!doctype html><html><head><title>Job Openings Archive - TeamLease</title><link rel="canonical" href="${teamlease.CAREERS_URL}"></head>
<body class="post-type-archive-awsm_job_openings">${payload.map(row=>`<div class="awsm-job-listing-item" id="awsm-grid-item-${row.id}"><a class="awsm-job-item" href="${row.link}"><h2 class="awsm-job-post-title">${row.title.rendered}</h2><span>More Details</span></a></div>`).join('')}</body></html>`
const reader=(pageSize,requested)=>async url=>{
 requested.push(url)
 if(url===teamlease.CAREERS_URL)return {status:200,url,headers:{'content-type':'text/html'},body:archive}
 const row=payload.find(row=>row.link===url)
 if(row)return {status:200,url,headers:{'content-type':'text/html'},body:detail(row)}
 const pages=Math.ceil(payload.length/pageSize)
 for(let page=1;page<=pages;page++)if(url===teamlease.buildSearchUrl(page,pageSize))return {
  status:200,url,headers:{'content-type':'application/json','x-wp-total':'2','x-wp-totalpages':String(pages)},
  body:JSON.stringify(payload.slice((page-1)*pageSize,page*pageSize))}
 throw Error('Unexpected or out-of-range TeamLease URL: '+url)
}

test('Teamlease AWSM helpers retain published records and keep city-only workplace country unknown',()=>{
 assert.equal(teamlease.CAREERS_URL,'https://group.teamlease.com/jobs/')
 assert.equal(teamlease.CAREERS_API_URL,'https://group.teamlease.com/wp-json/wp/v2/awsm_job_openings')
 assert.equal(teamlease.buildSearchUrl(1),'https://group.teamlease.com/wp-json/wp/v2/awsm_job_openings?_fields=id%2Clink%2Ctitle%2Ccontent%2Cclass_list&per_page=100&page=1')
 const rows=teamlease.extractSearchResults(payload)
 assert.equal(rows.length,2)
 assert.deepEqual(rows.map(row=>({id:row.jobId,title:row.title,department:row.department,location:row.location,country:row.country,requisitionId:row.requisitionId,employmentType:row.employmentType})),[
  {id:'5001',title:'Sales Manager - Staffing',department:'Sales',location:'Mumbai',country:null,requisitionId:null,employmentType:'Full Time'},
  {id:'5002',title:'Recruitment Specialist',department:'Operations',location:'Bengaluru',country:null,requisitionId:null,employmentType:'Full Time'},
 ])
 assert.deepEqual(rows.map(row=>row.sourceNativeListingRecord),payload)
 assert.ok(rows.every(row=>row.sourceCountryScopeUnresolved&&row.remoteStatus===null))
})
test('extractJobDetail binds the native post application form and retains full criteria and dates',()=>{
 const row=teamlease.extractSearchResults(payload)[0]
 const job=teamlease.extractJobDetail(detail(payload[0]),row,{now:date})
 assert.equal(job.applyUrl,row.sourceUrl+'#awsm-application-form')
 assert.deepEqual(job.sourceDescriptionLines,['Lead enterprise staffing growth for the west region.','Drive regional sales targets.','Manage strategic client relationships.'])
 assert.equal(job.postingDate,'2026-11-01T00:00:00.000Z')
 assert.equal(job.closingDate,'2026-11-20T00:00:00.000Z')
 assert.equal(job.country,null)
 assert.equal(job.lifecycleCleanupAllowed,false)
 assert.equal(job.applicationVisited,false)
})
test('run paginates native published listings, reconciles closing reads and decorates runner fields',async()=>{
 const requested=[]
 const jobs=await teamlease.createTeamleaseScraper({pageSize:1}).run({fetchPage:reader(1,requested),now:()=>date})
 assert.deepEqual(requested,[teamlease.CAREERS_URL,teamlease.buildSearchUrl(1,1),teamlease.buildSearchUrl(2,1),...payload.map(row=>row.link),teamlease.buildSearchUrl(1,1),teamlease.buildSearchUrl(2,1),teamlease.CAREERS_URL])
 assert.equal(jobs.length,2)
 assert.equal(jobs[0].source,'teamlease')
 assert.equal(jobs[0].link,payload[0].link+'#awsm-application-form')
 assert.equal(jobs[0].scrapedAt,date)
 assert.equal(jobs.nativeCollectionEvidence.openingClosingNativeRecordsMatch,true)
})
test('run respects the native final page declaration without probing an out-of-range page',async()=>{
 const requested=[]
 const jobs=await teamlease.run({fetchPage:reader(100,requested),now:()=>date})
 assert.deepEqual(requested.filter(url=>url.startsWith(teamlease.CAREERS_API_URL)),[teamlease.buildSearchUrl(1),teamlease.buildSearchUrl(1)])
 assert.equal(jobs.length,2)
 assert.equal(jobs.nativeCollectionEvidence.nativeFeedReportedTotal,2)
})
