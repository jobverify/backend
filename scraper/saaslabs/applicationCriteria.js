import {isDeepStrictEqual} from 'node:util'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {readUniqueLiteralJSON} from './literalJSON.js'

const LIMIT=10*1024*1024
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
const text=x=>typeof x==='string'&&x.trim().length>0
const norm=x=>decodeNativeEntities(x).replace(/\s+/g,' ').trim()
const walk=n=>[n,...(n.children||[]).filter(c=>typeof c!=='string').flatMap(walk)]
class ContractError extends Error{constructor(code){super(code);this.code=code}}
const need=(ok,code)=>{if(!ok)throw new ContractError(code)}

// Literal carriers only. Keep each occurrence; an ambiguous target is never
// selected. UTF8 T-frame lengths count bytes, not JavaScript string positions.
function readFrames(scripts){
 const chunks=[]
 for(const node of scripts){const s=(node.raw||'').trim();if(!s.includes('self.__next_f.push('))continue
  const m=s.match(/^self\.__next_f\.push\(([\s\S]*)\);?$/);need(m,'unreviewed-native-detail-carrier')
  let frame
  try{const parsed=readUniqueLiteralJSON(m[1]);if(parsed.duplicateKeys.length){const error=new ContractError('duplicate-native-JSON-key');error.duplicateKeys=parsed.duplicateKeys.map(d=>({...d,boundary:'carrier'}));throw error}frame=parsed.value}catch(error){if(error.code)throw error;throw new ContractError('malformed-native-detail-carrier')}
  need(Array.isArray(frame),'malformed-native-detail-carrier')
  if(frame.length===1&&frame[0]===0)continue
  need(frame.length===2&&frame[0]===1&&typeof frame[1]==='string','unreviewed-native-detail-carrier')
  chunks.push(frame[1])
 }
 need(chunks.length>0,'missing-native-detail-carriers')
 const bytes=Buffer.from(chunks.join(''),'utf8');need(bytes.length<=LIMIT,'native-detail-size-limit')
 const records=[],byId=new Map(),decode=b=>{try{return new TextDecoder('utf8',{fatal:true}).decode(b)}catch{throw new ContractError('invalid-native-detail-UTF8')}}
 const add=r=>{r.occurrenceIndex=records.length;records.push(r);if(r.id)byId.set(r.id,[...(byId.get(r.id)||[]),r])}
 let at=0
 while(at<bytes.length){if(bytes[at]===10){at++;continue}const colon=bytes.indexOf(58,at);need(colon>=0,'truncated-native-detail-header');const id=decode(bytes.subarray(at,colon));need(id===''||/^[\da-f]+$/i.test(id),'invalid-native-detail-frame-id');at=colon+1
  if(bytes[at]===84){const comma=bytes.indexOf(44,at),hex=comma<0?'':decode(bytes.subarray(at+1,comma));need(id&&/^[\da-f]+$/i.test(hex),'invalid-native-detail-text-length');const n=parseInt(hex,16),start=comma+1;need(Number.isSafeInteger(n)&&n<=bytes.length-start,'truncated-native-detail-text');const value=decode(bytes.subarray(start,start+n));add({id,kind:'text',raw:value,value});at=start+n}
  else{let end=bytes.indexOf(10,at);if(end<0)end=bytes.length;const raw=decode(bytes.subarray(at,end));let value,duplicateKeys,kind='opaque';try{const parsed=readUniqueLiteralJSON(raw);duplicateKeys=parsed.duplicateKeys;if(duplicateKeys.length)kind='ambiguous-json';else{value=parsed.value;kind='model'}}catch{need(!/^[\[{\"]/.test(raw),'malformed-native-detail-model')}add({id,kind,raw,...(kind==='model'?{value}:{}),...(duplicateKeys?.length?{duplicateKeys}: {})});at=end+1}
 }
 const ambiguous=new Set([...byId].filter(([,rs])=>new Set(rs.map(r=>r.kind+':'+r.raw)).size>1).map(([id])=>id))
 return{records,byId,ambiguous}
}

export function inspectSaaSLabsApplication(html,{url,listing}){
 const e={requestedUrl:url,rawHTML:html,rawCarrierScripts:[],literalFrameOccurrences:[],ambiguousFrameIds:[],duplicateJSONKeys:[],rawPropCandidates:[],rawProps:null,resolvedProps:null,referenceIssues:[],unknownFields:[],rawJobPostingSchemas:[],declaredDOMForms:[],declaredDOMControls:[],issues:['native-form-client-activation-unverified','native-detail-response-final-url-unverified'],contractIssues:[],identityReconciled:false,countryReconciled:false,criteriaAttributable:false,literalCriteriaCopyComplete:false,applicationDataRetained:false,fullCriteriaQualified:false,binding:{uniqueJSON:false,route:false,componentReachable:false,publicRole:false,applicationSettings:false,account:false,offices:false,description:false,canonical:false,visibleTitle:false,schemaIdentity:false,schemaCountry:false,references:false,formSchema:false,controlIdentity:false}}
 const issue=(code,p='')=>{const s=code+(p?':'+p:'');if(!e.issues.includes(s))e.issues.push(s);if(!e.contractIssues.includes(s))e.contractIssues.push(s)}
 let formSchemaValid=true,controlsUnique=true
 const shape=(ok,p)=>{if(!ok){formSchemaValid=false;issue('invalid-native-form-schema',p)}return Boolean(ok)}
 const extras=(v,keys,p)=>{if(!plain(v))return;for(const[k,value]of Object.entries(v))if(!keys.includes(k)){issue('unreviewed-native-form-field',p+'/'+k);e.unknownFields.push({path:p+'/'+k,value:structuredClone(value)})}}
 try{
  need(typeof html==='string'&&Buffer.byteLength(html,'utf8')<=LIMIT,'native-detail-unavailable-or-size-limit')
  const document=readNativeDocument(html),nodes=walk(document.nodes(n=>n.tag==='root')[0]),scripts=nodes.filter(n=>n.tag==='script')
  e.rawCarrierScripts=scripts.filter(n=>(n.raw||'').includes('self.__next_f.push(')).map(n=>({attrs:n.attrs,inert:Boolean(n.inert),raw:n.raw}))
  const frames=readFrames(scripts)
  e.literalFrameOccurrences=structuredClone(frames.records);e.ambiguousFrameIds=[...frames.ambiguous]
  for(const r of frames.records)for(const d of r.duplicateKeys||[]){e.duplicateJSONKeys.push({...d,boundary:'model',frameId:r.id});issue('duplicate-native-JSON-key','model/'+r.id+d.path)}
  const carriers=scripts.filter(n=>(n.raw||'').includes('self.__next_f.push('))
  if(carriers.some(n=>n.inert||Object.keys(n.attrs).length))issue('native-detail-carrier-activation-unverified')
  e.declaredDOMForms=nodes.filter(n=>n.tag==='form');e.declaredDOMControls=nodes.filter(n=>['input','select','textarea','button'].includes(n.tag))
  const resolve=(value,p='',seen=new Set(),depth=0)=>{
   need(depth<128,'native-detail-reference-depth-limit')
   if(typeof value==='string'&&value.startsWith('$')){const m=value.match(/^\$([\da-f]+)$/i);let code
    if(!m)code='unreviewed-control-token'
    else if(seen.has(m[1]))code='cyclic-reference'
    else if(!frames.byId.has(m[1]))code='missing-frame'
    else if(frames.ambiguous.has(m[1]))code='ambiguous-frame'
    else if(!['text','model'].includes(frames.byId.get(m[1])[0].kind))code='opaque-frame'
    if(code){e.referenceIssues.push({code,path:p,reference:value});issue(code,p);return value}
    const r=frames.byId.get(m[1])[0];return r.kind==='text'?r.value:resolve(r.value,p,new Set([...seen,m[1]]),depth+1)
   }
   if(Array.isArray(value))return value.map((x,i)=>resolve(x,p+'/'+i,seen,depth+1))
   if(plain(value))return Object.fromEntries(Object.entries(value).map(([k,x])=>[k,resolve(x,p+'/'+k,seen,depth+1)]))
   if(typeof value==='number'&&(!Number.isFinite(value)||Number.isInteger(value)&&!Number.isSafeInteger(value)))issue('invalid-native-form-schema',p)
   return value
  }
  const roots=frames.byId.get('0');need(roots&&!frames.ambiguous.has('0')&&plain(roots[0].value),'ambiguous-native-detail-route')
  const requested=new URL(url),expectedPath='/saas-labs/'+requested.pathname.split('/').at(-1),route=roots[0].value
  e.binding.route=requested.origin==='https://careers.kula.ai'&&requested.pathname===expectedPath&&!requested.search&&!requested.hash&&url===listing.sourceUrl&&isDeepStrictEqual(route.c,['','saas-labs',requested.pathname.split('/').at(-1)])
  if(!e.binding.route)issue('native-detail-route-mismatch')
  e.rawRoute=structuredClone(route)
  const candidates=[]
  const visit=(v,frame,p='',depth=0)=>{need(depth<128,'native-detail-model-depth-limit');if(Array.isArray(v)&&v[0]==='$'&&plain(v[3])&&Object.hasOwn(v[3],'form')&&Object.hasOwn(v[3],'job_description'))candidates.push({frameId:frame.id,path:p,component:v[1],props:v[3]});if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))visit(x,frame,p+'/'+k,depth+1)}
  for(const r of frames.records)if(r.kind==='model')visit(r.value,r)
  e.rawPropCandidates=structuredClone(candidates)
  need(candidates.length===1&&!frames.ambiguous.has(candidates[0].frameId),'ambiguous-native-application-props')
  const reachable=new Set(['0']),queue=['0']
  const references=(v,depth=0)=>{need(depth<128,'native-detail-route-depth-limit');if(typeof v==='string'){const m=v.match(/^\$(?:L|@)?([\da-f]+)$/i);if(m&&!frames.ambiguous.has(m[1])&&frames.byId.get(m[1])?.[0].kind==='model'&&!reachable.has(m[1])){reachable.add(m[1]);queue.push(m[1])}}else if(v&&typeof v==='object')for(const x of Object.values(v))references(x,depth+1)}
  for(let i=0;i<queue.length;i++)references(frames.byId.get(queue[i])[0].value)
  e.routeReachableModelFrameIds=[...reachable]
  const candidate=candidates[0];need(reachable.has(candidate.frameId),'unbound-native-application-component')
  e.binding.componentReachable=true
  e.formOwner={frameId:candidate.frameId,path:candidate.path,componentReference:candidate.component}
  e.rawProps=structuredClone(candidate.props);e.resolvedProps=resolve(candidate.props);const p=e.resolvedProps
  e.applicationDataRetained=plain(e.rawProps.form)
  extras(p,['job_description','form','eeoc','site','offices','isPreview','listed','jobCbvSettingsEnabled','coordinatorEnabled'],'props')
  e.binding.publicRole=p.isPreview===false&&p.listed===true
  if(!e.binding.publicRole)issue('native-detail-not-public')
  e.binding.applicationSettings=plain(p.eeoc)&&p.eeoc.enabled===false&&p.jobCbvSettingsEnabled===false&&p.coordinatorEnabled===false
  if(!e.binding.applicationSettings)issue('unreviewed-native-application-settings')
  extras(p.eeoc,['enabled'],'eeoc')
  e.binding.account=plain(p.site)&&p.site.company_name==='SaaS Labs'&&p.site.company_website==='https://www.saaslabs.co/'&&p.site.state==='enabled'&&p.site.iframe_enabled===false&&p.site.candidate_consent?.enabled===false
  if(!e.binding.account)issue('native-detail-account-mismatch')
  if(!isDeepStrictEqual(p.offices,listing.sourceNativeOffices))issue('native-detail-office-mismatch')
  if(shape(Array.isArray(p.offices)&&p.offices.length>0,'offices'))for(const[i,o]of p.offices.entries()){
   if(shape(plain(o),'offices/'+i)){extras(o,['id','name','location','location_key','country','country_code','state','city','remote','workplace'],'offices/'+i);shape(Number.isSafeInteger(o.id)&&o.id>0&&['name','location','location_key','country','country_code','state','city'].every(k=>text(o[k]))&&typeof o.remote==='boolean'&&['office','remote','hybrid'].includes(o.workplace),'offices/'+i)}
  }
  e.binding.offices=isDeepStrictEqual(p.offices,listing.sourceNativeOffices)
  e.binding.description=typeof p.job_description==='string'&&p.job_description===listing.sourceNativeDescription
  if(!e.binding.description)issue('native-detail-description-mismatch')
  const canonical=nodes.filter(n=>n.tag==='link'&&n.attrs.rel==='canonical'),og=nodes.filter(n=>n.tag==='meta'&&n.attrs.property==='og:url')
  e.binding.canonical=canonical.length===1&&canonical[0].attrs.href===url&&og.length===1&&og[0].attrs.content===url
  if(!e.binding.canonical)issue('native-detail-canonical-mismatch')
  const visible=readVisibleNativeDocument(html,{strict:true}),headings=visible.nodes(n=>n.tag==='h1')
  e.binding.visibleTitle=headings.length===1&&norm(visible.text(headings[0]))===norm(listing.title)
  if(!e.binding.visibleTitle)issue('native-detail-title-mismatch')
  for(const n of scripts.filter(n=>n.attrs.type==='application/ld+json')){try{const parsed=readUniqueLiteralJSON(n.raw);if(parsed.duplicateKeys.length){e.rawJobPostingSchemas.push({attrs:n.attrs,raw:n.raw,duplicateKeys:parsed.duplicateKeys});for(const d of parsed.duplicateKeys){e.duplicateJSONKeys.push({...d,boundary:'JSON-LD'});issue('duplicate-native-JSON-key','JSON-LD'+d.path)}}else e.rawJobPostingSchemas.push({attrs:n.attrs,raw:n.raw,value:parsed.value})}catch(error){e.rawJobPostingSchemas.push({attrs:n.attrs,raw:n.raw,error:error.message});issue('invalid-native-detail-JobPosting')}}
  const schemas=e.rawJobPostingSchemas.filter(x=>x.value?.['@type']==='JobPosting')
  if(schemas.length!==1)issue('ambiguous-native-detail-JobPosting')
  else{const s=schemas[0].value
   e.binding.schemaIdentity=norm(s.title)===norm(listing.title)&&String(s.identifier?.value)===listing.jobId&&s.identifier?.name==='SaaS Labs'&&s.hiringOrganization?.name==='SaaS Labs'
   if(!e.binding.schemaIdentity)issue('native-detail-job-identity-mismatch')
   const expected=listing.sourceNativeOffices.map(o=>({country:o.country_code,city:o.city,state:o.state})),actual=(Array.isArray(s.jobLocation)?s.jobLocation:[s.jobLocation]).map(l=>({country:l?.address?.addressCountry,city:l?.address?.addressLocality,state:l?.address?.addressRegion}))
   e.binding.schemaCountry=isDeepStrictEqual(actual,expected)
   if(!e.binding.schemaCountry)issue('native-detail-schema-country-mismatch')
  }
  const ids=new Set(),validateStatic=(field,path,siblingIds)=>{
   if(!shape(plain(field),path))return
   if(siblingIds.has(field.id)){controlsUnique=false;issue('native-form-control-identity-conflict',path)}
   siblingIds.add(field.id)
   extras(field,['id','label','type','required','fields'],path)
   shape(text(field.id)&&text(field.label)&&text(field.type)&&typeof field.required==='boolean',path)
   if(!['name','email','phone','linkedin_url','education','experience','resume','cover_letter','institution','discipline','degree','location','summary','date','title','company','industry'].includes(field.id)||!['string','email','phone','url','complex','rel_tag','text','range','rel_file'].includes(field.type))issue('unreviewed-native-form-field',path)
   if(Object.hasOwn(field,'fields')){if(shape(field.type==='complex'&&Array.isArray(field.fields),path+'/fields')){const nestedIds=new Set();field.fields.forEach((f,i)=>validateStatic(f,path+'/fields/'+i,nestedIds))}}
  }
  const validateRule=(r,path)=>{if(!shape(plain(r),path))return;extras(r,['id','name','status','position','associated_custom_field_deleted'],path);shape(Number.isSafeInteger(r.id)&&r.id>0&&text(r.name)&&text(r.status)&&Number.isSafeInteger(r.position)&&typeof r.associated_custom_field_deleted==='boolean',path);issue('native-rejection-predicate-unavailable')}
  if(shape(plain(p.form),'form')){
   const f=p.form;extras(f,['static_fields','field_groups','ats_custom_fields','ats_auto_rejection_rules'],'form')
   if(shape(Array.isArray(f.static_fields)&&f.static_fields.length>0,'form/static_fields')){const groupIds=new Set();for(const[i,g]of f.static_fields.entries()){if(shape(plain(g),'form/static_fields/'+i)){if(groupIds.has(g.id)){controlsUnique=false;issue('native-form-control-identity-conflict','form/static_fields/'+i)}groupIds.add(g.id);extras(g,['id','label','fields'],'form/static_fields/'+i);shape(text(g.id)&&text(g.label)&&Array.isArray(g.fields),'form/static_fields/'+i);if(Array.isArray(g.fields)){const siblingIds=new Set();g.fields.forEach((x,j)=>validateStatic(x,'form/static_fields/'+i+'/fields/'+j,siblingIds))}}}}
   if(shape(plain(f.field_groups),'form/field_groups'))for(const[k,v]of Object.entries(f.field_groups))shape(/^\d+$/.test(k)&&text(v),'form/field_groups/'+k)
   if(shape(Array.isArray(f.ats_auto_rejection_rules),'form/ats_auto_rejection_rules'))f.ats_auto_rejection_rules.forEach((r,i)=>validateRule(r,'form/ats_auto_rejection_rules/'+i))
   if(shape(Array.isArray(f.ats_custom_fields),'form/ats_custom_fields'))for(const[i,q]of f.ats_custom_fields.entries()){
    const path='form/ats_custom_fields/'+i;if(!shape(plain(q),path))continue
    extras(q,['id','label','description','placeholder','position','required','field_group_idx','kind','multi','ats_auto_rejection_rules','values'],path)
    if(ids.has(q.id)){controlsUnique=false;issue('native-form-control-identity-conflict',path)}
    shape(Number.isSafeInteger(q.id)&&q.id>0&&!ids.has(q.id)&&text(q.label)&&typeof q.description==='string'&&typeof q.placeholder==='string'&&Number.isSafeInteger(q.position)&&q.position>0&&typeof q.required==='boolean'&&Number.isSafeInteger(q.field_group_idx)&&Object.hasOwn(f.field_groups||{},String(q.field_group_idx))&&text(q.kind)&&typeof q.multi==='boolean',path);ids.add(q.id)
    if(!['text','string','enum_boolean','rel_tag','url'].includes(q.kind))issue('unreviewed-native-form-field',path+'/kind')
    if(q.kind==='enum_boolean')issue('native-implicit-boolean-options-unverified',path)
    if(Object.hasOwn(q,'values')){if(shape(Array.isArray(q.values),path+'/values')){const optionIds=new Set();for(const[j,v]of q.values.entries()){const p=path+'/values/'+j;if(shape(plain(v),p)){if(optionIds.has(v.id)){controlsUnique=false;issue('native-form-control-identity-conflict',p)}optionIds.add(v.id);extras(v,['id','value'],p);shape(Number.isSafeInteger(v.id)&&v.id>0&&text(v.value),p)}}}}
    if(q.kind==='rel_tag')shape(Array.isArray(q.values)&&q.values.length>0,path+'/values')
    if(shape(Array.isArray(q.ats_auto_rejection_rules),path+'/ats_auto_rejection_rules'))q.ats_auto_rejection_rules.forEach((r,j)=>validateRule(r,path+'/ats_auto_rejection_rules/'+j))
   }
  }
  e.binding.uniqueJSON=e.duplicateJSONKeys.length===0
  e.binding.references=e.referenceIssues.length===0
  e.binding.formSchema=formSchemaValid
  e.binding.controlIdentity=controlsUnique
  e.identityReconciled=['uniqueJSON','route','componentReachable','publicRole','account','canonical','visibleTitle','schemaIdentity'].every(k=>e.binding[k]===true)
  e.countryReconciled=e.binding.offices&&e.binding.schemaCountry
  e.criteriaAttributable=Object.values(e.binding).every(v=>v===true)
  e.literalCriteriaCopyComplete=e.criteriaAttributable&&e.contractIssues.length===0
 }catch(error){if(error.duplicateKeys)e.duplicateJSONKeys.push(...error.duplicateKeys);issue(error.code||'native-application-reader-error');e.failure={name:error.name,message:error.message,code:error.code??null}}
 return e
}
