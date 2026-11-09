import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {decodeHTML} from 'entities'
import {isRecruitmentIntakeTitle} from '../../scraper-support/utils/recruitmentObservationAccounting.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const HOME = 'https://www.adityabirlarealestate.com/career'
export const REAL_ESTATE_PUBLIC_METADATA = Object.freeze({source:'adityabirlarealestate',companyName:'Aditya Birla Real Estate',
  companyCareerPage:HOME,companyDomain:'adityabirlarealestate.com',countryFilter:'India',
  atsPlatform:'unqualified-first-party-role-context',paginationStrategy:'configured-document-only',
  extractionStrategy:'original-public-response-and-partial-role-context',zeroResultPolicy:'coverage-gap',
  verifiedAt:null,verifiedOn:null,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,
  runtimeInventoryVerification:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})

const own = (value,key) => {
  try {return value && ['object','function'].includes(typeof value) ? Object.getOwnPropertyDescriptor(value,key)?.value : undefined}
  catch {return undefined}
}
const describe = value => typeof own(value,'message')==='string' ? own(value,'message')
  : value===null ? 'null' : ['object','function'].includes(typeof value) ? 'Opaque read failure' : String(value)
const ignore = operation => {try {Promise.resolve(operation()).catch(()=>{})} catch {}}
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const headers = value => value instanceof Headers ? Object.fromEntries(value) : structuredClone(value??{})
const header = (value,name) => new Headers(value??{}).get(name)
const sortedHeaders = value => [...new Headers(value??{})].sort(([a],[b])=>a.localeCompare(b))
const denied = status => [401,403,429,451].includes(status)
const typedArray = Object.getPrototypeOf(Uint8Array.prototype)
const intrinsic = key => Object.getOwnPropertyDescriptor(typedArray,key).get
const byteLength = intrinsic('byteLength'), byteOffset = intrinsic('byteOffset'), arrayBuffer = intrinsic('buffer')

const controls = options => {
  const limit = (name,fallback,maximum,minimum=1) => {
    const value=options[name]??fallback
    if(!Number.isSafeInteger(value)||value<minimum||value>maximum)throw RangeError('Aditya Birla Real Estate invalid '+name+' limit')
    return value
  }
  for(const name of ['timeoutMs','collectionTimeoutMs'])if(options[name]!=null)limit(name,1,name==='timeoutMs'?30000:180000)
  const requestTimeoutMs=limit('requestTimeoutMs',options.timeoutMs??15000,30000)
  const bounds={requestTimeoutMs,entityTimeoutMs:limit('entityTimeoutMs',requestTimeoutMs,30000),
    sourceTimeoutMs:limit('sourceTimeoutMs',options.collectionTimeoutMs??60000,180000),
    callbackTimeoutMs:limit('callbackTimeoutMs',10000,30000),
    maxResponseBytes:limit('maxResponseBytes',2*1024*1024,16*1024*1024),
    maxSourceBytes:limit('maxSourceBytes',8*1024*1024,32*1024*1024),
    maxTotalBytes:limit('maxTotalBytes',8*1024*1024,32*1024*1024),
    maxRequests:limit('maxRequests',1,128),maxPages:limit('maxPages',1,128)}
  if(options.maxJobs!=null)limit('maxJobs',0,1000000,0)
  for(const name of ['fetchPage','fetchImpl','fetchText','onMetadata','onAudit','onRecords','now','monotonicNow']) {
    if(options[name]!==undefined&&typeof options[name]!=='function')throw TypeError('Aditya Birla Real Estate invalid '+name+' callback or clock')
  }
  if(options.signal!==undefined&&!(options.signal instanceof AbortSignal))throw TypeError('Aditya Birla Real Estate invalid signal')
  if(options.heldHosts!==undefined&&!(options.heldHosts instanceof Set))throw TypeError('Aditya Birla Real Estate invalid heldHosts')
  return bounds
}

// Register cancellation before invoking any asynchronous boundary. Both sides
// are checked so a synchronous overrun or an ignored signal cannot escape.
const race = (operation,scope,disposeLate) => new Promise((resolve,reject)=>{
  let settled=false,reason
  const detach=()=>scope.signal.removeEventListener('abort',aborted)
  const fail=value=>{if(!settled){settled=true;reason=value;detach();reject(value)}}
  const aborted=()=>fail(scope.signal.reason)
  scope.signal.addEventListener('abort',aborted,{once:true})
  try {scope.check()} catch(error){fail(error);return}
  Promise.resolve().then(()=>{scope.check();return operation()}).then(value=>{
    if(settled){if(disposeLate)ignore(()=>disposeLate(value,reason));return}
    try {scope.check()} catch(error){fail(error);if(disposeLate)ignore(()=>disposeLate(value,error));return}
    settled=true;detach();resolve(value)
  },error=>{
    if(settled)return
    try {scope.check()} catch(expired){error=expired}
    fail(error)
  })
})

// Retain scoped publisher text as partial observations only. Native title,
// location and division labels are independent from legal employer/country.
// Bootstrap classes cannot qualify criteria visibility without loaded CSS.
const context = html => {
  const document=readNativeDocument(html),root=document.nodes(node=>node.tag==='root')[0]
  const excluded=new Set(['svg','math','template','object','script','style','textarea','iframe','noscript',
    'xmp','noembed','noframes','plaintext','form','select','input','blockquote','q','pre','code','aside'])
  const native=node=>typeof node!=='string'&&!node.inert&&!node.nativeTagUnqualified&&!excluded.has(node.tag)
  const children=(node,predicate=()=>true)=>(node?.children??[]).filter(child=>native(child)&&predicate(child))
  const walk=node=>native(node)?[node,...children(node).flatMap(walk)]:[]
  const allNodes=node=>[node,...(node.children??[]).filter(child=>typeof child!=='string').flatMap(allNodes)]
  const normalize=value=>decodeHTML(value).replace(/\s+/g,' ').trim()
  const rawText=node=>!native(node)||['a','button'].includes(node.tag)?'':node.children
    .map(child=>typeof child==='string'?child:rawText(child)).join(' ')
  const text=node=>normalize(rawText(node))
  const hasClass=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)
  const requireUnique=(nodes,label)=>{
    if(nodes.length!==1)throw Error('ABREL ambiguous '+label+' identity')
    return nodes[0]
  }
  const page=requireUnique(children(root,node=>node.tag==='html'),'native page')
  const head=requireUnique(children(page,node=>node.tag==='head'),'native head')
  const body=requireUnique(children(page,node=>node.tag==='body'),'native body')
  const title=requireUnique(children(head,node=>node.tag==='title'),'publisher title')
  const nodes=walk(body)
  if(normalize(title.raw??'')!=='Careers at ABREL - Join Our Team of Innovators'
    ||nodes.filter(node=>node.tag==='h1'&&text(node)==='Empower your career journey with ABREL').length!==1)
    throw Error('ABREL original careers publisher identity changed')
  const sections=nodes.filter(node=>node.tag==='section'&&hasClass(node,'Job-openings-section'))
  if(!sections.length)return []
  const section=requireUnique(sections,'job section')
  const wrapper=requireUnique(walk(section).filter(node=>node.tag==='div'&&hasClass(node,'Job-openings-accordion')),'job wrapper')
  const heading=requireUnique(children(wrapper,node=>node.tag==='div'&&hasClass(node,'heading-select')),'job heading')
  if(children(heading,node=>node.tag==='h4'&&text(node)==='Job openings').length!==1)
    throw Error('ABREL job section identity changed')
  const divisionControls=walk(heading).filter(node=>node.tag==='div'&&hasClass(node,'custom-dropdown')
    &&children(node,child=>child.tag==='div'&&hasClass(child,'dropdown-btn')&&text(child)==='Divisions').length===1)
  const divisionLabels=[]
  if(divisionControls.length>1)throw Error('ABREL ambiguous division control identity')
  if(divisionControls.length){
    const lists=children(divisionControls[0],node=>node.tag==='ul'&&hasClass(node,'dropdown-options'))
    const list=requireUnique(lists,'division options')
    for(const node of children(list,child=>child.tag==='li')){
      const label=text(node)
      if(label&&node.attrs['data-value']===label)divisionLabels.push(label)
    }
    if(new Set(divisionLabels).size!==divisionLabels.length)throw Error('ABREL ambiguous division label identity')
  }
  const accordion=requireUnique(children(wrapper,node=>node.tag==='div'&&hasClass(node,'accordion')
    &&node.attrs.id==='accordionExample'),'role accordion')
  const ids=allNodes(body)
  if(ids.filter(node=>node.attrs?.id==='accordionExample').length!==1)throw Error('ABREL ambiguous accordion identity')
  const observations=[]
  for(const item of children(accordion,node=>node.tag==='div'&&hasClass(node,'accordion-item'))){
    const header=requireUnique(children(item,node=>node.tag==='h2'&&hasClass(node,'accordion-header')),'role heading')
    const breaks=children(header,node=>node.tag==='br')
    if(breaks.length!==1)continue
    const at=header.children.indexOf(breaks[0])
    const beforeBreak=header.children.slice(0,at),afterBreak=header.children.slice(at+1)
    const fields=afterBreak.filter(child=>typeof child!=='string')
    // This publisher's supported heading is title text, br, location span,
    // then collapse button. Unsupported partitions cannot label one another.
    if(beforeBreak.some(child=>typeof child!=='string')
      ||afterBreak.some(child=>typeof child==='string'&&normalize(child))
      ||fields.length!==2||!native(fields[0])||fields[0].tag!=='span'
      ||!native(fields[1])||fields[1].tag!=='button')continue
    const title=normalize(beforeBreak.join(' '))
    const location=text(fields[0])
    if(!title||!location)continue
    const button=fields[1]
    const collapse=requireUnique(children(item,node=>node.tag==='div'&&hasClass(node,'accordion-collapse')),'role collapse')
    const id=collapse.attrs.id
    if(typeof id!=='string'||!/^[A-Za-z][A-Za-z0-9_:.-]{0,127}$/.test(id)
      ||button.attrs['data-bs-target']!=='#'+id||button.attrs['aria-controls']!==id
      ||collapse.attrs['data-bs-parent']!=='#accordionExample')throw Error('ABREL role collapse reference identity changed')
    if(ids.filter(node=>node.attrs?.id===id).length!==1)throw Error('ABREL ambiguous role collapse identity')
    const detail=requireUnique(children(collapse,node=>node.tag==='div'&&hasClass(node,'accordion-body')),'role criteria scope')
    const criteriaHeadings=children(detail,node=>node.tag==='h6')
    const lists=children(detail,node=>node.tag==='ul')
    if(criteriaHeadings.length!==1||text(criteriaHeadings[0])!=='Job Description'||lists.length!==1)continue
    const criteriaItems=children(lists[0],node=>node.tag==='li').map(text)
    if(!criteriaItems.length||criteriaItems.some(value=>!value||!/[\p{L}\p{N}]/u.test(value)))continue
    // The shared label is retained only when this role's own native title
    // explicitly ends with that exact division; it never types an employer.
    const divisions=divisionLabels.filter(label=>title.endsWith(', '+label))
    if(divisions.length>1)throw Error('ABREL ambiguous role division identity')
    const division=divisions[0]??null
    const roleTitle=division?title.slice(0,-division.length-2):title
    const intake=isRecruitmentIntakeTitle(roleTitle)||/^(?:apply(?:\s+(?:here|now))?|open positions|current openings|careers?|job openings|join us)$/i.test(roleTitle)
    observations.push({kind:intake?'hiring-context':'published-role-context',vacancy:!intake,qualification:'partial',
      documentUrl:HOME,scopeId:id,title,publishedLocation:location,publishedDivision:division,
      criteriaItems,criteriaText:'Job Description '+criteriaItems.join(' '),country:null,legalEmployer:null,
      typedCountryPresent:false,typedLegalEmployer:null,criteriaVisibilityQualified:false,
      sourceDetailComplete:false,sourceListingComplete:false,sourceScopeComplete:false,eligibilityQualified:false,
      lifecycleCleanupAllowed:false,applicationInteractionPerformed:false})
  }
  return observations
}


export const runAdityaBirlaRealEstatePublicRead = async (options={}) => {
  const realStarted=performance.now(),bounds=controls(options),caller=options.signal
  caller?.throwIfAborted()
  const wall=()=>{
    const value=options.now?options.now():new Date()
    if(!(value instanceof Date)&&!['string','number'].includes(typeof value))throw RangeError('Aditya Birla Real Estate invalid source clock')
    const date=new Date(value)
    if(value===''||!Number.isFinite(date.getTime()))throw RangeError('Aditya Birla Real Estate invalid source clock')
    return date.toISOString()
  }
  let previous=-1
  const monotonic=()=>{
    const value=options.monotonicNow?options.monotonicNow():performance.now()
    if(!Number.isFinite(value)||value<0||value<previous)throw RangeError('Aditya Birla Real Estate invalid monotonic clock')
    previous=value;return value
  }
  const held=options.heldHosts??new Set()
  const audit={source:'adityabirlarealestate',sourceMetadata:REAL_ESTATE_PUBLIC_METADATA,startedAt:wall(),completedAt:null,
    outcome:'coverage-gap',bounds,responses:[],rawPages:[],observations:[],issues:[],decodedBytes:0,
    sourceScopeComplete:false,sourceListingComplete:false,sourceDetailComplete:false,applicationInteractionPerformed:false,
    companyGlobalTotal:null,companyIndiaTotal:null,nativeReportedTotal:null,nativeIndiaTotal:null,
    inventoryVerifiedAt:null,lifecycleCleanupAllowed:false,redirectsFollowed:false,
    corporateJavaScriptExecuted:false,subresourcesRequested:false,heldHosts:[...held]}
  let firstParty=false
  const inventory=()=>({status:'coverage-gap',surface:HOME,firstParty,listingComplete:false,
    pagesFetched:audit.responses.filter(row=>row.bodyComplete&&row.transportQualified).length,
    reportedTotal:null,indiaFacetCount:null,verifiedAt:null,
    reason:'Only the configured current careers document is read. Published role contexts remain partial source observations, not eligible jobs or a complete inventory; native, company and India totals remain unknown.'})
  const failure=(message,details={})=>Object.assign(Error('Aditya Birla Real Estate '+message),{source:'adityabirlarealestate',softFailure:true,
    abortRetries:true,failureKind:'source_inventory_unavailable',lifecycleCleanupAllowed:false,...details})
  const scope=(name,milliseconds,parent)=>{
    const controller=new AbortController(),start=name==='source'?realStarted:performance.now(),logical=monotonic()
    const timeout=failure(name+' deadline exceeded',{failureKind:'network_or_timeout'})
    const signal=AbortSignal.any([controller.signal,...(parent?[parent.signal]:[]),...(caller?[caller]:[])])
    const timer=setTimeout(()=>controller.abort(timeout),Math.max(1,milliseconds-(performance.now()-start)))
    const check=()=>{
      caller?.throwIfAborted();parent?.check()
      if(!controller.signal.aborted&&Math.max(performance.now()-start,monotonic()-logical)>=milliseconds)controller.abort(timeout)
      signal.throwIfAborted()
    }
    return {signal,check,close:()=>clearTimeout(timer)}
  }
  const source=scope('source',bounds.sourceTimeoutMs),cancelled=new WeakSet(),released=new WeakSet()
  const release=reader=>{if(reader&&!released.has(reader)){released.add(reader);ignore(()=>reader.releaseLock())}}
  const cancelReader=(reader,reason)=>{
    if(reader&&!cancelled.has(reader)){cancelled.add(reader);ignore(()=>reader.cancel(reason))}
    release(reader)
  }
  const cancelBody=(response,reason)=>ignore(()=>{
    const body=response?.body
    if(body&&!cancelled.has(body)){cancelled.add(body);return body.cancel(reason)}
  })
  const remaining=()=>Math.min(bounds.maxResponseBytes,bounds.maxSourceBytes-audit.decodedBytes,bounds.maxTotalBytes-audit.decodedBytes)
  const requireBytes=size=>{if(size>remaining())throw failure('original response body byte limit exceeded')}
  const clocks=(page,row,validate=true)=>{
    const receipt=own(page,'originalReceipt'),raw={},receiptRaw={}
    const diagnostic=value=>value===null||['string','boolean'].includes(typeof value)||typeof value==='number'&&Number.isFinite(value)
      ?value:{unretainedType:typeof value}
    for(const key of ['sourceRequestedAt','requestedAt','sourceCompletedAt','completedAt']){
      const value=own(page,key),original=own(receipt,key)
      if(value!==undefined)raw[key]=diagnostic(value)
      if(original!==undefined)receiptRaw[key]=diagnostic(original)
    }
    if(Object.keys(receiptRaw).length)raw.originalReceipt=receiptRaw
    row.rawAcquisitionClocks=raw
    let invalid=false,present=false
    for(const [key,alias] of [['sourceRequestedAt','requestedAt'],['sourceCompletedAt','completedAt']]){
      const values=[own(page,key),own(page,alias),own(receipt,key),own(receipt,alias)].filter(value=>value!=null)
      present ||= values.length>0
      const qualified=values.every(value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&value===values[0])
      row[key]=qualified?values[0]??null:null
      if(!qualified)invalid=true
    }
    if(row.sourceRequestedAt&&row.sourceCompletedAt&&Date.parse(row.sourceCompletedAt)<Date.parse(row.sourceRequestedAt)){
      row.sourceRequestedAt=null;row.sourceCompletedAt=null;invalid=true
    }
    row.acquisitionClocksQualified=invalid?false:present?true:null
    if(invalid&&validate)throw failure('invalid or contradictory original acquisition clock')
  }
  const remember=(page,row)=>{
    if(!page||typeof page!=='object')throw failure('original response unavailable')
    Object.assign(row,{status:page.status??null,finalUrl:page.finalUrl??page.url??null,headers:headers(page.headers)})
    row.sourceHttpDate=page.sourceHttpDate??header(row.headers,'date')
    if(denied(row.status)){held.add('www.adityabirlarealestate.com');audit.heldHosts=[...held]}
    // Acquisition fields are independent of the entity. Retain each valid
    // clock now, and keep conflicting originals as explicitly unqualified data.
    clocks(page,row,false)
  }
  const rawMetadata=(page,row)=>({url:page.url??null,requestedUrl:page.requestedUrl??null,status:row.status,
    headers:structuredClone(row.headers),sourceHttpDate:row.sourceHttpDate,
    ...structuredClone(row.rawAcquisitionClocks),acquisitionClocksQualified:row.acquisitionClocksQualified})
  const retainBytes=(page,row)=>{
    const encoded=page.bodyBase64
    if(typeof encoded!=='string'||!encoded)throw failure('original response body unavailable')
    if(encoded.length>Math.ceil(remaining()/3)*4)throw failure('original response body byte limit exceeded')
    if(encoded.length%4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))throw failure('original response body encoding is malformed')
    const bytes=Buffer.from(encoded,'base64');requireBytes(bytes.length)
    if(bytes.toString('base64')!==encoded)throw failure('original response body encoding is not canonical')
    Object.assign(row,{bodyBase64:encoded,bytes:bytes.length,sha256:hash(bytes),bodyComplete:true})
    audit.decodedBytes+=bytes.length
    return bytes
  }
  const validateOriginal=(page,row)=>{
    clocks(page,row)
    if(page.bytes!=null&&page.bytes!==row.bytes||page.sha256!=null&&page.sha256!==row.sha256)throw failure('original body digest or byte count contradicts supplied evidence')
    const receipt=page.originalReceipt
    if(receipt&&(receipt.status!==row.status||receipt.requestedUrl!==HOME||receipt.finalUrl!==row.finalUrl
      ||receipt.bytes!==row.bytes||receipt.sha256!==row.sha256
      ||JSON.stringify(sortedHeaders(receipt.headers))!==JSON.stringify(sortedHeaders(row.headers))))throw failure('original receipt contradicts supplied response')
    const dates=[page.sourceHttpDate,receipt?.sourceHttpDate,header(row.headers,'date')].filter(value=>value!=null)
    if(dates.some(value=>value!==dates[0]))throw failure('original HTTP date contradicts supplied headers')
  }
  const stamp=(target,key,rejected)=>{
    try {target[key]=wall()}catch(error){
      if(!rejected)throw error
      target[key]=null;audit.issues.push({kind:'completion-clock-unavailable',message:describe(error)})
    }
  }
  const read=async()=>{
    source.check()
    if(held.has('www.adityabirlarealestate.com')||held.has('adityabirlarealestate.com'))throw failure('public host held after denial',{failureKind:'blocked_or_access_denied'})
    if(audit.responses.length>=bounds.maxRequests||audit.responses.length>=bounds.maxPages)throw failure('request/page limit exceeded')
    const row={requestUrl:HOME,observedRequestedAt:wall(),observedCompletedAt:null,status:null,finalUrl:null,headers:{},
      sourceRequestedAt:null,sourceCompletedAt:null,sourceHttpDate:null,bodyBase64:null,bytes:null,sha256:null,bodyComplete:false,transportQualified:false}
    audit.responses.push(row)
    const request=scope('request',bounds.requestTimeoutMs,source)
    const init={method:'GET',redirect:'manual',credentials:'omit',signal:request.signal,maxResponseBytes:bounds.maxResponseBytes,
      headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 (compatible; Jobverify scraper)'},throwIfAborted:request.check}
    let page,response,reader,rawIndex,complete=false,rejected=false,rejection
    try {
      // Composed callers are supported: fetchPage retains original metadata;
      // otherwise fetchImpl wins over the decoded-only fetchText compatibility.
      if(options.fetchPage)page=await race(()=>options.fetchPage(HOME,init),request,cancelBody)
      else if(options.fetchText&&!options.fetchImpl){
        const text=await race(()=>options.fetchText(HOME,init),request)
        if(typeof text!=='string'||!text.trim())throw failure('decoded response body unavailable')
        requireBytes(Buffer.byteLength(text));audit.decodedBytes+=Buffer.byteLength(text)
        audit.rawPages.push({url:HOME,decodedText:text,transportQualified:false})
        row.finalUrl=HOME;row.decodedText=text
        audit.issues.push({kind:'unqualified-decoded-only-transport',url:HOME})
        request.check();return {html:text,qualified:false}
      } else {
        const startedAt=wall()
        response=await race(()=>(options.fetchImpl??globalThis.fetch)(HOME,init),request,cancelBody)
        page={url:response?.url,status:response?.status,headers:headers(response?.headers),sourceRequestedAt:startedAt}
      }
      request.check();rawIndex=audit.rawPages.length
      remember(page,row)
      // A rejected oversized entity must not be copied into retained evidence
      // before the same response/source byte allowance has admitted it.
      audit.rawPages.push(rawMetadata(page,row))
      const httpError=Number.isInteger(row.status)&&row.status>=100&&row.status<=599&&row.status!==200
        ?failure('original public HTTP '+row.status,{status:row.status,headers:row.headers,
          ...(row.status===403||row.status===429||row.status>=500?{upstreamOutage:true}:{}),
          failureKind:denied(row.status)?'blocked_or_access_denied':'source_inventory_unavailable'}):null
      let bytes
      try {
        if(response){
          const declared=header(row.headers,'content-length')
          if(declared!=null&&(!/^\d+$/.test(declared)||Number(declared)>remaining()))throw failure('declared response byte limit exceeded')
          if(!response.body?.getReader)throw failure('original readable body unavailable')
          const entity=scope('entity',bounds.entityTimeoutMs,request)
          try {
            reader=await race(()=>response.body.getReader(),entity,cancelReader)
            const chunks=[];let size=0
            for(;;){
              const chunk=await race(()=>reader.read(),entity);entity.check()
              if(chunk.done)break
              if(!types.isUint8Array(chunk.value))throw failure('native response chunk is not a Uint8Array')
              const length=byteLength.call(chunk.value);requireBytes(size+length)
              chunks.push(Buffer.from(new Uint8Array(arrayBuffer.call(chunk.value),byteOffset.call(chunk.value),length)))
              size+=length;row.bytesRead=size;entity.check()
            }
            page.bodyBase64=Buffer.concat(chunks,size).toString('base64')
          } finally {entity.close()}
        }
        bytes=retainBytes(page,row)
        audit.rawPages[rawIndex]=structuredClone(page)
        // Canonical admitted bytes survive clock/provenance qualification or
        // completion-clock failure. A missing clock is never filled by a guess.
        if(response){page.sourceCompletedAt=wall();audit.rawPages[rawIndex]=structuredClone(page)}
        validateOriginal(page,row)
      } catch(error){
        caller?.throwIfAborted()
        if(!httpError)throw error
        audit.issues.push({kind:'error-response-retention-incomplete',message:describe(error)})
        Object.defineProperty(httpError,'bodyReadError',{value:error,configurable:true})
      }
      if(httpError)throw httpError
      if(row.status!==200)throw failure('original response status unavailable')
      if(page.url!==HOME||row.finalUrl!==HOME||page.requestedUrl!==undefined&&page.requestedUrl!==HOME)throw failure('original response URL identity changed')
      if(!/^text\/html(?:\s*;|$)/i.test(header(row.headers,'content-type')??''))throw failure('original response HTML MIME is unqualified')
      let text
      try {text=new TextDecoder('utf8',{fatal:true}).decode(bytes)}catch(cause){throw failure('original response is not valid UTF8',{cause})}
      if(['html','text','body'].some(key=>typeof page[key]==='string'&&page[key]!==text))throw failure('decoded text contradicts original response bytes')
      if(!text.trim())throw failure('original response body unavailable')
      request.check();row.transportQualified=true;complete=true
      return {html:text,qualified:true}
    } catch(error){
      rejected=true;rejection=error
      // A thrown transport denial may carry its own immutable original entity.
      // Retention is best effort and can never replace that original rejection.
      const original=own(error,'originalResponse')
      if(original&&original!==page){
        try {
          remember(original,row)
          const index=audit.rawPages.length;audit.rawPages.push(rawMetadata(original,row))
          retainBytes(original,row);audit.rawPages[index]=structuredClone(original)
          validateOriginal(original,row)
        }
        catch(retention){audit.issues.push({kind:'rejected-original-retention-incomplete',message:describe(retention)})}
      } else if(!original&&!page&&Number.isInteger(own(error,'status'))){
        const metadata={}
        for(const key of ['status','headers','url','finalUrl','requestedUrl','bodyBase64','bytes','sha256',
          'sourceRequestedAt','sourceCompletedAt','requestedAt','completedAt','sourceHttpDate']){
          const value=own(error,key);if(value!==undefined)metadata[key]=value
        }
        row.status=metadata.status
        if(denied(row.status)){held.add('www.adityabirlarealestate.com');audit.heldHosts=[...held]}
        try {
          remember(metadata,row)
          const index=audit.rawPages.length;audit.rawPages.push(rawMetadata(metadata,row))
          if(metadata.bodyBase64!==undefined){
            retainBytes(metadata,row);audit.rawPages[index]=structuredClone(metadata);validateOriginal(metadata,row)
          } else clocks(metadata,row)
        }
        catch(retention){audit.issues.push({kind:'rejected-status-retention-incomplete',message:describe(retention)})}
      }
      caller?.throwIfAborted();throw error
    } finally {
      request.close()
      if(reader){if(!complete)cancelReader(reader,rejection);else release(reader)}
      else if(response)cancelBody(response,rejection)
      stamp(row,'observedCompletedAt',rejected)
    }
  }
  const deliver=async(name,value)=>{
    if(!options[name])return
    const callback=scope(name,bounds.callbackTimeoutMs,source)
    try {await race(()=>options[name](structuredClone(value),{signal:callback.signal,throwIfAborted:callback.check}),callback)}
    finally {callback.close()}
  }
  let rejected=false,rejection
  const reject=error=>{if(!rejected){rejected=true;rejection=error}audit.outcome='failed'}
  try {
    try {
      const page=await read();source.check()
      const observations=context(page.html);source.check()
      if(page.qualified){firstParty=true;audit.observations=observations}
      await deliver('onRecords',[]);source.check()
    } catch(error){caller?.throwIfAborted();reject(error);audit.issues.push({kind:'public-read-failed',message:describe(error)})}
    try {stamp(audit,'completedAt',rejected)}catch(error){reject(error)}
    audit.inventoryEvidence=inventory()
    for(const name of ['onMetadata','onAudit']){
      try {await deliver(name,name==='onMetadata'?REAL_ESTATE_PUBLIC_METADATA:audit)}catch(error){
        caller?.throwIfAborted();reject(error)
        audit.issues.push({kind:'failure-evidence-delivery-failed',callback:name,message:describe(error)})
      }
    }
    if(rejected)throw rejection
    source.check()
    const jobs=attachInventoryEvidence([],inventory())
    const vacancies=audit.observations.filter(row=>row.vacancy).length
    attachSourceObservationEvidence(jobs,{source:'adityabirlarealestate',
      recordKind:vacancies===audit.observations.length&&vacancies?'vacancy-rows':vacancies?'mixed':'hiring-signals',
      observedRecordCount:audit.observations.length,observedVacancyCount:vacancies,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
    const retained=structuredClone(audit)
    Object.defineProperties(jobs,{nativeCollectionEvidence:{value:retained,configurable:true},sourceAudit:{value:retained},
      metadata:{value:structuredClone(REAL_ESTATE_PUBLIC_METADATA)}})
    return jobs
  } catch(error){
    caller?.throwIfAborted();audit.outcome='failed';audit.inventoryEvidence=inventory()
    // Never assign through error accessors or mutate frozen/opaque reasons.
    // onAudit remains the independent evidence channel when attachment cannot.
    try {
      if(error&&typeof error==='object'&&Object.isExtensible(error))for(const [key,value] of Object.entries({
        sourceAudit:structuredClone(audit),inventoryEvidence:inventory(),lifecycleCleanupAllowed:false})){
        const field=Object.getOwnPropertyDescriptor(error,key)
        if(!field||field.configurable&&Object.hasOwn(field,'value'))Object.defineProperty(error,key,{value,configurable:true})
      }
    } catch {}
    throw error
  } finally {source.close()}
}
