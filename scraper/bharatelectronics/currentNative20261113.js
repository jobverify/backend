import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {extractPdfTextWorkerCore} from '../../scraper-support/shared/pdfTextWorkerCore.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {hasOfficialHomepageSignal,hasOfficialJobNotificationsPageSignal} from './script.js'
import review from './currentReview20261113.json' with {type:'json'}

const HOME='https://bel-india.in/',NOTICES=HOME+'job-notifications/',PAGE2=NOTICES+'page/2/'
const hash=value=>createHash('sha256').update(typeof value==='string'||value instanceof Uint8Array?value:JSON.stringify(value)).digest('hex')
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const need=(value,why)=>{if(!value)throw Object.assign(Error('BEL current native: '+why),{softFailure:true,abortRetries:true,lifecycleCleanupAllowed:false})}
const all=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(all)]
const snapshot=node=>typeof node==='string'?node:{tag:node.tag,attrs:node.attrs,inert:!!node.inert,...(Object.hasOwn(node,'raw')?{raw:node.raw}:{}),children:node.children.map(snapshot)}
const parse=html=>{const doc=readNativeDocument(html),root=doc.nodes(node=>node.tag==='root')[0];return{doc,root,nodes:all(root)}}
const norm=text=>text.replace(/\s+/g,' ').trim()

export async function runCurrentBel20261113(options={}){
  options.signal?.throwIfAborted()
  const deadline=AbortSignal.timeout(270000),signal=options.signal?AbortSignal.any([options.signal,deadline]):deadline
  const check=()=>{options.signal?.throwIfAborted();signal.throwIfAborted()}
  const wait=promise=>new Promise((resolve,reject)=>{check();const abort=()=>{signal.removeEventListener('abort',abort);reject(options.signal?.aborted?options.signal.reason:signal.reason)};signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);try{check();resolve(value)}catch(error){reject(error)}},error=>{signal.removeEventListener('abort',abort);reject(options.signal?.aborted?options.signal.reason:error)});if(signal.aborted)abort()})
  const responses=[],documents=[],closingDocuments=[],applicationSurfaces=[],failures=[];let count=0
  const readBytes=async url=>{
    check();need(++count<=64,'public request bound exceeded')
    const target=new URL(url);need(target.protocol==='https:'&&!target.username&&!target.password&&!target.port,'public HTTPS identity required')
    const response=await wait((options.fetchImpl||fetch)(url,{method:'GET',redirect:'manual',credentials:'omit',signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),headers:{'User-Agent':'Mozilla/5.0',Accept:'text/html,application/pdf'}}))
    need(response.status===200&&response.url===url,'public HTTP status or final URL changed: '+url)
    const bytes=new Uint8Array(await wait(response.arrayBuffer()));need(bytes.length<=4000000,'public body byte bound exceeded')
    responses.push({url,status:200,method:'GET',bytes:bytes.length,sha256:hash(bytes)});return bytes
  }
  const readHtml=async url=>{if(options.fetchText){const html=await wait(options.fetchText(url,{signal}));need(typeof html==='string'&&Buffer.byteLength(html)<=4000000,'HTML body bound exceeded');responses.push({url,method:'GET',bytes:Buffer.byteLength(html),sha256:hash(html)});return html}return Buffer.from(await readBytes(url)).toString()}
  const context=async()=>{
    const pages=[]
    for(const url of [HOME,NOTICES,PAGE2]){
      const html=await readHtml(url),tree=parse(html),known=review.contexts.find(row=>row.url===url)
      need(url===HOME?hasOfficialHomepageSignal(html):hasOfficialJobNotificationsPageSignal(html),'official employer/notification identity changed')
      need(equal(tree.nodes.find(node=>node.tag==='body')?.attrs,known.bodyAttributes),'original authority body visibility or styling changed')
      const inline=tree.nodes.filter(node=>node.tag==='style').map(node=>({attrs:node.attrs,sha256:hash(node.raw||'')}))
      const declarations=tree.nodes.filter(node=>node.tag==='link'&&(decodeHTML(node.attrs.rel||'').toLowerCase().split(/\s+/).includes('stylesheet')||decodeHTML(node.attrs.as||'').trim().toLowerCase()==='style')).map(node=>node.attrs)
      need(equal(inline,known.inline)&&equal(declarations,known.declarations),'original authority stylesheet declaration changed')
      const cards=tree.nodes.filter(node=>node.tag==='div'&&tree.doc.hasClass(node,'career-result-box')).map(node=>{
        const title=tree.doc.nodes(child=>child.tag==='h2',node),links=tree.doc.nodes(child=>child.tag==='a'&&child.attrs.href,node).map(child=>({url:new URL(child.attrs.href,NOTICES).href,text:tree.doc.text(child)}))
        const text=tree.doc.text(node),date=text.match(/Last Date to Apply:\s*(\d{2})-(\d{2})-(\d{4})/),sourceUrl=links.find(link=>/\.pdf$/.test(link.url))?.url
        return{title:title.length===1?tree.doc.text(title[0]):null,sourceUrl,links,closingDate:date?`${date[3]}-${date[2]}-${date[1]}`:null,treeSHA256:hash(snapshot(node)),visible:!node.inert,originalText:text}
      })
      need(cards.length<=100,'notification count exceeds bound')
      pages.push({url,html,cards})
    }
    const rows=new Map();for(const page of pages)for(const row of page.cards)if(row.sourceUrl&&!rows.has(row.sourceUrl))rows.set(row.sourceUrl,row)
    return{pages,rows:[...rows.values()]}
  }
  const currentDate=new Date(typeof options.now==='function'?options.now():options.now||Date.now()).toISOString().slice(0,10)
  const opening=await context(),current=opening.rows.filter(row=>!row.closingDate||row.closingDate>=currentDate)
  const documentByUrl=new Map()
  for(const row of current){
    const definition=review.notices.find(value=>value.pdfUrl===row.sourceUrl)
    if(!definition){failures.push({url:row.sourceUrl,reason:'unreviewed-current-notification-contract'});continue}
    for(const url of [definition.pdfUrl,...definition.relatedDocumentUrls]){
      if(documentByUrl.has(url))continue
      const known=review.documents.find(value=>value.url===url),bytes=await readBytes(url),bodySHA256=hash(bytes)
      const evidence={url,bodySHA256,originalPdfBase64:Buffer.from(bytes).toString('base64'),originalPageTexts:[],qualified:false}
      if(known&&bodySHA256===known.bodySHA256){
        const extracted=await extractPdfTextWorkerCore(bytes,{check,wait,maxPages:30,includePageLinks:true})
        need(extracted.numPages===known.numPages&&hash(extracted.text)===known.textSHA256,'pinned original PDF parser/text changed')
        Object.assign(evidence,{qualified:true,originalPageTexts:extracted.pageTexts,parser:extracted.parser,cleanup:extracted.cleanup})
      }else evidence.reason='full-original-visible-PDF-bytes-unreviewed'
      documentByUrl.set(url,evidence);documents.push(evidence)
    }
  }
  const currentDetails=[]
  for(const row of current){
    const definition=review.notices.find(value=>value.pdfUrl===row.sourceUrl),issues=[]
    if(!definition){currentDetails.push({...row,country:null,activeApplicationQualified:false,sourceDetailComplete:false,issues:['current-native-notice-unreviewed']});continue}
    const originalDocs=[definition.pdfUrl,...definition.relatedDocumentUrls].map(url=>documentByUrl.get(url))
    const originalCriteria=originalDocs.flatMap(value=>value?.originalPageTexts||[]).join('\n\n')
    if(originalDocs.some(value=>!value?.qualified))issues.push('full-original-visible-PDF-unqualified')
    if(!opening.pages.some(page=>review.contexts.find(known=>known.url===page.url)?.cards.some(known=>known.pdf===row.sourceUrl&&known.treeSHA256===row.treeSHA256))||!row.visible)issues.push('original-notice-criteria-links-or-visibility-changed')
    const countryQualified=!!definition.country&&documentByUrl.get(definition.pdfUrl)?.qualified
      &&norm(documentByUrl.get(definition.pdfUrl)?.originalPageTexts[definition.countryPage-1]||'').includes(definition.countryNeedle)
    if(definition.country&&!countryQualified)issues.push('native-role-country-assignment-unavailable')
    if(!definition.country)issues.push('role-assigned-country-untyped')
    if(row.closingDate&&row.closingDate!==definition.closingDate)issues.push('native-notice-PDF-closing-conflict')
    const application={url:definition.applyUrl,activeApplicationQualified:definition.activeApplicationQualified}
    if(definition.applicationMode!=='offline-walk-in'){
      const html=await readHtml(definition.applyUrl),tree=parse(html)
      application.originalHtml=html;application.sha256=hash(html)
      application.visibleControlCount=tree.doc.nodes(node=>['button','input','select'].includes(node.tag)&&node.attrs.type!=='hidden').length
      // The retained primary landings have no usable registration controls, or
      // declare an account continuation that has no current public response.
      application.activeApplicationQualified=false
      if(definition.registrationUrl){
        need(tree.doc.nodes(node=>node.tag==='a'&&new URL(node.attrs.href||'',definition.applyUrl).href===definition.registrationUrl).length>0,'current own-campaign registration declaration changed')
        try{application.registrationHtml=await readHtml(definition.registrationUrl);application.continuationStatus='current-contract-unreviewed'}catch(error){check();application.continuationStatus='public-read-unavailable';application.error=error.message}
      }
    }
    applicationSurfaces.push(application)
    if(!application.activeApplicationQualified)issues.push('current-active-same-notice-application-unqualified')
    if(!review.authorityStylesheetBytesReviewed)issues.push('current-authority-stylesheet-bytes-unreviewed')
    currentDetails.push({...row,...definition,country:countryQualified?definition.country:null,originalCriteria,activeApplicationQualified:application.activeApplicationQualified,issues,sourceDetailComplete:issues.length===0})
  }
  const closing=await context(),stable=equal(opening.rows,closing.rows)
  if(!stable)failures.push({reason:'native-full-notice-inventory-changed-during-closing'})
  for(const document of documents){const bytes=await readBytes(document.url),bodySHA256=hash(bytes);closingDocuments.push({url:document.url,bodySHA256,originalPdfBase64:Buffer.from(bytes).toString('base64'),matchesOpening:bodySHA256===document.bodySHA256});if(bodySHA256!==document.bodySHA256)failures.push({url:document.url,reason:'native-full-original-PDF-changed-during-closing'})}
  for(const application of applicationSurfaces.filter(row=>row.originalHtml)){const html=await readHtml(application.url);application.closingHtml=html;application.closingMatches=hash(html)===application.sha256;if(!application.closingMatches)failures.push({url:application.url,reason:'native-full-application-context-changed-during-closing'})}
  const jobs=[]
  for(const detail of currentDetails)if(detail.sourceDetailComplete&&stable&&failures.length===0&&detail.country==='India')jobs.push({title:detail.title,company:'Bharat Electronics',hiringEntity:detail.hiringEntity||'Bharat Electronics Limited',country:'India',jobId:detail.advertisementId,requisitionId:detail.advertisementId,source:'bharatelectronics',sourceUrl:detail.pdfUrl,applyUrl:detail.applyUrl,link:detail.applyUrl,postingDate:detail.postingDate,closingDate:detail.closingDate,jobDescription:detail.originalCriteria,sourceDetailComplete:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:new Date().toISOString()})
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:NOTICES,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:responses.length,reportedTotal:opening.rows.length,indiaFacetCount:null,verifiedAt:null,reason:'Full original PDF notices/corrigendum retained; role country, current native application or authority styling remain unqualified. Repeated page2 does not establish an unfiltered terminal inventory; no authoritative zero or cleanup.'})
  attachSourceObservationEvidence(jobs,{source:'bharatelectronics',recordKind:'vacancy-notices',observedRecordCount:opening.rows.length,observedVacancyCount:current.length,sourceScopeComplete:false})
  const audit={source:'bharatelectronics',originalNotices:opening.rows,currentDetails,documents,closingDocuments,applicationSurfaces,openingPages:opening.pages,closingPages:closing.pages,failures,responses,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
  Object.defineProperty(jobs,'sourceAudit',{value:audit,configurable:true});Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  const observed=options.onAudit?.(audit);if(observed&&typeof observed.then==='function')Promise.resolve(observed).catch(()=>{})
  check();return jobs
}
