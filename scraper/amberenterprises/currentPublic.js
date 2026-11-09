import {createReviewedPublicSurface,publicDocument,publicText,publicTitles,activeLinks} from '../balajitelefilms/currentPublic.js'
const C='https://www.ambergroupindia.com/careers/',N='https://www.naukri.com/amber-enterprises-india-overview-4576343?tab=jobs&src=JDLogo'
export const createCurrentAmber=()=>createReviewedPublicSurface({source:'amberenterprises',url:C,inspect:(html,fail)=>{
 const doc=publicDocument(html),text=publicText(doc),links=activeLinks(doc,C),handoffs=links.filter(link=>/View Current Openings/i.test(link.label)),canonical=doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical')
 if(publicTitles(doc).length!==1||!/^Careers at Amber Group\s*\|/.test(publicTitles(doc)[0])||canonical.length!==1||canonical[0].attrs.href!==C||!text.includes('Join Amber Group')||handoffs.length!==1||handoffs[0].url!==N)throw fail('current corporate employer/native handoff binding changed')
 const observation={kind:'declared-employer-native-board-handoff',url:C,nativeURL:N,nativeEmployerReference:'amber-enterprises-india-overview-4576343',vacancy:false,country:null,postingDate:null,descriptionComplete:false,applicationActionPerformed:false}
 return{model:{handoff:handoffs[0]},observations:[observation],activeNativeHandoffs:handoffs}
}})
