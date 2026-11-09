import {readNativeDocument,nativeDescendants,nativeEvidenceDescendants,nativeTextBlocks} from './nativeHtml.js'
import {createNativeRoleAvailability,findExplicitNativeClosure} from '../../scraper-support/utils/sourceAvailability.js'
export const SEARCH_URL='https://www.disneycareers.com/en/search-jobs'
export const ORIGIN='https://www.disneycareers.com'
const check=(ok,message)=>{if(!ok)throw Error('Disney native contract: '+message)}
const norm=s=>String(s??'').replace(/\s+/g,' ').trim()
const one=(items,label)=>{check(items.length===1,'Expected one '+label);return items[0]}
const integer=(value,label)=>{check(typeof value==='string'&&/^(0|[1-9]\d*)$/.test(value),'Invalid '+label);const n=Number(value);check(Number.isSafeInteger(n),'Unsafe '+label);return n}
const subtree=(d,node,predicate)=>nativeDescendants(node,predicate)
const meta=(d,name)=>one(d.nodes(n=>n.tag==='meta'&&n.attrs.name===name),'meta '+name).attrs.content
const canonical=(d,url)=>check(one(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href===url,'Canonical mismatch')
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export function originalDate(value,now,{display=false}={}){
 check(typeof value==='string','Missing original date')
 if(display)value=value.replace(/^Sept\./,'Sep.')
 const match=display?/^([A-Z][a-z]{2})\.? (\d{1,2}), (\d{4})$/.exec(value):/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
 check(match,'Invalid original date shape')
 const month=display?months.indexOf(match[1])+1:Number(match[1]),day=Number(match[2]),year=Number(match[3]),date=new Date(Date.UTC(year,month-1,day))
 check(month>=1&&month<=12&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day,'Invalid original calendar date')
 check(date.getTime()<=new Date(now).getTime(),'Future original publication')
 return date.toISOString()
}
function indiaLocation(value){
 const match=/^(Bengaluru|Mumbai),\s+India$/.exec(norm(value));check(match,'Unqualified native India office')
 return{city:match[1],country:'India',location:match[1]+', India'}
}
function resultSection(d){const n=one(d.nodes(n=>n.attrs.id==='search-results'),'native result section'),a=n.attrs
 check(a['data-ajax-url']==='/en/search-jobs/results'&&a['data-ajax-post-url']==='/en/search-jobs/resultspost','Changed advertised public search endpoints')
 check(a['data-sort-criteria']==='0'&&a['data-sort-direction']==='1'&&a['data-search-type']==='5','Changed native search contract')
 check(a['data-records-per-page']==='10','Changed native page size')
 return a
}
export function inspectSearch(html){
 const d=readNativeDocument(html);canonical(d,SEARCH_URL)
 check(d.nodes(n=>n.tag==='title'&&/Search our Job Opportunities at DISNEY/.test(n.raw??'')).length===1,'Search identity unavailable')
 check(d.nodes(n=>n.tag==='a'&&n.attrs.href==='https://join.disneycareers.com/global/en/home'&&d.text(n)==='Visit the new Disney Careers').length>=1,'Current native migration handoff unavailable')
 const a=resultSection(d),input=one(d.nodes(n=>n.tag==='input'&&n.attrs['data-display']==='India'),'explicit India country facet')
 check(input.attrs.type==='checkbox'&&input.attrs['data-facet-type']==='2'&&input.attrs['data-id']==='1269750'&&!Object.hasOwn(input.attrs,'disabled'),'Unknown country facet')
 const label=one(d.nodes(n=>n.tag==='label'&&n.attrs.for===input.attrs.id),'India facet label')
 const count=integer(input.attrs['data-count'],'India facet count');check(d.text(label)==='India '+count,'Country label/count mismatch')
 return{count,content:integer(a['data-total-content-results'],'content count')}
}
// These are the actual GET parameters emitted by the native India and Next Jobs
// controls. Content pagination is separate from job pagination. Its native NaN
// bookkeeping after page two is retained, never used as job-count evidence.
export function listingUrl(scope,page){
 const content=page<=2?String(scope.content):''
 const p=new URLSearchParams({ActiveFacetID:'1269750',CurrentPage:String(page),RecordsPerPage:'10',TotalContentResults:content,Distance:'50',RadiusUnitType:'0',Keywords:'',Location:'',ShowRadius:'False',IsPagination:'False',CustomFacetName:'',FacetTerm:'',FacetType:'0','FacetFilters[0].ID':'1269750','FacetFilters[0].FacetType':'2','FacetFilters[0].Count':String(scope.count),'FacetFilters[0].Display':'India','FacetFilters[0].IsApplied':'true','FacetFilters[0].FieldName':'',SearchResultsModuleName:'Search Results',SearchFiltersModuleName:'Search Filters',SortCriteria:'0',SortDirection:'1',SearchType:'5',PostalCode:'',ResultsType:page===1?'0':'1',fc:'',fl:'',fcf:'',afc:'',afl:'',afcf:'',TotalContentPages:page<=2?String(Math.ceil(scope.content/10)):'NaN'})
 return ORIGIN+'/en/search-jobs/results?'+p
}
function listingDocument(body){
 let payload;try{payload=JSON.parse(body)}catch{throw Error('Disney native contract: Invalid listing JSON')}
 check(payload&&typeof payload==='object'&&!Array.isArray(payload),'Invalid listing envelope')
 check(Object.keys(payload).sort().join(',')==='filters,hasContent,hasJobs,results','Changed or error listing envelope')
 check(typeof payload.filters==='string'&&typeof payload.results==='string'&&typeof payload.hasJobs==='boolean'&&typeof payload.hasContent==='boolean','Invalid listing fields')
 const d=readNativeDocument(payload.results),a=resultSection(d),total=integer(a['data-total-job-results'],'job total'),pages=integer(a['data-total-pages'],'page total')
 return{payload,d,a,total,pages}
}
function appliedIndia(d,a){
 check(a['data-active-facet-id']==='1269750','Country scope drift')
 check(d.nodes(n=>n.tag==='button'&&n.attrs['data-id']==='1269750'&&n.attrs['data-facet-type']==='2'&&n.attrs['data-facet-display']==='Country:  India').length===1,'Applied India filter unavailable')
}
// The discovery country-facet counter is a separate native surface. The first
// applied-country result supplies its own count; subsequent pages and closing
// reads must reconcile against that exact filtered inventory.
export function inspectFilteredScope(body){
 const{d,a,total,pages}=listingDocument(body)
 check(pages===Math.max(1,Math.ceil(total/10))&&integer(a['data-current-page'],'current page')===1,'Native count/page drift')
 appliedIndia(d,a)
 const list=one(d.nodes(n=>n.tag==='ul'&&n.attrs.id==='search-results-jobs'),'native job list')
 check(integer(list.attrs['data-results-count'],'list total')===total,'List count mismatch')
 return{count:total}
}
export function parsePage(body,{scope,page,now}){
 const{payload,d,a,total,pages}=listingDocument(body)
 check(total===scope.count&&pages===Math.max(1,Math.ceil(total/10))&&integer(a['data-current-page'],'current page')===page,'Native count/page drift')
 appliedIndia(d,a)
 const list=one(d.nodes(n=>n.tag==='ul'&&n.attrs.id==='search-results-jobs'),'native job list');check(integer(list.attrs['data-results-count'],'list total')===total,'List count mismatch')
 const links=subtree(d,list,n=>n.tag==='a')
 const rows=links.map(n=>{const id=n.attrs['data-job-id'],req=n.attrs['data-job-secondary-id']||null,href=n.attrs.href
  check(/^\d+$/.test(id??'')&&(req===null||/^\d+$/.test(req)),'Invalid native IDs')
  check(typeof href==='string'&&/^\/en\/job\/(mumbai|bengaluru)\/[^/?#]+\/391\/\d+$/.test(href)&&href.endsWith('/'+id),'Native role URL/identity mismatch')
  const title=d.text(one(subtree(d,n,x=>x.tag==='h2'),'listing title'));check(title&&!/<|>|future hiring|talent (?:pool|community)|submit.*resume/i.test(title),'Invalid native title')
  const text=cls=>d.text(one(subtree(d,n,x=>d.hasClass(x,cls)),cls))
  const office=indiaLocation(text('job-location')),brand=text('job-brand'),postedAt=originalDate(text('job-date-posted'),now,{display:true})
  check(brand.length>0,'Missing brand');return{id,req,url:ORIGIN+href,title,...office,brand,postedAt}
 })
 check(rows.length===Math.min(10,Math.max(0,total-(page-1)*10))&&payload.hasJobs===(total>0),'Truncated native page')
 check(new Set(rows.map(r=>r.id)).size===rows.length&&new Set(rows.filter(r=>r.req).map(r=>r.req)).size===rows.filter(r=>r.req).length,'Duplicate native page identities')
 const next=d.nodes(n=>n.tag==='a'&&d.hasClass(n,'next')&&n.attrs['data-display-type']==='Jobs')
 check(page<pages?next.length===1&&next[0].attrs.href==='/search-jobs/results&p='+(page+1):next.length===0,'Native continuation mismatch')
 return{rows,pages,total}
}
function qualifiedDescription(text,blocks){
 if(!text||!/[a-z]{3}/i.test(text))return{description:null,reason:'native-full-description-unavailable-or-unqualified'}
 const statements=blocks.flatMap(block=>block.replace(/^Job Summary:\s*/i,'').split(/(?<=[.!?])\s+/))
 const notice=findExplicitNativeClosure(statements)
 if(notice)return{description:null,reason:'native-role-explicitly-closed',notice}
 let removedInstructions=false
 const roleContent=statements.filter(sentence=>{
  const instruction=/^(?:please\b|click\b|apply(?:\s+now)?\b|to (?:view|read|learn)\b)/i.test(sentence.trim())
   ||/^(?:the\s+)?(?:full\s+)?job description\s+(?:is\s+(?:currently\s+)?unavailable|will be available|coming soon)/i.test(sentence.trim())
   ||(/\b(?:responsibilities|qualifications|required (?:skills|experience)|job description|position details)\b/i.test(sentence)&&/\b(?:available only after|provided after|after (?:you submit|completing|submitting)|cannot be displayed|available after|(?:provided|withheld|available|accessed) until (?:you (?:complete|submit)|an? application)|(?:available|provided|accessed) once you (?:apply|submit)|(?:accessed|available) only by (?:registered )?applicants)\b/i.test(sentence))
  if(instruction)removedInstructions=true
  return!instruction
 }).join(' ')
 const meaningful=/\bresponsibilit(?:y|ies)\b|\bqualifications\b|\brequired (?:skills|experience|education)\b|\bwhat (?:you['’]ll|we['’]re|you will)\b|\b(?:you will|your duties|skills and experience)\b/i
 if(!meaningful.test(roleContent)||roleContent.replace(/[^a-z]/gi,'').length<100)return{description:null,reason:removedInstructions?'native-description-instruction-or-unavailable-only':'native-description-no-role-content'}
 return{description:text,reason:null}
}
export function parseDetail(body,row,now){
 const d=readNativeDocument(body);canonical(d,row.url)
 const head=one(d.nodes(n=>n.attrs.id==='job-details-1'),'role header'),a=head.attrs
 check(a['data-org-id']==='391'&&a['data-job-id']===row.id&&/^\d+$/.test(a['data-tm-job-id']??'')&&(!row.req||a['data-tm-job-id']===row.req),'Detail native identity mismatch')
 row={...row,req:a['data-tm-job-id']}
check(norm(a['data-tm-job-name'])===row.title&&d.text(one(subtree(d,head,n=>n.tag==='h1'),'role title'))===row.title,'Detail title mismatch')
 const office=indiaLocation(a['data-tm-job-location']);check(office.location===row.location,'Detail office mismatch')
 check(d.text(one(subtree(d,head,n=>d.hasClass(n,'job-location')),'visible office'))==='Location '+row.location,'Visible office mismatch')
 const postedAt=originalDate(a['data-tm-job-date-posted'],now);check(postedAt===row.postedAt,'Original listing/detail date mismatch')
 const visibleDate=d.text(one(subtree(d,head,n=>d.hasClass(n,'job-date')),'visible original date')).replace(/^Date posted /,'');check(originalDate(visibleDate,now,{display:true})===postedAt,'Visible original date mismatch')
 check(a['data-tm-job-posting-brand']===row.brand,'Native brand mismatch')
 const employer=a['data-tm-job-business'];check(['Disney (India) Private Limited','Lucasfilm Visual Effects (India) Private Limited','Disney HR Strategies & Services, LLC'].includes(employer),'Unqualified native legal employer')
 check(meta(d,'job-ats-req-id')===row.req&&norm(meta(d,'job-tbcn-job-title'))===row.title&&['391,','391,'+employer].includes(meta(d,'gtm_tbcn_division')),'Native employer/req/title metadata mismatch')
 const locationCodes=row.city==='Mumbai'?['1269750-1264418-1275339']:['1269750-1267701-1277333','1269750-1267701-1277331-1277333']
 check(locationCodes.includes(meta(d,'job-location-ids'))&&meta(d,'gtm_tbcn_location')===(row.city==='Mumbai'?'Mumbai~Maharashtra~India':'Bengaluru~Karnataka~India'),'Native country/city metadata mismatch')
 const links=d.nodes(n=>n.tag==='a'&&d.hasClass(n,'job-apply'));check(links.length>=1,'Active native apply unavailable')
 const applyUrls=new Set(links.map(n=>{check(!Object.hasOwn(n.attrs,'disabled')&&(!Object.hasOwn(n.attrs,'aria-disabled')||n.attrs['aria-disabled'].toLowerCase()==='false'),'Native application control disabled or unqualified');check(n.attrs['data-job-id']===row.id&&n.attrs['data-job-organization-id']==='391'&&n.attrs.href===n.attrs['data-apply-url'],'Native apply identity mismatch');return n.attrs.href}))
 check(applyUrls.size===1,'Conflicting apply URLs');const applyUrl=[...applyUrls][0],u=new URL(applyUrl)
 check(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash,'Unsafe apply URL')
 if(u.hostname==='join.disneycareers.com')check(u.pathname==='/global/en/apply'&&u.searchParams.getAll('jobSeqNo').length===1&&u.searchParams.get('jobSeqNo')==='TWNTWDUS'+row.req+'EXTERNALENGLOBAL'&&u.searchParams.get('utm_source')==='RADANCY_FEED'&&u.searchParams.get('utm_medium')==='phenom-feeds'&&[...u.searchParams.keys()].length===3,'Phenom apply mismatch')
 else check(u.hostname==='disney.wd5.myworkdayjobs.com'&&new RegExp('^/en-US/disneycareer/job/[^/]+/[^/]+_'+row.req+'(?:-\\d+)?/apply$').test(u.pathname)&&!u.search,'Workday apply mismatch')
 check(meta(d,'search-job-apply-url')===applyUrl,'Apply metadata mismatch')
 const sections=d.nodes(n=>n.attrs.id==='job-details-3');check(sections.length===1,'Missing role description section')
 const s=sections[0];for(const key of ['data-org-id','data-job-id','data-tm-job-name','data-tm-job-location','data-tm-job-id','data-tm-job-business','data-tm-job-date-posted','data-tm-job-posting-brand'])check(s.attrs[key]===a[key],'Description identity mismatch '+key)
 const nativeJd=nativeEvidenceDescendants(s,n=>d.hasClass(n,'ats-description'));check(nativeJd.length<=1,'Ambiguous full description')
 const nativeText=nativeJd.length?d.text(nativeJd[0]):'',qualified=qualifiedDescription(nativeText,nativeJd.length?nativeTextBlocks(nativeJd[0]):[])
 const notice=findExplicitNativeClosure(nativeTextBlocks(head))||qualified.notice,description=notice?null:qualified.description
 const rejected=description?{}:{nativeRejectedDescription:nativeText||null,nativeRejectedDescriptionRawHTML:nativeJd.length?body.slice(nativeJd[0].start,nativeJd[0].end):null}
 const job={jobId:row.req,title:row.title,company:'Disney',source:'disney',location:row.location,locations:[row.location],city:row.city,country:'India',sourceUrl:row.url,sourceURL:row.url,url:row.url,applyUrl,postedAt,datePosted:postedAt,sourceDescription:description,jobDescription:description,sourceDetailComplete:Boolean(description),sourceDetailFailureReason:notice?'native-role-explicitly-closed':qualified.reason,...rejected,sourceListingComplete:false,sourceScopeComplete:false,nativeJobId:row.id,nativeRequisitionId:row.req,nativeLegalEmployer:employer,nativePostingBrand:row.brand,nativePublicationDate:a['data-tm-job-date-posted'],nativePublicationSource:row.url,nativeListingLocation:a['data-tm-job-location'],scrapedAt:new Date(now).toISOString()}
 if(description||notice)job.sourceAvailabilityEvidence=createNativeRoleAvailability(job,{state:notice?'closed':'open',observedAt:now,evidenceHtml:body})
 return job
}
