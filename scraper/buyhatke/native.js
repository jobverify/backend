import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
const check=(ok,message)=>{if(!ok)throw Object.assign(Error('Buyhatke native role: '+message),{abortRetries:true})}
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const identity=value=>norm(value).toLowerCase().replace(/\s+/g,'')
const within=(node,p)=>node.inert?[]:[...(p(node)?[node]:[]),...node.children.filter(n=>typeof n!=='string').flatMap(n=>within(n,p))]
export const activeListingMarkup=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),escape=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')
 const render=n=>typeof n==='string'?n:n.inert||['script','style','title'].includes(n.tag)?'':n.tag==='root'?n.children.map(render).join(''):'<'+n.tag+Object.entries(n.attrs).map(([k,v])=>' '+k+'="'+escape(v)+'"').join('')+'>'+n.children.map(render).join('')+'</'+n.tag+'>'
 return doc.nodes(n=>n.tag==='root').map(render).join('')
}
export const readBuyhatkeDetail=(html,listing)=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),blocks=doc.nodes(n=>doc.hasClass(n,'job-intro-section'))
 check(blocks.length<=1,'duplicate role container')
 const block=blocks[0],headings=block?within(block,n=>n.tag==='h4'&&doc.hasClass(n,'bh-titles')):doc.nodes(n=>n.tag==='h1')
 check(headings.length===1,'missing/ambiguous active role heading')
 const heading=doc.text(headings[0]),match=heading.match(/^(.*?)\s+@\s+Buyhatke,\s*(.+)$/i)
 check(!block||match,'missing employer/workplace in role heading')
 const title=norm(match?match[1]:heading),location=match?norm(match[2]):null
 check(identity(title)===identity(listing.title),'listing/detail role identity contradiction')
 const titles=activeHead(html).titles;check(titles.length===1&&/\bBuyhatke\b/i.test(titles[0]),'missing employer page title')
 const content=block?within(block,n=>doc.hasClass(n,'job-intro-content')):doc.nodes(n=>n.tag==='main')
 check(content.length>=1&&content.length<=2&&(!block||content.length===1&&!content[0].attrs.id||content.every(n=>['fulltime','internship'].includes(n.attrs.id))&&new Set(content.map(n=>n.attrs.id)).size===content.length),'missing/ambiguous active description container')
 const sections=block?content:within(content[0],n=>n.tag==='section')
 const description=sections.map(n=>doc.text(n)).filter(Boolean).join('\n\n')||null
 check(description&&description.length>40&&!/^(?:access denied|not found|this job is closed|job no longer available)/i.test(description),'missing/error/closed role description')
 const skills=content.flatMap(n=>within(n,s=>s.tag==='li')).map(n=>doc.text(n)).filter(Boolean)
 const frames=n=>n.activeFrame?[n]:n.inert?[]:n.children.filter(c=>typeof c!=='string').flatMap(frames)
 const forms=content.flatMap(frames).filter(n=>n.attrs.src).map(n=>new URL(n.attrs.src,listing.sourceUrl))
 check(forms.length<=content.length&&forms.every(u=>u.origin==='https://docs.google.com'&&/^\/forms\/(?:d|e)\//.test(u.pathname))&&new Set(forms.map(u=>u.href)).size===forms.length,'foreign/ambiguous advertised application frame')
 return {...listing,title,location,city:null,country:location&&/\bIndia\b/i.test(location)?'India':null,applyUrl:forms.length===1?forms[0].href:listing.sourceUrl||null,requiredSkills:skills,minimumQualification:skills[0]||null,preferredQualification:skills[1]||null,jobDescription:description,rawNativeRoleEvidence:{listingTitle:listing.title,detailTitle:title,workplaceHeader:heading,workplaceCountryQualified:Boolean(location&&/\bIndia\b/i.test(location)),identityQualified:true,applicationFrames:forms.map(u=>u.href),descriptionSections:block?content.map(n=>n.attrs.id):['main'],applicationRouteQualified:forms.length===1,applicationSubmissionQualified:false}}
}
