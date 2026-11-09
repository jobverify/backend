import{createHash}from'node:crypto'
import{readNativeDocument,decodeNativeEntities}from'../../scraper-support/utils/activeNativeHtml.js'
import{parseBoundedProgram,parseRemoteLiteral}from'../../scraper-support/utils/remoteScriptData.js'
import{attachInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import{attachSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'
import{createSurfaceReader}from'../atomberg/currentSurface.js'

const URL='https://www.angelone.in/careers',ORIGIN='https://www.angelone.in'
const MODULE=8957,REVIEWED='b5c7bc550ccc688eb2849513ca2b753233a44fbf2055cd6c217518c7216df600'
const fail=message=>{throw Object.assign(Error('angelone native source '+message),{abortRetries:true,failureKind:'parser_or_contract_error'})}
const need=(condition,message)=>{if(!condition)fail(message)}
const shape=node=>JSON.stringify(node,(key,value)=>['start','end','raw'].includes(key)?undefined:value)
const sha=value=>createHash('sha256').update(value).digest('hex')
const walk=(node,visit)=>{if(!node||typeof node!=='object')return;visit(node);for(const v of Object.values(node))if(Array.isArray(v))v.forEach(child=>walk(child,visit));else if(v&&typeof v==='object')walk(v,visit)}
const data=source=>{try{JSON.parse(source);return parseRemoteLiteral(source)}catch{fail('Flight data grammar or duplicate field changed')}}
function flightRows(text){
 const bytes=Buffer.from(text),records=new Map(),controls=[];need(bytes.length<8*1024*1024,'Flight data bound exceeded');let offset=0
 const decode=value=>{try{return new TextDecoder('utf-8',{fatal:true}).decode(value)}catch{fail('Flight UTF8 boundary changed')}}
 const add=(id,row)=>{need(!records.has(id)||records.get(id).raw===row.raw,'conflicting Flight model records');records.set(id,row)}
 while(offset<bytes.length){if(bytes[offset]===10){offset++;continue}const colon=bytes.indexOf(58,offset);need(colon>=0,'Flight header missing');const id=decode(bytes.subarray(offset,colon));need(/^[a-f\d]*$/i.test(id),'Flight identity changed');offset=colon+1
  if(bytes[offset]===84){const comma=bytes.indexOf(44,offset),hex=comma<0?'':decode(bytes.subarray(offset+1,comma));need(/^[a-f\d]+$/i.test(hex),'Flight text header changed');const n=parseInt(hex,16),start=comma+1;need(id&&Number.isSafeInteger(n)&&n<=bytes.length-start,'Flight text truncated');const value=decode(bytes.subarray(start,start+n));add(id,{kind:'text',value,raw:value});offset=start+n;continue}
  const newline=bytes.indexOf(10,offset),end=newline<0?bytes.length:newline,raw=decode(bytes.subarray(offset,end));offset=end+1;if(!id)continue
  if(raw==='X'||raw==='C'){controls.push({id,raw});continue}
  if(raw.startsWith('I')){add(id,{kind:'import',value:data(raw.slice(1)),raw});continue}
  need(/^[\[\{"n]/.test(raw),'unsupported/error Flight record');add(id,{kind:'model',value:data(raw),raw})
 }
 return{records,controls}
}
export function readCurrentAngelPanel(html){
 const doc=readNativeDocument(html),titles=doc.nodes(n=>n.tag==='title'),canonical=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 need(titles.length===1&&/Angel One Careers.*Leading Fintech Company/i.test(decodeNativeEntities(titles[0].raw))&&canonical.length===1&&canonical[0].attrs.href===URL,'employer canonical/title binding changed')
 need(doc.nodes(n=>n.tag==='section'&&n.attrs.id==='open-positions').length===1,'rendered open positions panel missing')
 const scripts=doc.nodes(n=>n.tag==='script'&&!n.attrs.src&&n.raw?.trim().startsWith('self.__next_f.push')),frames=[]
 for(const script of scripts){const type=script.attrs.type??''
  if(type&&!/^(?:text|application)\/javascript$/.test(type)){const m=type.match(/^([a-f\d]{8,64}-)text\/javascript$/i);need(m&&doc.nodes(n=>n.tag==='script'&&n.attrs.src==='/cdn-cgi/scripts/7d0fa10a/cloudflare-static/rocket-loader.min.js'&&n.attrs['data-cf-settings']?.startsWith(m[1]+'|')).length===1,'published Flight script binding changed')}
  const program=parseBoundedProgram(script.raw);need(program.body.length===1,'ambiguous Flight frame program');const e=program.body[0].expression,c=e?.callee,a=e?.arguments?.[0]
  need(e?.type==='CallExpression'&&!e.optional&&c?.type==='MemberExpression'&&!c.computed&&c.property.name==='push'&&c.object.type==='MemberExpression'&&!c.object.computed&&c.object.object.name==='self'&&c.object.property.name==='__next_f'&&e.arguments.length===1&&a?.type==='ArrayExpression'&&a.elements.length===2&&a.elements[0]?.value===1&&typeof a.elements[1]?.value==='string','Flight frame must be literal published data');frames.push(a.elements[1].value)
 }
 need(frames.length===1,'missing or ambiguous Flight source frames');const {records,controls}=flightRows(frames[0]),route=records.get('0')?.value
 need(route&&JSON.stringify(route.c)==='["","careers"]'&&route.q==='','unfiltered native careers route binding changed')
 const visited=new Set(),panels=[]
 const visit=value=>{
  if(typeof value==='string'){const ref=value.match(/^\$(?:L|Q)?([a-f\d]+)$/i);if(ref&&!visited.has(ref[1])){visited.add(ref[1]);const row=records.get(ref[1]);if(row?.kind==='model')visit(row.value)}return}
  if(!value||typeof value!=='object')return
  if(Array.isArray(value)&&value[0]==='$'&&typeof value[1]==='string'&&value[1].startsWith('$L')&&Object.hasOwn(value[3]??{},'jobs')){const row=records.get(value[1].slice(2));need(row?.kind==='import'&&Array.isArray(row.value),'jobs renderer import missing');if(row.value[0]===MODULE)panels.push({props:value[3],dependency:row.value})}
  for(const child of Object.values(value))visit(child)
 }
 visit(route.t);need(panels.length===1,'route-owned native jobs renderer missing or ambiguous');const {props,dependency}=panels[0]
 need(Array.isArray(props.jobs)&&props.department==='','unfiltered native jobs payload changed')
 const seen=new Set();for(const row of props.jobs){need(row&&['string','number'].includes(typeof row.job_id)&&String(row.job_id).trim()&&!seen.has(String(row.job_id))&&typeof row.slug==='string'&&/^[a-z\d-]+$/.test(row.slug)&&typeof row.title==='string'&&row.title.trim(),'native role identity malformed');seen.add(String(row.job_id))}
 need(Array.isArray(dependency[1])&&dependency[2]==='default','native renderer dependency changed');const assets=dependency[1].filter((_,i)=>i%2===1).map(v=>typeof v==='string'&&v.startsWith('$')?records.get(v.slice(1))?.value:v).filter(v=>typeof v==='string'&&/^static\/chunks\/app\/\(organic\)\/careers\/page-[a-f\d]+\.js$/.test(v))
 need(assets.length===1,'native careers renderer asset missing or ambiguous')
 return{nativeRoles:props.jobs,assetUrl:ORIGIN+'/_next/'+assets[0],controls,route:route.c,department:props.department}
}
function verifyRenderer(script){const modules=[];walk(parseBoundedProgram(script),n=>{if(n.type==='Property'&&(n.key?.value===MODULE||n.key?.name===String(MODULE)))modules.push(n.value)});need(modules.length===1&&sha(shape(modules[0]))===REVIEWED,'native renderer program changed');return{rendererModuleId:MODULE,clientPaginationPageSize:10,rendererProgramSHA256:REVIEWED,arrayCompleteForClient:true,completionScope:'configured-public-UI-input-array-only',upstreamInventoryVerified:false}}
export function createCurrentAngelScraper(defaults={}){
 const collect=async(options={})=>{const o={...defaults,...options};need(!o.fetchText&&!o.fetchPage,'observed status/final URL fetchImpl required');const allowed=new Set([URL]),reader=createSurfaceReader('angelone',o,url=>allowed.has(url))
  const snapshot=async()=>{const response=await reader.read(URL),panel=readCurrentAngelPanel(response.body);allowed.add(panel.assetUrl);return panel}
  try{const opening=await snapshot(),renderer=verifyRenderer((await reader.read(opening.assetUrl)).body),closing=await snapshot();verifyRenderer((await reader.read(closing.assetUrl)).body);const final=await snapshot(),closingStable=JSON.stringify(opening)===JSON.stringify(closing)&&JSON.stringify(closing)===JSON.stringify(final),jobs=[],heldRoles=opening.nativeRoles.map(native=>({jobId:String(native.job_id),nativeListing:native,reason:'no-current-public-detail-country-or-complete-criteria-contract-to-verify'}))
   const configuredPanelComplete=closingStable&&opening.nativeRoles.length===0
   const panelEvidence={...renderer,observedNativeTotal:opening.nativeRoles.length,closingStable,configuredPanelComplete},inventoryEvidence={status:configuredPanelComplete?'verified-empty':'coverage-gap',surface:URL,firstParty:true,listingComplete:configuredPanelComplete,pagesFetched:reader.responses.length,reportedTotal:configuredPanelComplete?0:null,indiaFacetCount:configuredPanelComplete?0:null,verifiedAt:new Date().toISOString(),reason:configuredPanelComplete?'angelone-current-unfiltered-route-bound-configured-public-panel-complete-empty;whole-company-totals-and-cleanup-unverified':'angelone-current-native-panel-detail-country-or-closing-scope-unverified'+(!closingStable?';closing-native-array-changed':'')}
   attachInventoryEvidence(jobs,inventoryEvidence);attachSourceObservationEvidence(jobs,{source:'angelone',recordKind:'vacancy-rows',observedRecordCount:opening.nativeRoles.length,observedVacancyCount:opening.nativeRoles.length,sourceScopeComplete:false});const result={jobs,nativeRoles:opening.nativeRoles,closingNativeRoles:closing.nativeRoles,finalNativeRoles:final.nativeRoles,heldRoles,panelEvidence,closingStable,inventoryEvidence,responses:reader.responses,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false};if(o.onAudit)await reader.wait(()=>o.onAudit(result));return result
  }finally{reader.dispose()}
 }
 return{collect,run:async o=>(await collect(o)).jobs}
}
