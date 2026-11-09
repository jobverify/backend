import { createHash } from 'node:crypto'
import { readNativeDocument, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { visibleDocument, visibleText } from './nativeVisibility.js'

export const SOURCE='valtechindiasystems', COMPANY='Valtech'
export const CAREER_LANDING_URL='https://www.valtech.com/en-in/career/', JOBS_URL=CAREER_LANDING_URL+'jobs/'
export const JOBS_API_URL='https://www.valtech.com/joblist/getjsonresult?id=1571&language=en-IN&limit=100', INDIA_COUNTRY_TAG='india'
export const NATIVE_BOARD_URL='https://job-boards.eu.greenhouse.io/valtech', NATIVE_BOARD_ID=4003061101
const B=NATIVE_BOARD_URL, C=CAREER_LANDING_URL, J=JOBS_URL, TOKEN='valtech'
const clean=value=>decodeNativeEntities(value).replace(/\s+/g,' ').trim(), folded=value=>clean(value).toLowerCase(), compact=value=>clean(value).replace(/\s/g,'')
const cls=(n,value)=>(n.attrs.class||'').split(/\s+/).includes(value), object=value=>value&&typeof value==='object'&&!Array.isArray(value)
const hash=value=>createHash('sha256').update(value).digest('hex'), nativeUrl=id=>B+'/jobs/'+id
export class ValtechIdentityError extends Error { constructor(message) { super('Valtech native identity: '+message); this.name='ValtechIdentityError'; this.abortRetries=true } }
const valid=(condition,message)=>{if(!condition)throw new ValtechIdentityError(message)}
const one=(nodes,label)=>{valid(nodes.length===1,'expected one '+label);return nodes[0]}
const heading=(doc,className,label)=>{const marked=doc.nodes(n=>n.tag==='h1'&&cls(n,className));return one(marked.length?marked:doc.nodes(n=>n.tag==='h1'),label)}
const listingText=(doc,node)=>{if(typeof node==='string')return node;if(node.inert)return '';if(cls(node,'tag-container')){valid(doc.text(node)==='New','unreviewed native listing badge');return ''}return node.children.map(child=>listingText(doc,child)).join(' ')}
const parse=value=>{try{return JSON.parse(value)}catch{throw new ValtechIdentityError('invalid public JSON')}}
export const decodeCorporatePayload=body=>{const value=typeof body==='string'?parse(body):body;return typeof value==='string'?parse(value):value}
const absolute=(value,base=J)=>{try{return new URL(value,base).href}catch{return null}}
const countryNames=new Map(), regions=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'})
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=regions.of(code);if(name&&!['ZZ','XA','XB','UN','EU','EZ','QO'].includes(code)){countryNames.set(folded(name),code);countryNames.set(folded(code),code)}}
for(const [name,code]of[['United States of America','US'],['USA','US'],['United Kingdom','GB'],['UK','GB']])countryNames.set(folded(name),code)
const country=value=>typeof value==='string'?countryNames.get(folded(value))||null:null
export const buildIndiaJobsApiUrl=({jobsApiUrl=JOBS_API_URL,countryTag=INDIA_COUNTRY_TAG,offset=0,limit=100}={})=>{const url=new URL(jobsApiUrl);url.searchParams.set('offset',String(offset));url.searchParams.set('limit',String(limit));url.searchParams.set('country',countryTag);return url.href}
export const extractJobsApiUrl=html=>{
 const doc=readNativeDocument(html),nodes=doc.nodes(n=>n.tag==='react'&&n.attrs['data-react-component-name']==='JobsPage')
 return nodes.length===1?absolute(nodes[0].attrs['data-url']):null
}
export const hasOfficialCareerLandingSignal=html=>{const d=visibleDocument(html);return d.nodes(n=>n.tag==='title'&&clean(n.raw)==='Career | Valtech').length===1&&d.nodes(n=>n.tag==='h1'&&d.text(n)==='Wanted: Innovators, Thinkers, Doers').length===1&&d.nodes(n=>n.tag==='a'&&absolute(n.attrs.href)===J).length>0}
export const hasOfficialJobsPageSignal=html=>{const d=visibleDocument(html);return d.nodes(n=>n.tag==='title'&&clean(n.raw)==='Jobs | Valtech').length===1&&extractJobsApiUrl(html)===JOBS_API_URL}
export const extractJobListingsFromApi=input=>{
 const payload=decodeCorporatePayload(input),tags=payload.filters?.find(value=>value.value==='country')?.tags||[]
 return (payload.list||[]).map(item=>{const codes=[...new Set((item.tags||[]).flatMap(tag=>tags.filter(t=>t.value===tag).map(t=>country(t.text))).filter(Boolean))];return {...item,sourceUrl:absolute(item.url),location:(item.offices||[]).join(' / ')||null,country:codes.length===1&&codes[0]==='IN'?'India':null,requisitionId:null}})
}
const corporateUrl=value=>{const url=new URL(value,C);valid(url.origin==='https://www.valtech.com'&&/^\/en-in\/career\/jobs\/[a-z0-9-]+\/$/i.test(url.pathname)&&!url.search&&!url.hash,'first-party posting path changed');return url.href}
const rowState=row=>JSON.stringify(row)
const nativeState=row=>JSON.stringify([row?.id,row?.internal_job_id,row?.title,row?.location,row?.absolute_url,row?.requisition_id,row?.published_at,row?.updated_at,row?.department])
const sourceScope=(html,base,reasons)=>{
 const doc=visibleDocument(html)
 if(doc.frames().length)reasons.add('additional-active-frame-hiring-scope')
 for(const node of doc.nodes(n=>n.tag==='a'&&n.attrs.href||n.tag==='iframe'&&n.attrs.src)){
  const url=absolute(node.attrs.href||node.attrs.src,base);if(!url)continue
  const u=new URL(url)
  if(['mailto:','tel:'].includes(u.protocol))continue
  if(u.origin==='https://job-boards.cdn.greenhouse.io'&&u.pathname.startsWith('/docs/'))continue
  if(u.origin==='https://www.valtech.com'&&/^\/(?:en-[a-z]{2}\/)?career(?:\/|$)/.test(u.pathname))continue
  if(u.origin===new URL(B).origin&&/^\/valtech(?:\/jobs\/\d+)?\/?$/.test(u.pathname)&&!u.search)continue
  if(node.tag==='iframe'||/(?:greenhouse\.io|careers\.india\.valtech\.com|teamtailor\.com|lever\.co|workable\.com|myworkdayjobs\.com)$/i.test(u.hostname)||/\b(?:jobs?|careers?|openings?|opportunities)\b/i.test(doc.text(node)))reasons.add('additional-public-hiring-scope:'+u.origin+u.pathname)
 }
}
const model=(html,isJob)=>{
 const native=readNativeDocument(html),scripts=native.nodes(n=>n.tag==='script'&&!n.attrs.src&&!Object.hasOwn(n.attrs,'nomodule')&&/^(?:|text\/javascript|application\/javascript)$/i.test(n.attrs.type||'')&&(n.raw||'').includes('window.__remixContext'))
 const assignment=one(scripts,'active native model').raw.match(/^\s*window\.__remixContext\s*=\s*([\s\S]+);\s*$/);valid(assignment,'native model assignment changed')
 const state=parse(assignment[1]).state,loaders=state?.loaderData,r=loaders?.root
 valid(state?.errors===null&&object(r)&&r.urlToken===TOKEN&&r.internal===false&&r.preview===false&&r.isJobPost===isJob&&r.boardConfiguration?.job_board_id===NATIVE_BOARD_ID&&r.boardConfiguration.job_board_public_url===B,'native public employer/board identity conflicts')
 return{doc:visibleDocument(html),loaders}
}
const taxonomy=offices=>{
 valid(Array.isArray(offices),'native office taxonomy missing');const labels=new Map(),countries=new Set(),ids=new Set()
 const walk=(nodes,parent=null)=>{for(const node of nodes){valid(object(node)&&Number.isSafeInteger(node.id)&&!ids.has(node.id)&&clean(node.name)&&Array.isArray(node.children),'native office taxonomy invalid');ids.add(node.id);const code=country(node.name)||parent;if(country(node.name))countries.add(code);const label=folded(node.name),set=labels.get(label)||new Set();if(code)set.add(code);labels.set(label,set);walk(node.children,code)}}
 walk(offices);return{labels,countries,raw:offices}
}
const boardPage=(html,page)=>{
 const{doc,loaders}=model(html,false),board=loaders['routes/$url_token'],posts=board?.jobPosts
 valid(board?.urlToken===TOKEN&&board.board?.name===COMPANY&&board.board.public_url===B&&board.board.redirect_to===null,'native board employer identity changed')
 valid(['departmentIds','officeIds'].every(k=>Array.isArray(board[k])&&board[k].length===0)&&object(board.customFieldFilters)&&Object.keys(board.customFieldFilters).length===0,'native inventory is filtered')
 valid(object(posts)&&Array.isArray(posts.data)&&Number.isSafeInteger(posts.total)&&posts.total>=0&&posts.total<=5000&&posts.page===page&&posts.count===posts.data.length&&posts.total_pages===Math.max(1,Math.ceil(posts.total/50))&&posts.data.length===Math.min(50,Math.max(0,posts.total-(page-1)*50)),'native pagination/count does not reconcile')
 one(doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='Current openings at Valtech'),'native visible employer heading')
 one(doc.nodes(n=>/^h[1-6]$/.test(n.tag)&&doc.text(n)===posts.total+' jobs'),'native visible global count')
 const anchors=doc.nodes(n=>n.tag==='a'&&(n.attrs.href||'').startsWith(B+'/jobs/')),rows=new Map()
 for(const row of posts.data){valid(Number.isSafeInteger(row.id)&&row.id>0&&Number.isSafeInteger(row.internal_job_id)&&clean(row.title)&&clean(row.location)&&row.absolute_url===nativeUrl(row.id)&&!rows.has(String(row.id)),'native row identity invalid or duplicate');const anchor=one(anchors.filter(n=>n.attrs.href===row.absolute_url),'visible native role');valid(folded(listingText(doc,anchor))===folded(row.title+' '+row.location),'native rendered listing title/location conflicts');rows.set(String(row.id),row)}
 valid(anchors.length===rows.size,'native rendered listing contains unaccounted roles')
 return{rows,total:posts.total,pages:posts.total_pages,taxonomy:taxonomy(board.offices)}
}
const date=(value,now,label)=>{if(value==null||value==='')return null;valid(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)&&Number.isFinite(Date.parse(value)),'invalid native '+label);if(label==='publication')valid(Date.parse(value)<=Date.parse(now),'future native publication');return new Date(value).toISOString()}
const knownJobFields=new Set(['post_type','language','title','hiring_plan_id','content','introduction','conclusion','enable_eeoc','job_post_location','public_url','company_name','confirmation_message','pay_ranges','published_at','employment','fingerprint','redirect_to','is_featured','ai_disclaimer','include_ai_disclaimer','apply_with_seek','show_quick_apply_cta','ai_opt_out_request_url','application_deadline','education_config','questions','demographic_questions','data_compliance','eeoc_sections'])
const geography=(row,job,official,tax,reasons)=>{
 const labels=clean(row.location).split(/\s*(?:;|\||\/)\s*/),scopes=labels.map(label=>{const explicit=country(label.replace(/\s*-\s*Remote$/i,''));return{label,countries:[...(tax.labels.get(folded(label))||new Set(explicit&&tax.countries.has(explicit)?[explicit]:[]))]}})
 const declared=official?.countryCodes||[],codes=[...new Set(scopes.flatMap(s=>s.countries))]
 if(declared.length===1&&codes.length===1)valid(declared[0]===codes[0],'corporate/native explicit country conflicts')
 for(const value of[row,job])for(const[key,field]of Object.entries(value))if(/^(?:country|countrycode|isocountrycode|addresscountry)$/.test(key.toLowerCase().replaceAll('_',''))&&field!=null){const explicit=country(field);if(!explicit)reasons.add('native-explicit-country-unresolved:'+row.id);else valid(!codes.length||codes.includes(explicit),'native explicit country conflicts')}
 const unresolved=scopes.some(s=>s.countries.length!==1)
 if(unresolved)reasons.add('native-country-unresolved:'+row.id)
 return{scopes,india:scopes.filter(s=>s.countries.length===1&&s.countries[0]==='IN'),unresolved}
}
const nativeDetail=(html,row,official,tax,reasons,now)=>{
 const{doc,loaders}=model(html,true),d=loaders['routes/$url_token_.jobs_.$job_post_id'],job=d?.jobPost,id=String(row.id)
 valid(d?.urlToken===TOKEN&&d.jobPostId===id&&object(job)&&job.post_type==='job_post'&&job.company_name===COMPANY&&job.public_url===nativeUrl(id)&&job.hiring_plan_id===row.internal_job_id&&folded(job.title)===folded(row.title)&&clean(job.job_post_location)===clean(row.location),'native employer/posting identity conflicts')
 valid(d.submitPath==='https://boards.eu.greenhouse.io/valtech/jobs/'+id&&d.confirmationPath==='/valtech/jobs/'+id+'/confirmation','native public application route changed')
 valid(doc.text(heading(doc,'section-header','native role heading'))===clean(row.title)&&doc.text(one(doc.nodes(n=>cls(n,'job__location')),'native location'))===clean(row.location),'native visible title/location conflicts')
 valid(absolute(one(doc.nodes(n=>n.tag==='form'&&n.attrs.id==='application-form'),'native public application form').attrs.action,B)===nativeUrl(id),'native rendered application context conflicts')
 if(job.redirect_to!==null||/\b(?:this (?:job|position|role) (?:is |has been )?(?:closed|filled|expired)|no longer accepting applications)\b/i.test(visibleText(job.content||'').text)){reasons.add('native-role-inactive:'+id);return null}
 const closing=date(job.application_deadline,now,'expiry');if(closing&&Date.parse(closing)<=Date.parse(now)){reasons.add('native-role-expired:'+id);return null}
 valid(job.published_at===row.published_at,'native original publication conflicts')
 const published=date(job.published_at,now,'publication'),geo=geography(row,job,official,tax,reasons)
 if(official){valid(folded(official.title)===folded(row.title),'corporate/native title conflicts');if(!official.offices.map(clean).includes(clean(row.location)))reasons.add('corporate-native-office-display-differs:'+id)}
 const fragments=['introduction','content','conclusion'].map(k=>job[k]==null?{text:null,unresolved:false}:visibleText(job[k])),fullText=fragments.map(v=>v.text).filter(Boolean).join('\n\n')
 const rendered=doc.nodes(n=>cls(n,'job__description')),unknown=Object.keys(job).filter(k=>!knownJobFields.has(k))
 if(Array.isArray(job.questions)&&job.questions.some(q=>[q.label,q.description,...(q.fields||[]).flatMap(f=>(f.values||[]).map(v=>v.label))].some(v=>v!=null&&visibleText(v).unresolved)))unknown.push('unreviewed-question-visibility')
 if(!Array.isArray(job.pay_ranges)||job.pay_ranges.length)unknown.push('unreviewed-pay-ranges')
 if(job.eeoc_sections!=null&&(!Array.isArray(job.eeoc_sections)||job.eeoc_sections.some(s=>!Array.isArray(s.questions)||s.questions.some(q=>q.required!==false||!['Gender','Race','Veteran Status','Disability Status'].includes(q.label)))))unknown.push('unreviewed-eeoc-sections')
 const full=Boolean(fragments[1].text&&!fragments.some(v=>v.unresolved)&&!doc.unresolved&&rendered.length===1&&compact(doc.text(rendered[0]))===compact(fullText)&&unknown.length===0)
 if(!full)reasons.add('native-full-criteria-unresolved:'+id)
 if(!geo.india.length)return null
 const sourceDescription=full?fullText:null,criteriaQuestions=Array.isArray(job.questions)?job.questions.filter(q=>/authori[sz]|eligib|experien|qualificat|certif|visa|sponsor|relocat|\bwork\b|notice period/i.test(visibleText(q.label).text)).map(q=>({label:visibleText(q.label).text,required:q.required===true,description:q.description?visibleText(q.description).text:null,fields:(q.fields||[]).map(f=>({type:f.type,options:Array.isArray(f.values)?f.values.map(v=>({label:visibleText(v.label).text,value:v.value})):null}))})):[]
 return{source:SOURCE,company:COMPANY,legalEmployer:null,jobId:id,id,sourceJobId:id,requisitionId:row.requisition_id==null||clean(row.requisition_id)===''?null:String(row.requisition_id),title:clean(row.title),department:clean(row.department?.name)||null,
  country:'India',location:geo.india.map(s=>s.label).join(' / '),locations:geo.india.map(s=>s.label),city:geo.india.length===1&&!/remote/i.test(geo.india[0].label)?geo.india[0].label:null,remoteStatus:/remote/i.test(row.location)?'Remote':null,
  sourceUrl:official?.sourceUrl||nativeUrl(id),applyUrl:nativeUrl(id),link:nativeUrl(id),jobDescription:sourceDescription,sourceDescription,sourceDetailComplete:full,sourceDetailFailureKind:full?null:'missing-content',nativeDescriptionSHA256:sourceDescription?hash(sourceDescription):null,
  postingDate:published,postedAt:published,nativePublicationDate:published,nativePublicationSource:published?'Greenhouse jobPost.published_at':null,sourcePublicationDateUnavailable:!published,closingDate:closing,validThrough:closing,employmentType:null,requiredSkills:[],experienceRequired:null,minimumQualification:null,
  sourceNativeCriteria:{sections:full?Object.fromEntries(['introduction','content','conclusion'].map((k,i)=>[k,fragments[i].text])):null,questions:criteriaQuestions,payRanges:Array.isArray(job.pay_ranges)&&!job.pay_ranges.length?[]:null,unresolvedFields:unknown},
  sourceNativeCountryEvidence:{nativeLocation:row.location,nativeDetailLocation:job.job_post_location,nativeOfficeScopes:geo.scopes,corporateCountryCodes:official?.countryCodes||[],corporateCountryTags:official?.countryTags||[]},
  sourceNativeEmployerEvidence:{brand:COMPANY,legalEmployer:null,companyWebsite:'https://www.valtech.com/',boardToken:TOKEN,nativeBoardId:NATIVE_BOARD_ID,nativeInternalJobId:row.internal_job_id},sourceNativeDates:{publishedAt:job.published_at??null,updatedAt:row.updated_at??null,corporateDatePosted:official?.corporateDatePosted??null},applicationPublicContextValidated:true,applicationSubmitted:false,candidateActionsTaken:false}
}
const defaultFetchPage=async(url,init)=>{const response=await fetch(url,{...init,redirect:'follow'});return{url:response.url,status:response.status,contentType:response.headers.get('content-type'),body:await response.text()}}
export const createValtechNativeInventory=(defaults={})=>({async run(options={}){
 const settings={...defaults,...options},load=settings.fetchPage||defaultFetchPage,signal=settings.signal,now=new Date((settings.now||(()=>new Date().toISOString()))()).toISOString(),maxJobs=settings.maxJobs??0,maxPages=settings.maxPages??50
 valid(!settings.fetchText&&!settings.fetchJson||settings.fetchPage,'current native transport requires fetchPage');valid(Number.isSafeInteger(maxJobs)&&maxJobs>=0&&Number.isSafeInteger(maxPages)&&maxPages>0&&maxPages<=100,'invalid enumeration/output cap')
 signal?.throwIfAborted();const reasons=new Set();let requests=0
 const pageAt=async(url,json=false,allowMissing=false)=>{
  signal?.throwIfAborted();const r=await load(url,{method:'GET',headers:{Accept:json?'application/json':'text/html'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)});requests++;signal?.throwIfAborted()
  if([401,403,429].includes(r?.status)||typeof r?.body==='string'&&/<(?:title|h1)[^>]*>\s*(?:access denied|just a moment|verify you are human|request rejected)/i.test(r.body)){const error=new ValtechIdentityError('public access denied HTTP '+r?.status);error.status=r?.status;throw error}
  valid(r?.url===url,'public response redirect changed employer binding');if(allowMissing&&[404,410].includes(r.status)){reasons.add('missing-public-role:'+url);return null}
  valid(r.status===200,'public HTTP '+r.status);valid(typeof r.body==='string'&&Buffer.byteLength(r.body)<=6*1024*1024&&(json?/^application\/json\b/i:/^text\/html\b/i).test(r.contentType||''),'public response format changed')
  if(!json)sourceScope(r.body,url,reasons);return r.body
 }
 const surfaces=async()=>{const landing=await pageAt(C),jobs=await pageAt(J);valid(hasOfficialCareerLandingSignal(landing),'verified Valtech careers landing page changed');valid(hasOfficialJobsPageSignal(jobs),'verified Valtech jobs page changed');return{landing,jobs}}
 const corporate=async()=>{
  const rows=new Map();let total,filters
  for(let page=0;page<maxPages;page++){
   const offset=page*100,p=decodeCorporatePayload(await pageAt(JOBS_API_URL+'&offset='+offset,true));valid(object(p)&&Array.isArray(p.list)&&Array.isArray(p.filters)&&object(p.page),'corporate listing format changed')
   valid(Number.isSafeInteger(p.page.itemTotal)&&p.page.itemTotal>=0&&p.page.pageOffset===offset&&p.page.pageLimit===100&&p.list.length===Math.min(100,Math.max(0,p.page.itemTotal-offset))&&p.page.pageQuery?.offset===offset&&p.page.pageQuery.limit===100&&p.page.pageQuery.language==='en-IN'&&['country','department','expertise'].every(k=>Array.isArray(p.page.pageQuery[k])&&p.page.pageQuery[k].length===0),'corporate global pagination/count/filter does not reconcile')
   valid(total==null||total===p.page.itemTotal&&JSON.stringify(filters)===JSON.stringify(p.filters),'corporate pagination changed');total=p.page.itemTotal;filters=p.filters
   const countries=one(filters.filter(f=>f.value==='country'),'corporate country taxonomy').tags;valid(Array.isArray(countries)&&countries.filter(t=>t.text==='India'&&t.value===INDIA_COUNTRY_TAG).length===1,'current corporate India country taxonomy changed')
   for(const r of p.list){const url=corporateUrl(r.url);valid(clean(r.title)&&Array.isArray(r.tags)&&Array.isArray(r.offices)&&!rows.has(url),'corporate role identity invalid or duplicate');const ct=r.tags.flatMap(tag=>countries.filter(t=>t.value===tag));rows.set(url,{...r,sourceUrl:url,countryTags:ct.map(t=>t.value),countryCodes:[...new Set(ct.map(t=>country(t.text)).filter(Boolean))]})}
   if(rows.size===total)return{rows,total,filters}
  }throw new ValtechIdentityError('corporate pagination budget exhausted')
 }
 const native=async()=>{
  const rows=new Map();let first
  for(let page=1;page<=maxPages;page++){const p=boardPage(await pageAt(B+(page===1?'':'?page='+page)),page);if(!first)first=p;else valid(p.total===first.total&&p.pages===first.pages&&JSON.stringify(p.taxonomy.raw)===JSON.stringify(first.taxonomy.raw),'native pagination/taxonomy changed');for(const[id,row]of p.rows){valid(!rows.has(id),'duplicate native posting across pages');rows.set(id,row)}if(page===p.pages){valid(rows.size===p.total,'native global count mismatch');return{rows,total:p.total,taxonomy:first.taxonomy}}}throw new ValtechIdentityError('native pagination budget exhausted')
 }
 const initialSurfaces=await surfaces(),initial=await corporate(),official=new Map(),otherScopes=[]
 for(const row of initial.rows.values()){
  const html=await pageAt(row.sourceUrl,false,true);if(!html)continue;const doc=visibleDocument(html)
  const links=doc.nodes(n=>n.tag==='a'&&/^apply(?:\s+now)?$/i.test(doc.text(n))).map(n=>absolute(n.attrs.href,row.sourceUrl)),matches=links.filter(url=>url?.startsWith(B+'/jobs/'))
  if(matches.length===1){const id=matches[0].match(/^https:\/\/job-boards\.eu\.greenhouse\.io\/valtech\/jobs\/([1-9]\d*)$/)?.[1];valid(id,'native corporate application link invalid');if(doc.text(heading(doc,'masthead-sticky__hgroup__title','corporate role heading'))!==clean(row.title)){reasons.add('corporate-heading-listing-conflicts:'+row.sourceUrl);continue}if(official.has(id)){reasons.add('corporate-native-alias:'+id);continue}const schemas=readNativeDocument(html).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>parse(n.raw)).filter(s=>s['@type']==='JobPosting');if(schemas.length)valid(schemas.length===1&&schemas[0].hiringOrganization?.name===COMPANY,'corporate structured employer conflicts');official.set(id,{...row,corporateDatePosted:schemas[0]?.datePosted??null})}
  else{reasons.add('additional-corporate-native-scope:'+row.sourceUrl);otherScopes.push({sourceUrl:row.sourceUrl,countryCodes:row.countryCodes,applicationUrls:links})}
 }
 valid(official.size>0||initial.total===0,'current first-party native employer handoff missing');const opening=await native(),jobs=[]
 if(official.size!==opening.total||[...official.keys()].some(id=>!opening.rows.has(id)))reasons.add('corporate-native-posting-inventories-differ')
 for(const[id,row]of opening.rows){const html=await pageAt(nativeUrl(id),false,true);if(!html)continue;const job=nativeDetail(html,row,official.get(id),opening.taxonomy,reasons,now);if(job)jobs.push(job)}
 const closingSurfaces=await surfaces(),closing=await corporate(),after=await native()
 if(JSON.stringify(initial.filters)!==JSON.stringify(closing.filters)||initial.total!==closing.total||[...initial.rows].some(([url,row])=>rowState(row)!==rowState(closing.rows.get(url))))reasons.add('closing-corporate-inventory-changed')
 if(opening.total!==after.total||JSON.stringify(opening.taxonomy.raw)!==JSON.stringify(after.taxonomy.raw)||[...opening.rows].some(([id,row])=>nativeState(row)!==nativeState(after.rows.get(id))))reasons.add('closing-native-inventory-changed')
 // Landing role promotions and job-list handoffs are hiring evidence too.
 const refs=html=>readNativeDocument(html).nodes(n=>n.tag==='a'&&/\/career\/jobs\/[a-z0-9-]+\/$/i.test(absolute(n.attrs.href)||'')).map(n=>absolute(n.attrs.href)).sort()
 if(JSON.stringify(refs(initialSurfaces.landing))!==JSON.stringify(refs(closingSurfaces.landing)))reasons.add('closing-advertised-role-links-changed')
 for(const url of [...refs(initialSurfaces.landing),...refs(initialSurfaces.jobs),...refs(closingSurfaces.landing),...refs(closingSurfaces.jobs)])if(!initial.rows.has(url)||!closing.rows.has(url))reasons.add('advertised-role-unreconciled:'+url)
 const healthy=jobs.filter(j=>nativeState(opening.rows.get(j.jobId))===nativeState(after.rows.get(j.jobId))&&(!official.has(j.jobId)||rowState(initial.rows.get(j.sourceUrl))===rowState(closing.rows.get(j.sourceUrl)))),selected=maxJobs?healthy.slice(0,maxJobs):healthy
 if(selected.length<healthy.length)reasons.add('source-job-limit')
 const complete=reasons.size===0,audit={corporateGlobalPostings:initial.total,corporateIndiaPostings:[...initial.rows.values()].filter(r=>r.countryCodes.includes('IN')).length,nativeGlobalPostings:opening.total,nativeIndiaPostings:jobs.length,fullCriteriaIndiaPostings:healthy.filter(j=>j.sourceDetailComplete).length,closingCorporateGlobalPostings:closing.total,closingNativeGlobalPostings:after.total,nativePages:Math.max(1,Math.ceil(opening.total/50)),otherScopes,reasons:[...reasons],sourceScopeComplete:complete,lifecycleCleanupAllowed:complete}
 for(const job of selected)Object.assign(job,{scrapedAt:now,companyCareerPage:J,companyDomain:'valtech.com',atsPlatform:'greenhouse-eu+first-party-joblist',sourceListingComplete:complete,sourceScopeComplete:complete,lifecycleCleanupAllowed:complete,sourceNativeInventoryEvidence:audit})
 Object.defineProperty(selected,'nativeInventoryAudit',{value:audit})
 return attachInventoryEvidence(selected,{status:complete?opening.total?'complete-inventory':'verified-empty':'discovery-only',firstParty:true,surface:J,listingComplete:complete,pagesFetched:requests,reportedTotal:complete?opening.total:null,indiaFacetCount:complete?healthy.length:null,verifiedAt:now,reason:complete?'valtech-corporate-native-inventories-reconciled':'valtech-native-incomplete:'+audit.reasons.join(';')})
}})
