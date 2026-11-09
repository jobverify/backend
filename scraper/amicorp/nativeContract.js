import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {AMICORP_CATALOG as catalog} from './catalog.js'
const check=(ok,message)=>{if(!ok)throw Object.assign(Error('Amicorp detail page '+message),{abortRetries:true})}
const norm=value=>decodeNativeEntities(value).replace(/[\u2013\u2014]/g,'-').replace(/\s+/g,' ').trim()
const titleKey=value=>norm(value).replace(/\u200b/g,'').replace(/\bJD\s+(?=\d)/gi,'JD').replace(/\s*\/\s*/g,'/').toLowerCase()
// The current Senior Manager H1 inserts ", &" and uses a comma where the
// matching card, canonical page title and public CMS title use a dash. Preserve
// all words and meaningful operators; do not equate Market with Marketing.
const visibleHeadingKey=value=>titleKey(value).replace(/,\s*&\s+/g,', ').replace(/[,-]/g,' ').replace(/\s+/g,' ').trim()
const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>within(child,predicate))]
const one=(nodes,label)=>{check(nodes.length===1,'no longer exposes the verified '+label);return nodes[0]}
const date=value=>{
 const text=norm(value),months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
 const parts=text.match(/^(\d{1,2})\s+([a-z]{3}|\d{1,2})\s+(\d{4})$/i)
 if(!parts)return null
 const month=/^\d+$/.test(parts[2])?Number(parts[2]):months.indexOf(parts[2].toLowerCase())+1
 const iso=`${parts[3]}-${String(month).padStart(2,'0')}-${parts[1].padStart(2,'0')}`
 return month>=1&&month<=12&&Number.isFinite(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso?iso:null
}
const workplace=value=>{
 const raw=norm(value),parenthesized=raw.match(/^(.*?)\s*\(([^)]+)\)$/),comma=raw.match(/^(.*),\s*([^,]+)$/)
 const parts=parenthesized||comma
 return {raw,location:parts?`${parts[1].trim()}, ${parts[2].trim()}`:raw,city:parts?parts[1].trim():null,country:parts?parts[2].trim():null}
}
export const readAmicorpDetail=(html,listing)=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),head=activeHead(html)
 const canonical=one(doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical'),'canonical role URL').attrs.href
 check(canonical===listing.sourceUrl,'canonical role identity contradiction')
 check(head.metas.some(meta=>meta.property==='og:site_name'&&meta.content==='Amicorp'),'employer identity contradiction')
 const pageTitle=one(head.titles,'employer role title')
 const rows=doc.nodes(node=>node.children.filter(child=>typeof child!=='string'&&child.tag==='span').length===3)
 const metadata=one(rows.filter(node=>/^(.+?)\s+\(\s*([^()]+)\)\s+JD\d*\s*$/.test(doc.text(node))),'role metadata')
 const spans=metadata.children.filter(child=>typeof child!=='string'&&child.tag==='span')
 const nativeLocation=workplace(doc.text(spans[0])),nativeDate=norm(doc.text(spans[1])).replace(/^\(\s*|\s*\)$/g,''),identifier=norm(doc.text(spans[2]))
 check(/^JD\d*$/.test(identifier)&&date(nativeDate),'role metadata')
 const advertised=norm(listing.subtitle).match(/^(?:(JD\d*)\s*-\s*)?(.+?)\s*-\s*(\d{1,2}\s+[a-z]{3}\s+\d{4})$/i)
 check(advertised&&(!advertised[1]||advertised[1]===identifier)
  &&norm(workplace(advertised[2]).location).toLowerCase()===norm(nativeLocation.location).toLowerCase(),'listing/detail workplace, date or requisition contradiction')
 check(nativeLocation.country?.toLowerCase()==='india','unqualified India workplace')
 const requisitionId=identifier==='JD'?null:identifier
 // The native head adds either a JD label or its own city plus JD label.
 // Bind the full composition; a shared role-title prefix is not identity.
 const titleCompositions=[`${listing.title} ${identifier} - Amicorp`,`${listing.title} - ${identifier} - Amicorp`,
  ...(nativeLocation.city?[`${listing.title} ${nativeLocation.city} - ${identifier} - Amicorp`]:[])]
 check(titleCompositions.some(value=>titleKey(pageTitle)===titleKey(value)),'listing/detail title contradiction')
 if(date(advertised[3])!==date(nativeDate))throw Object.assign(Error('Amicorp detail page listing/detail publication dates conflict'),{
  code:'AMICORP_NATIVE_PUBLICATION_DATE_CONFLICT',nativeJobId:identifier,
  listingDate:date(advertised[3]),detailDate:date(nativeDate),abortRetries:true})
 const slug=new URL(canonical).pathname.split('/').filter(Boolean).at(-1)
 if(requisitionId&&/jd\d+/i.test(slug))check(slug.match(/jd\d+/i)[0].toLowerCase()===requisitionId.toLowerCase(),'URL/requisition identity contradiction')
 const frames=doc.frames().filter(node=>/CareerPageForm/i.test(node.attrs.src||'')||node.attrs['aria-label']==='Career Page Form')
 const frame=one(frames,'trusted apply form')
 check(!Object.hasOwn(frame.attrs,'srcdoc')&&frame.attrs.src===catalog.trustedApplyFormUrl,'no longer exposes the trusted apply form')
 const parents=new Map(),root=doc.nodes(node=>node.tag==='root')[0]
 const index=node=>{for(const child of node.children||[])if(typeof child!=='string'){parents.set(child,node);index(child)}}
 index(root)
 let content=parents.get(metadata)
 while(content&&!(doc.hasClass(content,'vc_row')&&within(content,node=>node.tag==='p'&&doc.text(node).length>150).length)&&content.tag!=='body')content=parents.get(content)
 check(content,'role description container')
 let started=false,finished=false;const text=[]
 const collect=node=>{
  if(finished)return
  if(typeof node==='string'){if(started)text.push(node);return}
  if(node===metadata){started=true;return}
  if(node===frame||node.attrs.id==='form'){finished=true;return}
  if(node.inert||['script','style'].includes(node.tag)||node.tag==='a'&&node.attrs.href==='#form')return
  for(const child of node.children)collect(child)
 }
 collect(content)
 const jobDescription=norm(text.join(' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' '))
 check(jobDescription.length>150,'role description')
 const published=head.metas.filter(meta=>meta.property==='article:published_time').map(meta=>meta.content)
 check(published.length<=1&&(!published.length||Number.isFinite(Date.parse(published[0]))),'native posting date')
 const headings=within(content,node=>node.tag==='h1'&&doc.hasClass(node,'title-h1')).map(node=>doc.text(node))
 const titleConflict=headings.some(heading=>visibleHeadingKey(heading)!==visibleHeadingKey(listing.title))
 const headingFormattingOnly=!titleConflict&&headings.some(heading=>titleKey(heading)!==titleKey(listing.title))
 return {location:nativeLocation.location,city:nativeLocation.city,state:null,country:'India',requisitionId,
  jobId:`amicorp-${requisitionId?requisitionId.toLowerCase():slug}`,applyUrl:frame.attrs.src,
  postingDate:published[0]||date(nativeDate),jobDescription,sourceListingComplete:false,
  sourceDetailComplete:!titleConflict,sourceDetailStatus:titleConflict?'identity-mismatch':'complete',
  ...(headingFormattingOnly?{sourceNativeVisibleHeadingFormattingOnly:true}:{}),
  ...(titleConflict?{sourceDetailFailureKind:'identity-mismatch'}:{}),
  ...(headings.length?{rawNativeRoleEvidence:{canonicalUrl:canonical,listingTitle:listing.title,detailHeading:headings[0],
   nativeWorkplace:nativeLocation.raw,nativeDisplayDate:nativeDate,nativeIdentifierLabel:identifier,
   metadataPostingTimestamp:published[0]||null,nativeClosingDate:null,legalEmployer:null}}:{})}
}
