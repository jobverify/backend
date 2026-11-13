import {createHash} from 'node:crypto'
import {activeHead,readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const careers='https://www.e2open.com/company/careers/',jobsPage='https://www.e2open.com/jobs/'
const client='https://www.e2open.com/sb/e2open-js.v170.js',clientSHA='1582b7172edc05d3e71cf9e2000801fd79baea428ad6740a97c1af3570f2b522'
const api='https://boards-api.greenhouse.io/v1/boards/e2openllc/',board='https://job-boards.eu.greenhouse.io/e2openllc'
const urls=[api+'jobs',api+'departments?render_as=tree',api+'offices?render_as=tree']
const need=(condition,reason)=>{if(!condition)throw Object.assign(Error('e2open current Greenhouse: '+reason),{abortRetries:true})}
const hash=value=>createHash('sha256').update(value).digest('hex')
const text=value=>String(value??'').replace(/\s+/g,' ').trim()
const canonical=value=>JSON.stringify(value,(_,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))):row)
const id=value=>Number.isSafeInteger(value)&&value>=0
const classic=node=>!Object.keys(node.attrs).some(key=>!['src','type','defer','async','nonce'].includes(key))&&(!node.attrs.type||/^(?:text|application)\/(?:java|ecma)script$/i.test(node.attrs.type))
const absolute=value=>{try{return new URL(value,jobsPage).href}catch{return null}}

export function hasCurrentGreenhouseMarker(html){
 return readNativeDocument(html).nodes(node=>node.attrs.id==='page-block-greenhouse'||node.tag==='script'&&typeof node.attrs.src==='string'&&/\/sb\/e2open-js\.v\d+\.js$/.test(absolute(node.attrs.src)||'')).length>0
}
function publisher(careersHtml,jobsHtml){
 for(const [html,title]of [[careersHtml,'Supply Chain Careers with e2open - Supply Chain Software'],[jobsHtml,'Jobs - Supply Chain Software | Strategic Digital Supply Chain | e2open']]){
  const head=activeHead(html),doc=readNativeDocument(html),scripts=doc.nodes(node=>node.tag==='script'&&absolute(node.attrs.src)===client)
  need(head.titles.length===1&&head.titles[0]===title&&scripts.length===1&&classic(scripts[0]),'current publisher client handoff changed')
 }
 const careerdoc=readNativeDocument(careersHtml),doc=readNativeDocument(jobsHtml)
 need(careerdoc.nodes(node=>node.tag==='a'&&absolute(node.attrs.href)===jobsPage&&/View our open positions|Search e2open Jobs/i.test(careerdoc.text(node))).length>=2,'current corporate jobs handoff changed')
 const containers=doc.nodes(node=>node.attrs.id==='page-block-greenhouse')
 need(containers.length===1&&containers[0].tag==='section'&&doc.nodes(node=>node.attrs.id==='jobs-data',containers[0]).length===1,'current native client container handoff changed')
}
function inventory(bodies){
 const [list,departments,offices]=bodies.map(body=>JSON.parse(body))
 need(list&&Object.keys(list).length===2&&Array.isArray(list.jobs)&&list.meta&&Object.keys(list.meta).length===1&&Number.isSafeInteger(list.meta.total)&&list.meta.total===list.jobs.length&&list.jobs.length<=1000,'native jobs pagination or total changed')
 const jobs=new Map()
 for(const row of list.jobs){
  need(row&&id(row.id)&&row.id>0&&!jobs.has(row.id)&&text(row.title)&&row.location&&typeof row.location.name==='string'
   &&row.absolute_url===board+'/jobs/'+row.id&&row.company_name==='e2open','native role identity, employer or application URL changed')
  jobs.set(row.id,row)
 }
 const memberships=[],officeMemberships=[],departmentIds=new Set(),officeIds=new Set()
 function references(rows,scope,target){
  need(Array.isArray(rows)&&rows.length<=1000,'native department jobs shape changed')
  const seen=new Set()
  for(const row of rows){const native=jobs.get(row?.id);need(native&&!seen.has(row.id)&&row.absolute_url===native.absolute_url&&text(row.title)===text(native.title)&&text(row.location?.name)===text(native.location.name),'native department membership identity changed');seen.add(row.id);target.push({jobId:row.id,scope})}
 }
 function departmentTree(rows,depth=0,prefix='',seen=departmentIds,target=memberships){
  need(Array.isArray(rows)&&rows.length<=1000&&depth<=8,'native department tree or pagination changed')
  for(const row of rows){need(row&&id(row.id)&&!seen.has(row.id)&&text(row.name)&&Array.isArray(row.children),'native department identity changed');seen.add(row.id);references(row.jobs,prefix+row.id,target);departmentTree(row.children,depth+1,prefix,seen,target)}
 }
 need(departments&&Object.keys(departments).length===1&&Object.hasOwn(departments,'departments'),'native department envelope changed')
 departmentTree(departments.departments)
 function officeDepartments(rows,prefix){
  need(Array.isArray(rows)&&rows.length<=1000,'native office department envelope changed')
  const byId=new Map()
  for(const row of rows){need(row&&id(row.id)&&!byId.has(row.id)&&text(row.name)&&Array.isArray(row.child_ids)&&row.child_ids.every(id)&&(row.parent_id===null||id(row.parent_id)),'native office department identity changed');byId.set(row.id,row);references(row.jobs,prefix+row.id,officeMemberships)}
  for(const row of rows){
   need(row.parent_id===null||byId.get(row.parent_id)?.child_ids.includes(row.id),'native office parent department changed')
   need(new Set(row.child_ids).size===row.child_ids.length&&row.child_ids.every(child=>byId.get(child)?.parent_id===row.id),'native office child department changed')
   const seen=new Set([row.id]);let parent=row.parent_id
   while(parent!==null){need(!seen.has(parent),'native office department cycle');seen.add(parent);parent=byId.get(parent).parent_id}
  }
 }
 function officeTree(rows,depth=0){
  need(Array.isArray(rows)&&rows.length<=1000&&depth<=8,'native office tree or pagination changed')
  for(const row of rows){need(row&&id(row.id)&&!officeIds.has(row.id)&&text(row.name)&&Array.isArray(row.children),'native office identity changed');officeIds.add(row.id);officeDepartments(row.departments,'office:'+row.id+':');officeTree(row.children,depth+1)}
 }
 need(offices&&Object.keys(offices).length===1&&Object.hasOwn(offices,'offices'),'native office envelope changed');officeTree(offices.offices)
 // The acquired client finalObject()/findDeep() renders top-level department
 // jobs only. Office names and loose child.location matching are filter labels,
 // never a typed country assignment to the role.
 const renderedNativeIds=[...new Set(departments.departments.flatMap(row=>row.jobs.map(job=>job.id)))]
 return{list,departments,offices,memberships,officeMemberships,renderedNativeIds}
}
const criterionTags=new Set(['root','div','p','span','em','strong','b','i','u','s','br','ul','ol','li','h1','h2','h3','h4','h5','h6','blockquote','pre','code'])
const plain=node=>typeof node==='string'||criterionTags.has(node.tag)&&!node.nativeTagUnqualified&&!Object.keys(node.attrs).length&&node.children.every(plain)
function criterion(value){
 if(typeof value!=='string')return{visible:false,text:null}
 const doc=readNativeDocument(value),visible=readVisibleNativeDocument(value,{strict:true}),root=doc.nodes(node=>node.tag==='root')[0],shown=visible.nodes(node=>node.tag==='root')[0]
 const raw=node=>typeof node==='string'?decodeNativeEntities(node):typeof node.raw==='string'?decodeNativeEntities(node.raw):node.children.map(raw).join(' ')
 const original=root?text(raw(root)):null,rendered=shown?text(visible.text(shown)):null
 return{visible:Boolean(root&&shown&&plain(root)&&original===text(doc.text(root))&&original===rendered),text:rendered}
}
function nativeDetail(native,html){
 const doc=readNativeDocument(html),visible=readVisibleNativeDocument(html,{strict:true}),head=activeHead(html)
 const scripts=doc.nodes(node=>node.tag==='script'&&!node.attrs.src&&/^\s*window\.__remixContext\s*=/.test(node.raw||''))
 need(scripts.length===1&&classic(scripts[0]),'native detail data is not one active classic declaration')
 const match=scripts[0].raw.match(/^\s*window\.__remixContext\s*=\s*(\{[\s\S]*\})\s*;?\s*$/)
 need(match,'native detail literal contract changed')
 const data=JSON.parse(match[1]),root=data.state?.loaderData?.root,value=data.state?.loaderData?.['routes/$url_token_.jobs_.$job_post_id'],post=value?.jobPost
 const headings=visible.nodes(node=>node.tag==='h1'),descriptions=doc.nodes(node=>doc.hasClass(node,'job__description')),shown=visible.nodes(node=>visible.hasClass(node,'job__description'))
 need(data.isSpaMode===false&&root?.internal===false&&root.preview===false&&root.urlToken==='e2openllc'&&root.isJobPost===true
  &&value?.urlToken==='e2openllc'&&value.jobPostId===String(native.id)&&post?.public_url===native.absolute_url&&post.company_name==='e2open'
  &&text(post.title)===text(native.title)&&text(post.job_post_location)===text(native.location.name)
  &&head.titles.length===1&&head.titles[0]==='Job Application for '+text(native.title)+' at e2open'
  &&head.metas.some(row=>row.property==='og:url'&&row.content===native.absolute_url)&&headings.length===1&&text(visible.text(headings[0]))===text(native.title),'native detail identity or current employer binding changed')
 const criteria=[post.introduction,post.content,post.conclusion].map(criterion)
 const description=text(criteria.map(row=>row.text).join(' '))
 const fullNativeCriteriaVisible=criteria.every(row=>row.visible)&&descriptions.length===1&&shown.length===1
  &&Object.keys(descriptions[0].attrs).every(key=>key==='class')&&descriptions[0].attrs.class==='job__description body'
  &&descriptions[0].children.filter(row=>typeof row==='object').every(plain)&&description===text(visible.text(shown[0]))
 const forms=visible.nodes(node=>node.tag==='form'&&node.attrs.id==='application-form')
 const activeApplication=post.redirect_to===null&&value.submitPath==='https://boards.eu.greenhouse.io/e2openllc/jobs/'+native.id
  &&forms.length===1&&forms[0].attrs.method==='get'&&absolute(new URL(forms[0].attrs.action,native.absolute_url).href)===native.absolute_url
  &&visible.nodes(node=>node.tag==='button'&&node.attrs.type==='submit'&&!Object.hasOwn(node.attrs,'disabled')&&node.attrs['aria-disabled']==='false'&&text(visible.text(node))==='Submit application',forms[0]).length===1
 const vacancy=post.post_type!=='prospect_post'
 return{nativeDetailRecord:value,sha256:hash(html),fullNativeCriteriaVisible,activeApplication,vacancy,description,
  // The current source exposes only a prospect_post. A new vacancy type or
  // country carrier needs its own actual native contract review before output.
  sourceDetailComplete:false,sourceCountryEvidence:null,holds:[vacancy?'new-native-vacancy-country-and-render-contract-unreviewed':'native-prospect-post-is-not-a-vacancy',...(!fullNativeCriteriaVisible?['unqualified-full-original-criteria']:[]),...(!activeApplication?['inactive-or-unqualified-native-application']:[])]}
}
export async function readCurrentGreenhouse({careersHtml,jobsHtml,readText,onAudit,now=()=>new Date().toISOString()}){
 publisher(careersHtml,jobsHtml)
 let pagesFetched=2
 const read=async url=>{pagesFetched++;const body=await readText(url);need(typeof body==='string'&&Buffer.byteLength(body)<=4000000,'bounded original native body required');return body}
 const program=async()=>{const code=await read(client);need(hash(code)===clientSHA,'declared client program changed')}
 await program()
 const opening=inventory(await Promise.all(urls.map(read))),details=new Map()
 for(const row of opening.list.jobs){const html=await read(row.absolute_url);details.set(row.id,{html,proof:nativeDetail(row,html)})}
 const closing=inventory(await Promise.all(urls.map(read)))
 need(canonical(opening)===canonical(closing),'closing full native inventory or department/office membership changed')
 const observations=[]
 for(const row of opening.list.jobs){
  const before=details.get(row.id),html=await read(row.absolute_url),after=nativeDetail(row,html)
  need(canonical(before.proof.nativeDetailRecord)===canonical(after.nativeDetailRecord),'closing native detail criteria or application model changed')
  observations.push({nativeSourceRecord:row,...before.proof,fullNativeCriteriaVisible:before.proof.fullNativeCriteriaVisible&&after.fullNativeCriteriaVisible,activeApplication:before.proof.activeApplication&&after.activeApplication,
   nativeOpeningDetailHTML:before.html,nativeClosingDetailHTML:html,nativeOpeningDetailSHA256:before.proof.sha256,nativeClosingDetailSHA256:after.sha256,
   renderedByCurrentDepartmentClient:opening.renderedNativeIds.includes(row.id),sourceScopeComplete:false,lifecycleCleanupAllowed:false})
 }
 publisher(await read(careers),await read(jobsPage));await program()
 const vacancies=observations.filter(row=>row.vacancy).length,jobs=[]
 const audit={source:'e2open',recordKind:vacancies?'mixed':'hiring-signals',observedRecordCount:opening.list.jobs.length,observedVacancyCount:vacancies,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,
  currentClient:{url:client,sha256:clientSHA},sourceNativeRaw:opening.list.jobs,sourceNativeMeta:opening.list.meta,sourceNativeDepartments:opening.departments,sourceNativeOffices:opening.offices,
  closingNativeRaw:closing.list.jobs,closingNativeDepartments:closing.departments,closingNativeOffices:closing.offices,renderedNativeIds:opening.renderedNativeIds,
  unrenderedNativeIds:opening.list.jobs.filter(row=>!opening.renderedNativeIds.includes(row.id)).map(row=>row.id),departmentMemberships:opening.memberships,officeMemberships:opening.officeMemberships,
  openingClosingMatched:true,observations,pagesFetched,productionWrites:false,websiteJavaScriptExecuted:false,reason:'current-published-Greenhouse-department-renderer; all-declared-native-feeds-and-full-detail-models-reconciled; prospect-posts-are-not-vacancies; new-vacancy-contract-and-company-scope-remain-unqualified'}
 attachSourceObservationEvidence(jobs,audit);Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
 onAudit?.(structuredClone(audit))
 return attachInventoryEvidence(jobs,{status:'coverage-gap',firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,surface:jobsPage,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:audit.reason})
}
