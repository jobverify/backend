import {createHash} from 'node:crypto'
import {createCurrentNativeReader} from '../../scraper-support/native-sources/boundedCurrentNativeRead20261106.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {canonicalNativeRecord} from '../../scraper-support/native-sources/collectCurrentOriginalRecords20261106.js'
import {readOwnedCurrentDocument,readOriginalNativeCriteria} from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeText,clean} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const CV_URL='https://www.lalpathlabs.com/career/submit-your-cv'
export const CAREERS_URL='https://www.lalpathlabs.com/career',LIST_URL=CAREERS_URL+'/job-opening-list'
const origin='https://www.lalpathlabs.com',api='https://admin-api.lalpathlabs.com/api/'
const tokenURL=api+'public/guest-token',postsURL=api+'jobs/posts',rolePrefix=CAREERS_URL+'/job-opening/'
const failure=(message,fields={})=>firstPartyFailure('drlalpathlabs',message,fields)
const need=(ok,message)=>{if(!ok)throw failure(message,{nativeAuthorityFailure:true})}
const sha=value=>createHash('sha256').update(value).digest('hex')
// Exact Nov13 deployment: the corporate handoff, anonymous public read service,
// list/detail renderers and their declared supporting assets. Never execute it.
const assets={
 '/_next/static/chunks/pages/career/job-opening-list-f766a771562d2445.js':'9a4abdfcd6d3f2bdaceb0862a46dc61e64912dd8669351bff1ce89314c3b6fc9',
 '/_next/static/chunks/85610-cdae5f4dc3eab6eb.js':'51098d2f1704042f6b430d67af57e82f79277418a20d78dee1915d5f97cade64',
 '/_next/static/chunks/27339-3eee8d6b253158cb.js':'248f502fb0c9bf86ac351903209bc6eb0bfad6ed3dc72008da1195dba24a745f',
 '/_next/static/chunks/pages/_app-e5472efa73c4d602.js':'88e6802ad35888b1cdc5fe3b6b1f15157dd8eeaaaa88c42e86ec3087c486957b',
 '/_next/static/chunks/5498-9ed78741d65bf4b1.js':'fe61d4ff3a4dbaa77d24eec0de6d1db07d72d3d4613096adbb1f76c8a82cae38',
 '/_next/static/chunks/63106-52d5602bd7ee0ec4.js':'1492153cbfbe8751df12f67387c2345d977026c1342789bddf45dc3672ca4964',
 '/_next/static/chunks/pages/career/job-opening/%5Bslug%5D-b5d564a8bf8ce11d.js':'63a44e78d2acea1967c01109c0854cf1ad831f29f5ecab553785520068668ca2',
 '/_next/static/chunks/polyfills-42372ed130431b0a.js':'0973c1d64c88adc8e3c950410cb58b288f72118d5965b78049438deb8f2f9683',
 '/_next/static/chunks/webpack-b6b6ad631fcd0674.js':'f86d415bc294647b8ce792a521d4467d4142f4b789dc886c4fa200aa73c8fbeb',
 '/_next/static/chunks/framework-7d3dc92bf3c4a3f5.js':'3a8b8e023ae6f7726d93e2184243ead427252960a91b16a261f659fa70da613a',
 '/_next/static/chunks/main-bb6a4e290b43ffcd.js':'d42141a63024b730f2b7f6b20f32f46c4362eb13ebe5a21320841ff1a576d94c',
 '/_next/static/chunks/19357-b20eb32cfbfbc5f4.js':'08427034a1d284341ddf3cf594f33c909be09706f1959788fc1e68d7837eaf83',
 '/_next/static/chunks/pages/career-af15024b345a2429.js':'7e0b69801f702fd9281e06972aa6db0a86403e24834d3a6f193bce0521c2a3bc',
 '/_next/static/E9KQC0EiB74sBCg9QwRS8/_buildManifest.js':'5a730afe0a629e65aa9c28429b52f0c521cdc7486759c979bb883e54a7fd6497',
 '/_next/static/E9KQC0EiB74sBCg9QwRS8/_ssgManifest.js':'d19d028d3173758a2023d14f325ef580c6c99da40ee117951ba9e81699561572',
 '/_next/static/chunks/35536-dbf17e7b9ee36283.js':'95199b065f0f1f320ae38e62257577475a37a23c9e1ff3e816b071281b8d6d0d',
 '/_next/static/chunks/pages/career/submit-your-cv-6606abf5898b9ebd.js':'b5f9d41113dfa42efdf409b267f431c444bcdf585a932a4d2f5402352971e33f',
}
const documents={
 [CV_URL]:['Submit Your CV to Dr Lal PathLabs','affa2412a87d0237a32f72da10d9a30c29b8f01e4ccee3f3e9d877ed71d84887','46b038ea96119b10941363047481506fc7d5fc3143bc9a4564960a23335dffe6'],
 [CAREERS_URL]:['Careers at Dr Lal PathLabs','8a2444baec7000ac04e02a0a2497b9d1ea132f91b4f4801022379656eed60ab7','12a7dca320040283d75f47dd512630ffe0219957e75d6524116db543c3d7d912'],
 [LIST_URL]:['Current Job Openings at Dr Lal PathLabs','e4bdf499d0be5aa8fab875d30275db3ac7d796e29f4f97bc1e6aaa10f9cd2db8','ef84076a68d87835727e7638eba44af4df29c76130ddefdf519ec86b9d5d8b27'],
 role:['Diagnostic Centre and Pathology Lab for Blood Test | Dr Lal PathLabs','dcc51a8ef7dbe2c15e51659a6541e8eb098fb6c51a62c93ef92c6c3094492e39','27b6447ba1932691318a26bd7185080fd2d43dcb06271d7457eacab8a97467cf'],
}
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]*)*$/
export function readDrLalDocument(html,url){
 const isRole=url.startsWith(rolePrefix),slug=isRole?url.slice(rolePrefix.length):null,profile=documents[isRole?'role':url]
 need(profile&&(!isRole||slugPattern.test(slug)),'Unbound corporate/native role document')
 const owned=readOwnedCurrentDocument(html,{failure,title:profile[0],canonical:isRole?origin+'/':url,eventPrograms:[]})
 need(owned.nodes.filter(n=>n.tag==='link'&&n.attrs.rel==='canonical').length===1,'Missing corporate/native canonical')
 const scripts=owned.nodes.filter(n=>n.tag==='script'),dataNodes=scripts.filter(n=>n.attrs.id==='__NEXT_DATA__')
 need(dataNodes.length===1&&owned.body.children.includes(dataNodes[0]),'Native page data owner changed')
 let data;try{data=JSON.parse(dataNodes[0].raw)}catch{throw failure('Malformed native page data')}
 if(isRole){need(data.page==='/career/job-opening/[slug]'&&data.query?.slug===slug,'Native role route identity changed');data.query.slug='REVIEWED_NATIVE_SLUG'}
 const declaration=scripts.map(n=>({attrs:n.attrs,raw:n.attrs.id==='__NEXT_DATA__'?null:n.raw||'',inert:!!n.inert,
  owner:owned.head.children.includes(n)?'head':owned.body.children.includes(n)?'body':'nested'}))
 need(sha(canonicalNativeRecord(declaration))===profile[1]&&sha(canonicalNativeRecord(data))===profile[2],'Native document/program deployment requires review')
 if(url===CV_URL||url===CAREERS_URL){
  const next=url===CV_URL?'/career':'/career/job-opening-list',visible=readVisibleNativeDocument(html,{strict:true})
  need(visible.nodes(n=>n.tag==='a'&&n.attrs.href===next&&clean(nativeText(n))).length>0,'Corporate recruitment handoff is missing or hidden')
 }
 return scripts.filter(n=>n.attrs.src).map(n=>{const asset=new URL(n.attrs.src,url);need(asset.origin===origin&&assets[asset.pathname]&&asset.href===origin+asset.pathname,'Unreviewed native program URL');return asset.href})
}
export function readDrLalAsset(url,body){need(assets[new URL(url).pathname]&&url===origin+new URL(url).pathname&&sha(body)===assets[new URL(url).pathname],'Immutable native program bytes require review')}
function envelope(body){
 let value;try{value=JSON.parse(body)}catch{throw failure('Malformed public native jobs JSON')}
 need(value&&canonicalNativeRecord(Object.keys(value).sort())===canonicalNativeRecord(['Data','Error','Message','Meta','Status','StatusCode','TotalRecord'])&&value.Status===true&&value.StatusCode===200&&value.Meta===false&&
  canonicalNativeRecord(value.Error)===canonicalNativeRecord({ErrorCode:'',ErrorMessage:''}),'Public native jobs envelope changed or failed')
 return value
}
const fields=['Id','JobCategoryId','JobTitle','Slug','JobHeading','Location','Experience','JobDetails','Responsibility','JobProfile','JobPurpose','Eligibility','JobVacancy','JobDisclosed','SimilarJobIds','JobSalary','Status','CreatedAt','CreatedBy','UpdatedAt','UpdatedBy'].sort()
const renderedCriteria=[['JobDetails','Job Highlights'],['JobPurpose','Purpose'],['Responsibility','Roles and Responsibilities'],['JobDisclosed','Required Candidate Profile']]
function validateRecord(row){
 need(row&&typeof row==='object'&&!Array.isArray(row)&&canonicalNativeRecord(Object.keys(row).sort())===canonicalNativeRecord(fields),'Original native role schema changed')
 need(Number.isSafeInteger(row.Id)&&row.Id>0&&Number.isSafeInteger(row.CreatedBy)&&Number.isSafeInteger(row.UpdatedBy)&&[0,1].includes(row.Status)&&
  ['JobCategoryId','JobHeading','JobProfile','Eligibility','SimilarJobIds'].every(key=>row[key]===null),'Native identity/status or unrendered criteria require review')
 need(['JobTitle','Slug','Location','Experience','JobVacancy','JobSalary','CreatedAt','UpdatedAt',...renderedCriteria.map(([key])=>key)].every(key=>typeof row[key]==='string'&&Buffer.byteLength(row[key])<=256*1024),'Incomplete or excessive native role field')
 need(slugPattern.test(row.Slug)&&clean(row.JobTitle)&&!/[<>\u0000-\u001f]/.test(row.JobTitle+row.Location)&&Number.isFinite(Date.parse(row.CreatedAt))&&Number.isFinite(Date.parse(row.UpdatedAt)),'Ambiguous native role identity')
 return row
}
export function readDrLalInventory(body){
 const value=envelope(body)
 need(value.Message==='Job posts list retrieved successfully.'&&Array.isArray(value.Data)&&value.Data.length<=1000&&value.TotalRecord===value.Data.length,'Native list is missing or partial')
 const ids=new Set()
 for(const row of value.Data){validateRecord(row);need(!ids.has(row.Id),'Duplicate original native role ID');ids.add(row.Id)}
 return value.Data
}
function readDetail(body){const value=envelope(body);need(value.Message==='Details retrieved successfully.'&&value.TotalRecord===0,'Native detail envelope changed');return validateRecord(value.Data)}
export function normalizeDrLalRecord(row){
 validateRecord(row)
 const parts=renderedCriteria.map(([key])=>readOriginalNativeCriteria(row[key],failure,{minimumChars:1}))
 const criteria=readOriginalNativeCriteria(renderedCriteria.map(([key,label])=>'<section><h2>'+label+'</h2>\n'+row[key]+'</section>').join('\n'),failure)
 if(parts.some(part=>!part.sourceDetailComplete)||parts.map(part=>part.sourceDescription??'').join('\n').length<300){
  Object.assign(criteria,{jobDescription:null,sourceDescription:null,sourceDetailComplete:false,sourceDetailFailureKind:'native-full-criteria-unavailable'})
 }
 const closed=/\b(?:applications? (?:are )?closed|no longer accepting applications|(?:position|vacancy|job) (?:has been |is )?(?:filled|closed))\b/i.test(criteria.sourceDescription??'')
 return {jobId:String(row.Id),sourceNativeJobId:String(row.Id),title:clean(row.JobTitle),company:'Dr Lal PathLabs',source:'drlalpathlabs',
  country:/^(?:PAN INDIA|India)$/.test(row.Location)?'India':null,location:row.Location,city:null,state:null,
  sourceCountryScopeUnresolved:!/^(?:PAN INDIA|India)$/.test(row.Location),sourceNativeJobRecord:structuredClone(row),
  sourceNativeCriteria:Object.fromEntries(renderedCriteria.map(([key])=>[key,row[key]])),experienceRequired:row.Experience,
  nativeVacancyCount:row.JobVacancy,nativeSalary:row.JobSalary,sourceUrl:rolePrefix+row.Slug,applyUrl:rolePrefix+row.Slug,link:rolePrefix+row.Slug,
  companyDomain:'lalpathlabs.com',companyCareerPage:CAREERS_URL,sourceCorporateURL:CAREERS_URL,
  sourceEmployerEvidence:{corporateCareersURL:CAREERS_URL,nativeAPI:postsURL,nativeEmployerDisplayName:'Dr Lal PathLabs'},
  sourceEmployerScope:'corporate-declared-native-jobs-service',sourceExactBrandRoleScopeVerified:false,
  postingDate:null,firstPublishedAt:null,closingDate:null,nativeCreatedAt:row.CreatedAt,nativeUpdatedAt:row.UpdatedAt,
  nativeDateProvenance:'Native record maintenance dates; publication semantics unverified',applicationVisited:false,activationVerified:false,
  ...criteria,...(closed?{sourceDetailComplete:false,sourceDetailFailureKind:'native-closed-role-notice'}:{}),lifecycleCleanupAllowed:false}
}
function redactedStats(reader){
 const stats=reader.stats();stats.receipts=stats.receipts.map(row=>row.requestedUrl===tokenURL?
  {requestedUrl:row.requestedUrl,method:row.method,requestedAt:row.requestedAt,completedAt:row.completedAt,status:row.status,finalUrl:row.finalUrl,
   bodyOmittedReason:'Issued anonymous public session credentials are not retained'}:row)
 return stats
}
export async function runCurrentDrLal(options={}){
 options.signal?.throwIfAborted()
 const maxJobs=options.maxJobs??1000
 if(!Number.isSafeInteger(maxJobs)||maxJobs<1||maxJobs>1000)throw RangeError('Invalid native output limit')
 const observedAt=(options.now??(()=>new Date().toISOString()))()
 if(typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt)))throw TypeError('Invalid native observation clock')
 const learned=new Set(Object.keys(assets).map(path=>origin+path)),checkedAssets=new Set(),holds=[]
 let token=null
 const reader=createCurrentNativeReader({...options,fetchImpl:async(url,init)=>{
  const headers=new Headers(init.headers);headers.set('User-Agent','Mozilla/5.0 (compatible; Jobverify/1.0)')
  headers.set('Accept',url.startsWith(api)?'application/json':url.endsWith('.js')?'application/javascript':'text/html')
  headers.delete('X-Requested-With')
  if(url.startsWith(api)){headers.set('Origin',origin);headers.set('Referer',LIST_URL);if(url===tokenURL)headers.set('Content-Type','application/json');else{need(token,'Native public session is unavailable');headers.set('X-Access-Token',token)}}
  let response
  if(options.fetchImpl)response=await options.fetchImpl(url,{...init,headers})
  else if(options.fetchPage){const page=await options.fetchPage(url,{...init,headers});need(page&&typeof page.body==='string'&&page.headers&&Number.isInteger(page.status)&&typeof(page.finalUrl??page.url)==='string','Incomplete original native HTTP metadata');response=new Response(page.body,{status:page.status,headers:page.headers});Object.defineProperty(response,'url',{value:page.finalUrl??page.url})}
  else response=await fetch(url,{...init,headers})
  // Only public HTTP metadata enters the generic reader's audit. Neither
  // cookies nor the in-memory guest credential are included in evidence.
  return {status:response.status,url:response.url,body:response.body,headers:new Headers([...response.headers].filter(([key])=>['content-type','location','etag','last-modified'].includes(key.toLowerCase())))}
 }},{source:'drlalpathlabs',admitted:[[CV_URL,'html'],[CAREERS_URL,'html'],[LIST_URL,'html'],[tokenURL,'json'],[postsURL,'json']],
  requests:[[tokenURL,{method:'POST',body:'{}'}]],learnedURL:url=>learned.has(url)})
 const document=async url=>{
  const programs=readDrLalDocument((await reader.read(url)).body,url)
  for(const program of programs)if(!checkedAssets.has(program)){reader.allow(program,'javascript');readDrLalAsset(program,(await reader.read(program)).body);checkedAssets.add(program)}
 }
 try{
  await document(CV_URL);await document(CAREERS_URL);await document(LIST_URL)
  const sessionPage=await reader.read(tokenURL)
  let session;try{session=JSON.parse(sessionPage.body)}catch{throw failure('Malformed anonymous public session response')}
  need(session?.Status===true&&session.StatusCode===200&&typeof session.Data?.token==='string'&&session.Data.token.length>0&&session.Data.token.length<=16384&&!/[\r\n]/.test(session.Data.token)&&Number.isSafeInteger(session.Data.expiresIn)&&session.Data.expiresIn>0,'Published anonymous session shape changed')
  token=session.Data.token;session=null
  const opening=readDrLalInventory((await reader.read(postsURL)).body),slugCounts=new Map(),facts=[]
  for(const row of opening)slugCounts.set(row.Slug,(slugCounts.get(row.Slug)||0)+1)
  for(const row of opening){
   reader.check()
   if(row.Status!==1){holds.push({nativeId:String(row.Id),reason:'native-inactive'});continue}
   if(!/^(?:PAN INDIA|India)$/.test(row.Location)){holds.push({nativeId:String(row.Id),reason:'native-country-unqualified'});continue}
   if(slugCounts.get(row.Slug)!==1){holds.push({nativeId:String(row.Id),reason:'ambiguous-native-role-slug'});continue}
   const fact=normalizeDrLalRecord(row)
   if(!fact.sourceDetailComplete){holds.push({nativeId:String(row.Id),reason:fact.sourceDetailFailureKind});continue}
   const roleURL=rolePrefix+row.Slug,detailURL=api+'jobs/details/'+row.Slug
   learned.add(roleURL);learned.add(detailURL);reader.allow(roleURL,'html');reader.allow(detailURL,'json')
   await document(roleURL)
   const detail=readDetail((await reader.read(detailURL)).body)
   if(canonicalNativeRecord(detail)!==canonicalNativeRecord(row)){holds.push({nativeId:String(row.Id),reason:'native-list-detail-identity-or-criteria-mismatch'});continue}
   facts.push({row,fact})
  }
  const closing=readDrLalInventory((await reader.read(postsURL)).body),closedById=new Map(closing.map(row=>[row.Id,row])),closingSlugs=new Map()
  for(const row of closing)closingSlugs.set(row.Slug,(closingSlugs.get(row.Slug)||0)+1)
  await document(LIST_URL);await document(CAREERS_URL);await document(CV_URL)
  const stable=facts.filter(({row})=>{const latest=closedById.get(row.Id)
   if(latest?.Status===1&&closingSlugs.get(row.Slug)===1&&canonicalNativeRecord(latest)===canonicalNativeRecord(row))return true
   holds.push({nativeId:String(row.Id),reason:'native-record-missing-inactive-ambiguous-or-changed-at-closing'});return false})
  const jobs=stable.slice(0,maxJobs).map(({fact})=>({...fact,sourceClosingReconciled:true,scrapedAt:observedAt,sourceScopeComplete:false}))
  const audit={source:'drlalpathlabs',recordKind:'mixed',observedRecordCount:opening.length,observedVacancyCount:opening.filter(row=>row.Status===1).length,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,unknownCountryCount:opening.filter(row=>!/^(?:PAN INDIA|India)$/.test(row.Location)).length,
   ambiguousIndiaIdentityCount:opening.filter(row=>/^(?:PAN INDIA|India)$/.test(row.Location)&&slugCounts.get(row.Slug)>1).length,
   observedIndiaCount:opening.filter(row=>/^(?:PAN INDIA|India)$/.test(row.Location)).length,returnedCount:jobs.length,outputLimited:stable.length>maxJobs,
   originalOpeningRecords:opening,originalClosingRecords:closing,openingClosingRecordsMatch:canonicalNativeRecord(opening)===canonicalNativeRecord(closing),
   closingReconciled:true,holds,activationVerified:false,lifecycleCleanupAllowed:false,observationTime:observedAt,reader:redactedStats(reader)}
  attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,reportedTotal:null,indiaFacetCount:null,
   pagesFetched:audit.reader.requests,verifiedAt:observedAt,lifecycleCleanupAllowed:false,reason:'native-unique-explicit-India-details-reconciled;city-only-and-ambiguous-identities-held;company-scope-unqualified'})
  need(Buffer.byteLength(JSON.stringify({jobs,audit}))<=8*1024*1024,'Native output byte budget exceeded')
  reader.check();return jobs
 }finally{token=null;reader.close()}
}
