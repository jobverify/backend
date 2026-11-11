import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {decodeHTML} from 'entities'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {parseEightfoldJson as parseNativeJSON} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'

export const CORPORATE='https://www.huntress.com/company/careers'
export const BOARD='https://job-boards.greenhouse.io/huntress'
export const API='https://boards-api.greenhouse.io/v1/boards/huntress/jobs?content=true'
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const failure=message=>Object.assign(Error('Huntress current programme: '+message),{
 code:'HUNTRESS_PROGRAMME_HOLD',softFailure:true,upstreamOutage:false,abortRetries:true,
 failureKind:'coverage_gap',lifecycleCleanupAllowed:false})
export const need=(value,message)=>{if(!value)throw failure(message)}
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)
 &&isDeepStrictEqual(Object.keys(value).sort(),[...keys].sort())
const norm=value=>String(value??'').replace(/\s+/gu,' ').trim()
const kids=node=>node.children.filter(child=>typeof child!=='string')
const walk=(node,ancestors=[])=>[{node,ancestors},...kids(node).flatMap(child=>walk(child,[...ancestors,node]))]
const text=node=>norm(node.children.map(child=>typeof child==='string'?decodeHTML(child):text(child)).join(' '))
const one=(rows,label)=>{need(rows.length===1,'Expected unique '+label);return rows[0]}
const cls=(node,value)=>(node.attrs.class||'').split(/\s+/).includes(value)
const attrs=(node,expected)=>isDeepStrictEqual(node.attrs,expected)
const integer=value=>Number.isSafeInteger(value)&&value>0
const integerList=value=>Array.isArray(value)&&value.every(integer)&&new Set(value).size===value.length
const ids=value=>Array.isArray(value)&&value.every(row=>integer(row.id))&&new Set(value.map(row=>row.id)).size===value.length
const json=raw=>{try{return parseNativeJSON(raw)}catch(error){throw failure('Unqualified original JSON: '+error.message)}}
const contentTags=new Set(['root','div','p','strong','ul','li','em','a','span','h3','br','h4'])
const blockTags=new Set(['div','p','ul','li','h3','br','h4'])
const publishedText=node=>{
 const value=node.children.map(child=>typeof child==='string'?decodeHTML(child):publishedText(child)).join('')
 return blockTags.has(node.tag)?' '+value+' ':value
}
const publishedContent=raw=>{
 const decoded=decodeHTML(raw),document=readNativeDocument(decoded),root=one(document.nodes(n=>n.tag==='root'),'published API description')
 const entries=walk(root)
 need(entries.every(({node})=>contentTags.has(node.tag)&&!node.nativeTagUnqualified
  &&!Object.keys(node.attrs).some(key=>/^on/i.test(key)||['srcdoc','xmlns','src'].includes(key))),
 'Unreviewed published API HTML/carrier/application programme')
 need(norm(publishedText(root)).length>100,'Missing authored native API description')
 need(!/\bIndia\b/i.test(decoded)&&!/\bIndia\b/i.test(publishedText(root)),'Published native content has unresolved India scope')
}

// These are complete reviewed current representations. Only the two observed
// delivery components below are comparison-only variants; all other bytes stay
// pinned, including hidden declarations, original loader data and CSP carriers.
const CORPORATE_PROFILE='7af639dcd2c5a0cf865fb95358d3301b31cd978405a2ee56746ed92c59744cf5'
const RUNTIME={clock:'ee6bb81f4e9fc030a39a7c71affc4d1f2b900baa4b4c7af83361388d7c39599b',
 replacement:'4009527b06902e2fcd3c2ce78c0652caf43bda1783d1577198d0c3919782c607',
 close:'a7b184efc6db3070eb138216ce988c4adb40b13a54bbbc308b9ff0be71f9e0eb'}
export function corporateProgramme(original){
 let html=original
 const gallery=/<div id="photo-gallery-section-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-carousel" class="flex flex-col w-full justify-center items-center carousel-wrapper-style ">/g
 const galleries=[...html.matchAll(gallery)]
 need(galleries.length===2&&galleries[0][1]===galleries[1][1]
  &&html.split(galleries[0][1]).length-1===2,'Unreviewed corporate gallery instance/reference')
 need(galleries.every(match=>html.slice(match.index+match[0].length).startsWith('<div class="splide" aria-label="We Are Huntress">')),
  'Corporate gallery authority context changed')
 html=html.replace(gallery,'<div id="photo-gallery-section-<reviewed-gallery-instance>-carousel" class="flex flex-col w-full justify-center items-center carousel-wrapper-style ">')
 const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
 const enqueue=one(scripts.filter(m=>m[1]===''&&m[2].startsWith('window.__reactRouterContext.streamController.enqueue(')),'corporate loader enqueue')
 const close=one(scripts.filter(m=>m[1]===''&&m[2]==='window.__reactRouterContext.streamController.close();'),'corporate loader close')
 const marker='import("/assets/entry.client-BnfsZT6Y.js");</script>'
 need(html.split(marker).length-1===1,'Corporate current entry boundary changed')
 const at=html.indexOf(marker)+marker.length,prefix=html.slice(0,at),tail=html.slice(at)
 const complete='<!--$-->'+enqueue[0]+'<!--$-->'+close[0]+'<!--/$--><!--/$--></body></html>'
 let variant='completed-react-stream'
 if(tail!==complete){
  const clock=one(scripts.filter(m=>m[1]===' id="_R_"'&&sha(m[2])===RUNTIME.clock),'reviewed stream clock')
  const replacement=one(scripts.filter(m=>m[1]===''&&sha(m[2])===RUNTIME.replacement),'reviewed stream replacement')
  const closing=one(scripts.filter(m=>m[1]===''&&sha(m[2])===RUNTIME.close),'reviewed stream completion')
  const pending='<!--$?--><template id="B:0"></template><!--/$-->'+clock[0]+'<div hidden id="S:0">'+enqueue[0]
   +'<!--$?--><template id="B:1"></template><!--/$--></div>'+replacement[0]+'<div hidden id="S:1">'+close[0]+'</div>'+closing[0]+'</body></html>'
  need(tail===pending,'Unreviewed corporate stream envelope or moved original data')
  for(const id of ['B:0','B:1','S:0','S:1','_R_'])need(html.split('id="'+id+'"').length-1===1,'Ambiguous corporate stream boundary')
  variant='pending-react-stream-with-exact-reviewed-runtime'
 }
 const canonical=prefix+enqueue[0]+close[0]+'</body></html>',canonicalSHA256=sha(canonical)
 need(canonicalSHA256===CORPORATE_PROFILE,'Unreviewed corporate authority/programme/loader bytes')
 return {canonicalSHA256,variant,declaredNativeProgramme:BOARD,originalHrefRetained:true,
  galleryInstance:galleries[0][1],comparisonOnly:true,unknownDifferencesIgnored:false}
}

const STATIC_MODEL='85c4ec231a9605b4815b9d5409c5e045a04a69a6d58286dbff2274e1d125980e'
const STATIC_SHELL='764b1510c80a39177b49aaf6af8286eaae59be9f4cce0f6ea0e0427675beb5ee'
const ROW=/<tr class="job-post">[\s\S]*?<\/tr>/g
const COUNT=/<h2[^>]*data-testid="job-count-header"[^>]*>[\s\S]*?<\/h2>/g
const POST_KEYS=['id','title','internal_job_id','updated_at','requisition_id','location','absolute_url','published_at','department','is_featured']
const apiKeys=['absolute_url','data_compliance','internal_job_id','location','metadata','id','updated_at','requisition_id','title',
 'company_name','first_published','language','application_deadline','content','departments','offices','ai_disclaimer','include_ai_disclaimer','ai_opt_out_request_url']
const roleURL=(id,value)=>integer(id)&&value===BOARD+'/jobs/'+id
const country=value=>{
 need(typeof value==='string'&&value.length>0,'Missing written native country')
 const known={'United States of America':'United States','Remote US':'United States','Remote UK':'United Kingdom','Remote Ireland':'Ireland'}
 const result=known[value]||nativeCountryName(value)
 need(result,'Unknown native country/application scope')
 if(result==='India')throw Object.assign(failure('India requires the existing qualified positive reader'),{positiveReaderRequired:true})
 return result
}
const date=(value,label,now)=>{
 need(typeof value==='string','Missing original '+label)
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})$/.exec(value)
 need(m,'Unsupported original '+label+' precision/timezone')
 const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number),days=new Date(Date.UTC(year,month,0)).getUTCDate()
 const offset=m[7]==='Z'?[0,0]:m[7].slice(1).split(':').map(Number)
 need(year>=1970&&month>=1&&month<=12&&day>=1&&day<=days&&hour<=23&&minute<=59&&second<=59
  &&offset[0]<=14&&offset[1]<=59&&(offset[0]!==14||offset[1]===0)&&Number.isFinite(Date.parse(value))
  &&Date.parse(value)<=Date.parse(now),'Invalid original '+label+' calendar/clock/currentness')
}

export function nativeBoard(html,now){
 const document=readNativeDocument(html),root=one(document.nodes(n=>n.tag==='root'),'native document'),entries=walk(root)
 const carriers=entries.filter(({node})=>node.tag==='script'&&(node.raw||'').includes('window.__remixContext'))
 const {node:carrier,ancestors}=one(carriers,'native Remix carrier')
 need(attrs(carrier,{})&&!carrier.inert&&!ancestors.some(n=>n.inert||n.nativeTagUnqualified||['svg','math','object','template','noscript'].includes(n.tag)),
  'Unqualified native carrier/source/ancestor')
 const match=/^window\.__remixContext = ([\s\S]+);$/.exec(carrier.raw||'')
 need(match,'Native literal loader assignment changed')
 const model=json(match[1]),route=model?.state?.loaderData?.['routes/$url_token'],posts=route?.jobPosts
 need(exact(posts,['count','page','total','total_pages','data'])&&Array.isArray(posts.data)&&posts.data.length>0&&posts.data.length<=200
  &&posts.page===1&&posts.total_pages===1&&posts.count===posts.data.length&&posts.total===posts.data.length,
 'Incomplete/filtered native programme paging/count')
 const fixed=structuredClone(model);delete fixed.state.loaderData['routes/$url_token'].jobPosts
 need(sha(JSON.stringify(fixed))===STATIC_MODEL,'Unreviewed native scope/filter/config/employer model')
 need(ids(posts.data),'Duplicate native posting identity')
 for(const row of posts.data){
  need(exact(row,POST_KEYS)&&integer(row.internal_job_id)&&typeof row.title==='string'&&norm(row.title)
   &&roleURL(row.id,row.absolute_url)&&typeof row.requisition_id==='string'&&row.is_featured===false,
  'Unreviewed native posting identity/model')
  country(row.location);date(row.published_at,'SSR publication',now);date(row.updated_at,'SSR revision',now)
  need(exact(row.department,['name','id','path'])&&integer(row.department.id)&&typeof row.department.name==='string'
   &&Array.isArray(row.department.path)&&row.department.path.every(value=>typeof value==='string'),'Unknown native department model')
 }
 const rawRows=[...html.matchAll(ROW)],activeRows=entries.filter(({node})=>node.tag==='tr'&&cls(node,'job-post'))
 need(rawRows.length===posts.data.length&&activeRows.length===rawRows.length,'Unmatched native raw/active card inventory')
 const byId=new Map(posts.data.map(row=>[row.id,row])),seen=new Set(),cards=[]
 for(const {node:row,ancestors:path}of activeRows){
  need(!row.inert&&attrs(row,{class:'job-post'})&&!path.some(n=>n.inert||['svg','math','object','template'].includes(n.tag)),
   'Unqualified native visible card carrier')
  const td=one(kids(row),'card cell'),a=one(kids(td),'own-role anchor'),paragraphs=kids(a)
  need(attrs(td,{class:'cell'})&&td.tag==='td'&&a.tag==='a'&&paragraphs.length===2&&paragraphs.every(p=>p.tag==='p'),
   'Native card hierarchy/extra criterion changed')
  const id=Number(a.attrs.href?.split('/').at(-1)),expected=byId.get(id)
  need(expected&&!seen.has(id)&&attrs(a,{href:expected.absolute_url,target:'_top'}),'Unmatched native own-role card link')
  seen.add(id)
  const [title,location]=paragraphs
  need(attrs(title,{class:'body body--medium'})&&attrs(location,{class:'body body__secondary body--metadata'})&&kids(location).length===0,
   'Unreviewed native card title/location model')
  const badges=kids(title)
  need(badges.length<=1,'Additional card criterion/badge')
  if(badges.length){
   const badge=badges[0],ellipse=one(kids(badge),'badge ellipse'),label=one(kids(ellipse),'badge text')
   need(badge.tag==='span'&&attrs(badge,{class:'tag-container',style:'margin-left:8px'})&&ellipse.tag==='span'
    &&attrs(ellipse,{class:'ellipse'})&&label.tag==='span'&&attrs(label,{class:'tag-text'})&&kids(label).length===0
    &&text(label)==='New'&&text(badge)==='New','Unreviewed card badge criteria')
  }
  const writtenTitle=norm(title.children.filter(child=>typeof child==='string').map(decodeHTML).join(' '))
  need(writtenTitle===norm(expected.title)&&text(location)===norm(expected.location)
   &&text(row)===norm(expected.title+(badges.length?' New':'')+' '+expected.location),'Whole native card title/location criteria conflict')
  cards.push({id,url:expected.absolute_url,title:expected.title,location:expected.location,newBadge:badges.length===1})
 }
 const headings=[...html.matchAll(COUNT)]
 need(headings.length===1&&headings[0][0]===`<h2 class="section-header section-header--large font-primary" data-testid="job-count-header">${posts.data.length} jobs</h2>`,
  'Native published visible count changed')
 const shell=html.replace(carrier.raw,'<reviewed-native-model>').replace(ROW,'').replace(COUNT,'<reviewed-job-count>')
 need(sha(shell)===STATIC_SHELL,'Unreviewed native page programme/carrier/control/criterion bytes')
 return {model,posts:posts.data,cards,reportedTotal:posts.total,canonicalMetadataURL:'http://job-boards.greenhouse.io/huntress',
  requestedHTTPSURL:BOARD,canonicalHTTPMetadataRetained:true,revisionDifferenceCauseVerified:false}
}

export function nativeAPI(raw,board,now){
 const value=json(raw)
 need(exact(value,['jobs','meta'])&&exact(value.meta,['total'])&&Array.isArray(value.jobs)&&value.jobs.length>0
  &&value.jobs.length<=200&&value.meta.total===value.jobs.length,'Incomplete native public API count/model')
 need(ids(value.jobs),'Duplicate native public posting IDs')
 for(const row of value.jobs){
  need(exact(row,apiKeys),'Unreviewed full native API criteria/country fields')
  need(row.company_name==='Huntress Labs'&&integer(row.internal_job_id)&&roleURL(row.id,row.absolute_url)
   &&typeof row.title==='string'&&norm(row.title)&&typeof row.requisition_id==='string','Native API employer/own-role identity changed')
  need(!/\bIndia(?:n)?\b/i.test(decodeHTML(row.title)),'Native API title has unresolved India scope')
  need(exact(row.location,['name']),'Unknown nested native primary location/country fields');country(row.location.name)
  need(row.metadata===null&&row.application_deadline===null&&row.ai_disclaimer===null&&row.include_ai_disclaimer===null
   &&row.ai_opt_out_request_url===null&&row.language==='en','Unreviewed native metadata/application/AI/deadline scope')
  need(Array.isArray(row.offices)&&row.offices.length>0&&ids(row.offices),'Unresolved native office scope')
  for(const office of row.offices){
   need(exact(office,['id','name','location','child_ids','parent_id'])&&integerList(office.child_ids)
    &&(office.parent_id===null||integer(office.parent_id)),'Unreviewed native office hierarchy/country fields')
   country(office.name);if(office.location!==null)country(office.location)
  }
  need(Array.isArray(row.departments)&&row.departments.length>0&&ids(row.departments),'Unresolved native departments')
  for(const department of row.departments)need(exact(department,['id','name','child_ids','parent_id'])
   &&typeof department.name==='string'&&integerList(department.child_ids)&&(department.parent_id===null||integer(department.parent_id)),
  'Unreviewed native department hierarchy')
  need(Array.isArray(row.data_compliance)&&row.data_compliance.length===1&&isDeepStrictEqual(row.data_compliance[0],{
   type:'gdpr',requires_consent:false,requires_processing_consent:false,requires_retention_consent:false,
   retention_period:null,demographic_data_consent_applies:false}),'Unreviewed native applicant/compliance model')
  need(typeof row.content==='string'&&row.content.length>100,'Missing full published API criteria')
  publishedContent(row.content)
  date(row.first_published,'API publication',now);date(row.updated_at,'API revision',now)
 }
 need(value.jobs.length===board.posts.length,'Native SSR/API programme totals disagree')
 const byId=new Map(value.jobs.map(row=>[row.id,row])),revisionDifferences=[]
 for(const row of board.posts){
  const api=byId.get(row.id)
  need(api&&['id','title','internal_job_id','requisition_id','absolute_url'].every(key=>api[key]===row[key])
   &&api.location.name===row.location&&api.first_published===row.published_at
   &&api.departments.some(d=>d.id===row.department.id&&d.name===row.department.name),'Native SSR/full API posting identity/country disagreement')
  if(row.updated_at!==api.updated_at)revisionDifferences.push({id:row.id,SSRUpdatedAt:row.updated_at,APIUpdatedAt:api.updated_at})
 }
 return {value,revisionDifferences}
}
