import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {parseJavaScriptLiteral} from '../../scraper-support/utils/safeLiteral.js'
import {activeHead,decodeNativeEntities,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const HOME='https://www.artizent.com/',STORY=HOME+'about/our-story',CAREERS=HOME+'insights/careers',OPENINGS=CAREERS+'/openings'
const MAIN=HOME+'assets/index-Bln9X1qC.js',LIST=HOME+'assets/JobOpenings-DvlYhWC5.js',DETAIL=HOME+'assets/JobDetail-CRWMO1hX.js',DATA=HOME+'assets/jobs-Bj5fZx4-.js'
const USER_AGENT='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const PROFILE=new Map([[MAIN,'95ab5118281c93b1ab598a35866c10807d444e076426c34ab88725315f47492f'],[LIST,'d07753bc149b028e262c6ba8b7f85b0285f5a9c480bad5848ceabb08b58334b4'],[DETAIL,'5e3706b4fb8eb12919067520f1e45f7ae6be5310b2b869500e5ea4e2728c2274']])
const need=(ok,message)=>{if(!ok)throw Error('Nous current native: '+message)}
const clean=x=>typeof x==='string'?x.replace(/\s+/g,' ').trim():''
const sha=x=>createHash('sha256').update(x).digest('hex')
const clone=x=>structuredClone(x)
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x)
const canonical=x=>Array.isArray(x)?x.map(canonical):object(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):x
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b))
const one=(rows,label)=>{need(rows.length===1,'Expected one '+label);return rows[0]}
const ownRoleURL=row=>OPENINGS+'/'+row.slug
const retainedNodes=node=>typeof node==='string'?[]:[node,...node.children.flatMap(retainedNodes)]
// These exact declarations occur on every genuine current corporate/list/detail
// response. The inline analytics body is pinned as a whole, never executed.
// runtime-config.js remains an unread external declaration; it is not one of
// the three critical client bodies reviewed and pinned in PROFILE above.
const HTML_PROGRAM_PROFILE=[
 {attributes:{},bodySHA256:'f24cb3a188ba3fb2e7d6d18ce9883bf3d7f7a6d028ded5ad456f45a4dab4a8e7'},
 {attributes:{src:'/runtime-config.js'},bodySHA256:sha('')},
 {attributes:{type:'module',crossorigin:'',src:'/assets/index-Bln9X1qC.js'},bodySHA256:sha('')},
]
const retainedAuthoredText=node=>typeof node==='string'?decodeNativeEntities(node):node.raw===undefined?node.children.map(retainedAuthoredText).join(' '):decodeNativeEntities(node.raw)
const roleAuthorityName=/country|address|employer|company|organization|organisation/i
const semanticMarkerKeys=new Set(['name','property','itemprop','itemtype'])
const presentationKeys=new Set(['id','class','style','hidden','inert','role','aria-hidden','aria-disabled','aria-selected','aria-expanded'])
const hasSemanticPayload=node=>clean(retainedAuthoredText(node))||retainedNodes(node).some(child=>Object.entries(child.attrs).some(([key,value])=>!semanticMarkerKeys.has(key)&&!presentationKeys.has(key)&&clean(value)))
function documentModel(html,url,title){
 const doc=readNativeDocument(html),visible=readVisibleNativeDocument(html,{strict:true})
 const root=one(doc.nodes(n=>n.tag==='root'),'retained document root'),nodes=retainedNodes(root),head=one(nodes.filter(n=>n.tag==='head'),'retained head')
 need(!head.inert,'Hidden or inert own head')
 need(!nodes.some(n=>n.tag==='base'),'Unreviewed base authority')
 const retainedTitles=nodes.filter(n=>n.tag==='title'),retainedCanonical=nodes.filter(n=>n.tag==='link'&&clean(n.attrs.rel).toLowerCase().split(' ').includes('canonical'))
 need(retainedTitles.length===1&&head.children.includes(retainedTitles[0])&&!retainedTitles[0].inert,'Unreviewed retained title authority')
 const canonicalLink=one(retainedCanonical,'retained canonical authority')
 need(head.children.includes(canonicalLink)&&!canonicalLink.inert&&same(canonicalLink.attrs,{rel:'canonical',href:url}),'Own retained canonical authority changed')
 const scripts=nodes.filter(n=>n.tag==='script')
 need(scripts.every(n=>head.children.includes(n)&&!n.inert)&&same(scripts.map(n=>({attributes:n.attrs,bodySHA256:sha(n.raw??'')})),HTML_PROGRAM_PROFILE),'Whole retained HTML program declarations changed')
 need(!nodes.some(n=>Object.entries(n.attrs).some(([key,value])=>/^on[a-z]/i.test(key)&&clean(value))),'Unreviewed HTML event program')
 need(!nodes.some(n=>n.tag==='meta'&&clean(n.attrs['http-equiv'])),'Unreviewed HTTP-equivalent document authority')
 need(same(activeHead(html).titles,[title]),'Own page title/brand changed')
 need(one(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical').attrs.href===url,'Own canonical authority changed')
 need(!doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&clean(n.raw)).length,'Unreviewed native structured authority/country carrier')
 const modules=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='module'&&n.attrs.src)
 need(modules.length===1&&new URL(modules[0].attrs.src,url).href===MAIN,'Own declared main client changed')
 const owner=url.startsWith(OPENINGS+'/')?n=>n.tag==='main':n=>n.attrs.id==='root'
 const main=one(visible.nodes(owner),'visible own page owner'),activeMain=one(doc.nodes(owner),'active own page owner')
 const links=doc.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string').map(n=>({url:new URL(n.attrs.href,url).href,text:doc.text(n)}))
 return {doc,visible,main,activeMain,links}
}
function literalInventory(program){
 const tree=parse(program,{ecmaVersion:'latest',sourceType:'module'})
 need(tree.body.length===2&&tree.body[0].type==='VariableDeclaration'&&tree.body[0].kind==='const'&&tree.body[0].declarations.length===1,'Whole literal inventory program changed')
 const declaration=tree.body[0].declarations[0],out=tree.body[1]
 need(declaration.id.type==='Identifier'&&declaration.id.name==='e'&&declaration.init?.type==='ArrayExpression'&&out.type==='ExportNamedDeclaration'&&out.declaration===null&&out.source===null&&out.specifiers.length===1&&out.specifiers[0].local.name==='e'&&out.specifiers[0].exported.name==='JOBS','Whole literal export contract changed')
 const keys=['slug','title','team','location','openings','type','experience','description','skills'].sort()
 for(const item of declaration.init.elements){need(item?.type==='ObjectExpression'&&item.properties.every(p=>p.type==='Property'&&p.kind==='init'&&!p.computed&&!p.method&&!p.shorthand),'Unsupported executable native record');const names=item.properties.map(p=>p.key.type==='Identifier'?p.key.name:p.key.value);need(same(names.slice().sort(),keys)&&new Set(names).size===keys.length,'Unreviewed or duplicate native criteria/country/authority carrier')}
 const rows=parseJavaScriptLiteral(program.slice(declaration.init.start,declaration.init.end))
 need(rows.length>0&&rows.length<=14&&new Set(rows.map(r=>r.slug)).size===rows.length,'Native bounded vacancy inventory changed')
 for(const row of rows){need(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)&&clean(row.title)&&clean(row.team)&&['Pune','Bangalore','Hyderabad'].includes(row.location)&&row.openings===1&&row.type==='Full time'&&/^\d{1,2} to \d{1,2} Years$/.test(row.experience),'Native vacancy identity/location/status/criteria changed');for(const k of ['description','skills'])need(Array.isArray(row[k])&&row[k].length>0&&row[k].length<=50&&row[k].every(s=>typeof s==='string'&&clean(s)),'Native full criteria array changed');need(row.description.join(' ').length>=100,'Missing substantive native criteria')}
 return clone(rows)
}
function roleModel(html,url,row){
 const d=documentModel(html,url,row.title+' | Careers | Artizent'),overview=one(d.visible.nodes(n=>n.attrs.id==='job-panel-overview'),'own overview'),headings=d.visible.nodes(n=>['h1','h2'].includes(n.tag)).map(n=>d.visible.text(n))
 need(same(headings,[row.title,'Job Description','Skills and Experience Required']),'Own complete role headings changed')
 const expected=clean('Back to Open Positions '+row.title+' ( '+row.team+' ) '+row.type+' '+row.location+' '+row.experience+' 01 Opening Overview Application Job Description '+row.description.join(' ')+' Skills and Experience Required '+row.skills.join(' '))
 need(d.visible.text(d.main)===expected&&d.doc.text(d.activeMain)===expected,'Own full visible vacancy/mandatory criteria contradicted or omitted')
 // The pinned detail renderer authors an animated duplicate back-link label
 // and one aria-hidden bullet per native criterion. Match those exact native
 // strings in place; no hidden ordinary text or general subtree is discarded.
 const retainedExpected=clean('Back to Open Positions Back to Open Positions '+row.title+' ( '+row.team+' ) '+row.type+' '+row.location+' '+row.experience+' 01 Opening Overview Application Job Description '+row.description.map(s=>'• '+s).join(' ')+' Skills and Experience Required '+row.skills.map(s=>'• '+s).join(' '))
 need(clean(retainedAuthoredText(d.activeMain))===retainedExpected,'Own retained authored vacancy/mandatory criteria contradicted or omitted')
 const overviewExpected=clean('Job Description '+row.description.join(' ')+' Skills and Experience Required '+row.skills.join(' '))
 need(d.visible.text(overview)===overviewExpected,'Own full overview criteria changed')
 need(d.links.some(l=>l.url===OPENINGS&&l.text==='Back to Open Positions'),'Missing own board return link')
 const overviewTab=one(d.visible.nodes(n=>n.attrs.id==='job-tab-overview'),'overview tab'),applyTab=one(d.visible.nodes(n=>n.attrs.id==='job-tab-application'),'application entry tab')
 need(overviewTab.attrs.role==='tab'&&overviewTab.attrs['aria-selected']==='true'&&applyTab.attrs.role==='tab'&&applyTab.attrs['aria-selected']==='false'&&applyTab.attrs['aria-controls']==='job-panel-application'&&!Object.hasOwn(applyTab.attrs,'disabled')&&d.visible.text(applyTab)==='Application','Own public role overview/application entry unavailable')
 // Inspect the whole owner tree, including inert nodes. The pinned renderer
 // cannot silently add a hidden criteria section or another country authority.
 function inspect(node){
  if(typeof node==='string')return
  need(!['script','style','template','noscript','iframe','object','embed'].includes(node.tag),'Unreviewed role-owned program or inert criteria carrier')
  for(const[key,value]of Object.entries(node.attrs)){
   need(!clean(value)||!roleAuthorityName.test(key),'Unreviewed role-owned country/employer/address carrier')
   if(semanticMarkerKeys.has(key)&&roleAuthorityName.test(value))need(!hasSemanticPayload(node),'Unreviewed nonempty semantic role-owned country/employer/address carrier')
  }
  for(const child of node.children)inspect(child)
 }
 inspect(d.activeMain)
 return {url,title:row.title,visibleMainText:expected,overviewText:overviewExpected,nativeLocationLabel:row.location,nativeDescription:clone(row.description),nativeSkills:clone(row.skills),nativeExperience:row.experience,nativeEmploymentType:row.type,nativeOpenings:row.openings,country:null,postedDate:null,workplaceMode:null,nativeStatus:null,legalHiringOrganization:null,publicOverviewAndApplicationEntryVisible:true,activeApplyVerified:false}
}

export async function runCurrentNous(options={}){
 need(options.maxJobs==null,'Read caps cannot establish native completion')
 const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),timeoutMs=options.timeoutMs??90000
 need(Number.isFinite(Date.parse(now))&&Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=90000,'Invalid bounded clock/deadline')
 const aggregate=new AbortController(),timer=setTimeout(()=>aggregate.abort(Error('Nous aggregate request deadline exceeded')),timeoutMs),signal=options.signal?AbortSignal.any([options.signal,aggregate.signal]):aggregate.signal,fetchImpl=options.fetchImpl??globalThis.fetch,receipts=[],observations=[]
 async function read(url,type='html'){
  signal.throwIfAborted();need(receipts.length<48,'Native request bound exceeded')
  const controller=new AbortController(),readTimer=setTimeout(()=>controller.abort(Error('Nous native request deadline exceeded')),15000),requestSignal=AbortSignal.any([signal,controller.signal]);let response,reader,abortListener,httpFailure,disposed=false
  const receipt={requestedURL:url,method:'GET',startedAt:new Date().toISOString()};receipts.push(receipt)
  const bounded=async operation=>{requestSignal.throwIfAborted();let listener;try{return await Promise.race([Promise.resolve().then(()=>{requestSignal.throwIfAborted();return operation()}),new Promise((_,reject)=>{listener=()=>reject(requestSignal.reason);requestSignal.addEventListener('abort',listener,{once:true})})])}finally{requestSignal.removeEventListener('abort',listener);requestSignal.throwIfAborted()}}
  const dispose=reason=>{if(!response||disposed)return;disposed=true;try{void(reader?reader.cancel(reason):response.body?.cancel(reason))?.catch(()=>{})}catch{}}
  try{
   await bounded(()=>Promise.resolve(fetchImpl(url,{method:'GET',headers:{'User-Agent':USER_AGENT,Accept:type==='html'?'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8':'application/javascript,text/javascript,text/plain;q=0.9,*/*;q=0.8'},credentials:'omit',redirect:'manual',signal:requestSignal})).then(r=>{response=r;if(requestSignal.aborted){dispose(requestSignal.reason);requestSignal.throwIfAborted()}abortListener=()=>dispose(requestSignal.reason);requestSignal.addEventListener('abort',abortListener,{once:true});return r}))
   Object.assign(receipt,{status:response.status,finalURL:response.url,contentType:response.headers.get('content-type')});if(response.status!==200){httpFailure=Error('Nous native HTTP '+response.status);httpFailure.status=response.status;httpFailure.cause={status:response.status,requestUrl:url}}
   need(response.body,'Missing native response body');reader=response.body.getReader();const chunks=[];let length=0
   for(;;){const r=await bounded(()=>reader.read());if(r.done)break;length+=r.value.byteLength;need(length<=4000000,'Native body over bound');chunks.push(Buffer.from(r.value))}
   const bytes=Buffer.concat(chunks);Object.assign(receipt,{bodyBytes:bytes.length,bodySHA256:sha(bytes),bodyBase64:bytes.toString('base64'),completedAt:new Date().toISOString()});if(httpFailure)throw httpFailure
   need(response.url===url,'Native final URL/authority changed');need((type==='html'?/^text\/html(?:\s*;|$)/i:/^(?:text|application)\/javascript(?:\s*;|$)/i).test(receipt.contentType||''),'Native representation changed');return new TextDecoder('utf-8',{fatal:true}).decode(bytes)
  }catch(error){signal.throwIfAborted();if(httpFailure&&error!==httpFailure){receipt.bodyReadComplete=false;httpFailure.responseBodyError=error;throw httpFailure}requestSignal.throwIfAborted();throw error}
  finally{clearTimeout(readTimer);requestSignal.removeEventListener('abort',abortListener);dispose(requestSignal.aborted?requestSignal.reason:undefined);try{reader?.releaseLock()}catch{};signal.throwIfAborted()}
 }
 async function authority(){
  const home=documentModel(await read(HOME),HOME,'Artizent | The Engineering Partner for Mission Critical AI');need(home.links.some(l=>l.url===STORY&&l.text==='Our Story')&&home.links.some(l=>l.url===CAREERS&&l.text==='Careers'),'Missing current corporate reciprocal identity links')
  const story=documentModel(await read(STORY),STORY,'Our Story | Artizent'),storyText=story.visible.text(story.main);need(storyText.includes('Previously Nous Infosystems')&&storyText.includes('After more than thirty years as Nous, we are taking a new name')&&story.links.some(l=>l.url===CAREERS&&l.text==='Join the team'),'Current affirmative rebrand/careers authority changed')
  const career=documentModel(await read(CAREERS),CAREERS,'Careers | Artizent');need(career.links.some(l=>l.url===STORY&&l.text==='Our Story')&&career.links.some(l=>l.url===OPENINGS&&l.text==='Find your next build'),'Missing active reciprocal career/board handoff')
  const html=await read(OPENINGS),listing=documentModel(html,OPENINGS,'Open Roles | Careers | Artizent');need(listing.links.some(l=>l.url===CAREERS&&l.text==='Back to Careers'),'Missing official board return link')
  const programs={};for(const url of [MAIN,LIST,DETAIL]){const code=await read(url,'script');need(sha(code)===PROFILE.get(url),'Whole reviewed publisher client program changed');programs[url]={SHA256:sha(code),bytes:Buffer.byteLength(code)}}
  const data=await read(DATA,'script'),rows=literalInventory(data),links=listing.links.filter(l=>l.url.startsWith(OPENINGS+'/'))
  need(links.length===rows.length&&new Set(links.map(l=>l.url)).size===rows.length&&rows.every(r=>links.some(l=>l.url===ownRoleURL(r)&&l.text.includes(r.title)&&l.text.includes(r.location))),'Whole native literal/visible listing parity changed')
  return {rows,programs,literalProgramSHA256:sha(data),literalProgramBytes:Buffer.byteLength(data),nativeListLinks:links,rebrand:{canonicalHome:HOME,officialStory:STORY,affirmativeFormerName:'Previously Nous Infosystems',affirmativeContinuity:'After more than thirty years as Nous, we are taking a new name',currentCareer:CAREERS,currentOpenings:OPENINGS,reciprocalCurrentLinksVerified:true,legacyEndpointAttempted:false,currentLegacyRedirectCertified:false,legalEmployerCertified:false}}
 }
 async function batches(rows,operation){for(let i=0;i<rows.length;i+=4){signal.throwIfAborted();const settled=await Promise.allSettled(rows.slice(i,i+4).map(operation)),failure=settled.find(r=>r.status==='rejected');if(failure)throw failure.reason}}
 try{
  const opening=await authority();for(const row of opening.rows)observations.push({id:row.slug,nativeOpeningRecord:clone(row),url:ownRoleURL(row),country:null,postedDate:null,workplaceMode:null,nativeStatus:null,legalHiringOrganization:null,activeApplyVerified:false,qualificationIssues:['native-country-unpublished'],sourceScopeComplete:false,lifecycleCleanupAllowed:false})
  await batches(observations,async o=>{const html=await read(o.url);o.ownOpeningHTML=html;o.ownOpeningModel=roleModel(html,o.url,o.nativeOpeningRecord)})
  const closing=await authority();need(same(opening,closing),'Opening/closing whole publisher identity/client/literal/listing changed')
  await batches(observations,async o=>{const row=closing.rows.find(r=>r.slug===o.id),html=await read(o.url);o.nativeClosingRecord=clone(row);o.ownClosingHTML=html;o.ownClosingModel=roleModel(html,o.url,row);need(same(o.nativeOpeningRecord,row)&&same(o.ownOpeningModel,o.ownClosingModel),'Opening/closing full native role/criteria changed')})
  signal.throwIfAborted()
  // The current finite publisher profile has no country field or role-owned
  // country grammar. Every actual raw vacancy is retained; none is promoted
  // into India from a city label. A new typed carrier requires profile review.
  const jobs=[]
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'current-affirmative-rebrand-and-whole-native-models-reconciled-country-and-company-scope-unknown'})
  const summary={source:'nousinfosystems',recordKind:'vacancy-rows',observedRecordCount:observations.length,observedVacancyCount:observations.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null};attachSourceObservationEvidence(jobs,summary)
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{...summary,observations,heldNativeRows:observations,nativeOpeningAuthority:opening,nativeClosingAuthority:closing,wholeObservedNativeBoardClosingReconciled:true,observedNativeBoardTotal:observations.length,originalResponses:receipts,unknownCountryVacancies:observations.length,companyScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaZeroProven:false,legalEmployerUnknown:true,activeApplyVerified:false,applicationInteractions:0,legacyEndpointAttempted:false,currentLegacyRedirectCertified:false,readLimits:{aggregateMs:90000,perReadMs:15000,maximumReads:48,deterministicBatchWidth:4}},configurable:true});return jobs
 }catch(error){signal.throwIfAborted();if(error&&typeof error==='object')try{Object.defineProperty(error,'recruitmentObservations',{value:{source:'nousinfosystems',receipts,observations,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null},configurable:true,enumerable:true})}catch{};throw error}finally{clearTimeout(timer)}
}
