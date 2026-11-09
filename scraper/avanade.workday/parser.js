import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { requireNative, nativeDate, plainNativeHTML } from '../../scraper-support/shared/nativeJobPosting.js'
export const SOURCE='avanade',COMPANY='Avanade',ORIGIN='https://www.avanade.com'
export const HOME=ORIGIN+'/en/career',SEARCH=HOME+'/search-jobs'
export const ORGANIZATION='avanadesc9productionlk3bs0x7',HUB='dotcomcareersearch'
export const API='https://'+ORGANIZATION+'.org.coveo.com/rest/search/v2?organizationId='+ORGANIZATION
export const BOARD=API+'&firstResult=0'
const CQ='@job_item_type == ActiveJobs AND @joblanguageid == 1 AND @isignoredjob == 0'
const ensure=(value,message)=>requireNative(value,'Avanade: '+message)
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)
const pageURL=offset=>API+'&firstResult='+offset
const nextData=html=>{
 const values=document(html).nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__')
 ensure(values.length===1,'Missing unique embedded native page data')
 const data=JSON.parse(values[0].raw)
 ensure(data.props?.pageProps?.site?.name===COMPANY&&data.locale==='en','Official site/locale identity conflict')
 return data
}
const fields=(value,key,result=[])=>{
 if(!value||typeof value!=='object')return result
 for(const[k,v]of Object.entries(value)){if(k===key)result.push(v);if(typeof v==='object')fields(v,key,result)}
 return result
}
export function createSourceConfig({now=()=>new Date().toISOString()}={}){
 const current=Date.parse(now()),allowedDetails=new Set();ensure(Number.isFinite(current),'Invalid observation clock')
 let appURL=null,clientURL=null,detailBase=null,publicSearchKey=null
 const activeRecord=record=>{
  const r=record?.raw
  ensure(object(record)&&object(r)&&typeof r.jobid==='string'&&/^R\d{8}$/.test(r.jobid)
   &&r.job_id===r.jobid&&r.id===r.jobid+'-1','Native requisition aliases conflict')
  ensure(typeof record.title==='string'&&norm(record.title)&&['title','systitle','jobname','job_name'].every(k=>typeof r[k]==='string'&&norm(r[k])===norm(record.title)),
   'Native title aliases conflict')
  const uri='https://avanade.com/careers/job-details/1/'+r.jobid+'-1'
  ensure(['uri','clickUri','printableUri'].every(k=>record[k]===uri)
   &&['uri','sysuri','identifiableuri'].every(k=>r[k]===uri),'Native listing URI identity conflict')
  ensure(r.job_item_type==='ActiveJobs'&&r.isignoredjob===0&&r.joblanguageid===1&&r.language_cd==='EN','Native listing is not in the verified active language scope')
  ensure(r.jobcountry==='India'&&['jobcountryid','job_countryid','countrycode'].every(k=>r[k]==='19821')
   &&typeof r.jobcityname==='string'&&norm(r.jobcityname)&&typeof r.state==='string'&&norm(r.state)
   &&Array.isArray(r.joblocation)&&r.joblocation.length===2&&r.joblocation[0]==='India'&&r.joblocation[1]===r.jobcityname,
  'Missing or conflicting explicit native India location')
  ensure(Number.isSafeInteger(r.jobposteddate)&&r.jobposteddate>0&&r.job_posted_date===r.jobposteddate
   &&r.jobposteddate<=current,'Missing,conflicting or future native original posting epoch')
  const application=new URL(r.apply_url)
  ensure(application.origin==='https://accenture.wd103.myworkdayjobs.com'&&!application.username&&!application.password&&!application.search&&!application.hash
   &&new RegExp('^/AvanadeCareers/job/[^/]+/[^/]+_'+r.jobid+'/apply$').test(application.pathname),
  'Unqualified native application href identity')
  return record
 }
 // Search/index/import timestamps and rankings can change without a vacancy
 // changing. Compare all business fields used by extraction,including the full
 // original sections,while retaining both original records as evidence.
 const identity=record=>{
  const r=activeRecord(record).raw
  return {id:r.jobid,title:record.title,uri:record.uri,country:r.jobcountry,countryID:r.jobcountryid,
   city:r.jobcityname,state:r.state,locations:r.joblocation,posted:r.jobposteddate,application:r.apply_url,
   description:r.jobdescription,descriptionAlias:r.job_description,qualification:r.qualification,
   skills:[r.skill1??null,r.skill2??null,r.skill3??null],expertise:r.jobareaofexpertise??null}
 }
 const config={source:SOURCE,companyName:COMPANY,boardURL:BOARD,detailConcurrency:4,compactResponseReferences:true,
  sameReadIdentity:(from,to)=>from===to,
  expectedContentType:url=>url.startsWith(API+'&')?'application/json':[appURL,clientURL].includes(url)?'application/javascript':'text/html',
  validateURL(value){
   if([HOME,SEARCH,appURL,clientURL].filter(Boolean).includes(value)||allowedDetails.has(value))return
   const url=new URL(value),offset=url.searchParams.get('firstResult')
   ensure(!url.username&&!url.password&&!url.hash&&/^(?:0|[1-9]\d{0,3})$/.test(offset||'')
    &&Number(offset)%12===0&&value===pageURL(Number(offset)),'Unqualified public read URL')
  },
  readRequest(url){
   config.validateURL(url)
   if(!url.startsWith(API+'&'))return{method:'GET',headers:{Accept:config.expectedContentType(url)}}
   ensure(publicSearchKey,'Missing advertised public client search binding')
   // Coveo accepts firstResult in the query OR the JSON body. Supplying both
   // returns DuplicateParameterException. The actual URL retains the cursor.
   return{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',Authorization:'Bearer '+publicSearchKey},
    body:JSON.stringify({cq:CQ,q:'@jobcountryid == 19821',numberOfResults:12,
     sortCriteria:'@jobposteddate descending, @jobname ascending',searchHub:HUB})}
  },
  handoffs:[
   {url:HOME,verify(html){
    nextData(html)
    ensure(document(html).nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string'&&new URL(n.attrs.href,ORIGIN).href===SEARCH).length>0,
     'Official careers page no longer links the public search')
   }},
   {url:SEARCH,verify(html){
    const data=nextData(html),route=data.props.pageProps.layoutData?.sitecore?.route
    const links=fields(route?.placeholders,'JobDetails'),queries=fields(route?.placeholders,'cq')
    ensure(links.length===1&&links[0].value?.href==='/en/career/job-details'
     &&queries.length===1&&queries[0].value===CQ,'Native job route/active search scope changed')
    detailBase=ORIGIN+links[0].value.href
    const sources=document(html).nodes(n=>n.tag==='script'&&typeof n.attrs.src==='string').map(n=>new URL(n.attrs.src,ORIGIN))
    const app=sources.filter(u=>u.origin===ORIGIN&&/^\/_next\/static\/chunks\/pages\/_app-[a-f0-9]{16}\.js$/.test(u.pathname)&&!u.search&&!u.hash)
    const client=sources.filter(u=>u.origin===ORIGIN&&/^\/_next\/static\/chunks\/8245-[a-f0-9]{16}\.js$/.test(u.pathname)&&!u.search&&!u.hash)
    ensure(app.length===1&&client.length===1,'Missing uniquely advertised public client assets')
    appURL=app[0].href;clientURL=client[0].href
   }},
   {get url(){ensure(appURL,'Missing public app binding');return appURL},verify(js){
    const literal=name=>{
     const matches=[...js.matchAll(new RegExp('n\\.'+name+'=a\\.env\\.[A-Z_]+\\|\\|("(?:[^"\\\\]|\\\\.)*")','g'))]
     ensure(matches.length===1,'Missing unique advertised public search configuration')
     return JSON.parse(matches[0][1])
    }
    ensure(literal('coveoCareersOrganizationId')===ORGANIZATION&&literal('coveoCareersSearchHub')===HUB,
     'Advertised native public search organization/hub changed')
    const key=literal('coveoCareersAccessToken')
    ensure(typeof key==='string'&&/^[A-Za-z0-9_.-]{16,4096}$/.test(key),'Invalid advertised public client search key')
    publicSearchKey=key // Used only for this advertised anonymous search;never logged/evaluated.
   }},
   {get url(){ensure(clientURL,'Missing public search contract binding');return clientURL},verify(js){
    ensure(js.includes('CoveoSearchRequest:')&&js.includes('.org.coveo.com/rest/search/v2?organizationId=')
     &&js.includes('@job_item_type == ActiveJobs AND @joblanguageid == ')
     &&js.includes('@jobposteddate descending, @jobname ascending')&&js.includes('String(e.raw.job_id)'),
    'Advertised native search request/role contract changed')
   }},
  ],
  parseListing(raw,url){
   const data=JSON.parse(raw),offset=Number(new URL(url).searchParams.get('firstResult'))
   ensure(object(data)&&Number.isSafeInteger(data.totalCount)&&data.totalCount>=0&&data.totalCount<=400
    &&data.totalCountFiltered===data.totalCount&&Array.isArray(data.results)
    &&data.results.length===Math.min(12,Math.max(0,data.totalCount-offset)),'Truncated or invalid native pagination envelope')
   const records=[],errors=[]
   for(const item of data.results)try{
    const record=activeRecord(item),r=record.raw,url=detailBase+'/'+r.jobid;allowedDetails.add(url)
    records.push({id:r.jobid,title:norm(record.title),url,locations:[r.jobcityname+', '+r.state+', India'],countries:['India'],nativeAPIListing:record})
   }catch(error){errors.push({message:error.message,rawCandidate:item})}
   return{pageNumber:offset/12+1,lastPage:Math.max(1,Math.ceil(data.totalCount/12)),reportedTotal:data.totalCount,
    observedRows:data.results.length,records,errors,nextURL:offset+12<data.totalCount?pageURL(offset+12):null,terminationKnown:true}
  },
  pageFingerprint:page=>JSON.stringify([page.pageNumber,page.lastPage,page.reportedTotal,page.observedRows,page.records.map(r=>identity(r.nativeAPIListing)),page.errors]),
  candidateForIndia:()=>true,
  parseDetail(html,row){
   const data=nextData(html),record=activeRecord(data.props.pageProps.jobDetails),r=record.raw
   ensure(data.query?.id===row.id&&r.jobid===row.id&&JSON.stringify(identity(record))===JSON.stringify(identity(row.nativeAPIListing)),
    'Native public role/listing identity or content conflict')
   ensure(typeof r.jobdescription==='string'&&plainNativeHTML(r.jobdescription)&&r.jobdescription===r.job_description
    &&typeof r.qualification==='string'&&plainNativeHTML(r.qualification),'Missing original native role description/qualification sections')
   const posted=nativeDate(new Date(r.jobposteddate).toISOString(),{required:true})
   return{id:row.id,title:row.title,sourceURL:row.url,nativeListingRecord:row.nativeAPIListing,nativeAPIRecord:record,
    nativeJobPosting:null,nativeJobPostingIdentifier:null,nativeHiringOrganization:null,
    nativeCountryAddresses:[{raw:{jobcountry:r.jobcountry,jobcityname:r.jobcityname,state:r.state,joblocation:r.joblocation,jobcountryid:r.jobcountryid},
     country:'India',nativeCountryRaw:r.jobcountry,nativeAddressFormat:'original typed native search fields;not JSON-LD'}],
    nativeVisibleLocationTexts:[],nativeSchemaDescription:null,nativeVisibleDescriptionHTML:null,
    nativeDescriptionHTML:r.jobdescription+'\n\n'+r.qualification,
    nativeDescriptionOrigin:'original embedded native jobdescription and qualification;rendered DOM equality not asserted',
    nativePostedDate:posted,nativeOriginalPostingEpoch:r.jobposteddate,nativeCreatedOn:r.jobcreatedon,
    nativeUpdatedOn:r.jobupdatedon,nativeIndexedDate:r.sysindexeddate,nativeValidThrough:nativeDate(null),nativeApplicationURL:r.apply_url,
    nativeSearchBinding:{organization:ORGANIZATION,searchHub:HUB,countryField:'jobcountryid',countryID:'19821',country:'India',languageID:1,
     activeQuery:CQ,detailBase,publicAppURL:appURL,publicSearchContractURL:clientURL,publicClientSearchKeyValueRetainedOnlyInOriginalPublicAsset:true},
    applicationsVisited:false,firstEverPublication:null,legalEmployer:null,sourceScopeComplete:false}
  },
 }
 return config
}
