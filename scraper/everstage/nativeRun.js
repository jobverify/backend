import {createHash} from 'node:crypto'
import {qualifyEverstageClient} from './nativeClientProfiles20261107.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {CANONICAL_CITIES} from '../../scraper-support/utils/cities.js'

export const CAREERS='https://www.everstage.com/careers',BOARD='https://ats.rippling.com/everstage/jobs',WIDGET='https://static-assets.ripplingcdn.com/ats/embeds/job-board.v1.js'
export const EMBED='https://ats.rippling.com/embed/everstage/jobs?s=https%3A%2F%2Fwww.everstage.com%2Fcareers'
const need=(ok,message)=>{if(!ok)throw Error('Everstage native: '+message)}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const plain=v=>typeof v==='string'&&v.length>0&&v.length<1000&&v.trim()===v&&!/[<>\u0000-\u001f]/.test(v)
const closed=/\b(?:this (?:job|position|role) is (?:no longer available|closed)|(?:we are )?no longer accepting applications|(?:job|position|role) has (?:been (?:closed|filled)|expired))\b/i
const foreign=/\b(?:United States|USA|United Kingdom|Australia|France|Germany|Canada|Singapore|Israel|Portugal|Brazil|Philippines|Mexico|New York|Sydney|Paris|London|Tokyo|California)\b/i
const hash=v=>createHash('sha256').update(v).digest('hex')
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const doc=body=>{need(typeof body==='string'&&body.length>0&&Buffer.byteLength(body)<=3000000,'Native body missing or over bound');return readNativeDocument(body)}
function envelope(v){
 need(v&&typeof v==='object'&&!Array.isArray(v),'Native envelope missing')
 for(const[k,x]of Object.entries(v)){
  if(/^(?:error|errors|exception|fault)$/i.test(k))need(x==null||x===''||Array.isArray(x)&&x.length===0,'Native error envelope')
  if(/^(?:success|ok)$/i.test(k))need(x===true,'Native failed envelope')
  if(/^(?:status|statusCode|status_code)$/i.test(k))need(x===200||['success','published','active','open'].includes(x),'Native failed status')
 }
}
function official(html){
 const d=doc(html),widgets=d.nodes(n=>n.attrs.id==='rr-job-board'),scripts=d.nodes(n=>n.tag==='script'&&n.attrs.src===WIDGET)
 need(widgets.length===1&&widgets[0].attrs['data-job-board-id']==='everstage'&&!widgets[0].attrs['data-locale']&&scripts.length===1,'Current official widget/tenant missing or ambiguous')
 need(!d.nodes(n=>n.tag==='script'&&!n.attrs.src).some(n=>/RR_BASE_URL\s*=/.test(n.raw||'')),'Unqualified official widget origin override')
 return{board:'everstage',widget:WIDGET,embed:EMBED}
}
function board(b){need(b?.boardType==='RIPPLING'&&b.slug==='everstage'&&b.companyName==='Everstage Inc.'&&b.title==='Everstage Inc.'&&b.boardURL===BOARD&&b.isTest===false,'Native board/employer/test identity mismatch');return b}
function next(html,page,id){
 const d=doc(html),nodes=d.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__')
 need(nodes.length===1&&nodes[0].attrs.type==='application/json','Native Next data missing or ambiguous')
 let n;try{n=JSON.parse(nodes[0].raw)}catch{throw Error('Everstage native: Native Next JSON unavailable')}
 envelope(n);need(n.page===page&&n.query?.jobBoardSlug==='everstage'&&n.locale==='en-US'&&(!id||n.query.jobId===id),'Native route/query UUID identity mismatch')
 const p=n.props?.pageProps,a=p?.apiData;envelope(p);envelope(a);board(a.jobBoard)
 need(!closed.test(d.text({tag:'root',attrs:{},children:d.nodes(n=>n.tag==='body')})),'Native active page is closed')
 return{d,n,p,a}
}
function location(l){
 // Country-scoped remote listings intentionally have no city or state.
 // Require the exact native country tuple rather than inferring India from remote work.
 if(l?.name==='Remote, India'&&l.country==='India'&&l.countryCode==='IN'
   &&l.workplaceType==='REMOTE'&&l.city===null&&l.state===null&&l.stateCode===null)return true
 need(l&&plain(l.name)&&plain(l.country)&&/^[A-Z]{2}$/.test(l.countryCode)&&plain(l.city)&&plain(l.state)&&plain(l.stateCode)&&['ON_SITE','HYBRID','REMOTE'].includes(l.workplaceType),'Native typed geography missing')
 const india=l.country==='India'||l.countryCode==='IN',indianCity=Object.hasOwn(CANONICAL_CITIES,l.city.toLowerCase())&&!/^remote|india$/i.test(l.city)
 if(india){
  need(l.country==='India'&&l.countryCode==='IN'&&indianCity&&!foreign.test(l.city+' '+l.state+' '+l.name),'Native India country/city geography contradiction')
  // These two exact typed state/city tuples are the currently qualified native geography contract.
  const states={Hyderabad:['Telangana','TG'],Chennai:['Tamil Nadu','TN']}
  need(same(states[l.city],[l.state,l.stateCode])&&l.name===l.city+', India','Native India state/city geography changed or contradictory')
 }else need(!indianCity&&!/\bIndia\b/i.test(l.name+' '+l.country+' '+l.state)&&l.name.includes(l.country),'Native foreign country/city geography contradiction')
 return india
}
function listing(html,maxRecords){
 const{d,n,p,a}=next(html,'/embed/[jobBoardSlug]/jobs')
 need(n.query.s===CAREERS&&a.jobBoardSlug==='everstage','Native embed identity mismatch')
 need(same(a.filtersConfig,{workLocations:[],departments:[]}),'Native board filters changed')
 const queries=p.dehydratedState?.queries;need(Array.isArray(queries),'Native queries missing')
 const found=queries.filter(q=>q.queryKey?.[2]==='job-posts');need(found.length===1,'Native listing query missing/ambiguous')
 const q=found[0];need(same(q.queryKey,['board','everstage','job-posts',false,{searchQuery:'',departments:[],workplaceType:null,country:'',state:'',city:'',page:0,pageSize:20}]),'Native unqualified filter/pagination query changed')
 need(q.state?.status==='success'&&q.state.error==null,'Native listing query error')
 const v=q.state.data;envelope(v)
 need(same(Object.keys(v).sort(),['items','page','pageSize','totalItems','totalPages'].sort()),'Native listing envelope changed')
 need(v.page===0&&v.pageSize===20&&v.totalPages===1&&Number.isInteger(v.totalItems)&&v.totalItems>0&&v.totalItems<=20&&v.totalItems<=maxRecords&&Array.isArray(v.items)&&v.items.length===v.totalItems,'Native pagination/total/empty contract changed; company zero unknown')
 const grouped=new Map(),seenLocations=new Set()
 for(const row of v.items){
  envelope(row);need(uuid.test(row.id)&&plain(row.name)&&row.url===BOARD+'/'+row.id&&row.language==='en-US'&&plain(row.department?.name)&&Array.isArray(row.locations)&&row.locations.length>0,'Native listing role identity missing/mismatch')
  const prior=grouped.get(row.id),identity={id:row.id,name:row.name,url:row.url,language:row.language,department:row.department}
  if(prior)need(same(prior.identity,identity),'Native duplicate job title/identity contradiction')
  const entry=prior||{identity,locations:[],rows:[],india:null}
  for(const l of row.locations){const isIndia=location(l),key=row.id+'|'+JSON.stringify(l);need(!seenLocations.has(key),'Native duplicate location row');seenLocations.add(key);need(entry.india==null||entry.india===isIndia,'Native mixed country job scope is unqualified');entry.india=isIndia;entry.locations.push(l)}
  for(const k of ['country','countryCode','country_code'])if(row[k]!=null)need(row.locations.every(l=>row[k]===l[k==='country'?'country':'countryCode']),'Native listing country geography contradiction')
  entry.rows.push(row);grouped.set(row.id,entry)
 }
 const expected=[...grouped.values()].map(r=>'https://ats.rippling.com/en-US/everstage/jobs/'+r.identity.id).sort(),links=[...new Set(d.nodes(n=>n.tag==='a'&&n.attrs.href?.startsWith('https://ats.rippling.com/en-US/everstage/jobs/')).map(n=>n.attrs.href))].sort()
 need(same(expected,links),'Native listing links/data cross-surface identity mismatch')
 for(const row of grouped.values()){const anchors=d.nodes(n=>n.tag==='a'&&n.attrs.href==='https://ats.rippling.com/en-US/everstage/jobs/'+row.identity.id);need(anchors.some(n=>d.text(n)===row.identity.name)&&anchors.every(n=>[row.identity.name,'View job'].includes(d.text(n))),'Native listing rendered title/data contradiction')}
 return{items:v.items,groups:[...grouped.values()],query:q.queryKey,pagination:{page:v.page,pageSize:v.pageSize,totalItems:v.totalItems,totalPages:v.totalPages}}
}
function deadlines(values,now){
 const known=values.filter(v=>v!=null&&v!=='').map(v=>{
  need(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v)),'Malformed native closing date')
  const[y,m,d]=v.slice(0,10).split('-').map(Number);need(m>=1&&m<=12&&d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate(),'Invalid native closing calendar')
  need(Date.parse(v)>Date.parse(now),'Native closing deadline is past');return new Date(v).toISOString()
 })
 need(new Set(known).size<=1,'Native closing date conflict');return known[0]??null
}
function jobData(a,row,now){
 const j=a.jobPost;envelope(j);board(j.board)
 need(j.uuid===row.identity.id&&j.name===row.identity.name&&j.url===row.identity.url&&j.companyName==='Everstage Inc.'&&j.unlistedFromSearch===false,'Native job UUID/title/employer/status identity mismatch')
 for(const key of ['closed','isClosed','archived','isArchived','isInternal'])if(j[key]!=null)need(j[key]===false,'Native job closed/internal status')
 need(j.jsonLd==null,'Native schema contract changed and requires qualification')
 for(const k of ['datePosted','postedAt','publishedAt','publishedOn','postingDate','publicationDate','published_at','posted_at','published_on','posted_on','publication_date','date_posted'])need(j[k]==null&&row.rows.every(r=>r[k]==null),'Native publication contract changed; creation is not publication')
 const names=row.locations.map(l=>l.name);need(same(j.workLocations,names),'Native job location geography mismatch')
 if(a.workLocations!=null)need(same(a.workLocations,names),'Native page location geography mismatch')
 need(j.department?.base_department===row.identity.department.name&&plain(j.department.name)&&Array.isArray(j.department.department_tree)&&j.department.department_tree[0]===row.identity.department.name,'Native department identity mismatch')
 if(a.department!=null)need(same(a.department,j.department),'Native page department identity contradiction')
 for(const k of ['country','countryCode','country_code'])if(j[k]!=null)need(row.locations.every(l=>j[k]===l[k==='country'?'country':'countryCode']),'Native detail country geography contradiction')
 const role=extractActiveDescription(j.description?.role),company=extractActiveDescription(j.description?.company)
 const meaningful=role?.split(/(?<=[.!?])\s+/).filter(s=>!/^Please\s+(?:click|apply|visit|check)/i.test(s)).join(' ')
 need(role&&meaningful.replace(/[^\p{L}\p{N}]/gu,'').length>=100&&role!==company&&!closed.test(role)&&/\b(?:responsibilities|job description|what you['’]ll do|you will (?:own|develop|build|manage|lead))\b/i.test(role)&&/\b(?:own|execute|develop|lead|representing|engage|solution|configure|build|manage)\b/i.test(meaningful),'Native substantive core role description missing/closed/instruction-only')
 need(j.description.company==null||typeof j.description.company==='string','Native company description malformed')
 need(!company||!closed.test(company),'Native company description closed')
 const closingFields=['validThrough','closingDate','deadline','deadline_at'],closingDate=deadlines([j,...row.rows].flatMap(x=>closingFields.map(k=>x[k])),now)
 need(plain(j.createdOn)&&Number.isFinite(Date.parse(j.createdOn)),'Native creation metadata missing/malformed')
 const form=j.activeJobApplication,fields=form?.basicQuestions
 need(Array.isArray(fields)&&fields.length>=4&&new Set(fields.map(f=>f.oid)).size===fields.length,'Native active application configuration missing/ambiguous')
 for(const oid of ['first_name','last_name','email','resume'])need(fields.some(f=>f.oid===oid&&f.required===true&&plain(f.title)&&f.fieldType===(oid==='resume'?'FILE':'SHORT_ANSWER')),'Native application required field identity missing')
 return{j,role,company,closingDate}
}
function canonical(d,url){const c=d.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical'));need(c.length===1&&c[0].attrs.href===url,'Native canonical identity mismatch')}
function asset(d,kind){const nodes=d.nodes(n=>n.tag==='script'&&new RegExp('/chunks/pages/%5BjobBoardSlug%5D/jobs/%5BjobId%5D'+(kind==='apply'?'/apply-':'-')+'[a-f0-9]+\\.js$').test(n.attrs.src||''));need(nodes.length===1,'Native advertised executable '+kind+' client missing/ambiguous');const u=new URL(nodes[0].attrs.src);need(u.origin==='https://ats.us1.rippling.com'&&!u.search&&!u.hash,'Native executable client origin identity mismatch');return u.href}
export async function runNativeEverstage(options={}){
 need(options.maxJobs==null,'Native truncation forbidden')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),timeoutMs=options.timeoutMs??180000,maxRecords=options.maxNativeRecords??200
 need(Number.isFinite(Date.parse(now))&&Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=300000&&Number.isInteger(maxRecords)&&maxRecords>0&&maxRecords<=200,'Invalid bounded options')
 const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs),fetchImpl=options.fetchImpl??globalThis.fetch,assets=new Map()
 async function get(url){signal.throwIfAborted();const r=await fetchImpl(url,{method:'GET',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),headers:{Accept:'text/html,application/javascript;q=0.9'}});if(r.status!==200){const e=Error('Everstage native HTTP unavailable: '+r.status);e.httpStatus=r.status;e.failureKind=r.status===403?'upstream_blocked':'upstream_http_failure';throw e}need(r.url===url,'Native HTTP URL identity mismatch');const body=await r.text();need(body.length>0&&Buffer.byteLength(body)<=3000000,'Native body missing/over bound');signal.throwIfAborted();return body}
 let selectedClientProfile=null
 async function client(d,kind){const url=asset(d,kind); // Assets are fetched only from each current page's advertised URL.
  if(!assets.has(url))assets.set(url,await get(url));const body=assets.get(url)
  const profile=qualifyEverstageClient(d,url,body,kind)
  need(selectedClientProfile==null||selectedClientProfile===profile,'Native executable client version context changed')
  selectedClientProfile=profile
  return url
 }
 const binding=official(await get(CAREERS)),widget=await get(WIDGET)
 need(hash(widget)==='ccbb518a08c80678c93c6028fc38579edc3edf0da0b03fd34a5d6834186aa6a2','Native widget delegation executable contract changed')
 const list=listing(await get(EMBED),maxRecords),selected=list.groups.filter(r=>r.india);need(selected.length>0,'No qualified India roles; company zero unknown')
 const jobs=[]
 for(const row of selected){
  const sourceUrl='https://ats.rippling.com/en-US/everstage/jobs/'+row.identity.id,{d,a}=next(await get(sourceUrl),'/[jobBoardSlug]/jobs/[jobId]',row.identity.id)
  canonical(d,row.identity.url);const values=jobData(a,row,now),{j,role,company,closingDate}=values,title=d.nodes(n=>n.tag==='title'),og=d.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:title')
  need(title.length===1&&title[0].raw===j.name&&og.length===1&&og[0].attrs.content===j.name+' | Everstage Inc.','Native active title/Open Graph identity mismatch')
  const preview=d.nodes(n=>(n.attrs.class||'').split(/\s+/).includes('ATS_htmlPreview')),text=[company,role].filter(Boolean).join(' ')
  need(preview.length===1&&d.text(preview[0])===text,'Native rendered/full description cross-surface contradiction/truncation')
  const apply=d.nodes(n=>n.tag==='button'&&n.attrs['data-testid']==='Apply now')
  need(apply.length>=1&&apply.every(n=>d.text(n)==='Apply now'&&n.attrs['data-disabled']==='false'&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']!=='true'),'Native active apply control missing/disabled')
  const roleClient=await client(d,'role'),applyUrl=sourceUrl+'/apply',application=next(await get(applyUrl),'/[jobBoardSlug]/jobs/[jobId]/apply',row.identity.id)
  const applicationTitles=application.d.nodes(n=>n.tag==='title');need(applicationTitles.length===1&&applicationTitles[0].raw==='Apply for job post','Native application title identity contradiction')
  canonical(application.d,j.url);jobData(application.a,row,now)
  const fields=['uuid','name','description','workLocations','department','employmentType','createdOn','activeJobApplication','url','companyName','unlistedFromSearch','jsonLd','validThrough','closingDate','deadline','deadline_at']
  need(fields.every(k=>same(j[k],application.a.jobPost[k])),'Native application job identity/full JD/date configuration contradiction')
  const applicationClient=await client(application.d,'apply'),locations=row.locations.map(l=>l.name),full=[company,role].filter(Boolean).join('\n\n')
  jobs.push({source:'everstage',company:'Everstage',jobId:j.uuid,title:j.name,country:'India',city:row.locations[0].city,state:row.locations[0].state,location:locations.join(' / '),locations,sourceUrl,applyUrl,link:sourceUrl,
   jobDescription:full,sourceDescription:full,nativeDescriptionHtml:{...j.description},nativeContentSections:Object.entries(j.description).map(([key,html])=>({key,html,text:extractActiveDescription(html)})),nativeJobPost:j,nativeListingRecords:row.rows,nativeLocations:row.locations,nativeEmployer:j.companyName,nativeLegalEmployer:null,nativeCreatedOn:j.createdOn,nativePublicationDate:null,nativeClosingDate:closingDate,postedAt:null,postingDate:null,closingDate,...(closingDate?{sourceClosingDateIsExact:true}:{}),
   nativeEmploymentType:j.employmentType,employmentType:j.employmentType?.id??null,department:j.department.name,sourceDetailComplete:true,sourceDetailStatus:'complete',applicationAccess:'anonymous-public-advertised-native-application-entry-with-job-config-and-executable-client',applicationSubmitted:false,sourcePostingStatusEvidence:'current-native-listed-nontest-public-role+active-apply-control+matching-native-application-config',sourceListingComplete:false,sourceScopeComplete:false,sourceGlobalJobCount:null,sourceIndiaJobCount:null,sourceObservedNativeLocationRows:list.items.length,sourceObservedNativeUniqueJobs:list.groups.length,sourceObservedNativeIndiaJobs:selected.length,sourceOfficialBinding:{...binding,officialURL:CAREERS,checkedAt:now},sourceNativeListingTerminalEvidence:list.pagination,nativeExecutableClients:{role:roleClient,application:applicationClient},scrapedAt:now})
 }
 const final=listing(await get(EMBED),maxRecords);need(same(list.items,final.items)&&same(list.query,final.query)&&same(binding,official(await get(CAREERS))),'Native listing/official widget changed during extraction')
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:EMBED,firstParty:true,listingComplete:false,pagesFetched:2,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'current-terminal-native-board-enumerated-and-rechecked-whole-company-scope-unproven'})
}
export const run=runNativeEverstage
