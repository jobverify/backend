import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {document as rawDocument} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {failure} from './runtime20261108.js'
export const PRIMARY='https://www.hiddenbrains.com/careers.html',SOURCE='hiddenbrainsinfotech',COMPANY='Hidden Brains InfoTech'
export const need=(ok,message)=>{if(!ok)throw failure('Hidden Brains native: '+message,'HIDDEN_BRAINS_NATIVE_PROOF')}
const norm=v=>decodeNativeEntities(v??'').replace(/\s+/g,' ').trim(),children=n=>n.children.filter(v=>typeof v==='object'),all=(n,p)=>[...(p(n)?[n]:[]),...children(n).flatMap(c=>all(c,p))]
const text=n=>['script','style','template','noscript'].includes(n.tag)?'':norm(n.raw??n.children.map(v=>typeof v==='string'?v:text(v)).join(' ')),script=n=>n.raw??n.children.filter(v=>typeof v==='string').join(''),prefix=(n,v)=>(n.attrs.class||'').split(/\s+/).some(c=>c.startsWith('JobPostView_'+v+'__')),one=v=>v.length===1?v[0]:null
const json=raw=>{readLiteralModel(raw);return JSON.parse(raw)},diagnostic=e=>({name:e.name,message:e.message}),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
function flight(frames){
 const chunks=[],diagnostics=[],records=[],lookup=new Map(),ambiguous=new Set()
 for(const [index,frame]of frames.entries())try{const m=frame.raw.trim().match(/^self\.__next_f\.push\(([\s\S]*)\);?$/);need(m,'malformed declared Flight frame');const value=json(m[1]);need(Array.isArray(value),'Flight frame is not a literal array');need(value[0]===1,'unsupported Flight frame control');need(value.length===2&&typeof value[1]==='string','malformed Flight text frame');chunks.push(value[1])}catch(e){diagnostics.push({stage:'frame',index,...diagnostic(e)})}
 const bytes=Buffer.from(chunks.join(''),'utf8');need(bytes.length<=10485760,'Flight literal exceeds bounded parser size');let offset=0
 const decode=raw=>new TextDecoder('utf8',{fatal:true}).decode(raw)
 while(offset<bytes.length){
  if(bytes[offset]===10){offset++;continue}
  let id,record
  try{
   const colon=bytes.indexOf(58,offset);need(colon>=0,'incomplete Flight header');id=decode(bytes.subarray(offset,colon));need(/^[0-9a-f]*$/i.test(id),'invalid Flight record identity');offset=colon+1
   if(bytes[offset]===84){const comma=bytes.indexOf(44,offset),hex=comma<0?'':decode(bytes.subarray(offset+1,comma));need(id&&/^[0-9a-f]+$/i.test(hex),'invalid Flight text length');const length=Number.parseInt(hex,16),start=comma+1;need(Number.isSafeInteger(length)&&length<=bytes.length-start,'truncated Flight text');const value=decode(bytes.subarray(start,start+length));record={id,kind:'text',value,raw:value};offset=start+length}
   else{let end=bytes.indexOf(10,offset);if(end<0)end=bytes.length;const raw=decode(bytes.subarray(offset,end));record={id,kind:'model',raw};offset=end+1;try{if(/^[\[{"]/.test(raw))record.value=json(raw);else if(raw==='null')json(raw);else if(/^(?:HL|I)\[/.test(raw)){const at=raw.startsWith('HL')?2:1;need(Array.isArray(json(raw.slice(at))),'unsupported Flight module/resource payload')}else need(false,'unsupported Flight record control')}catch(e){record.parseFailure=diagnostic(e);diagnostics.push({stage:'record',id,...record.parseFailure})}}
  }catch(e){diagnostics.push({stage:'stream',offset,...diagnostic(e)});break}
  if(!id)continue
  if(lookup.has(id)){if(!same(lookup.get(id),record)){ambiguous.add(id);diagnostics.push({stage:'duplicate-record',id});records.push(record)}}else{lookup.set(id,record);records.push(record)}
 }
 const resolve=value=>{const chain=[],seen=new Set();while(typeof value==='string'&&/^\$[0-9a-f]+$/i.test(value)){const id=value.slice(1),r=lookup.get(id);need(r&&!seen.has(id)&&!ambiguous.has(id)&&!r.parseFailure,'missing, cyclic or ambiguous Flight reference '+id);seen.add(id);chain.push(r);value=r.value;if(r.kind==='text')break}return {value,chain}}
 return {records,resolve,diagnostics}
}
const keys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...names].sort().join(',')
const roleKeys=['job_title','job_description','job_experience','job_type','no_of_openings','href']
const unhidden=n=>({...n,inert:false,children:n.children.map(v=>typeof v==='string'?v:unhidden(v))})
export const keyFor=(model,index=model.ordinal)=>PRIMARY+'::title='+encodeURIComponent(model.title??'unqualified')+'::observation='+index
export function parsePage(html,onRecord,onPage){
 const raw=rawDocument(html),nodes=all(raw.root,()=>true),issues=[],frames=nodes.filter(n=>n.tag==='script'&&script(n).trim().startsWith('self.__next_f.push(')).map(n=>({attrs:{...n.attrs},raw:script(n),nativeHTML:raw.outer(n)}))
 const head={titles:nodes.filter(n=>n.tag==='title').map(text),canonicals:nodes.filter(n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical')).map(n=>n.attrs.href??null),metas:nodes.filter(n=>n.tag==='meta').map(n=>({...n.attrs})),schemas:nodes.filter(n=>n.tag==='script'&&(n.attrs.type||'').split(';')[0].trim().toLowerCase()==='application/ld+json').map(n=>{const v={attrs:{...n.attrs},raw:script(n)};try{v.parsed=json(v.raw)}catch(e){v.parseFailure=diagnostic(e);issues.push({stage:'schema',...v.parseFailure})}return v})}
 const page={sourcePage:PRIMARY,head,frames,flightRecords:[],nativeCategoryScope:null,displayCards:[],records:[],observedRoleCount:0,displayCardOccurrences:0,desktopCardOccurrences:0,mobileCardOccurrences:0,companyGlobalTotal:null,companyIndiaTotal:null},qualifications=[];onPage?.(page)
 let visible;try{readNativeDocument(html);visible=readVisibleNativeDocument(html,{strict:true})}catch(e){issues.push({stage:'document',...diagnostic(e)})}
 const knownDisplayNodes=nodes.filter(n=>prefix(n,'inner-box')),parentMap=new Map();for(const n of nodes)for(const c of children(n))parentMap.set(c,n)
 const within=(node,ancestor)=>{for(let n=node;n;n=parentMap.get(n))if(n===ancestor)return true;return false},unreviewedDisplayNodes=new Set()
 for(const title of nodes.filter(n=>prefix(n,'inner-title')&&!knownDisplayNodes.some(c=>within(n,c))))for(let n=parentMap.get(title);n&&n!==raw.root;n=parentMap.get(n))if(all(n,c=>prefix(c,'openings-text')).length&&all(n,c=>c.tag==='a'&&(prefix(c,'apply-now-btn')||prefix(c,'apply-now-btn-mobile'))).length){unreviewedDisplayNodes.add(n);break}
 const displayNodes=nodes.filter(n=>knownDisplayNodes.includes(n)||unreviewedDisplayNodes.has(n))
 for(const block of displayNodes){
  const titleNode=one(all(block,n=>prefix(n,'inner-title'))),title=titleNode?norm(titleNode.children.filter(n=>typeof n==='string'||!prefix(n,'sub-title')).map(n=>typeof n==='string'?n:text(n)).join(' ')):null,openingNode=one(all(block,n=>prefix(n,'openings-text'))),opening=openingNode?text(openingNode).match(/^(\d+) Openings?$/i):null,lists=all(block,n=>n.tag==='ul'),items=lists.length===1?all(lists[0],n=>n.tag==='li'):[],apply=one(all(block,n=>n.tag==='a'&&(prefix(n,'apply-now-btn')||prefix(n,'apply-now-btn-mobile')))),details=all(block,n=>n.tag==='a'&&prefix(n,'view-details-link'))
  const control=n=>({attrs:{...n.attrs},text:text(n),nativeHTML:raw.outer(n)}),card={tag:block.tag,attrs:{...block.attrs},nativeHTML:raw.outer(block),text:text(block),title,openingsCount:opening?Number(opening[1]):null,experienceRequired:items[0]?text(items[0]).replace(/\s*Experience$/i,''):null,employmentType:items[1]?text(items[1]):null,applicationControl:apply?control(apply):null,detailControls:details.map(control),presentation:apply&&prefix(apply,'apply-now-btn-mobile')?'mobile':'desktop'}
  page.displayCards.push(card)
  const expectedText=norm([titleNode?text(titleNode):'',openingNode?text(openingNode):'',...items.map(text),...details.map(text),apply?text(apply):''].join(' ')),knownTags=new Set(['div','span','ul','li','a','svg','path'])
  if(!knownDisplayNodes.includes(block)||all(block,n=>!knownTags.has(n.tag)).length||card.text!==expectedText||block.inactive||!title||!opening||items.length!==2||!apply||apply.attrs.href!=='#InquiryJob'||apply.attrs['aria-disabled']==='true'||!/^APPLY NOW!$/i.test(text(apply))||details.length>1||details.some(n=>n.attrs.href!=='#')||all(titleNode??block,n=>prefix(n,'sub-title')).some(n=>!['','-'].includes(text(n))))issues.push({stage:'display-card',title,reason:'unreviewed-native-card'})
 }
 page.displayCardOccurrences=page.displayCards.length;page.desktopCardOccurrences=page.displayCards.filter(n=>n.presentation==='desktop').length;page.mobileCardOccurrences=page.displayCards.filter(n=>n.presentation==='mobile').length
 let parsed;try{parsed=flight(frames)}catch(e){issues.push({stage:'flight',...diagnostic(e)});page.parseIssues=issues;need(false,'native Flight unavailable;original page evidence retained')}
 page.flightRecords=parsed.records;issues.push(...parsed.diagnostics)
 if(nodes.filter(n=>n.tag==='script'&&script(n).trim().startsWith('self.__next_f.push(')).some(n=>n.inactive))issues.push({stage:'frame',reason:'inactive-native-Flight-carrier'})
 const scopes=[],walk=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v)&&v[0]==='$'&&typeof v[1]==='string'&&/^\$L[0-9a-f]+$/i.test(v[1])&&Array.isArray(v[3]?.categories))scopes.push(v[3]);for(const child of Object.values(v))walk(child)};for(const r of parsed.records)if(r.kind==='model'&&r.value!==undefined)walk(r.value)
 page.nativeCategoryScope=scopes[0]??null;if(scopes.length!==1)issues.push({stage:'scope',reason:'missing-or-ambiguous-category-component',count:scopes.length});if(scopes.length>1)page.nativeCategoryScopes=scopes
 const visibleText=body=>{const v=readVisibleNativeDocument(body,{strict:true}),root=one(v.nodes(n=>n.tag==='root'));return root?v.text(root):null}
 for(const scope of scopes){
  const categories=scope.categories,main=categories.filter(c=>c?.categoryName==='ALL POSITIONS'&&Array.isArray(c.jobs))
  if(!keys(scope,['categories'])||new Set(categories.map(c=>c?.categoryName)).size!==categories.length||main.length!==1||!categories.every(c=>keys(c,['categoryName','count','jobs'])&&typeof c.categoryName==='string'&&Number.isSafeInteger(c.count)&&Array.isArray(c.jobs)&&c.count===c.jobs.length))issues.push({stage:'categories',reason:'unreviewed-category-schema-count-or-identity'})
  const canonical=v=>JSON.stringify(v,(_k,n)=>n&&typeof n==='object'&&!Array.isArray(n)?Object.fromEntries(Object.keys(n).sort().map(k=>[k,n[k]])):n)
  const signature=item=>{const role=parsed.resolve(item).value;need(role&&typeof role==='object'&&!Array.isArray(role),'native role is not object');return canonical({...role,job_description:parsed.resolve(role.job_description).value})}
  const work=main.flatMap(group=>group.jobs.map(item=>({item,categoryName:'ALL POSITIONS'}))),mainSignatures=new Set(),extraSignatures=new Set()
  for(const item of work)try{mainSignatures.add(signature(item.item))}catch{}
  for(const category of categories)if(category?.categoryName!=='ALL POSITIONS'&&Array.isArray(category?.jobs))for(const [ordinal,item]of category.jobs.entries()){
   let key;try{key=signature(item)}catch{key=canonical({categoryName:category.categoryName,ordinal,unresolvedNativeRole:item})}
   if(!mainSignatures.has(key)&&!extraSignatures.has(key)){extraSignatures.add(key);work.push({item,categoryName:category.categoryName});issues.push({stage:'inventory',reason:'category-role-declaration-unreconciled-with-main-inventory',categoryName:category.categoryName,ordinal})}
  }
  for(const {item,categoryName}of work){
   let role,description=null,chain=[],criteria=null;const local=[]
   try{role=parsed.resolve(item).value;need(role&&typeof role==='object'&&!Array.isArray(role),'native role model is not object')}catch(e){local.push({stage:'role',...diagnostic(e)});role={unresolvedNativeRole:item}}
   try{const resolved=parsed.resolve(role.job_description);description=resolved.value;chain=resolved.chain;need(typeof description==='string','native description is not text');criteria=text(rawDocument(description).root)}catch(e){local.push({stage:'description',...diagnostic(e)});if(typeof description!=='string')description=null}
   if(!roleKeys.every(k=>typeof role[k]==='string'))local.push({stage:'role-scalars',reason:'unreviewed-native-role-scalar-types'})
   const title=typeof role.job_title==='string'?role.job_title:null,members=[],matching=page.displayCards.filter(c=>c.title===title)
   for(const category of categories)for(const [ordinal,member]of(Array.isArray(category?.jobs)?category.jobs:[]).entries())try{const resolved=parsed.resolve(member).value;if(resolved?.job_title===title){members.push({categoryName:category.categoryName,ordinal,rawNativeRole:structuredClone(resolved)});const body=parsed.resolve(resolved.job_description).value;if(!same(Object.fromEntries(Object.entries(resolved).filter(([k])=>k!=='job_description')),Object.fromEntries(Object.entries(role).filter(([k])=>k!=='job_description')))||body!==description)local.push({stage:'category-role',reason:'conflicting-native-role-across-categories'})}}catch(e){local.push({stage:'category-role',...diagnostic(e)})}
   const model={sourcePage:PRIMARY,categoryName,ordinal:page.records.length,title,rawNativeRole:structuredClone(role),descriptionReference:role.job_description??null,descriptionRecords:structuredClone(chain),nativeDescriptionHTML:description,fullCriteriaText:criteria,displayCards:structuredClone(matching),categoryMemberships:members,head:structuredClone(head),primaryWorkplace:null,primaryCountry:null,formalPostingID:null,formalRequisitionID:null,workplaceMode:null,postingDate:null,closingDate:null,descriptionCarrierKind:'declared-React-Flight-role-description;interactive-rendering-unproved'}
   if(local.length)model.parseIssues=local
   let complete=Boolean(criteria&&criteria.length>=100);try{complete&&=visibleText(description)===criteria;const active=readNativeDocument(description),root=one(active.nodes(n=>n.tag==='root'));complete&&=Boolean(root)&&active.text(unhidden(root))===criteria}catch{complete=false}
   const experience=typeof role.job_experience==='string'?role.job_experience.match(/^exp_(\d+)(?:_(\d+))?_years?$/):null,nativeExperience=experience?[experience[1],experience[2]].filter(v=>v!=null).join('-'):null
   const matched=matching.length>0&&matching.every(c=>c.openingsCount===Number(role.no_of_openings)&&c.experienceRequired?.toLowerCase().replace(/years?/g,'').replace(/[^\d-]/g,'')===nativeExperience&&c.employmentType?.replace(/[ _-]/g,'').toLowerCase()===(typeof role.job_type==='string'?role.job_type.replace(/[ _-]/g,'').toLowerCase():null))
   const qualification={contractQualified:Boolean(!issues.length&&!local.length&&keys(role,roleKeys)&&title&&experience&&/^[1-9]\d*$/.test(role.no_of_openings)&&role.href==='#'&&matched),authoredCriteriaComplete:complete,visibilityQualified:false,visibilityReason:'native-criteria-declared-in-React-Flight;interactive-description-rendering-not-executed'}
   page.records.push(model);qualifications.push(qualification);page.observedRoleCount=page.records.length;onRecord?.(model,qualification)
  }
 }
 const titleSet=new Set(page.records.map(v=>v.title)),schemaTypes=head.schemas.map(v=>v.parsed?.['@type']),metadataKnown=head.schemas.length===3&&schemaTypes.every(v=>['BreadcrumbList','Organization','LocalBusiness'].includes(v))&&new Set(schemaTypes).size===3&&!head.metas.some(v=>/dateposted|validthrough|expir/i.test(v.name||v.property||''))
 if(page.displayCards.some(c=>!titleSet.has(c.title))||page.records.length!==titleSet.size)issues.push({stage:'inventory',reason:'duplicate-or-unreconciled-display-and-declared-native-identities'})
 const visibleCards=visible?.nodes(n=>prefix(n,'inner-box'))??[];if(visibleCards.length!==displayNodes.length)issues.push({stage:'display-card',reason:'hidden-or-discrepant-display-carriers'})
 if(issues.length)page.parseIssues=issues
 need(head.titles.length===1&&head.titles[0]==='Careers at Hidden Brains | Taking your Career to New Heights'&&head.canonicals.length===1&&head.canonicals[0]===PRIMARY,'publisher title or canonical conflict;all available models retained')
 need(!nodes.some(n=>n.tag==='base'),'unreviewed publisher base URI');need(nodes.some(n=>n.tag==='a'&&!n.inactive&&typeof n.attrs.href==='string'&&n.attrs.href.trim()&&new URL(n.attrs.href,PRIMARY).href===PRIMARY),'active publisher careers self-link missing')
 need(page.records.length>0,'unproved empty native role inventory');need(qualifications.every(q=>q.authoredCriteriaComplete)&&page.records.every(v=>!v.parseIssues),'missing or hidden native description/identity;complete available models retained')
 need(!issues.length,'unusable native page or category contract;all available models and originals retained')
 return {...page,qualifications:qualifications.map(q=>({...q,contractQualified:q.contractQualified&&metadataKnown}))}
}
export function rowFor(model,q={},index=model.ordinal){
 const card=model.displayCards[0],native=model.rawNativeRole
 return {source:SOURCE,company:COMPANY,title:model.title,jobId:null,requisitionId:null,nativeObservationKey:keyFor(model,index),nativeObservationKeyKind:'publisher-page-title-and-observation-ordinal;formal-identifiers-unstated',sourceUrl:PRIMARY,detailUrl:PRIMARY,applyUrl:PRIMARY+'#InquiryJob',link:PRIMARY,applicationLinkIsRolePage:true,location:null,city:null,state:null,country:null,department:null,employmentType:native.job_type??null,experienceRequired:card?.experienceRequired??null,minimumQualification:null,preferredQualification:null,requiredSkills:[],postingDate:null,closingDate:null,remoteStatus:null,sourceRemoteStatusUnresolved:true,jobDescription:model.fullCriteriaText,sourceDescription:model.fullCriteriaText,sourceNativeRecord:structuredClone(model),sourceNativeClosingRecord:null,sourceNativeOwnDescriptionHTML:model.nativeDescriptionHTML,sourceNativeClosingOwnDescriptionHTML:null,sourceNativeCriteriaComplete:q.authoredCriteriaComplete??false,sourceNativeCriteriaVisibilityQualified:false,sourceNativeCriteriaVisibilityReason:q.visibilityReason??null,sourceNativeContractQualified:q.contractQualified??false,sourceNativePairQualified:false,sourceNativeAdvertisementPairObserved:false,sourceNativeCurrentPublicationQualified:false,sourceCurrentNativeRoleQualified:false,sourceDetailComplete:false,sourceCountryScopeUnresolved:true,sourceNativeCountryEvidence:{primaryWorkplace:null,primaryCountry:null,titleCountryInferenceUsed:false,corporateOfficeCountryUsed:false},sourceNativeFormalIDKindKnown:false,sourceNativePublicationDateKnown:false,sourceNativeActiveHiringVerified:false,activeApplyVerified:false,applicationVisited:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyCareerPage:PRIMARY,companyDomain:'hiddenbrains.com',atsPlatform:'official-nextjs-careers-page'}
}
