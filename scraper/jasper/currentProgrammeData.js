import {isDeepStrictEqual,types,MIMEType} from 'node:util'
import {decodeHTML} from 'entities'
import {readNativeDocument,readNativeAttributeTokens} from '../../scraper-support/utils/activeNativeHtml.js'
import {SOURCE,CORPORATE,BOARD,API,UUID,need,shape,sha,copyData,originalJSON,readResponse,initialPolicy,
 active,readNativeHtml,ownData,freezeData} from './currentProgrammeRenderer.js'

const apiKeys='id title department team employmentType location secondaryLocations publishedAt isListed isRemote workplaceType address jobUrl applyUrl descriptionHtml descriptionPlain'.split(' ')
const postingKeys='id title departmentName departmentExternalName locationName locationAddress workplaceType employmentType descriptionHtml isListed isConfidential teamNames secondaryLocationNames compensationTierSummary compensationTiers applicationDeadline compensationTierGuideUrl scrapeableCompensationSalarySummary compensationPhilosophyHtml applicationLimitCalloutHtml shouldAskForTextingConsent shouldAskForWhatsAppConsent candidateTextingPrivacyPolicyUrl candidateTextingTermsAndConditionsUrl legalEntityNameForTextingConsent automatedProcessingLegalNotice __typename'.split(' ')
const briefKeys='id title teamId locationId locationName workplaceType employmentType secondaryLocations compensationTierSummary __typename'.split(' ')
const nonempty=value=>typeof value==='string'&&value.length>0
// Only these readers can create provenance. Each private snapshot is copied
// from the original bytes/receipts and recursively frozen before publication;
// neither caller input nor public derived fields remain mutable aliases.
const publications=new WeakMap()
function publication(kind,value){const owned=freezeData(copyData(value));publications.set(owned,{kind,value:owned});return owned}
function originalPublication(value,kind){
 const saved=value&&typeof value==='object'&&!types.isProxy(value)?publications.get(value):null
 need(saved?.kind===kind,'provenance','Immutable original source reader snapshot required');return saved.value
}
const foreignFlags={currentnessQualified:false,programmeZeroQualified:false,sourceScopeComplete:false,companyGlobalScopeQualified:false,
 sourceBodiesQualified:false,rendererConsumptionQualified:false,fullRenderedCriteriaQualified:false,browserExecutionQualified:false,
 applicationVisited:false,screeningCriteriaAcquired:false,privacyPolicyVisited:false,legalSemanticsQualified:false,applicantEligibilityQualified:false,
 legalEmployerQualified:false,lifecycleCleanupAllowed:false}

// Closed source-specific authored classes, independently derived from all seven
// original complete HTML/plain/head/LD publications. The full exact APIPlain
// projection preserves its case, punctuation, numeric conditions and link text.
// IDs, inventory size and array order are deliberately absent from these keys.
// New prose or labels require review; lexical geography checks alone never
// establish that an arbitrary new work-country statement is within this class.
const reviewedContentFamilies=new Set([
 ['0bd767577f3cea63da7ea7737fc9a89db2f8f9eec6dfdd39423ebd7091731b57',5686,'Enterprise Account Manager','Customer Success','Account Management Enterprise ','Customer Success','Customer Success',['Customer Success','Account Management Enterprise '],[['Customer Success',null],['Account Management Enterprise ',null]]],
 ['047ffc2b7d0855f7b557fb2960e344566895e7841c66d35587f253967ebb4f56',6288,'Senior Director, Product Marketing','Marketing','Product Marketing','Marketing','Marketing',['Marketing','Product Marketing'],[['Marketing',null],['Product Marketing',null]]],
 ['3564414f59fdfd09927a5e172acdee076949670ab96c8af77cc69d752bc30638',6199,'Senior Product Designer ','Design','Design','Design','Design',['Design'],[['Design',null]]],
 ['f0dfde5319a320f42d40c8344542a0df6ac1ef3bea89f701f5a31ff3a5d0baf9',4978,'Director, Strategic Finance','Finance','Finance','Finance','Finance',['Finance'],[['Finance',null]]],
 ['9b5a9a988ab8653ef0e1deba53ee8e7c94ac9936545d655392002e342c15866e',5704,'Senior Accountant','Finance','Accounting','Finance','Finance',['Finance','Accounting'],[['Finance',null],['Accounting',null]]],
 ['52b04353c94f61b0c5ccec5b47ff65564b44fb8736e432823a28807dedeaf3d6',8096,'Senior Manager, Customer & Experiential Marketing','Marketing','Marketing','Marketing','Marketing',['Marketing'],[['Marketing',null]]],
 ['1b6edc2bc6bdbfcef104cd87d05727e55e4f212b296f0c8e5812e3d7f637e685',6955,'Strategic AI Outcomes Manager','Customer Success','Customer Success','Customer Success','Customer Success',['Customer Success'],[['Customer Success',null]]],
 // Full current API authored variants observed Nov21; raw criteria/pay and dates are retained unchanged.
 ["4fd0f358654e6938f57f367eeea3ba6181cab734d1370d7f3a8b8a19a6d70ac3",5674,"Enterprise Account Manager","Customer Success","Account Management Enterprise ","Customer Success","Customer Success",["Customer Success","Account Management Enterprise "],[["Customer Success",null],["Account Management Enterprise ",null]]],
 ["d5cd31b6e3d904b69b7c7bb20c9c8e8bc76d3e2b50be87ec45122970e6cbadae",6187,"Senior Product Designer ","Design","Design","Design","Design",["Design"],[["Design",null]]],
 ["ffe6937f9ef36bbdf5396b990d996a297e036005f5318da2693208d565c8642c",4966,"Director, Strategic Finance","Finance","Finance","Finance","Finance",["Finance"],[["Finance",null]]],
 ["b4f120fd3a6e6457a3b36f44d1e317a8cf432d8c3a186200fec7a745a6bd1139",5692,"Senior Accountant","Finance","Accounting","Finance","Finance",["Finance","Accounting"],[["Finance",null],["Accounting",null]]],
 ["fdae1ab45da228020af7bb9178f3359abae24c28de8fc56812bf6da6fe4272a6",8084,"Senior Manager, Customer & Experiential Marketing","Marketing","Marketing","Marketing","Marketing",["Marketing"],[["Marketing",null]]],
 ["c777962150327df0548da9d537f14d435d946d553b61ba26cf60226634c23729",6943,"Strategic AI Outcomes Manager","Customer Success","Customer Success","Customer Success","Customer Success",["Customer Success"],[["Customer Success",null]]],
 ["18a33e604a75fd6161224dc9c3f6e2ba9bfef319e6ebb4685cdff07fe1f991f5",6276,"Senior Director, Product Marketing","Marketing","Product Marketing","Marketing","Marketing",["Marketing","Product Marketing"],[["Marketing",null],["Product Marketing",null]]]
].map(value=>JSON.stringify(value)))
const reviewedTeamPaths=new Set([
 [['Finance',null]],[['Customer Success',null]],[['Customer Success',null],['Account Management Enterprise ',null]],
 [['Finance',null],['Accounting',null]],[['Marketing',null]],[['Marketing',null],['Product Marketing',null]],[['Design',null]]
].map(value=>JSON.stringify(value)))
const internalExternalPath=path=>path.map(team=>[team.name,team.externalName])

// Bind the authored employer and every hiring declaration rather than incidental
// marketing document bytes. Original HTML/attributes remain in the publication.
export function readJasperCorporate(input){
 const response=readResponse(input,'C'),securityFacts=initialPolicy(response,'C')
 const document=readNativeDocument(response.text,{excludeObjectFallback:true,sourceRanges:true}),entries=[]
 const visit=(node,ancestors)=>{entries.push({node,ancestors});for(const child of node.children)if(typeof child!=='string')visit(child,[...ancestors,node])}
 visit(document.nodes(n=>n.tag==='root')[0],[])
 const title='Careers at Jasper | Shape the future of marketing'
 const unique=(predicate,message)=>{const found=entries.filter(predicate);need(found.length===1&&active(found[0]),'corporate-programme',message);return found[0].node}
 const headTitle=unique(e=>e.node.tag==='title'&&e.ancestors.some(n=>n.tag==='head'),'Unique active Jasper corporate title unavailable')
 need(decodeHTML(headTitle.raw??'').trim()===title,'corporate-programme','Jasper corporate employer/title changed')
 const canonical=unique(e=>e.node.tag==='link'&&e.node.attrs.rel==='canonical','Unique Jasper corporate canonical unavailable')
 need(canonical.attrs.href===CORPORATE,'corporate-programme','Corporate canonical employer changed')
 for(const property of ['og:title','twitter:title']){
  const meta=unique(e=>e.node.tag==='meta'&&(e.node.attrs.property===property||e.node.attrs.name===property),'Unique corporate title metadata unavailable')
  need(meta.attrs.content===title,'corporate-programme','Corporate title metadata disagrees')
 }
 const heading=unique(e=>e.node.tag==='h1','Unique corporate careers heading unavailable')
 need(document.text(heading)==='Grow your career while shaping the future of marketing','corporate-programme','Corporate careers context changed')
 const anchors=entries.filter(e=>e.node.tag==='a'&&e.node.attrs.href===BOARD)
 need(anchors.length===2&&anchors.every(e=>active(e)&&document.text(e.node)==='Explore Open Roles'),'corporate-programme','Exact ordinary corporate Jasper hiring handoff unavailable')
 const hiringURL=/(?:ashbyhq\.com|(?:jobs|careers)\.[a-z0-9-]+\.[a-z]{2,}|greenhouse\.io|lever\.co|myworkdayjobs\.com|smartrecruiters\.com|jobvite\.com|bamboohr\.com)/i
 const hiringLabel=/\b(?:careers?|jobs?|vacanc(?:y|ies)|openings?|open\s+(?:roles?|positions?)|(?:explore|view|see|search)\s+(?:all\s+)?(?:open\s+)?(?:opportunities|roles?|positions?|jobs?)|apply\s+now|join\s+(?:us|our\s+team))\b/i
 const hiringDestination=value=>{
  if(hiringURL.test(value))return true
  if(value.startsWith('#'))return /(?:careers?|jobs?|vacanc|open[-_ ]?(?:roles|positions|opportunities))/i.test(value)
  let target;try{target=new URL(value,CORPORATE)}catch{return false}
  return ['http:','https:'].includes(target.protocol)&&/(?:^|\/)(?:careers?|jobs?|vacanc(?:y|ies)|openings?|recruit(?:ment|ing)?|open[-_ ]?(?:roles|positions|opportunities))(?:[/._-]|$)/i.test(target.pathname)
 }
 // Classification includes authored hidden labels; these cannot authorize a handoff.
 const rawLabel=node=>node.children.map(child=>typeof child==='string'?child:rawLabel(child)).join(' ')
 const structured=[]
 const roleType=value=>typeof value==='string'&&value.trim().split(/\s+/).some(type=>/(?:^|[/:#])JobPosting$/.test(type))
 const hasRole=value=>Array.isArray(value)?value.some(hasRole):value&&typeof value==='object'?(Object.entries(value).some(([key,item])=>key==='@type'?(Array.isArray(item)?item:[item]).some(roleType):hasRole(item))):false
 const jsonLdType=value=>{try{return new MIMEType(value).essence==='application/ld+json'}catch{return /^\s*application\s*\/\s*ld\+json\b/i.test(value)}}
 for(const entry of entries){
  const {node}=entry,attrs=node.attrs
  if(node.tag==='iframe')need(!Object.hasOwn(attrs,'srcdoc'),'corporate-programme','Unreviewed inline iframe content needs review')
  const raw=node.sourceStart!==undefined&&node.sourceOpenEnd!==undefined?response.text.slice(node.sourceStart,node.sourceOpenEnd):''
  const tokens=raw?readNativeAttributeTokens(raw.replace(/^<[^\s>]+/,'').replace(/>$/,'')):[]
  // All authored contexts participate, including inert nodes and every raw
  // duplicate attribute. These declarations can hold, never authorize jobs.
  need(!tokens.some(([key,value])=>['itemtype','typeof'].includes(key)&&roleType(decodeHTML(value))),'corporate-programme','Additional corporate structured role carrier needs review')
  const declaredTypes=tokens.filter(([key])=>key==='type').map(([,value])=>decodeHTML(value))
  if(node.tag==='script'&&declaredTypes.some(jsonLdType)){
   let validMime=false;try{validMime=new MIMEType(declaredTypes[0]).essence==='application/ld+json'}catch{/* Malformed carrier remains held. */}
   need(declaredTypes.length===1&&validMime&&attrs.type===declaredTypes[0],'corporate-programme','Ambiguous or malformed JSON-LD MIME declaration')
   const model=originalJSON(node.raw??'');need(!hasRole(model),'corporate-programme','Additional corporate native role schema needs review');structured.push(model)
  }
  const values=tokens.map(([,value])=>decodeHTML(value)),destination=['href','src','action','data-src'].map(key=>attrs[key]).filter(Boolean)
  const relevant=values.some(value=>hiringURL.test(value))||(['a','iframe','form','object','embed','button','input','select'].includes(node.tag)&&destination.some(hiringDestination))||(['a','button','form','iframe','object','embed'].includes(node.tag)&&hiringLabel.test(document.text(node)+' '+decodeHTML(rawLabel(node))))
  if(relevant){
   const seen=new Set();for(const[key]of tokens){need(!seen.has(key),'corporate-programme','Duplicate hiring declaration attribute');seen.add(key)}
   need(!Object.keys(attrs).some(key=>/^on/i.test(key)),'corporate-programme','Unreviewed hiring event handler')
   const self=node.tag==='a'&&['/careers',CORPORATE].includes(attrs.href)&&['Careers','Careers at Jasper'].includes(document.text(node))
   const handoff=anchors.includes(entry)&&destination.length===1
   const wrapper=entry.ancestors.at(-1),siblings=wrapper?.children.filter(child=>typeof child==='object')??[]
   const overlayButton=node.tag==='button'&&attrs.type==='button'&&!Object.hasOwn(attrs,'form')&&destination.length===0&&document.text(node)==='Explore Open Roles'
    &&siblings.length===2&&siblings.includes(node)&&anchors.some(e=>e.ancestors.at(-1)===wrapper&&siblings.includes(e.node))&&!entry.ancestors.some(n=>n.tag==='form')
   need((self||handoff||overlayButton)&&active(entry),'corporate-programme','Additional, hidden or foreign corporate hiring declaration')
  }
  if(node.tag==='script'&&hiringURL.test(node.raw??''))need(false,'corporate-programme','Additional scripted hiring declaration needs review')
 }
 need(structured.length===1,'corporate-programme','Corporate structured identity is ambiguous')
 const about=structured[0]
 need(about['@type']==='AboutPage'&&about.name===title&&about.url==='/careers'&&about.about?.['@type']==='Organization'&&about.about.name==='Jasper'&&about.about.url==='https://www.jasper.ai','corporate-programme','Corporate structured employer identity changed')
 const declarations=entries.filter(e=>['a','script','link','iframe','object','embed','form','input','select','textarea','button'].includes(e.node.tag)).map(e=>({tag:e.node.tag,attributes:e.node.attrs,
  ancestorTags:e.ancestors.map(n=>n.tag),inertAttributeFact:e.node.inert===true,originalContent:['script','iframe'].includes(e.node.tag)?e.node.raw??null:null}))
 return publication('C',{url:CORPORATE,originalHTML:response.text,originalResponse:response.originalResponse,securityFacts,declaredBoardURL:BOARD,
  ordinaryHandoffs:anchors.map(e=>({href:e.node.attrs.href,label:document.text(e.node),attributes:e.node.attrs,ancestorTags:e.ancestors.map(n=>n.tag)})),
  originalDeclarations:declarations,originalStructuredCorporateContext:structured,
  corporateContext:'Remote-first culture and corporate work-location statements are corporate context, not role/applicant eligibility.',...foreignFlags})
}

export function readJasperApi(input){
 const response=readResponse(input,'A'),securityFacts=initialPolicy(response,'A'),nativePayload=originalJSON(response.text)
 shape(nativePayload,['jobs','apiVersion'],'api-shape')
 need(nativePayload.apiVersion==='1','api-shape','Original apiVersion must be string1')
 need(Array.isArray(nativePayload.jobs)&&nativePayload.jobs.length>=1&&nativePayload.jobs.length<=10,'membership','Native inventory count outside1..10')
 const ids=new Set()
 for(const record of nativePayload.jobs){
  shape(record,apiKeys,'api-shape')
  need(UUID.test(record.id)&&!ids.has(record.id),'membership','Duplicate or invalid original API identity');ids.add(record.id)
  need(record.isListed===true&&record.employmentType==='FullTime'&&record.workplaceType==='Remote'&&record.isRemote===true,'api-shape','Unlisted or unsupported native role class')
  need([record.title,record.department,record.team,record.descriptionHtml,record.descriptionPlain].every(nonempty),'api-shape','Incomplete native primary role fields')
  need(record.jobUrl===BOARD+'/'+record.id&&record.applyUrl===record.jobUrl+'/application','identity','Exact account/own/application route disagreement')
  primaryCountry(record)
  validPostedDate(record.publishedAt)
 }
 return publication('A',{url:API,nativePayload,originalText:response.text,originalResponse:response.originalResponse,securityFacts,...foreignFlags})
}

function boardForest(board){
 shape(board,['stealthAccess','teams','jobPostings','__typename'],'membership')
 need(board.stealthAccess===false&&board.__typename==='JobBoard'&&Array.isArray(board.jobPostings)&&board.jobPostings.length>=1&&board.jobPostings.length<=10
  &&Array.isArray(board.teams)&&board.teams.length>0&&board.teams.length<=1000,'membership','Unreviewed empty/stealth/partial native board')
 const teams=new Map(),ids=new Set()
 for(const team of board.teams){
  shape(team,['id','name','externalName','parentTeamId','__typename'],'team')
  need(UUID.test(team.id)&&!teams.has(team.id)&&nonempty(team.name)&&(team.externalName===null||nonempty(team.externalName))
   &&(team.parentTeamId===null||UUID.test(team.parentTeamId))&&team.__typename==='Team','team','Invalid/duplicate native team')
  writtenGeography(team.name);if(team.externalName!==null)writtenGeography(team.externalName);teams.set(team.id,team)
 }
 for(const team of teams.values()){
  const path=teamPath(team.id,teams)
  need(reviewedTeamPaths.has(JSON.stringify(internalExternalPath(path))),'team-family','Unreviewed complete internal/external native team path')
 }
 for(const brief of board.jobPostings){
  shape(brief,briefKeys,'membership')
  need(UUID.test(brief.id)&&!ids.has(brief.id)&&teams.has(brief.teamId)&&UUID.test(brief.locationId)&&nonempty(brief.title)
   &&brief.__typename==='JobPostingBriefsWithIdsAndTeamId','membership','Incomplete or duplicate native brief');ids.add(brief.id)
  need(brief.locationName==='United States'&&brief.workplaceType==='Remote'&&brief.employmentType==='FullTime'&&Array.isArray(brief.secondaryLocations)
   &&brief.secondaryLocations.length===0&&brief.compensationTierSummary===null,'country','Unreviewed native brief location/mode/pay class')
  writtenGeography(brief.title)
 }
 return teams
}
function teamPath(id,teams){
 const path=[],seen=new Set();let next=id
 while(next!==null){need(teams.has(next)&&!seen.has(next),'team','Orphan or cyclic native team forest');seen.add(next);const team=teams.get(next);path.unshift(team);next=team.parentTeamId}
 return path
}
export function readJasperBoard(input){const native=readNativeHtml(input,'B');boardForest(native.originalAppData.jobBoard);return publication('B',{...native,...foreignFlags})}

function primaryCountry(record){
 shape(record.address,['postalAddress'],'country');shape(record.address.postalAddress,['addressRegion','addressCountry','addressLocality'],'country')
 const address=record.address.postalAddress
 need(address.addressCountry==='USA'&&address.addressLocality===''&&address.addressRegion===''&&record.location==='United States'
  &&Array.isArray(record.secondaryLocations)&&record.secondaryLocations.length===0,'country','Unreviewed typed work-country/address/secondary location class')
}
function validPostedDate(value){
 need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+00:00$/.test(value),'date','Unreviewed source timestamp/offset class')
 let exact=false
 try{exact=new Date(value).toISOString()===value.slice(0,-6)+'Z'}catch{}
 need(exact,'date','Invalid original calendar timestamp');return value.slice(0,10)
}
const countryLabels=(()=>{
 const names=new Intl.DisplayNames(['en'],{type:'region'}),values=new Set()
 for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=names.of(code);if(name!==code&&name.length>2&&name!=='United States')values.add(name)}
 return[...values]
})()
function writtenGeography(value){
 need(typeof value==='string'&&!/\p{Cf}/u.test(value)&&!/\p{Cf}/u.test(decodeHTML(value)),'geography','Unreviewed authored format controls')
 need(!/\b(?:India|Indian|Bangalore|Bengaluru|Mumbai|Hyderabad|Chennai|Pune|New Delhi|Noida|Gurugram)\b/iu.test(value),'geography','Published India or unresolved work-location signal')
 // Only these literal bounded-US strings are a reviewed location scope. They
 // are inspected in comparison-only data; every original byte stays retained.
 const inspected=value.replace(/located anywhere in the (?:continental US|US)\b/g,'located within the published US scope')
 need(!/\b(?:anywhere|worldwide|globally|any\s+(?:country|countries|location|locations)|every\s+country|all\s+countries)\b/iu.test(inspected),'geography','Unbounded or additional published work-country scope')
 for(const country of countryLabels){
  const escaped=country.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  need(!new RegExp('(?:^|[^\\p{L}])'+escaped+'(?=$|[^\\p{L}])','iu').test(inspected),'geography','Additional authored country scope is unresolved')
 }
 const explicit=/\b(?:work\s+(?:country|location)\s*[:=]|applicants?\s+must\s+be\s+(?:based|located)\s+in)\s*([^\n.]+)/gi
 for(const match of inspected.matchAll(explicit))need(['USA','United States','the US','the continental US'].includes(match[1].trim()),'geography','Unknown explicit work/applicant location condition')
}

// Jasper's actual source serializer, characterized against all seven complete
// independent HTML/plain/head pairs. No whitespace fold, NFC or token erasure.
function authored(html){
 need(typeof html==='string'&&html.length>0&&html.length<=4194304,'authored','Original primary HTML unavailable')
 need(!/\p{Cf}/u.test(html)&&!/\p{Cf}/u.test(decodeHTML(html)),'geography','Unreviewed authored format controls')
 const root={tag:'root',attrs:{},children:[]},stack=[root],inline=new Set(['strong','em','a','br'])
 let cursor=0
 while(cursor<html.length){
  if(html[cursor]!=='<'){
   const next=html.indexOf('<',cursor),end=next===-1?html.length:next,text=decodeHTML(html.slice(cursor,end))
   need(!/&(?:#\d+|#x[\da-f]+|[a-z]+);/i.test(text),'authored','Unreviewed repeated entity representation')
   stack.at(-1).children.push(text);cursor=end;continue
  }
  const end=html.indexOf('>',cursor),token=html.slice(cursor,end+1),match=/^<(\/)?([a-z][a-z0-9]*)([\s\S]*?)>$/.exec(token)
  need(end!==-1&&match,'authored','Comment, foreign or unknown authored representation')
  const closing=Boolean(match[1]),tag=match[2],attributes=match[3],parent=stack.at(-1)
  need(['p','h3','strong','ul','li','em','a','br'].includes(tag),'authored','Unreviewed authored vocabulary')
  if(closing){need(attributes===''&&parent.tag===tag&&tag!=='br','authored','Unbalanced original authored structure');stack.pop();cursor=end+1;continue}
  const raw=attributes.replace(/\/$/,''),tokens=readNativeAttributeTokens(raw),attrs={},seen=new Set()
  for(const[key,value]of tokens){need(!seen.has(key),'authored','Duplicate authored attribute');seen.add(key);attrs[key]=decodeHTML(value)}
  if(['p','ul'].includes(tag)){shape(attrs,['style'],'authored');need(attrs.style==='min-height:1.5em','authored','Unreviewed authored hiding/style model')}
  else if(tag==='a'){
   shape(attrs,['target','rel','href'],'authored');need(attrs.target==='_blank'&&attrs.rel==='noopener noreferrer nofollow'&&attrs.href==='http://legal.jasper.ai/#ccpa','authored','Unreviewed original authored link semantics')
  }else shape(attrs,[],'authored')
  need(parent.tag==='root'?['p','h3','ul'].includes(tag):parent.tag==='ul'?tag==='li':parent.tag==='li'?tag==='p':inline.has(tag),'authored','Unreviewed authored nesting')
  const node={tag,attrs,children:[]};parent.children.push(node)
  if(tag!=='br')stack.push(node)
  cursor=end+1
 }
 need(stack.length===1,'authored','Incomplete original authored structure')
 const contents=(node,mode)=>node.children.map(c=>typeof c==='string'?c:render(c,mode)).join('')
 function render(node,mode){
  if(node.tag==='br')return'\n'
  let value=contents(node,mode)
  if(node.tag==='a')value+=' '+node.attrs.href
  if(node.tag==='li'){if(value.endsWith('\n\n'))value=value.slice(0,-2);value=' - '+value.replaceAll('\n','\n   ')+'\n\n'}
  if(node.tag==='h3')return'\n'+value.toUpperCase()+'\n\n'
  if(node.tag==='p')return mode==='head'&&value.length===0?'':value+'\n\n'
  return value
 }
 const APIPlain=render(root,'api').trim(),head=render(root,'head').trim()
 need(APIPlain.length>=3000&&/WHAT YOU WILL BRING TO JASPER|What You Will Bring to Jasper|What you will bring to Jasper/.test(APIPlain)
  &&/Compensation Range|COMPENSATION RANGE/.test(APIPlain)&&/Benefits & Perks|BENEFITS & PERKS/.test(APIPlain),'criteria','Role-specific complete primary criteria sections unavailable')
 const companyParagraph='Jasper is the marketing agents platform, built to help enterprises orchestrate AI agents that execute marketing work at scale. Purpose-built for marketing teams, Jasper enables faster, more consistent execution across campaigns, personalization, localization, and compliance—while maintaining enterprise-grade control and governance.\n\nJasper is trusted by hundreds of enterprises worldwide, including Prudential, Cushman & Wakefield, and nearly 20% of the Fortune 500. Founded in 2021, Jasper has team members across the U.S., Australia, and France.'
 // Only the exact current first corporate paragraph is another reviewed company context.
 const reviewedCompanyParagraphs=[companyParagraph,companyParagraph.replace('U.S., Australia, and France.','U.S. and France.')]
 for(let i=0;i<root.children.length;i++){
  const node=root.children[i]
  if(typeof node==='string'){need(node.length===0,'authored','Unexpected inter-block authored data');continue}
  const value=render(node,'head')
  if(i===0&&node.tag==='p'&&reviewedCompanyParagraphs.some(paragraph=>value===paragraph+'\n\n'))continue
  writtenGeography(value)
 }
 return{APIPlain,head}
}

function ownDetails(native){
 const posting=native.originalAppData.posting,schema=native.originalLD
 shape(posting,postingKeys,'own-shape')
 shape(schema,'@context @type title description directApply identifier datePosted hiringOrganization jobLocation employmentType jobLocationType applicantLocationRequirements'.split(' '),'schema-shape')
 need(posting.id===native.id&&posting.__typename==='JobPostingDetails'&&posting.isListed===true&&posting.isConfidential===false,'identity','Own role identity/publication disagreement')
 shape(schema.identifier,['@type','name','value'],'identity');shape(schema.hiringOrganization,['@type','name','sameAs','logo'],'identity')
 need(schema['@context']==='https://schema.org/'&&schema['@type']==='JobPosting'&&schema.directApply===true&&schema.identifier['@type']==='PropertyValue'
  &&schema.identifier.name==='Jasper'&&schema.identifier.value===posting.id&&schema.hiringOrganization['@type']==='Organization'&&schema.hiringOrganization.name==='Jasper'
  &&schema.hiringOrganization.sameAs==='http://www.jasper.ai'&&schema.hiringOrganization.logo===native.originalAppData.organization.theme.logoSquareImageUrl,'identity','Original native employer/identifier fields disagree')
 need(nonempty(posting.title)&&schema.title===posting.title,'identity','Original own titles disagree')
 need(typeof posting.descriptionHtml==='string'&&schema.description===posting.descriptionHtml,'criteria','Full own/schema primary criteria disagree')
 const projected=authored(posting.descriptionHtml)
 need(native.headDescriptions.every(value=>value===projected.head),'criteria','Exact decoded original head/primary projection disagrees')
 shape(schema.jobLocation,['@type','address'],'country');shape(schema.jobLocation.address,['@type','addressLocality','addressRegion','addressCountry'],'country')
 shape(schema.applicantLocationRequirements,['@type','name'],'country')
 const address=schema.jobLocation.address
 need(schema.jobLocation['@type']==='Place'&&address['@type']==='PostalAddress'&&address.addressCountry==='USA'&&address.addressLocality===''&&address.addressRegion===''
  &&schema.applicantLocationRequirements['@type']==='Country'&&schema.applicantLocationRequirements.name==='USA'&&posting.locationName==='United States'
  &&posting.locationAddress===null&&Array.isArray(posting.secondaryLocationNames)&&posting.secondaryLocationNames.length===0,'country','Unreviewed typed work/applicant/secondary address class')
 need(posting.workplaceType==='Remote'&&schema.jobLocationType==='TELECOMMUTE'&&posting.employmentType==='FullTime'&&schema.employmentType==='FULL_TIME','mode','Original remote/employment model disagreement')
 for(const field of ['compensationTierSummary','applicationDeadline','compensationTierGuideUrl','scrapeableCompensationSalarySummary','compensationPhilosophyHtml','candidateTextingTermsAndConditionsUrl','automatedProcessingLegalNotice'])
  need(posting[field]===null,'supplements','Unreviewed full pay/deadline/privacy/notice model: '+field)
 need(Array.isArray(posting.compensationTiers)&&posting.compensationTiers.length===0&&posting.shouldAskForTextingConsent===true&&posting.shouldAskForWhatsAppConsent===false
  &&posting.candidateTextingPrivacyPolicyUrl==='https://legal.jasper.ai/#candidate-notice'&&posting.legalEntityNameForTextingConsent==='Jasper'
  &&typeof posting.applicationLimitCalloutHtml==='string'&&sha(posting.applicationLimitCalloutHtml)==='4c777f923f02cde558e2d00819d9ca158522dafd7ebe6e3fa5dde10743d8d46b',
 'supplements','Original full application-limit/SMS/privacy/pay conditions changed')
 for(const field of ['title','departmentName','departmentExternalName'])writtenGeography(posting[field])
 need(Array.isArray(posting.teamNames)&&posting.teamNames.length>0&&posting.teamNames.every(nonempty),'team','Original own team path unavailable')
 posting.teamNames.forEach(writtenGeography)
 need(typeof schema.datePosted==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(schema.datePosted),'date','Unreviewed original LD date-only value')
 try{need(new Date(schema.datePosted+'T00:00:00.000Z').toISOString().slice(0,10)===schema.datePosted,'date','Invalid original LD calendar')}catch(error){if(error?.code==='JASPER_PROGRAMME_HOLD')throw error;need(false,'date','Invalid original LD calendar')}
 return projected
}
export function readJasperOwn(input){const native=readNativeHtml(input,'O'),projection=ownDetails(native);return publication('O',{...native,primaryProjection:projection,...foreignFlags})}

export function reconcileJasperServerProgramme(input={}){
 shape(input,['corporate','board','api','roles'],'provenance')
 const corporate=ownData(input,'corporate','provenance'),board=ownData(input,'board','provenance'),api=ownData(input,'api','provenance'),roles=ownData(input,'roles','provenance')
 const C=originalPublication(corporate,'C'),B=originalPublication(board,'B'),A=originalPublication(api,'A')
 need(Array.isArray(roles)&&!types.isProxy(roles),'provenance','Original own publications unavailable')
 const descriptors=Object.getOwnPropertyDescriptors(roles),length=descriptors.length?.value
 need(Number.isInteger(length)&&length>=1&&length<=10&&Reflect.ownKeys(descriptors).length===length+1,'provenance','Original dense own-publication array required')
 const own=[]
 for(let i=0;i<length;i++){
  const descriptor=descriptors[i];need(descriptor&&Object.hasOwn(descriptor,'value')&&descriptor.enumerable,'provenance','Own-publication accessor is unsupported')
  own.push(originalPublication(descriptor.value,'O'))
 }
 const payload=A.nativePayload,jobBoard=B.originalAppData.jobBoard,teams=boardForest(jobBoard)
 need(own.length===payload.jobs.length&&jobBoard.jobPostings.length===payload.jobs.length,'membership','Complete B/A/own inventories differ')
 const briefs=new Map(jobBoard.jobPostings.map(b=>[b.id,b])),seen=new Set(),nativeRecords=[]
 for(let i=0;i<payload.jobs.length;i++){
  const record=payload.jobs[i],native=own[i],posting=native.originalAppData.posting,schema=native.originalLD,brief=briefs.get(record.id)
  need(brief&&native.id===record.id&&!seen.has(native.id),'membership','Own/API original order or complete ID membership disagreement');seen.add(native.id)
  need(isDeepStrictEqual(native.originalAppData.organization,B.originalAppData.organization),'identity','Own/board original organizations disagree')
  need(brief.title===record.title&&posting.title===record.title&&brief.locationName===record.location&&brief.workplaceType===record.workplaceType
   &&brief.employmentType===record.employmentType&&posting.workplaceType===record.workplaceType&&record.isRemote===true,'identity','Brief/full/API original title or publication fields disagree')
  const path=teamPath(brief.teamId,teams),names=path.map(t=>t.externalName??t.name),root=path[0],leaf=path.at(-1)
  need(record.department===(root.externalName??root.name)&&record.team===(leaf.externalName??leaf.name)&&posting.departmentName===root.name
   &&posting.departmentExternalName===(root.externalName??root.name)&&isDeepStrictEqual(posting.teamNames,names),'team','Original complete department/team path disagreement')
  need(posting.descriptionHtml===record.descriptionHtml&&schema.description===record.descriptionHtml&&native.primaryProjection.APIPlain===record.descriptionPlain,'criteria','Exact API/own/schema/plain primary criteria disagree')
  const family=[sha(record.descriptionPlain),Buffer.byteLength(record.descriptionPlain),record.title,record.department,record.team,
   posting.departmentName,posting.departmentExternalName,posting.teamNames,internalExternalPath(path)]
  need(reviewedContentFamilies.has(JSON.stringify(family)),'criteria-family','Unreviewed complete authored primary/title/department/team class')
  need(schema.datePosted===validPostedDate(record.publishedAt),'date','Original timestamp/date-only projection disagreement')
  nativeRecords.push({id:record.id,url:record.jobUrl,originalAPI:record,originalBrief:brief,originalPosting:posting,originalLD:schema,originalHead:native.originalHead,
   originalTeamPath:path,primaryWorkCountry:'USA',publishedApplicantCountry:'USA',displayLocation:'United States',originalAPIHTML:record.descriptionHtml,originalAPIPlain:record.descriptionPlain,
   originalFullHTML:posting.descriptionHtml,originalLDHTML:schema.description,originalHeadDescriptions:native.headDescriptions,originalApplicationLimitHTML:posting.applicationLimitCalloutHtml,
   originalPublishedAt:record.publishedAt,originalLDDatePosted:schema.datePosted,originalDeadline:posting.applicationDeadline,firstPublication:null,...foreignFlags})
 }
 need(C.declaredBoardURL===B.url&&A.url===API,'identity','Original corporate/native account authority disagreement')
 return freezeData(copyData({source:SOURCE,profile:'jasper-finite-server-work-country-v1',serverRecordsQualified:true,nativeVacancyCount:nativeRecords.length,nativePayload:payload,
  originalBoard:jobBoard,originalOrganization:B.originalAppData.organization,originalCorporate:C,originalBoardPublication:B,originalAPIPublication:A,originalOwnPublications:own,nativeRecords,
  originalAPIOrder:payload.jobs.map(r=>r.id),originalBoardOrder:jobBoard.jobPostings.map(r=>r.id),reportedTotal:null,
  observation:{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:nativeRecords.length,observedVacancyCount:nativeRecords.length,sourceScopeComplete:false},
  predicate:'Pure reconciliation of finite server-published work-country records only. Complete currentness/whole-body closing remains a future controller requirement.',...foreignFlags}))
}
