import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,activeHead,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {currentRapid7Transport} from './currentTransport20261117.js'
const ORIGIN='https://careers.rapid7.com',SEARCH=ORIGIN+'/jobs/search'
const requireCurrent=(ok,message)=>{if(!ok)throw Object.assign(Error('Rapid7 current native contract: '+message),{abortRetries:true,failureKind:'parser_or_contract_error',sourceScopeComplete:false,lifecycleCleanupAllowed:false})}
const one=(values,label)=>{requireCurrent(values.length===1,'unique '+label);return values[0]}
const classes=(node,value)=>(node.attrs.class||'').split(/\s+/).includes(value)
const key=text=>extractActiveDescription(text)?.replace(/\s+/g,' ').trim()

function searchPage(html,pageNumber,extractCards){
 const doc=readNativeDocument(html)
 requireCurrent(isDeepStrictEqual(activeHead(html).titles,['Search Page']),'current search title')
 const form=one(doc.nodes(n=>n.tag==='form'&&classes(n,'job-search-results-form')),'native search form')
 requireCurrent(form.attrs.action===SEARCH&&form.attrs.method==='get'&&form.attrs['data-action']==='jobs--search#submitForm','native search action')
 const rows=doc.nodes(n=>n.tag==='tr'&&n.attrs['data-job-url']),cards=[],parsed=extractCards(html)
 requireCurrent(rows.length>0&&rows.length<=30,'bounded complete active rows')
 requireCurrent(parsed.length===rows.length,'complete raw/active native row accounting')
 for(const row of rows){
  requireCurrent(row.attrs.role==='link'&&row.attrs['data-action']==='click->jobs--table-results#navigate','native table row binding')
  const url=row.attrs['data-job-url'];requireCurrent(typeof url==='string'&&url.startsWith(ORIGIN+'/jobs/')&&new URL(url).origin===ORIGIN&&!url.includes('?')&&!url.includes('#'),'current native row URL identity')
  const anchors=doc.nodes(n=>n.tag==='a',row);requireCurrent(anchors.length===1&&anchors[0].attrs.href===url,'native row/title URL relation')
  const card=one(parsed.filter(card=>card.sourceUrl===url),'complete native row fields')
  requireCurrent(card.sourceUrl===url&&/^R\d+$/.test(card.requisitionId),'native requisition identity')
  requireCurrent(doc.text(anchors[0])===card.title,'active complete title text')
  cards.push({...card,nativeRowModel:structuredClone(row)})
 }
 const next=[...new Set(doc.nodes(n=>n.tag==='a'&&n.attrs.rel==='next').map(n=>new URL(n.attrs.href,ORIGIN).href))]
 requireCurrent(next.length<=1&&(!next.length||next[0]===SEARCH+'?page='+(pageNumber+1)),'declared forward pagination')
 return {cards,next:next[0]??null}
}

function detail(html,card){
 const doc=readNativeDocument(html),heading=one(doc.nodes(n=>n.tag==='h3'&&n.attrs.class==='job-title'),'visible native title')
 requireCurrent(doc.text(heading)===card.title,'native title relation')
 const description=one(doc.nodes(n=>classes(n,'job-description')),'full native description')
 const postings=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>JSON.parse(n.raw)).filter(v=>v['@type']==='JobPosting')
 const posting=one(postings,'active native JobPosting'),location=Array.isArray(posting.jobLocation)&&posting.jobLocation.length===1?posting.jobLocation[0]:null,country=location?.address?.addressCountry
 requireCurrent(posting.title===card.title&&posting.hiringOrganization?.name==='Rapid7'&&posting.identifier?.name==='Rapid7'
  &&typeof posting.identifier.value==='string'&&/^[a-f0-9]{32}$/.test(posting.identifier.value),'native title/employer/schema identifier')
 requireCurrent(nativeCountryName(country)==='India'&&location.address.addressLocality==='Pune','schema native explicit India workplace')
 requireCurrent(key(posting.description)&&key(posting.description)===key(doc.text(description)),'complete native visible/schema criteria')
 return {requisitionId:card.requisitionId,sourceURL:card.sourceUrl,nativeSchemaIdentifier:posting.identifier.value,nativeJobPosting:posting,
  nativeDescriptionHTML:posting.description,nativeVisibleDescription:doc.text(description),nativeDescriptionModel:structuredClone(description),publicApplicationVerified:false,browserEquivalenceComplete:false}
}

export async function runCurrentRapid7(options={},extractCards){
 options.signal?.throwIfAborted()
 const now=new Date().toISOString(),allowed=new Set([SEARCH]),io=currentRapid7Transport({...options,allowedURL:url=>allowed.has(url)})
 let opening=[],closing=null,pages=0,paginationComplete=false
 const failures=[],details=[]
 const readInventory=async()=>{const rows=[],seen=new Set();let url=SEARCH
  for(let number=1;url&&number<=10;number++){
   allowed.add(url);const p=searchPage((await io.read(url)).text,number,extractCards);pages++
   for(const card of p.cards){requireCurrent(!seen.has(card.requisitionId),'unique full native inventory');seen.add(card.requisitionId);rows.push(card)}
   url=p.next;if(!url)return rows
  }throw Error('Rapid7 current native pagination bound changed')
 }
 try{
  opening=await readInventory();paginationComplete=true
  const india=opening.filter(row=>/^(?:[^,]+,\s*)?India$/.test(row.location)),unknown=opening.filter(row=>/\bIndia\b/i.test(row.location)&&!india.includes(row))
  for(let index=0;index<india.length;index++){
   const card=india[index];allowed.add(card.sourceUrl)
   try{
    details.push(detail((await io.read(card.sourceUrl)).text,card))
    failures.push({stage:'native-detail',id:card.requisitionId,reason:'current-application-handoff-unverified',nativeRecord:card})
   }catch(error){
    options.signal?.throwIfAborted()
    if(error.failureKind==='blocked_or_access_denied'){
     failures.push({stage:'native-detail',id:card.requisitionId,reason:'native-http-access-denied',httpStatus:error.status??error.httpStatus,nativeRecord:card})
     failures.push(...india.slice(index+1).map(row=>({stage:'native-detail',id:row.requisitionId,reason:'not-read-after-native-access-denial',nativeRecord:row})))
     break
    }
    throw error
   }
  }
  if(!failures.some(v=>v.reason==='native-http-access-denied')){
   try{closing=await readInventory();requireCurrent(isDeepStrictEqual(opening,closing),'closing full native row model changed')}
   catch(error){options.signal?.throwIfAborted();if(error.failureKind!=='blocked_or_access_denied')throw error
    failures.push({stage:'closing-inventory',reason:'native-http-access-denied',httpStatus:error.status??error.httpStatus})}
  }
  const jobs=[]
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:SEARCH,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,
   pagesFetched:pages,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'native-metadata-observed;application-handoff-unverified;native-access-denial-and-company-scope-held'})
  attachSourceObservationEvidence(jobs,{source:'rapid7india',recordKind:'vacancy-rows',observedRecordCount:opening.length,observedVacancyCount:opening.length,
   sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{configurable:true,value:{...jobs.nativeCollectionEvidence,source:'rapid7india',observedListingCount:opening.length,
   candidateDetails:india.length,extractedDetailJobs:0,excludedDetailJobs:0,exclusions:[],failures,nativeOpeningInventory:opening,nativeClosingInventory:closing,
   nativeOpeningDetails:details,nativeUnknownCountryRecords:unknown,listingPaginationComplete:paginationComplete,closingInventoryMatches:closing!==null,
   retainedResponses:io.receipts,sourceScopeComplete:false,browserEquivalenceComplete:false,lifecycleCleanupAllowed:false}})
  return jobs
 }finally{io.close()}
}
