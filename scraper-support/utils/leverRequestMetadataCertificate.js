import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {readNativeDocument} from './activeNativeHtml.js'

const PROFILE='9ae8d69ef658b78f79d4b11ba855d2cf3f4676e22ed85a55dbe867237bddd306'
export const LOADSMART_SERVER_PUBLICATION_PROFILE='loadsmart-server-publication-v1'
export const IMMUTA_INTAKE_SERVER_PUBLICATION_PROFILE='immuta-intake-server-publication-v1'
const sha=value=>createHash('sha256').update(value).digest('hex')
const need=(value,message)=>{if(!value)throw Object.assign(new Error('Lever response metadata certificate: '+message),{softFailure:true,abortRetries:true,upstreamOutage:false,failureKind:'coverage_gap'})}
const own=(object,key)=>{const property=Object.getOwnPropertyDescriptor(object,key);need(property&&Object.hasOwn(property,'value'),'Original own data metadata unavailable: '+key);return property.value}
const plain=object=>object!==null&&typeof object==='object'&&!types.isProxy(object)&&[Object.prototype,null].includes(Object.getPrototypeOf(object))
const dataArray=array=>{need(Array.isArray(array)&&!types.isProxy(array)&&Object.getPrototypeOf(array)===Array.prototype,'Original header entries must be plain data arrays');for(const key of Reflect.ownKeys(array))need(typeof key==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(array,key),'value'),'Header entry accessor/symbol is unreviewed');return array}
const headerViews=metadata=>{
 need(plain(metadata),'Original response metadata must be plain own data');const headers=own(metadata,'headers'),entries=dataArray(own(metadata,'headerEntries'));need(plain(headers),'Original Fetch header view must be plain data')
 const normalized=new Map()
 for(const key of Reflect.ownKeys(headers)){need(typeof key==='string','Original header symbol is unreviewed');const value=own(headers,key),name=key.toLowerCase();need(typeof value==='string'&&!normalized.has(name),'Duplicate/invalid original header field');normalized.set(name,value)}
 const selected=new Map()
 for(let i=0;i<entries.length;i++){const entry=dataArray(own(entries,String(i)));need(entry.length===2,'Original header entry shape changed');const key=own(entry,'0'),value=own(entry,'1');need(typeof key==='string'&&typeof value==='string','Original header entry is not text');const name=key.toLowerCase();if(['cf-ray','date'].includes(name)){need(!selected.has(name),'Duplicate original '+name+' entry');selected.set(name,value)}}
 for(const key of['cf-ray','date'])need(selected.has(key)&&normalized.get(key)===selected.get(key),'Original header views missing or disagree: '+key)
 return{cfRay:selected.get('cf-ray'),date:selected.get('date')}
}

const comparisonScope=metadata=>{
 need(plain(metadata),'Original response metadata must be plain own data')
 const descriptor=Object.getOwnPropertyDescriptor(metadata,'profile');if(!descriptor)return null
 need(Object.hasOwn(descriptor,'value')&&(descriptor.value===LOADSMART_SERVER_PUBLICATION_PROFILE||descriptor.value===IMMUTA_INTAKE_SERVER_PUBLICATION_PROFILE),'Unknown or non-data comparison profile')
 const loadsmart=descriptor.value===LOADSMART_SERVER_PUBLICATION_PROFILE,expectedURL=loadsmart?'https://jobs.lever.co/loadsmart/':'https://jobs.lever.co/immuta/4372d3ba-00d6-4ae0-986c-e65d8dbf9def'
 const requestedURL=own(metadata,'requestedURL'),finalURL=own(metadata,'finalURL')
 need(requestedURL===expectedURL&&finalURL===requestedURL,'Comparison profile requires exact original '+(loadsmart?'Loadsmart':'Immuta intake')+' requestedURL/finalURL')
 return{profile:descriptor.value,requestedURL,finalURL}
}
// Pure comparison certificate, never an access-control action or execution.
// The reviewed complete script creates a hidden frame and declares child code;
// that code is neither fetched nor executed here. Identity/country/programme
// acceptance and all raw original retention remain source-caller obligations.
export function certifyLeverRequestMetadata(html,responseMetadata){
 need(typeof html==='string'&&Buffer.byteLength(html)>0&&Buffer.byteLength(html)<=4*1024*1024,'Original complete HTML string/byte bound unavailable')
 need(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.from(html))===html,'Original HTML is not a lossless UTF8 string')
 const scope=comparisonScope(responseMetadata),{cfRay,date}=headerViews(responseMetadata),ray=/^([a-f0-9]{16})-([A-Z0-9]{3})$/.exec(cfRay)
 need(ray,'Original cf-ray is not canonical');const dateValue=new Date(date),seconds=String(dateValue.getTime()/1000)
 need(Number.isFinite(dateValue.getTime())&&dateValue.toUTCString()===date&&/^\d{10}$/.test(seconds),'Original Date must be valid canonical whole-second IMF-fixdate')
 const base64Time=Buffer.from(seconds,'ascii').toString('base64'),document=readNativeDocument(html),entries=[]
 const visit=(node,ancestors=[])=>{if(typeof node==='string')return;entries.push({node,ancestors});for(const child of node.children)visit(child,[...ancestors,node])}
 const roots=document.nodes(node=>node.tag==='root');need(roots.length===1,'Unique original HTML root unavailable');visit(roots[0])
 const found=entries.filter(({node})=>node.tag==='script'&&node.raw?.includes('__CF$cv$params'))
 need(found.length===1&&html.split('__CF$cv$params').length===2,'Unique raw request metadata carrier unavailable/ambiguous')
 const {node,ancestors}=found[0]
 need(Object.keys(node.attrs).length===0&&!node.inert&&!node.activeFrame&&!node.nativeTagUnqualified,'Unreviewed active carrier attributes/namespace')
 need(ancestors.map(parent=>parent.tag).join('/')==='root/html/body'&&!ancestors.some(parent=>parent.inert||parent.nativeTagUnqualified),'Carrier must be an active direct HTML body child')
 need(entries.filter(e=>e.node.tag==='html').length===1&&entries.filter(e=>e.node.tag==='body').length===1,'Ambiguous original HTML/body context')
 need(ancestors.at(-1).children.filter(child=>typeof child!=='string').at(-1)===node,'Carrier must be the final direct body element')
 const source=node.raw;need(Buffer.byteLength(source)===1097&&source.length===1097,'Whole reviewed script byte length changed')
 const slots=[{name:'params.r',offset:171,length:16},{name:'params.t',offset:192,length:16},{name:'jsd query ray',offset:401,length:16}].map(slot=>({...slot,originalValue:source.slice(slot.offset,slot.offset+slot.length)}))
 need(/^[a-f0-9]{16}$/.test(slots[0].originalValue)&&slots[0].originalValue===ray[1]&&slots[2].originalValue===ray[1],'Both exact source rays must bind to original cf-ray')
 let decodedDigits=null
 if(scope){
  const literal=slots[1].originalValue;need(/^[A-Za-z0-9+/]{14}==$/.test(literal),'Opaque source literal must use exact canonical base64')
  decodedDigits=Buffer.from(literal,'base64').toString('latin1')
  need(/^[1-9][0-9]{9}$/.test(decodedDigits)&&Buffer.from(decodedDigits,'ascii').toString('base64')===literal,'Opaque source literal must roundtrip to ten canonical ASCII decimal digits without a leading zero')
 }else need(/^[A-Za-z0-9+/]{14}==$/.test(slots[1].originalValue)&&slots[1].originalValue===base64Time,'Exact source time must bind to original Date second')
 let comparisonSource=source
 for(const slot of [...slots].reverse()){const value=slot.name==='params.t'?'MDAwMDAwMDAwMA==':'0000000000000000';comparisonSource=comparisonSource.slice(0,slot.offset)+value+comparisonSource.slice(slot.offset+slot.length)}
 need(sha(comparisonSource)===PROFILE,'Every other exact source byte/literal context must match the reviewed whole template')
 const markup='<script>'+source+'</script>',offset=html.indexOf(markup)
 need(offset>=0&&html.lastIndexOf(markup)===offset,'Original attribute-free raw carrier boundary is unreviewed')
 need(html.slice(offset+markup.length).startsWith('</body></html>'),'Original terminal direct-body closing context changed')
 const sourceOffset=offset+8,comparison=html.slice(0,sourceOffset)+comparisonSource+html.slice(sourceOffset+source.length)
 const certificate={comparisonFingerprint:sha(comparison),profileSHA256:PROFILE,originalEntitySHA256:sha(html),originalEntityBytes:Buffer.byteLength(html),sourceSHA256:sha(source),sourceBytes:1097,sourceOffset,literalSlots:slots,headerBinding:{cfRay,date,rayPrefix:ray[1],unixSeconds:seconds,base64Time},comparisonOnly:true,rawRetentionRequired:true,limits:['Only the three exact header-bound source literal spans are represented differently for comparison. Every other entity byte remains in the fingerprint.','No modified HTML is returned as evidence. Caller must retain complete original bytes/headers/clocks independently.','No external request, child-code completeness, CF execution/solving/replay, browser/CORS/UI, employer/country/job/inventory/global/cleanup authority is established.']}
 if(scope){
  certificate.comparisonProfile=scope.profile;certificate.requestBinding={requestedURL:scope.requestedURL,finalURL:scope.finalURL}
  certificate.headerBinding={cfRay,date,rayPrefix:ray[1],dateUnixSeconds:seconds}
  certificate.tDateBound=false;certificate.sourceTimeSemanticsQualified=false
  certificate.timeLiteral={rawBase64:slots[1].originalValue,decodedDigits,originalDate:date,originalDateUnixSeconds:seconds,signedDifferenceSeconds:Number(decodedDigits)-Number(seconds),tDateBound:false,sourceTimeSemanticsQualified:false}
  certificate.limits[0]='Only the two original-header-bound ray spans and one opaque canonical numeric literal span are represented differently for comparison. Every other entity byte remains in the fingerprint.'
  certificate.limits.push(scope.profile===LOADSMART_SERVER_PUBLICATION_PROFILE?'This explicit Loadsmart profile compares finite server-published SSR/API content only. The opaque literal has no qualified time, freshness, publication or CF-child/runtime semantics, including when its digits equal Date seconds.':'This explicit Immuta intake profile compares finite server-published content only. Non-position classification and programme scope require independent complete native evidence. The opaque literal has no qualified time, freshness, publication or CF-child/runtime semantics, including when its digits equal Date seconds.')
 }
 return certificate
}
