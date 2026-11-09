import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {nativeCountryName,plainNativeHTML} from '../../scraper-support/shared/nativeJobPosting.js'
export const HOME_URL='https://yournest.in/'
export const BOARD_URL='https://jobs.pyjamahr.com/yournest-venture-capital'
export const LIST_URL='https://api.pyjamahr.com/api/career/jobs/?company_uuid=987EE7EF32&page=1&is_careers_page=true'
const facts=new Map([
 [376083,{uuid:'03FA105459',title:'Associate/Sr. Associate - Foundation',date:'2026-07-07T12:41:03.836418+05:30',own:true}],
 [374870,{uuid:'81DE63CFC2',title:'Associate Principal/Principal - Venture Capital',date:'2026-07-03T14:50:27.461782+05:30',own:true}],
 [43774,{uuid:'B79F7D2B07',title:'Interested in VC/Startups (Across India)',date:'2023-05-31T15:03:45.624257+05:30',own:false}],
])
const check=(ok,reason)=>{if(!ok)throw Error(reason)}
const parseSSR=html=>{const doc=document(html),scripts=doc.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__');check(scripts.length===1,'Native SSR data missing or ambiguous');return {doc,props:JSON.parse(scripts[0].raw).props?.pageProps}}
const company=c=>check(c?.id===6566&&c.uuid==='987EE7EF32'&&c.name==='YourNest Venture Capital'&&c.url===HOME_URL&&c.slug==='yournest-venture-capital','Exact native board employer binding changed')
const date=raw=>{check(typeof raw==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}\+05:30$/.test(raw)&&Number.isFinite(Date.parse(raw)),'Native offset timestamp missing or malformed');const iso=new Date(raw).toISOString();const local=new Date(Date.parse(raw)+19800000).toISOString();check(local.slice(0,19)===raw.slice(0,19),'Invalid native calendar timestamp');return {raw,iso,precision:'microsecond',exact:true}}
const sensitive=/^(?:datePosted|datePublished|dateModified|published_at|updated_at|published_on|closingDate|expiresAt|expirationDate|expiry_date|validThrough|valid_through|created_at|addressCountry|country|jobLocation|applicantLocationRequirements)$/i
const reviewKeys=(o,allowed)=>{for(const k of Object.keys(o))check(!sensitive.test(k)||allowed.includes(k),'New native country, publication or expiry field requires review: '+k)}
const everyNode=root=>[root,...root.children.filter(c=>typeof c!=='string').flatMap(everyNode)]
const schemaKeys={
 '':['@context','@type','title','description','identifier','datePosted','employmentType','hiringOrganization','jobLocation','applicantLocationRequirements','jobLocationType','directApply','baseSalary','validThrough'],
 identifier:['@type','name','value'],hiringOrganization:['@type','name','sameAs','logo'],
 jobLocation:['@type','address'],'jobLocation.address':['@type','addressCountry','addressLocality','addressRegion','streetAddress'],
 applicantLocationRequirements:['@type','name'],baseSalary:['@type','currency','value'],'baseSalary.value':['@type','value','unitText'],
}
const reviewSchema=(value,path='')=>{
 check(value&&typeof value==='object'&&!Array.isArray(value),'Unreviewed native schema container: '+path)
 const allowed=schemaKeys[path];check(allowed,'Unreviewed native schema nesting: '+path)
 for(const [key,child] of Object.entries(value)){
  check(allowed.includes(key),'Unreviewed native schema field: '+(path?path+'.':'')+key)
  if(child&&typeof child==='object')reviewSchema(child,path?path+'.'+key:key)
 }
}
export async function collectYourNestNative({read,now}){
 const home=document(await read(HOME_URL));check(home.nodes(n=>n.tag==='meta'&&n.attrs.name==='description'&&n.attrs.content==='YourNest Venture Capital').length===1,'Official employer identity changed')
 const board=parseSSR(await read(BOARD_URL));company(board.props?.companyDetails)
 const jobs=[],nativeCandidates=[],listing=[];let next=LIST_URL,pages=0
 while(next){
  check(++pages<=10,'Native pagination exceeds bound')
  const p=JSON.parse(await read(next));check(Number.isSafeInteger(p.count)&&p.count>=0&&p.count<=200&&Array.isArray(p.results)&&p.results.length<=100,'Native inventory shape or count changed')
  for(const row of p.results){check(Number.isSafeInteger(row.id)&&!listing.some(r=>r.id===row.id),'Native duplicate or invalid listing ID');reviewKeys(row,['country']);listing.push(row)}
  check(listing.length<=p.count,'Native inventory count conflict')
  if(p.next){const u=new URL(p.next);check(u.origin==='https://api.pyjamahr.com'&&u.pathname==='/api/career/jobs/'&&u.searchParams.get('company_uuid')==='987EE7EF32'&&u.searchParams.get('is_careers_page')==='true'&&u.searchParams.get('page')===String(pages+1),'Unsafe or cyclic native pagination');next=u.href}else{check(listing.length===p.count,'Incomplete native page count');next=null}
 }
 for(const row of listing){
  const fact=facts.get(row.id);check(fact&&row.title===fact.title&&typeof row.slug==='string'&&/^[a-z0-9-]+$/.test(row.slug),'Unreviewed role or exact native listing identity changed')
  const apiURL=`https://api.pyjamahr.com/api/career/jobs/${row.id}/?company_uuid=987EE7EF32&is_careers_page=false`
  const detail=JSON.parse(await read(apiURL));reviewKeys(detail,['country','created_at','valid_through'])
  check(detail.id===row.id&&detail.uuid===fact.uuid&&detail.title===row.title&&detail.email_domain==='yournest.in'&&detail.published_internally===false,'Native detail own-employer identity changed')
  check(detail.created_at===fact.date,'Native earliest publication changed; refresh requires review')
  const posted=date(detail.created_at),closing=date(detail.valid_through);check(closing.iso>=posted.iso&&Date.parse(posted.iso)<=Date.parse(now),'Native date range invalid or future')
  const sourceURL=BOARD_URL+'/'+row.slug,{doc,props}=parseSSR(await read(sourceURL));company(props?.companyDetails)
  const visible=props?.jobDetails;check(visible&&JSON.stringify(visible)===JSON.stringify(detail),'Native SSR/API detail conflict')
  const nodes=everyNode(doc.root)
  check(!nodes.some(n=>Object.hasOwn(n.attrs,'itemprop')&&!(n.tag==='meta'&&n.attrs.itemprop==='image')||/JobPosting/.test(n.attrs.itemtype||'')||n.tag==='time'),'New native microdata or primary role time requires review')
  const carriers=nodes.filter(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')
  check(carriers.length===1&&!carriers[0].inactive,'Native schema carriers changed or hidden')
  const schema=JSON.parse(carriers[0].raw);check(schema['@type']==='JobPosting','Native root JobPosting changed');reviewSchema(schema)
  check(schema.identifier?.value===row.id&&schema.title===row.title&&schema.hiringOrganization?.name==='YourNest Venture Capital'&&schema.hiringOrganization?.sameAs===HOME_URL&&schema.datePosted===detail.created_at&&schema.validThrough===detail.valid_through,'Native JobPosting employer/date conflict')
  const country=nativeCountryName(detail.country)
  check(detail.country===row.country&&schema.jobLocation?.address?.addressCountry===detail.country&&schema.applicantLocationRequirements?.name===detail.country,'Native country conflict')
  const links=doc.nodes(n=>n.tag==='a'&&doc.text(n)==='Apply'&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']!=='true')
  const app=links.length===1?new URL(links[0].attrs.href,sourceURL):null
  const activeApplyVerified=Boolean(app&&app.origin==='https://jobs.pyjamahr.com'&&app.pathname==='/careers'&&app.searchParams.get('job_id')===String(row.id)&&app.searchParams.get('company_uuid')==='987EE7EF32'&&app.searchParams.get('apply_now')==='true')
  const description=typeof detail.description==='string'&&plainNativeHTML(detail.description).trim()?plainNativeHTML(detail.description):null
  const exclusionReason=!fact.own?'generic-talent-pool':closing.iso<=new Date(now).toISOString()?'native-expired':country!=='India'?'missing-explicit-India-country':!activeApplyVerified?'active-application-tenant-unproven':null
  nativeCandidates.push({id:row.id,uuid:detail.uuid,title:row.title,nativeEmployer:'YourNest Venture Capital',nativeEmployerBoardId:6566,ownEmployerRole:fact.own,country,location:detail.location,nativePostedDate:posted,nativeValidThrough:closing,sourceURL,nativeApplicationURL:app?.href??null,activeApplyVerified,jobDescription:description,sourceDetailStatus:description?'complete':'partial',exclusionReason})
  if(!exclusionReason)jobs.push({source:'yournest',company:'YourNest',title:row.title,jobId:String(row.id),requisitionId:detail.uuid,location:detail.location,country,postingDate:posted.raw,closingDate:closing.raw,nativeDetailPublicationDate:posted.raw,firstEverPublication:null,sourceUrl:sourceURL,applyUrl:app.href,link:sourceURL,activeApplyVerified:true,firstParty:false,jobDescription:description,sourceDescription:description,sourceDetailComplete:Boolean(description),sourceDetailStatus:description?'complete':'partial',sourceDetailFailureKind:description?null:'missing-content',sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})
 }
 return {jobs,firstParty:false,inventoryStatus:jobs.length?'discovery-only':'coverage-gap',facts:{nativeCandidates,nativeObservedRecordCount:listing.length,nativeReportedBoardCount:listing.length,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false},reason:'Exact native YourNest board6566 uuid987EE7EF32 contains own roles and portfolio talent pool. Native created_at and valid_through retained without refresh. At observed verification both own roles are explicitly expired; generic pool excluded independently. Rendered Apply links carry unresolved company_uuid=undefined and do not prove active tenant application. Whole-company scope and official recruiting handoff unverified; counts unknown and cleanup disabled.'}
}


