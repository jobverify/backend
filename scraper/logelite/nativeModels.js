import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
export const SOURCE='logelite',COMPANY='Logelite',CAREERS='https://logelite.com/career/'
export const need=(ok,message)=>{if(!ok)throw Object.assign(Error('Logelite native: '+message),{code:'LOGELITE_NATIVE_CONTRACT',abortRetries:true})}
export const hash=value=>createHash('sha256').update(value).digest('hex')
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const compareText=value=>clean(value).replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,'-')
const all=(node,predicate)=>typeof node==='string'?[]:[...(predicate(node)?[node]:[]),...node.children.flatMap(child=>all(child,predicate))]
const cls=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name)
const one=(nodes,label)=>{need(nodes.length===1,'one '+label+' required');return nodes[0]}
const excluded=new Set(['script','style','template','noscript','svg'])
const text=(node,visible=false)=>typeof node==='string'?decodeHTML(node):excluded.has(node.tag)||visible&&node.inert?'':node.children.map(child=>text(child,visible)).join(' ')
const nativeText=node=>clean(text(node))
const tree=node=>typeof node==='string'?node:{tag:node.tag,attrs:structuredClone(node.attrs),children:node.children.map(tree),...(node.raw===undefined?{}:{raw:node.raw})}
const allowedURL=(value,path)=>{try{const u=new URL(value);return u.origin==='https://logelite.com'&&!u.username&&!u.password&&!u.port&&!u.hash&&path(u)}catch{return false}}
export const isRoleURL=value=>allowedURL(value,u=>!u.search&&/^\/career\/[a-z0-9-]+\/$/.test(u.pathname))
export const isPDFURL=value=>allowedURL(value,u=>!u.search&&/^\/wp-content\/uploads\/\d{4}\/\d{2}\/[A-Za-z0-9_-]+\.pdf$/.test(u.pathname))
const isApplyURL=(value,title)=>allowedURL(value,u=>u.pathname==='/job-apply/'&&[...u.searchParams.keys()].length===1&&u.searchParams.get('apply_for')===title)
const geoDeclarations=node=>all(node,n=>Object.keys(n.attrs).some(k=>/^data-(?:country|location|worksite)$/i.test(k)||k==='itemprop'&&/country|location|worksite|address/i.test(n.attrs[k]))).map(tree)
const document=html=>{
 const d=readNativeDocument(html),root=one(d.nodes(n=>n.tag==='root'),'document')
 need(!all(root,n=>n.tag==='base').length,'unreviewed native base')
 return {d,root,head:activeHead(html),visible:readVisibleNativeDocument(html,{strict:true})}
}
const scoped=(node,visible)=>{
 need(!all(node,n=>['script','style','template','noscript','svg','iframe','object','embed','form','img'].includes(n.tag)).length,'unreviewed delegated or inactive role content')
 need(nativeText(node)===clean(text(visible,true)),'hidden native role content')
}
const withoutActionLinks=(node,pdf,apply)=>typeof node==='string'?node:node.tag==='a'&&[pdf,apply].includes(node.attrs.href)?'':{...tree(node),children:node.children.map(child=>withoutActionLinks(child,pdf,apply))}
function card(node,{sourceUrl=null,single=false}={}){
 const heading=one(all(node,n=>n.tag===(single?'h1':'h3')&&cls(n,'card-title')),'native card heading'),title=nativeText(heading)
 const titleLinks=all(heading,n=>n.tag==='a')
 if(!single){const anchor=one(titleLinks,'native own role anchor');sourceUrl=anchor.attrs.href;need(isRoleURL(sourceUrl),'declared own role URL required')}
 else need(!titleLinks.length,'unreviewed own title link')
 const labels=all(node,n=>cls(n,'card-meta-item')).map(nativeText);need(labels.length===2&&labels.every(Boolean),'native location and compensation labels required')
 const openingsLabel=nativeText(one(all(node,n=>cls(n,'card-status')),'advertised openings')),match=/^Total Openings ([1-9]\d{0,4})$/.exec(openingsLabel)
 need(match,'native openings label changed')
 const links=all(node,n=>n.tag==='a'),pdfLink=one(links.filter(n=>nativeText(n)==='Download Details'),'declared full PDF link'),applyLink=one(links.filter(n=>nativeText(n)==='Apply Now'),'unvisited application link')
 need(isPDFURL(pdfLink.attrs.href)&&isApplyURL(applyLink.attrs.href,title),'unreviewed PDF/application declaration')
 need(links.every(n=>n===pdfLink||n===applyLink||titleLinks.includes(n)),'unreviewed role handoff or delegated criteria')
 return {title,sourceUrl,nativeLocationLabel:labels[0],nativeCompensationLabel:labels[1],nativeOpeningsLabel:openingsLabel,numberOfOpenings:Number(match[1]),
  pdfURL:pdfLink.attrs.href,applyURL:applyLink.attrs.href,criteriaText:nativeText(withoutActionLinks(node,pdfLink.attrs.href,applyLink.attrs.href)),
  unreviewedGeographicDeclarations:geoDeclarations(node),card:tree(node)}
}
export function readCareers(html){
 const {d,root,head,visible}=document(html)
 need(JSON.stringify(head.titles)===JSON.stringify(['Join Our Dynamic Digital Marketing & Web Development Team']),'publisher page identity changed')
 const heading=one(d.nodes(n=>n.tag==='h1'&&nativeText(n)==='Career'),'publisher heading')
 need(d.nodes(n=>n.tag==='h2'&&nativeText(n)==='Your Career Starts Here').length===1,'publisher careers context missing')
 const grid=one(d.nodes(n=>cls(n,'cl-grid-wrap')),'whole native role grid'),vgrid=one(visible.nodes(n=>cls(n,'cl-grid-wrap')),'visible role grid')
 scoped(grid,vgrid)
 const cards=all(grid,n=>cls(n,'career-page-card'));need(cards.length>0&&cards.length<=20,'native role bound or missing declarations')
 const rows=cards.map(n=>card(n));need(new Set(rows.map(r=>r.sourceUrl)).size===rows.length&&new Set(rows.map(r=>r.pdfURL)).size===rows.length,'duplicate native role/PDF identity')
 const shared=node=>typeof node==='string'?node:cls(node,'career-page-card')?'':{...tree(node),children:node.children.map(shared)}
 const sharedGrid=shared(grid)
 const schema=all(root,n=>n.tag==='script'&&(n.attrs.type||'').toLowerCase()==='application/ld+json').map(n=>{let value;try{value=JSON.parse(n.raw)}catch{need(false,'invalid native publisher schema')}return {declaration:tree(n),value}})
 const containsPosting=v=>!!v&&typeof v==='object'&&([v['@type']].flat().some(type=>typeof type==='string'&&/^(?:https?:\/\/schema\.org\/)?JobPosting$/.test(type))||Object.values(v).some(containsPosting))
 need(!schema.some(s=>containsPosting(s.value)),'new native JobPosting context requires review')
 return {head,heading:tree(heading),sharedGrid,sharedText:nativeText(sharedGrid),rows,publisherSchemas:schema}
}
export function readRole(html,row){
 const {d,root,head,visible}=document(html)
 need(JSON.stringify(head.titles)===JSON.stringify([row.title+' - Logelite']),'own role publisher/title mismatch')
 need(head.metas.filter(m=>m.property==='og:url').length===1&&head.metas.find(m=>m.property==='og:url').content===row.sourceUrl,'own native URL mismatch')
 const wrapper=one(d.nodes(n=>cls(n,'page-wrapper')),'native own page wrapper'),vwrapper=one(visible.nodes(n=>cls(n,'page-wrapper')),'visible own page wrapper')
 const regionFrom=parent=>{
  const boundary=parent.children.findIndex(n=>typeof n==='object'&&cls(n,'breadcrumb-area'))
  need(boundary>=0,'native role boundary missing')
  return {tag:'native-role-region',attrs:{},children:parent.children.slice(boundary+1)}
 }
 const region=regionFrom(wrapper),vregion=regionFrom(vwrapper);scoped(region,vregion)
 const native=card(one(all(region,n=>cls(n,'career-single-card')),'whole own native role card'),{sourceUrl:row.sourceUrl,single:true})
 need(all(region,n=>n.tag==='h1').every(n=>nativeText(n)===row.title)&&native.title===row.title,'own visible title mismatch')
 for(const key of ['nativeLocationLabel','nativeCompensationLabel','nativeOpeningsLabel','pdfURL','applyURL'])need(native[key]===row[key],'own native '+key+' differs from listing')
 need(!all(root,n=>n.tag==='script'&&(n.attrs.type||'').toLowerCase()==='application/ld+json').length,'new structured role context requires review')
 const body=one(d.nodes(n=>n.tag==='body'),'native own body'),ids=(body.attrs.class||'').split(/\s+/).filter(c=>/^postid-\d+$/.test(c))
 need(ids.length===1,'native content document identity required')
 return {head,contentDocumentID:ids[0].slice(7),nativeCard:native,region:tree(region),criteriaText:nativeText(withoutActionLinks(region,row.pdfURL,row.applyURL)),
  unreviewedGeographicDeclarations:[...geoDeclarations(region),...head.metas.filter(m=>/country|location|worksite|geo[.:]|job:/i.test([m.name,m.property,m.itemprop].filter(Boolean).join(' ')))]}
}
const workScopes=value=>[...String(value).matchAll(/(?=(\b(?:(?:country|(?:work |job |office |employment )?location|work\s?site|duty station)\s*:|(?:located|based|stationed|posted)\s+(?:in|at|from)\b|(?:work|works|operate|operates|operated|relocate|relocated|transfer|transferred|deployed|assigned)\s+(?:in|at|from|to)\b|(?:will|shall|must)\s+(?:be\s+)?(?:working|operating|relocating)\s+(?:in|at|from|to)\b|overseas\b|abroad\b|work from anywhere\b)[^.!?\n]{0,200}))/gi)].map(m=>m[1])
export function makeJob(row,role,pdf,careers,clock){
 const lines=pdf.text.split('\n'),field=label=>{const matches=lines.filter(line=>line.startsWith(label));need(matches.length===1,'one native PDF '+label+' required');return matches[0].slice(label.length).trim()}
 const title=field('Job Role:'),location=field('Location:'),employment=field('Job Type:'),salary=field('Salary:'),experience=field('Experience:')
 need(title===row.title&&role.nativeCard.title===title,'PDF job-role identity mismatch')
 need(/(?:^|\n)About Logelite Pvt\. Ltd\.:?\n/.test(pdf.text)&&pdf.text.includes('Logelite is a forward-thinking digital marketing company'),'own PDF publisher context missing')
 need(pdf.totalPages>0&&pdf.text.length>=750&&['Job Description:','Responsibilities:','Benefits','To Apply:'].every(s=>pdf.text.includes(s))&&/\n(?:Requirements|Qualifications)\s*:/.test(pdf.text)&&pdf.text.includes('hr@logelite.com'),'incomplete native PDF criteria')
 need(salary===row.nativeCompensationLabel,'own PDF compensation mismatch')
 const match=/^([^,]+),\s*([^,]+)$/.exec(location),city=match?.[1].trim(),country=nativeCountryName(match?.[2])
 const consistentScope=scope=>compareText(scope)===compareText('Location: '+location)
 const scopes=[careers.sharedText,row.criteriaText,role.criteriaText,pdf.text].flatMap(workScopes).filter(s=>!consistentScope(s))
 const typed=[...row.unreviewedGeographicDeclarations,...role.unreviewedGeographicDeclarations]
 const proven=country==='India'&&city===row.nativeLocationLabel&&city===role.nativeCard.nativeLocationLabel&&!scopes.length&&!typed.length
 const description=[careers.sharedText,row.criteriaText,role.criteriaText,pdf.text].filter(Boolean).join('\n\n')
 const job={source:SOURCE,company:COMPANY,title,jobId:null,requisitionId:null,nativeContentDocumentID:role.contentDocumentID,nativeCanonicalRoleURL:row.sourceUrl,
  sourceUrl:row.sourceUrl,applyUrl:row.applyURL,link:row.applyURL,applicationUrlIsGeneric:true,applicationVisited:false,applicationFormSubmitted:false,activeApplyVerified:false,
  nativeApplicationHandoff:{kind:'unvisited-prefilled-shared-application-form',url:row.applyURL,publishedRoleTitle:row.title,publicRolePageRead:true,formInteractedWith:false},
  country:proven?'India':null,city:proven?city:null,state:null,location:proven?location:null,nativeWorkplace:location,nativeLocationLabel:row.nativeLocationLabel,
  employmentType:employment,nativeEmploymentType:employment,nativeExperienceLabel:experience,experienceRequired:null,remoteStatus:null,
  numberOfOpenings:row.numberOfOpenings,openings:String(row.numberOfOpenings),compensation:salary,
  nativeHiringOrganization:{name:'Logelite Pvt. Ltd.',context:'own native PDF About heading and paragraph'},legalEmployer:null,
  postingDate:null,postedAt:null,closingDate:null,firstEverPublication:null,publicationTimezone:null,sourceDatePrecision:null,
  minimumQualification:null,preferredQualification:null,requiredSkills:[],jobDescription:description,sourceDescription:description,nativePDFDescription:pdf.text,
  nativeSourceRecord:{listing:structuredClone(row),role:structuredClone(role),pdf:structuredClone(pdf),careers:structuredClone(careers)},
  sourceNativeCriteriaContainerRetained:true,sourceCountryScopeUnresolved:!proven,sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:proven?'native-closing-unreconciled':'native-country-unproven',
  nativeRoleClosingReconciled:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:clock}
 if(proven)job.sourceWorksiteCountryProof={method:'declared-own-role-pdf-literal-work-location',literalRoleCountry:true,exactCampusEstablished:false,country:'India',
  roleURL:row.sourceUrl,pdfURL:row.pdfURL,pdfSHA256:pdf.sha256,nativePDFLocationLabel:location,nativeListingLocationLabel:row.nativeLocationLabel,nativeOwnRoleLocationLabel:role.nativeCard.nativeLocationLabel,pages:pdf.pages.map(p=>p.number)}
 else job.sourceNativeCountryContext={nativePDFLocationLabel:location,nativeCountry:country,nativeListingLocationLabel:row.nativeLocationLabel,unreviewedWorkplaceScopes:scopes,unreviewedGeographicDeclarations:typed}
 return job
}
export const equivalent=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
