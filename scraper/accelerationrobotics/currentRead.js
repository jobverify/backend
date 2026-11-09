import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const HOME = 'https://recruit.accelerationrobotics.in/'
const SOURCE = 'accelerationrobotics', COMPANY = 'Acceleration Robotics'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const own = (value, key) => {
  try {return value && ['object','function'].includes(typeof value) ? Object.getOwnPropertyDescriptor(value,key)?.value : undefined}
  catch {return undefined}
}
const describe = value => typeof own(value,'message') === 'string' ? own(value,'message')
  : value === null ? 'null' : ['object','function'].includes(typeof value) ? 'Opaque read failure' : String(value)
const ignore = operation => {try {Promise.resolve(operation()).catch(()=>{})} catch {}}
const headers = value => Object.fromEntries(new Headers(value ?? {}))
const limit = (options, name, fallback, maximum, minimum=1) => {
  const value=options[name] ?? fallback
  if (!Number.isSafeInteger(value) || value<minimum || value>maximum) throw RangeError('Acceleration Robotics invalid '+name+' limit')
  return value
}
const controls = options => {
  // Validate aliases even when an explicit primary control wins precedence.
  for (const name of ['timeoutMs','collectionTimeoutMs']) if (options[name] != null) limit(options,name,1,name==='timeoutMs'?30000:180000)
  const requestTimeoutMs=limit(options,'requestTimeoutMs',options.timeoutMs ?? 15000,30000)
  const bounds={requestTimeoutMs,entityTimeoutMs:limit(options,'entityTimeoutMs',requestTimeoutMs,30000),
    sourceTimeoutMs:limit(options,'sourceTimeoutMs',options.collectionTimeoutMs ?? 60000,180000),
    processingTimeoutMs:limit(options,'processingTimeoutMs',5000,30000),callbackTimeoutMs:limit(options,'callbackTimeoutMs',10000,30000),
    maxResponseBytes:limit(options,'maxResponseBytes',2*1024*1024,16*1024*1024),
    maxSourceBytes:limit(options,'maxSourceBytes',8*1024*1024,32*1024*1024),maxTotalBytes:limit(options,'maxTotalBytes',8*1024*1024,32*1024*1024),
    maxRequests:limit(options,'maxRequests',65,128),maxPages:limit(options,'maxPages',65,128),maxJobs:limit(options,'maxJobs',64,1000,0)}
  for (const name of ['fetchImpl','fetchPage','fetchText','onAudit','onRecords','now','monotonicNow'])
    if (options[name] !== undefined && typeof options[name] !== 'function') throw TypeError('Acceleration Robotics invalid '+name+' callback or clock')
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) throw TypeError('Acceleration Robotics invalid signal')
  if (options.heldHosts !== undefined && !(options.heldHosts instanceof Set)) throw TypeError('Acceleration Robotics invalid heldHosts')
  return bounds
}

// An ignored signal cannot keep an asynchronous acquisition or callback alive.
// A check on both sides also detects synchronous work exceeding its allowance.
const race = (operation, scope, disposeLate) => new Promise((resolve,reject)=>{
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

export const runAccelerationRoboticsCurrentRead = async (options={}) => {
  const realStarted=performance.now(),bounds=controls(options),caller=options.signal
  caller?.throwIfAborted()
  const wall=()=>{
    const value=options.now?options.now():new Date()
    if (!(value instanceof Date) && !['string','number'].includes(typeof value)) throw RangeError('Acceleration Robotics invalid source clock')
    const date=new Date(value)
    if(value==='' || !Number.isFinite(date.getTime())) throw RangeError('Acceleration Robotics invalid source clock')
    return date.toISOString()
  }
  let previous=-1
  const monotonic=()=>{
    const value=options.monotonicNow?options.monotonicNow():performance.now()
    if(!Number.isFinite(value)||value<0||value<previous)throw RangeError('Acceleration Robotics invalid monotonic clock')
    previous=value;return value
  }
  const held=options.heldHosts ?? new Set()
  const audit={source:SOURCE,startedAt:wall(),completedAt:null,outcome:'coverage-gap',bounds,responses:[],observations:[],issues:[],
    decodedBytes:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null,nativeReportedTotal:null,nativeIndiaTotal:null,
    lifecycleCleanupAllowed:false,redirectsFollowed:false,corporateJavaScriptExecuted:false,heldHosts:[...held]}
  const inventory=()=>({status:'coverage-gap',surface:HOME,firstParty:audit.responses.some(row=>row.requestUrl===HOME&&row.transportQualified),
    listingComplete:false,pagesFetched:audit.responses.filter(row=>row.transportQualified&&row.bodyComplete).length,
    reportedTotal:null,indiaFacetCount:null,verifiedAt:null,
    reason:'Only the configured root and its qualified literal role details are read. This attempt does not establish complete company, native or India inventory; unavailable responses are failures.'})
  const failure=(message,details={})=>Object.assign(Error('Acceleration Robotics '+message),{source:SOURCE,softFailure:true,abortRetries:true,
    lifecycleCleanupAllowed:false,failureKind:'source_inventory_unavailable',...details})
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
  const source=scope('source',bounds.sourceTimeoutMs)
  const remaining=()=>Math.min(bounds.maxResponseBytes,bounds.maxSourceBytes-audit.decodedBytes,bounds.maxTotalBytes-audit.decodedBytes)
  const requireBytes=size=>{if(size>remaining())throw failure('decoded body byte limit exceeded')}
  const denied=status=>[401,403,429,451].includes(status)
  const cancelBody=(response,reason)=>ignore(()=>response?.body?.cancel(reason))
  const acquisition=(page,row)=>{
    for(const [sourceKey,alias] of [['sourceRequestedAt','requestedAt'],['sourceCompletedAt','completedAt']]){
      const values=[page[sourceKey],page[alias],page.originalReceipt?.[sourceKey],page.originalReceipt?.[alias]].filter(value=>value!=null)
      if(values.some(value=>typeof value!=='string'||!Number.isFinite(Date.parse(value))||value!==values[0]))throw failure('contradictory original acquisition clock')
      row[sourceKey]=values[0]??null
    }
    if(row.sourceRequestedAt&&row.sourceCompletedAt&&Date.parse(row.sourceCompletedAt)<Date.parse(row.sourceRequestedAt))throw failure('invalid original acquisition clock order')
  }
  const remember=(page,row)=>{
    if(!page||typeof page!=='object')throw failure('original response unavailable')
    Object.assign(row,{status:page.status??null,finalUrl:page.finalUrl??page.url??null,headers:headers(page.headers)})
    row.sourceHttpDate=page.sourceHttpDate??row.headers.date??null
    acquisition(page,row)
    if(denied(row.status)){held.add(new URL(HOME).hostname);audit.heldHosts=[...held]}
  }
  const pageBytes=(page,row)=>{
    const encoded=page.bodyBase64
    if(typeof encoded!=='string'||!encoded)throw failure('original response body unavailable')
    if(encoded.length>Math.ceil(remaining()/3)*4)throw failure('original response body byte limit exceeded')
    if(encoded.length%4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))throw failure('original response body encoding is malformed')
    const bytes=Buffer.from(encoded,'base64');requireBytes(bytes.length)
    if(bytes.toString('base64')!==encoded)throw failure('original response body encoding is not canonical')
    Object.assign(row,{bodyBase64:encoded,bytes:bytes.length,sha256:hash(bytes),bodyComplete:true})
    audit.decodedBytes+=bytes.length
    if(page.bytes!=null&&page.bytes!==bytes.length||page.sha256!=null&&page.sha256!==row.sha256)throw failure('original body digest or byte count contradicts supplied evidence')
    const original=page.originalReceipt
    if(original&&(original.status!==row.status||original.requestedUrl!==row.requestUrl||original.finalUrl!==row.finalUrl
      ||original.bytes!==bytes.length||original.sha256!==row.sha256||JSON.stringify(headers(original.headers))!==JSON.stringify(row.headers)))throw failure('original receipt contradicts supplied response')
    if(page.sourceHttpDate!=null&&row.headers.date!=null&&page.sourceHttpDate!==row.headers.date)throw failure('original HTTP date contradicts headers')
    return bytes
  }
  const read=async url=>{
    source.check()
    if(url!==HOME&&!/^https:\/\/recruit\.accelerationrobotics\.in\/jobs\/[A-Za-z0-9][A-Za-z0-9_-]{0,199}\/?$/.test(url))throw failure('URL is not a configured root or qualified literal role')
    if(held.has(new URL(HOME).hostname))throw failure('public host held after denial',{failureKind:'blocked_or_access_denied'})
    if(audit.responses.length>=bounds.maxRequests||audit.responses.length>=bounds.maxPages)throw failure('request/page limit exceeded')
    const row={requestUrl:url,observedRequestedAt:wall(),observedCompletedAt:null,status:null,finalUrl:null,headers:{},sourceRequestedAt:null,
      sourceCompletedAt:null,sourceHttpDate:null,bodyBase64:null,bytes:null,sha256:null,bodyComplete:false,transportQualified:false}
    audit.responses.push(row)
    const request=scope('request',bounds.requestTimeoutMs,source)
    const init={method:'GET',redirect:'manual',credentials:'omit',signal:request.signal,maxResponseBytes:bounds.maxResponseBytes,
      headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 (compatible; Jobverify scraper)'},throwIfAborted:request.check}
    let page,response,reader,complete=false,rejected=false,rejection
    try {
      if(options.fetchPage)page=await race(()=>options.fetchPage(url,init),request,cancelBody)
      else if(options.fetchText&&!options.fetchImpl){
        const html=await race(()=>options.fetchText(url,init),request)
        if(typeof html!=='string'||!html.trim())throw failure('decoded response body unavailable')
        requireBytes(Buffer.byteLength(html));audit.decodedBytes+=Buffer.byteLength(html)
        Object.assign(row,{finalUrl:url,bodyComplete:true,decodedText:html})
        audit.issues.push({kind:'unqualified-decoded-only-transport',url,originalStatusAvailable:false})
        request.check();return html
      } else {
        response=await race(()=>(options.fetchImpl??globalThis.fetch)(url,init),request,cancelBody)
        page={url:response?.url,status:response?.status,headers:headers(response?.headers),sourceRequestedAt:row.observedRequestedAt}
      }
      request.check();remember(page,row)
      const httpError=Number.isInteger(row.status)&&row.status>=100&&row.status<=599&&row.status!==200
        ?failure('original public HTTP '+row.status,{status:row.status,headers:row.headers,originalResponse:page,
          failureKind:denied(row.status)?'blocked_or_access_denied':'source_inventory_unavailable'}):null
      let bytes
      try {
        if(response){
          const declared=row.headers['content-length']
          if(declared!=null&&(!/^\d+$/.test(declared)||Number(declared)>remaining()))throw failure('declared response byte limit exceeded')
          if(!response.body?.getReader)throw failure('original readable body unavailable')
          const entity=scope('entity',bounds.entityTimeoutMs,request)
          try {
            reader=await race(()=>response.body.getReader(),entity)
            const chunks=[];let size=0
            for(;;){
              const chunk=await race(()=>reader.read(),entity);entity.check()
              if(chunk.done)break
              if(!types.isUint8Array(chunk.value))throw failure('response chunk is not a Uint8Array')
              const copy=Buffer.from(chunk.value);requireBytes(size+copy.length)
              size+=copy.length;chunks.push(copy);row.bytesRead=size;entity.check()
            }
            bytes=Buffer.concat(chunks,size);page.bodyBase64=bytes.toString('base64');page.sourceCompletedAt=wall();acquisition(page,row)
          } finally {entity.close()}
        }
        bytes=pageBytes(page,row)
      } catch(error){
        caller?.throwIfAborted()
        if(!httpError)throw error
        audit.issues.push({kind:'error-response-entity-unavailable',url,message:describe(error)})
        Object.defineProperty(httpError,'bodyReadError',{value:error,configurable:true})
      }
      if(httpError)throw httpError
      if(row.status!==200)throw failure('original response status unavailable',{originalResponse:page})
      if(page.url!==url||row.finalUrl!==url||page.requestedUrl!==undefined&&page.requestedUrl!==url)throw failure('original response URL identity changed',{originalResponse:page})
      if(!/^text\/html(?:\s*;|$)/i.test(row.headers['content-type']??''))throw failure('original response HTML MIME is unqualified',{originalResponse:page})
      let html
      try {html=new TextDecoder('utf8',{fatal:true}).decode(bytes)}catch(cause){throw failure('original response is not UTF8',{cause})}
      if(['html','text','body'].some(key=>typeof page[key]==='string'&&page[key]!==html))throw failure('decoded text contradicts original response bytes',{originalResponse:page})
      if(!html.trim())throw failure('original response body unavailable',{originalResponse:page})
      row.transportQualified=true;complete=true;request.check();return html
    } catch(error){
      rejected=true;rejection=error
      const original=own(error,'originalResponse')
      if(original&&original!==page){
        // A legacy fetchText rejection can already carry its genuine receipt.
        // Retaining it must never replace the original rejection, even if its
        // body is unavailable, exceeds the allowance, or has bad provenance.
        try {remember(original,row);pageBytes(original,row)}catch(retention){audit.issues.push({kind:'rejected-original-retention-incomplete',url,message:describe(retention)})}
      } else if(!original) {
        const status=own(error,'status')
        if(Number.isInteger(status)&&status>=100&&status<=599){
          // A direct rejection is evidence, never a qualified acquisition.
          // Copy data descriptors only: a thrown object may be frozen, opaque,
          // or accessor-bearing, and its exact identity must survive retention.
          const metadata={status}
          for(const key of ['headers','url','finalUrl','sourceHttpDate','sourceRequestedAt','sourceCompletedAt',
            'requestedAt','completedAt','bodyBase64','bytes','sha256']){
            const value=own(error,key)
            if(value!==undefined)metadata[key]=value
          }
          row.status=status
          if(denied(status)){held.add(new URL(HOME).hostname);audit.heldHosts=[...held]}
          const clocks={}
          for(const key of ['sourceRequestedAt','sourceCompletedAt','requestedAt','completedAt'])if(Object.hasOwn(metadata,key)){
            const value=metadata[key]
            clocks[key]=value===null||['string','boolean'].includes(typeof value)||typeof value==='number'&&Number.isFinite(value)
              ?value:{unretainedType:typeof value}
          }
          if(Object.keys(clocks).length)row.directAcquisitionClocks=clocks
          try {remember(metadata,row)}catch(retention){
            row.sourceRequestedAt=null;row.sourceCompletedAt=null
            audit.issues.push({kind:'rejected-status-retention-incomplete',url,message:describe(retention)})
          }
          if(Object.hasOwn(metadata,'bodyBase64')){
            try {request.check();pageBytes(metadata,row);request.check()}
            catch(retention){audit.issues.push({kind:'rejected-status-retention-incomplete',url,message:describe(retention)})}
          }
        }
      }
      caller?.throwIfAborted();throw error
    } finally {
      request.close()
      if(reader){if(!complete)ignore(()=>reader.cancel(rejection));ignore(()=>reader.releaseLock())}
      else if(response)cancelBody(response,rejection)
      try {row.observedCompletedAt=wall()}catch(error){if(!rejected)throw error;audit.issues.push({kind:'completion-clock-unavailable',message:describe(error)})}
    }
  }
  const parse=(html,operation)=>{
    const processing=scope('processing',bounds.processingTimeoutMs,source)
    try {
      processing.check()
      // This small HTML-only reader grants no navigation authority to foreign
      // namespaces, base overrides, XML, or recursive ampersand spellings.
      if(/<\s*(?:base|math|svg)\b|<\?|&#(?:0*38|x0*26);/i.test(html))throw failure('document profile is unqualified for literal role authority')
      const document=readNativeDocument(html)
      processing.check()
      const result=operation(document,processing.check)
      processing.check();return result
    } finally {processing.close()}
  }
  const roleUrl=value=>typeof value==='string'&&/^(?:https:\/\/recruit\.accelerationrobotics\.in)?\/jobs\/[A-Za-z0-9][A-Za-z0-9_-]{0,199}\/?$/.test(value)?new URL(value,HOME).href:null
  const field=(document,node,name)=>{
    const nodes=document.nodes(item=>document.hasClass(item,name),node)
    if(nodes.length>1)throw failure('ambiguous explicit role '+name)
    return nodes.length?document.text(nodes[0])||null:null
  }
  const employment=value=>value?/intern/i.test(value)?'Internship':/full/i.test(value)?'Full-time':/part/i.test(value)?'Part-time':/contract/i.test(value)?'Contract':value:null
  const geography=location=>({location,city:location?.split(',')[0].trim()||null,country:location&&/\bIndia\b/i.test(location)?'India':null})
  const listings=html=>parse(html,(document,check)=>{
    const text=document.nodes(node=>node.tag==='root').map(document.text).join(' ')
    if(!/Careers at Acceleration Robotics/i.test(text)||!/Build the future of robotics with us/i.test(text)||!/\bOpen Roles\b/i.test(text))throw failure('official careers document identity changed materially')
    const rows=[],seen=new Map()
    for(const anchor of document.nodes(node=>node.tag==='a'&&roleUrl(node.attrs.href))){
      check()
      const headings=document.nodes(node=>/^h[1-6]$/.test(node.tag),anchor)
      if(headings.length!==1)continue
      const title=document.text(headings[0]),sourceUrl=roleUrl(anchor.attrs.href)
      if(!title)continue
      if(seen.has(sourceUrl)){if(seen.get(sourceUrl)!==title)throw failure('conflicting literal role identity');continue}
      if(rows.length>=1000)throw failure('literal role processing limit exceeded')
      seen.set(sourceUrl,title)
      const location=field(document,anchor,'location'),jobId=new URL(sourceUrl).pathname.split('/')[2]
      rows.push({title,...geography(location),jobId,requisitionId:jobId,sourceUrl,applyUrl:null,department:field(document,anchor,'category'),
        employmentType:employment(field(document,anchor,'employment-type')),experienceRequired:field(document,anchor,'experience')?.replace(/\byrs?\b/gi,'years')??null,
        postingDate:document.nodes(node=>node.tag==='time'&&node.attrs.datetime,anchor)[0]?.attrs.datetime??null})
    }
    return rows
  })
  const details=(html,listing)=>parse(html,(document)=>{
    const titles=document.nodes(node=>node.tag==='h1').map(document.text)
    if(titles.length!==1||titles[0]!==listing.title)throw failure('literal role detail identity changed')
    const root=document.nodes(node=>node.tag==='root')[0]
    const location=field(document,root,'location')
    const sections=document.nodes(node=>node.tag==='section'&&document.nodes(item=>/^h[1-6]$/.test(item.tag)&&/^About the Role$/i.test(document.text(item)),node).length===1)
    if(sections.length>1)throw failure('ambiguous role description')
    const jobDescription=sections.length?document.text(sections[0]).replace(/^About the Role\s*/i,'').trim()||null:null
    const apply=document.nodes(node=>node.tag==='a'&&node.attrs.href&&/^(?:Apply|Apply Now)$/i.test(document.text(node)))
      .map(node=>node.attrs.href).filter(href=>href===new URL(listing.sourceUrl).pathname.replace(/\/$/,'')+'/apply'||href===listing.sourceUrl.replace(/\/$/,'')+'/apply')
    return {...(location?geography(location):{}),jobDescription,applyUrl:apply.length?new URL(apply[0],HOME).href:null}
  })
  const deliver=async(name,value)=>{
    if(!options[name])return
    const callback=scope(name,bounds.callbackTimeoutMs,source)
    try {await race(()=>options[name](structuredClone(value),{signal:callback.signal,throwIfAborted:callback.check}),callback)}
    finally {callback.close()}
  }
  let rejected=false,rejection,jobs=[]
  try {
    try {
      const root=await read(HOME),rows=listings(root)
      for(const listing of rows.slice(0,bounds.maxJobs)){
        source.check()
        const detail=details(await read(listing.sourceUrl),listing)
        const record={...listing,...detail,company:COMPANY,source:SOURCE,
          link:detail.applyUrl||listing.sourceUrl,scrapedAt:wall()}
        if(record.country==null)record.sourceCountryScopeUnresolved=true
        jobs.push(record)
      }
      source.check();audit.observations=jobs.map(row=>({...row,vacancy:true,sourceScopeComplete:false}))
      if(rows.length>jobs.length)audit.issues.push({kind:'bounded-role-selection',discoveredRows:rows.length,returnedRows:jobs.length})
      await deliver('onRecords',jobs)
    } catch(error){caller?.throwIfAborted();rejected=true;rejection=error;audit.outcome='failed';audit.issues.push({kind:'public-read-failed',message:describe(error)})}
    try {audit.completedAt=wall()}catch(error){if(!rejected){rejected=true;rejection=error;audit.outcome='failed'}audit.issues.push({kind:'completion-clock-unavailable',message:describe(error)})}
    audit.inventoryEvidence=inventory()
    try {await deliver('onAudit',audit)}catch(error){
      caller?.throwIfAborted()
      if(!rejected){rejected=true;rejection=error;audit.outcome='failed'}
      audit.issues.push({kind:'failure-audit-delivery-failed',message:describe(error)})
    }
    if(rejected)throw rejection
    source.check()
    jobs=attachInventoryEvidence(jobs,inventory())
    const retained=structuredClone(audit)
    Object.defineProperties(jobs,{sourceAudit:{value:retained},nativeCollectionEvidence:{value:retained,configurable:true}})
    return jobs
  } catch(error){
    caller?.throwIfAborted();audit.outcome='failed';audit.inventoryEvidence=inventory()
    // An opaque, frozen, falsy, or setter-bearing rejection remains itself.
    // onAudit is the independent evidence channel when it cannot be attached.
    try {
      if(error&&typeof error==='object'&&Object.isExtensible(error))for(const [key,value] of Object.entries({sourceAudit:structuredClone(audit),
        inventoryEvidence:inventory(),lifecycleCleanupAllowed:false})){
        const descriptor=Object.getOwnPropertyDescriptor(error,key)
        if(!descriptor||descriptor.configurable&&Object.hasOwn(descriptor,'value'))Object.defineProperty(error,key,{value,configurable:true})
      }
    } catch {}
    throw error
  } finally {source.close()}
}
