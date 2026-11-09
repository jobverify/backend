import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {AMNEAL_PHARMACEUTICALS_INDIA_CATALOG as catalog} from './catalog.js'

// Only the two employer-authored paths are accepted. A country search parameter
// is not evidence about an individual vacancy's workplace or legal employer.
export const readAmnealCareersHandoff=html=>{
 const doc=readVisibleNativeDocument(html,{strict:true}),head=activeHead(html)
 if(head.titles.length!==1||head.titles[0]!=='Careers at Amneal India | Join Our Team')return null
 const canonical=doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical')
 if(canonical.length>1||canonical.length===1&&canonical[0].attrs.href!==catalog.officialCareersPageUrl)return null
 const anchors=doc.nodes(node=>node.tag==='a'&&node.attrs.href)
 const direct=anchors.filter(node=>node.attrs.href===catalog.oracleCandidateExperienceUrl
  &&/^Explore career opportunities(?:\s*\(Opens in a new tab\))?$/i.test(doc.text(node)))
 if(direct.length&&canonical.length===1&&doc.nodes(node=>node.tag==='h1'&&doc.text(node)).length===1)return catalog.oracleCandidateExperienceUrl
 const historical=anchors.filter(node=>node.attrs.href===catalog.companyCareerPage&&doc.text(node)==='Search Our Career Opportunities')
 return historical.length&&doc.nodes(node=>node.tag==='h1'&&doc.text(node)==='Join and help make medicines accessible for all').length===1
  &&doc.nodes(node=>node.tag==='p'&&doc.text(node).includes('Amneal is cultivating a workplace where innovation, excellence, and employee growth are at the forefront')).length
  ?catalog.companyCareerPage:null
}
