import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {document,all,one,hasClass,norm,flow,snapshot,detailURL,APPLY,BRAND,need} from './currentDeclarations.js'

const labels=['Department','Designation','Open Positions','Location','Gender','Work Experience']
const tags=new Set(['root','h3','h4','h5','div','ul','ol','li','strong','b','em','i','span','p','br'])
export function readRole(html,card,context){
 const doc=document(html),root=one(doc.nodes(n=>n.tag==='root'),'role document')
 for(const n of all(root)){
  need(!n.inert&&tags.has(n.tag),'hidden, inert or unsupported native role requirements')
  need(Object.keys(n.attrs).every(k=>k==='class'),'unreviewed role placement, assets or content attributes')
 }
 const heading=one(doc.nodes(n=>n.tag==='h3'),'native role heading');need(norm(flow(heading))===card.title,'native role heading and card differ')
 const content=one(doc.nodes(n=>hasClass(n,'career-offset-content')),'whole native role content')
 const tops=root.children.filter(n=>typeof n!=='string'),empty=one(tops.filter(n=>n.tag==='div'&&hasClass(n,'career-posttop')),'native role header')
 need(tops.length===3&&tops[0]===heading&&tops[1]===empty&&tops[2]===content&&!norm(flow(empty))&&empty.children.every(c=>typeof c==='string'),'unreviewed material outside full role boundary')
 need(root.children.filter(n=>typeof n==='string').every(s=>!norm(s)),'unbound role text')
 const elements=content.children.filter(n=>typeof n!=='string'),metadataNode=elements[0]
 need(metadataNode?.tag==='ul','missing native metadata list')
 const metadata={}
 for(const li of metadataNode.children.filter(n=>typeof n!=='string')){
  need(li.tag==='li','native metadata shape changed')
  const label=one(li.children.filter(n=>typeof n!=='string'&&n.tag==='strong'),'native metadata label'),key=norm(flow(label))
  need(!Object.hasOwn(metadata,key)&&labels.includes(key),'duplicate or unreviewed native metadata field')
  need(li.children.find(n=>typeof n!=='string'||norm(n))===label,'native metadata label is not leading')
  const rest=norm(flow(li)).slice(key.length),match=rest.match(/^\s*:\s*(.+)$/)
  need(match&&norm(match[1]),'missing full native metadata value');metadata[key]=norm(match[1])
 }
 need(isDeepStrictEqual(Object.keys(metadata),labels),'incomplete native metadata')
 const opening=metadata['Open Positions'].match(/^([1-9]\d*)(?: Positions?)?(?: \(([^)]+)\))?$/)
 need(opening&&Number.isSafeInteger(Number(opening[1]))&&Number(opening[1])<=1000,'opening count unavailable, closed or malformed')
 const openPositions=Number(opening[1]),openingComponents=[]
 if(opening[2]){
  for(const value of opening[2].split(',')){const p=value.trim().match(/^([A-Za-z][A-Za-z .&/]*) - ([1-9]\d*)$/);need(p,'unknown native opening component');openingComponents.push({label:p[1],count:Number(p[2])})}
  need(new Set(openingComponents.map(p=>p.label)).size===openingComponents.length&&openingComponents.reduce((a,p)=>a+p.count,0)===openPositions,'native component opening counts disagree')
 }
 const body=elements.slice(1),headings=body.filter(n=>/^h[45]$/.test(n.tag)).map(n=>norm(flow(n)))
 need(headings.includes('Key Skills')&&headings.some(s=>/^Role(?:s)?\s*(?:&|and)?\s*Responsibilit(?:y|ies)$/i.test(s)),'native whole role requirements headings missing')
 need(body.filter(n=>['ul','ol'].includes(n.tag)).every(n=>n.children.some(c=>typeof c!=='string'&&c.tag==='li'&&/[\p{L}]/u.test(flow(c)))),'empty role requirements list')
 const criteria=norm(flow({...content,children:body})),description=norm(flow(content))
 need(criteria.length>=80&&!/\b(?:description will be available soon|placeholder description|see (?:the )?attached job description)\b/i.test(criteria),'missing full native criteria')
 const statements=body.flatMap(all).filter(n=>['p','li','div','h4','h5'].includes(n.tag)).map(n=>norm(flow(n)))
 for(const text of statements){
  need(!/\b(?:(?:this|the) (?:position|job|vacancy|role) (?:has been filled|is (?:filled|closed)|is no longer (?:available|open|accepting applications))|no longer accepting applications)(?=[\s.!?;,:]|$)/i.test(text),'explicit closed or filled native vacancy')
  const assertion=/^(?:employer|legal employer|hiring (?:company|organization|employer)|(?:(?:work(?:site|place)?|job|office|position)\s+)?(?:location|country)|mandatory work assignment)(?:\s*[:\-\u2013\u2014]|\s*$)/i.test(text)
  const placement=/\b(?:(?:this|the) (?:position|role|job|vacancy|employee|candidate)|(?:the )?(?:successful|selected) candidate|you)\s+(?:(?:is|are|will be|must be|shall be)\s+(?:based|located|employed|assigned|posted|hired|stationed|working)|(?:will|must|shall)\s+(?:work|relocate|reside|be based))\b/i.test(text)
  const employer=/\b(?:the (?:hiring |legal )?employer|hiring (?:company|organization))\s+(?:is|will be)\b/i.test(text)
  need(!assertion&&!placement&&!employer,'unreviewed native employer or assignment statement')
 }
 const qualified=['Mumbai','Seepz, Mumbai'].includes(metadata.Location)&&context.city==='Mumbai'&&context.country==='India'
 const model={jobId:card.jobId,title:card.title,metadata,openPositions,openingComponents,detailHTML:html,tree:snapshot(root),description}
 return{model,qualified,country:qualified?'India':null,city:qualified?'Mumbai':null,heldReason:qualified?null:'native-worksite-country-unresolved'}
}
export const reconcile=(a,b,label)=>need(isDeepStrictEqual(a,b),'closing whole '+label+' changed')
export function mapRole(card,open,close,context,at){
 const m=open.model
 return{source:'finacussolutions',company:'Finacus Solutions',companyName:'Finacus Solutions',officialBrandName:BRAND,title:card.title,jobId:card.jobId,requisitionId:null,canonicalRoleURL:null,
  department:m.metadata.Department,designation:m.metadata.Designation,experienceRequired:m.metadata['Work Experience'],nativeLocation:m.metadata.Location,location:m.metadata.Location,city:open.city,country:open.country,state:null,remoteStatus:null,workplaceType:null,employmentType:null,
  jobDescription:m.description,description:m.description,sourceDescription:m.detailHTML,sourceUrl:detailURL(card.jobId),jobUrl:detailURL(card.jobId),link:detailURL(card.jobId),applyUrl:APPLY,applicationUrlIsGeneric:true,applicationVisited:false,activeApplyVerified:false,
  nativeSourceRecord:{listing:card,detailHTML:m.detailHTML,metadata:m.metadata,model:m},nativeClosingRecord:{listing:card,detailHTML:close.model.detailHTML,metadata:close.model.metadata,model:close.model},nativeDocumentSHA256:createHash('sha256').update(m.detailHTML).digest('hex'),
  nativeOpenPositions:m.openPositions,nativeOpeningComponents:m.openingComponents,nativeCriteriaComplete:true,nativeDescriptionComplete:true,nativeGeographyQualified:true,nativeEmployerReconciled:true,nativeRoleClosingReconciled:true,sourceDetailComplete:true,sourceCountryScopeUnresolved:false,
  sourceWorksiteCountryProof:{kind:'own-current-explicit-city-country-relation-and-literal-role-workplace',roleWorkplace:m.metadata.Location,city:context.city,country:context.country,contextURL:context.url,contextParagraph:context.paragraph,cityDictionaryUsed:false,headquartersCountryDefaultUsed:false,exactWorksiteAddressVerified:false},
  firstEverPublication:null,postingDate:null,postedAt:null,closingDate:null,sourceScopeComplete:false,sourceListingComplete:false,companyInventoryComplete:false,lifecycleCleanupAllowed:false,sourceCapturedAt:at,scrapedAt:at}
}
