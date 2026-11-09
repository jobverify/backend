import {document,norm} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {requireNative,nativeDate,nativeCountryName,plainNativeHTML} from '../../scraper-support/shared/nativeJobPosting.js'
import {mapWorkablePublicDetail} from '../../scraper-support/utils/workablePublicApi.js'
export const SOURCE='fortanix',COMPANY='Fortanix',CORPORATE='https://www.fortanix.com/company/careers'
export const WIDGET='https://apply.workable.com/api/v1/widget/accounts/337112',LLMS='https://apply.workable.com/fortanix/llms.txt',MARKDOWN='https://apply.workable.com/fortanix/jobs.md'
export const ACCOUNT_UID='ce81a40d-ccc1-41ad-b20b-a603237884c8'
const ensure=(v,m)=>requireNative(v,'Fortanix: '+m),text=v=>typeof v==='string',key=v=>norm(v).toLowerCase()
const detailURL=id=>'https://apply.workable.com/api/v2/accounts/fortanix/jobs/'+id
const locationKey=l=>[l.countryCode,l.city,l.region].map(v=>String(v??'').trim().toLowerCase()).join('|')
function locations(rows){
 ensure(Array.isArray(rows)&&rows.length>0&&rows.length<=32,'Native country/location list missing')
 for(const r of rows){ensure(r&&text(r.countryCode)&&nativeCountryName(r.countryCode)===r.country&&r.hidden===false,'Explicit native country or visibility conflicts');ensure((r.city==null||text(r.city))&&(r.region==null||text(r.region)),'Malformed native locality')}
 ensure(new Set(rows.map(locationKey)).size===rows.length,'Duplicate native location')
 return rows
}
function payload(raw){const p=JSON.parse(raw);ensure(p&&typeof p==='object'&&!Array.isArray(p)&&!p.error&&!p.errors&&p.success!==false,'Native upstream error');return p}
export function createSourceConfig({now=()=>new Date().toISOString()}={}){
 const clock=now(),current=Date.parse(clock);ensure(Number.isFinite(current),'Invalid collection clock')
 let clientURL,total,markdownRows
 const allowedDetails=new Set()
 const config={source:SOURCE,companyName:COMPANY,boardURL:WIDGET,sameReadIdentity:(from,to)=>from===to,
  expectedContentType(url){if(url===clientURL)return'text/javascript';if(url===LLMS||url===MARKDOWN)return'text/markdown';return url===CORPORATE?'text/html':'application/json'},
  validateURL(value){ensure(value===CORPORATE||value===WIDGET||value===LLMS||value===MARKDOWN||clientURL&&value===clientURL||allowedDetails.has(value),'Unqualified public endpoint')},
  handoffs:[
   {url:CORPORATE,verify(html){const doc=document(html),assets=doc.nodes(n=>n.tag==='script'&&/^\/_next\/static\/chunks\/8661\.[a-f0-9]{16}\.js$/.test(n.attrs.src||''));ensure(assets.length===1&&doc.nodes(n=>n.tag==='section'&&n.attrs.id==='workable-section').length===1,'Current corporate Workable component missing');clientURL=new URL(assets[0].attrs.src,CORPORATE).href}},
   {get url(){return clientURL},verify(raw){ensure(raw.includes('https://cdn.aglty.io/fortanix/js-files/workable-embed.js'),'Current corporate advertised embed changed');const ids=[...new Set([...raw.matchAll(/\bwhr_embed\(([1-9]\d*),/g)].map(m=>m[1]))];ensure(ids.length===1&&ids[0]==='337112','Corporate native account identity changed')}},
   {url:LLMS,verify(raw){ensure(raw.startsWith('# Fortanix Careers\n')&&raw.includes('[Company website](http://www.fortanix.com)'),'Native tenant/company identity changed');const matches=[...raw.matchAll(/All open roles \(GET `https:\/\/apply\.workable\.com\/fortanix\/jobs\.md`\): (\d+) current openings/g)];ensure(matches.length===1,'Native authoritative count missing');total=Number(matches[0][1]);ensure(Number.isSafeInteger(total)&&total>=0&&total<=1000,'Native inventory bound')}},
   {url:MARKDOWN,verify(raw){
    ensure(raw.startsWith('# Fortanix — All Open Positions\n'),'Native listing tenant/title changed')
    const dates=[...raw.matchAll(/^> Last updated: (\d{4}-\d{2}-\d{2})$/gm)];ensure(dates.length===1,'Native listing freshness missing');const updated=Date.parse(nativeDate(dates[0][1],{required:true}).iso);ensure(updated<=current&&current-updated<=48*3600000,'Native listing stale or future')
    const lines=raw.split(/\r?\n/).filter(l=>l.startsWith('|'));ensure(lines.length>=2&&lines[0]==='| Title | Department | Location | Type | Salary | Posted | Details |'&&/^\|[-|]+\|$/.test(lines[1]),'Native listing table changed')
    markdownRows=new Map()
    for(const line of lines.slice(2)){const cells=line.split('|').slice(1,-1).map(v=>v.trim());ensure(cells.length===7,'Malformed native listing row');const m=/^\[View\]\(https:\/\/apply\.workable\.com\/fortanix\/jobs\/view\/([A-Z0-9]{6,32})\.md\)$/.exec(cells[6]);ensure(m&&!markdownRows.has(m[1])&&cells[0],'Duplicate/foreign native listing role');nativeDate(cells[5],{required:true});markdownRows.set(m[1],{title:cells[0],location:cells[2],posted:cells[5]})}
    ensure(markdownRows.size===total,'Native count and complete listing do not reconcile')
   }},
  ],
  parseListing(raw,url){
   ensure(url===WIDGET,'Unqualified native listing');const p=payload(raw);ensure(p.name===COMPANY&&Array.isArray(p.jobs)&&p.jobs.length===total,'Native account/count mismatch')
   const ids=new Set(),records=p.jobs.map(r=>{
    ensure(r&&/^[A-Z0-9]{6,32}$/.test(r.shortcode||'')&&!ids.has(r.shortcode)&&text(r.title)&&r.title.trim(),'Duplicate/missing native public role identity');ids.add(r.shortcode)
    const md=markdownRows.get(r.shortcode);ensure(md&&key(md.title)===key(r.title)&&md.posted===r.published_on,'Native widget/listing identity or date mismatch')
    locations(r.locations);ensure(r.locations.some(l=>l.country===r.country&&key(l.city??'')===key(r.city??'')&&key(l.region??'')===key(r.state??'')),'Native primary location conflicts')
    ensure(md.location.replace(/ \((?:Hybrid|Remote|On-site)\)$/,'').endsWith(r.country),'Native listing/widget country conflict')
    ensure(r.url==='https://apply.workable.com/j/'+r.shortcode&&r.application_url===r.url+'/apply','Native public/application URL mismatch')
    const posted=nativeDate(r.published_on,{required:true});ensure(Date.parse(posted.iso)<=current,'Future native listing publication');if(r.created_at)ensure(Date.parse(nativeDate(r.created_at,{required:true}).iso)<=current,'Future native widget creation date')
    allowedDetails.add(detailURL(r.shortcode));return{id:r.shortcode,title:r.title,url:detailURL(r.shortcode),rawWidget:r,nativeMarkdownRow:md}
   })
   return{pageNumber:1,lastPage:1,reportedTotal:total,observedRows:records.length,records,nextURL:null,terminationKnown:true}
  },
  pageFingerprint:p=>JSON.stringify({total:p.reportedTotal,records:p.records.map(r=>r.rawWidget)}),candidateForIndia:r=>r.rawWidget.locations.some(l=>l.countryCode==='IN'),
  parseDetail(raw,row){
   const d=payload(raw),r=row.rawWidget;locations(d.locations)
   ensure(d.accountUid===ACCOUNT_UID&&d.shortcode===r.shortcode&&d.title===r.title&&d.code===r.code,'Native detail account/identity changed')
   ensure(JSON.stringify(d.locations.map(locationKey).sort())===JSON.stringify(r.locations.map(locationKey).sort()),'Native detail/listing locations conflict')
   ensure(text(d.published)&&d.published.slice(0,10)===r.published_on,'Native publication calendar conflict')
   ensure(text(d.description)&&plainNativeHTML(d.description).length>=100,'Missing full native description')
   const mapped=mapWorkablePublicDetail(d,d,d.locations,{source:SOURCE,company:COMPANY,tenant:'fortanix',accountUid:ACCOUNT_UID,requiredContentSections:['description'],careersUrl:CORPORATE,companyDomain:'fortanix.com'},clock)
   const validated={...mapped,jobId:row.id,requisitionId:d.code.trim()||null,sourceUrl:r.url,applyUrl:r.application_url,link:r.application_url}
   return{id:row.id,title:row.title,sourceURL:r.url,nativeApplicationURL:r.application_url,nativeListingRecord:row,nativeDetail:d,mappedValidation:validated,sourceScopeComplete:false,applicationsVisited:false,originalFirstPublication:null}
  },
  projectJobs(result){
   const{jobs,listingRecords,retainedResponses,unknownRawFailures,...summary}=result
   const compact={...summary,extractedDetailJobs:jobs.length,listingRecordCount:listingRecords.length,unknownRawFailureCount:unknownRawFailures.length,fullBatchEvidenceOnFirstExtractedJob:true,retainedResponses:retainedResponses.map(({url,status,bodyBytes,bodySHA256,requestedAt,completedAt})=>({url,status,bodyBytes,bodySHA256,requestedAt,completedAt}))}
   return jobs.map((f,index)=>{const r=f.nativeListingRecord.rawWidget,d=f.nativeDetail,sections=['description','requirements','benefits'].map(k=>d[k]).filter(v=>typeof v==='string');return{...f.mappedValidation,jobId:f.id,requisitionId:d.code.trim()||null,sourceUrl:f.sourceURL,applyUrl:f.nativeApplicationURL,link:f.nativeApplicationURL,applicationLinkSource:'native-widget-application-url',nativeApplicationURL:f.nativeApplicationURL,employmentType:r.employment_type||null,jobDescription:sections.join('\n\n'),sourceDescription:sections.join('\n\n'),nativeContentSections:Object.fromEntries(['description','requirements','benefits'].map(k=>[k,d[k]??null])),nativePublished:d.published,nativeWidgetPublishedOn:r.published_on,nativeWidgetCreatedAt:r.created_at??null,nativeAccountUID:d.accountUid,nativeNumericID:d.id,nativeFacts:f,nativeCollectionEvidence:index===0?result:compact,sourceListingComplete:false,sourceDetailComplete:true,sourceDetailStatus:'complete',sourceScopeComplete:false,lifecycleCleanupAllowed:false,applicationsVisited:false,firstEverPublication:null,legalEmployer:null}})
  },
 }
 return config
}
