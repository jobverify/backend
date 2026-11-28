import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {parse} from 'acorn'
import profile from './currentNative20261128.json' with {type:'json'}
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const requireValue=(condition,reason)=>{if(!condition)throw Object.assign(Error(`Sagar current native ${reason}`),{abortRetries:true,failureKind:'parser_or_contract_error',lifecycleCleanupAllowed:false})}
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;')
const one=(values,label)=>{requireValue(values.length===1,`expected one ${label}`);return values[0]}

export const isCurrentNativeHomepage=html=>typeof html==='string'&&sha(html)===profile.homepageSHA256

// An injected reader may ignore abort. Observe its eventual settlement while
// preserving a prompt, opaque caller rejection and preventing a stale commit.
export const guardedReader=(reader,signal)=>(url)=>new Promise((resolve,reject)=>{
 if(signal?.aborted){reject(signal.reason);return}
 let settled=false
 const finish=(failed,value)=>{
  if(settled)return
  settled=true;signal?.removeEventListener('abort',abort)
  if(signal?.aborted)reject(signal.reason)
  else if(failed)reject(value)
  else resolve(value)
 }
 const abort=()=>finish(true,signal.reason)
 signal?.addEventListener('abort',abort,{once:true})
 try{signal?.throwIfAborted();Promise.resolve(reader(url,{signal})).then(value=>finish(false,value),error=>finish(true,error))}
 catch(error){finish(true,error)}
})

function expectedRegion(records){
 const cards=records.slice(0,6).map(record=>profile.cardTemplate.replace(/\{\{(department|title|description|location)\}\}/g,(_,key)=>escape(record[key]))).join('')
 const pages=Math.max(1,Math.ceil(records.length/6)),buttons=profile.paginationButtons
 const numbers=pages<=5?Array.from({length:pages},(_,i)=>i+1):[1,2,'gap',pages]
 const navigation=pages>1?profile.paginationOpen+buttons[0]+numbers.map(value=>value===1?buttons[1]:value==='gap'?'<span class="px-1 text-sm text-muted" aria-hidden="true">..</span>':buttons[2].replace('>2</button>',`>${value}</button>`)).join('')+buttons.at(-1)+'</div>':''
 const empty=records.length?'':'<p class="mt-10 text-center text-sm text-muted">No openings right now.</p>'
 return profile.gridOpen+cards+'</div>'+empty+navigation
}

function readCareer(html){
 requireValue(typeof html==='string','career body is missing')
 const document=readNativeDocument(html,{sourceRanges:true}),carriers=[],nullRegistrations=[],flight=[]
 const body=one(document.nodes(value=>value.tag==='body'),'active body')
 for(const node of document.nodes(value=>value.tag==='script'&&!value.attrs.src)){
  let ast
  try{ast=parse(node.raw||'',{ecmaVersion:'latest'})}catch{requireValue(false,'inline programme is unqualified')}
  const expression=ast.body[0]?.expression,callee=expression?.callee,array=expression?.arguments?.[0],literal=array?.elements?.[1]
  if(expression?.type!=='CallExpression'||callee?.type!=='MemberExpression'||callee.computed||callee.property.name!=='push'
   ||callee.object.type!=='MemberExpression'||callee.object.computed||callee.object.object.name!=='self'||callee.object.property.name!=='__next_f'
   ||expression.arguments.length!==1||array.type!=='ArrayExpression'||array.elements.length!==2||array.elements[0]?.value!==1||literal?.type!=='Literal'||typeof literal.value!=='string')continue
  flight.push(literal.value)
  if(literal.value==='12:null\n'){
   requireValue(ast.body.length===1&&body.children.includes(node)&&node.sourceNamespace==='html'
    &&html.slice(node.sourceStart,node.sourceEnd)===profile.nullRegistrationScript,'literal-null registration programme, attributes or ancestry changed')
   nullRegistrations.push(node)
  }
  if(literal.value.startsWith('13:')){
   requireValue(ast.body.length===1,'carrier has extra programme statements')
   carriers.push({node,literal})
  }
 }
 const {node,literal}=one(carriers,'Flight opening carrier')
 const nullRegistration=one(nullRegistrations,'literal-null registration')
 let model
 try{model=JSON.parse(literal.value.slice(3).trim())}catch{requireValue(false,'opening model is not complete literal JSON')}
 const records=model?.[3]?.children?.[3]?.openings
 requireValue(Array.isArray(records)&&records.length<=profile.limits.records,'opening array is unqualified')
 const emptyModel=structuredClone(model);emptyModel[3].children[3].openings=[]
 requireValue(JSON.stringify(emptyModel)==='["$","$14",null,{"fallback":null,"children":["$","$L15",null,{"openings":[]}]}]','opening component ancestry changed')
 const importRows=flight.join('').split('\n').filter(value=>value.startsWith('15:I'))
 requireValue(importRows.length===1&&importRows[0]==='15:I'+JSON.stringify(profile.componentImport),'native component import changed')
 const ids=new Set()
 for(const record of records){
  requireValue(plain(record)&&typeof record.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(record.id)
   &&['title','description','department','experience'].every(key=>typeof record[key]==='string'&&record[key].trim())
   &&typeof record.location==='string','record identity or complete native criteria is malformed')
  const identity=record.id.toLowerCase()
  requireValue(!ids.has(identity),'duplicate record UUID');ids.add(identity)
 }
 const section=one(document.nodes(value=>value.attrs.id==='openings'),'native openings section')
 const grid=one(document.nodes(value=>document.hasClass(value,'grid')&&document.hasClass(value,'mt-12'),section),'native preview grid')
 const paginations=document.nodes(value=>document.hasClass(value,'flex-wrap')&&document.hasClass(value,'mt-12'),section)
 const emptyMessages=document.nodes(value=>value.tag==='p'&&document.hasClass(value,'mt-10')&&document.hasClass(value,'text-center'),section)
 requireValue(paginations.length===(records.length>6?1:0)&&emptyMessages.length===(records.length?0:1),'native pagination or empty preview changed')
 const regionEnd=paginations[0]?.sourceEnd??emptyMessages[0]?.sourceEnd??grid.sourceEnd
 requireValue(html.slice(grid.sourceStart,regionEnd)===expectedRegion(records),'native full criteria preview or pagination disagrees with the opening array')
 let normalized=html
 const replacements=[
  [node.sourceOpenEnd+literal.start,node.sourceOpenEnd+literal.end,JSON.stringify('13:'+JSON.stringify(emptyModel)+'\n')],
  [grid.sourceStart,regionEnd,'$NATIVE_OPENINGS_AND_PAGINATION$'],
  [nullRegistration.sourceStart,nullRegistration.sourceEnd,''],
 ]
 for(const [start,end,value]of replacements.sort((a,b)=>b[0]-a[0]))normalized=normalized.slice(0,start)+value+normalized.slice(end)
 requireValue(sha(normalized)===profile.normalizedCareerSHA256,'career outside the native records no longer matches the finite profile')
 return {records:structuredClone(records),heldRecords:records.map(record=>({raw:structuredClone(record),reason:'native-country-publication-application-unqualified'})),DOMPreviewCount:Math.min(records.length,6),nativePageCount:Math.max(1,Math.ceil(records.length/6)),careerContractSHA256:sha(normalized),flightData:flight.join(''),careers:html}
}

export function attachHeldNativeEvidence(jobs,{opening=null,closing=null,pagesFetched=0,verifiedAt=null,legacy=null}={}){
 const observation={source:'sagardefence',recordKind:'vacancy-rows',observedRecordCount:opening?.records.length??0,observedVacancyCount:opening?.records.length??0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null}
 attachSourceObservationEvidence(jobs,observation)
 const audit={...observation,companyInventoryComplete:false,configuredBoardComplete:false,sourceListingComplete:false,sourceRenderedCriteriaComplete:false,sourceApplicationQualificationComplete:false,sourceAvailabilityVerified:false,lifecycleCleanupAllowed:false,nativeInventoryPaired:Boolean(opening&&closing),opening,closing,legacy}
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
 Object.defineProperty(jobs,'nativeInventoryEvidence',{value:audit,configurable:true})
 return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:profile.careerURL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt,
  reason:'Passive native observations only: role country, publication, browser rendering, application qualification and company-wide coverage remain unverified'})
}

export async function collectCurrentNative({readText,homepage,homepageURL,now}){
 const snapshot=async home=>{
  requireValue(isCurrentNativeHomepage(home),'homepage identity no longer matches the finite profile')
  const html=await readText(profile.careerURL),result=readCareer(html),assets=[]
  for(const asset of profile.assets){
   const body=await readText(asset.url)
   requireValue(typeof body==='string'&&Buffer.byteLength(body)===asset.bytes&&sha(body)===asset.sha256,`full programme or stylesheet changed: ${asset.url}`)
   assets.push({...asset,body})
  }
  return {...result,homepage:home,assets}
 }
 const opening=await snapshot(homepage),closing=await snapshot(await readText(homepageURL))
 const comparable=value=>{
  const result={...value}
  // Both raw bodies and stream envelopes remain above. Only the independently
  // proved exact direct-body literal-null slot may arrive in a different order;
  // the qualified outside bytes and every full native record still compare.
  delete result.careers;delete result.flightData
  return result
 }
 requireValue(isDeepStrictEqual(comparable(opening),comparable(closing)),'closing complete native records, criteria, membership or publisher changed')
 // No country/publication proof is supplied by this reviewed passive DTO shape.
 // Applicant-form defaults and a company address never qualify a vacancy.
 return attachHeldNativeEvidence([],{opening,closing,pagesFetched:32,verifiedAt:now()})
}
