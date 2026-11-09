import {createReviewedPublicSurface,publicDocument,publicText,publicTitles} from '../balajitelefilms/currentPublic.js'
const C='https://www.bharatforge.com/careers/careers'
export const createCurrentBharatForge=()=>createReviewedPublicSurface({source:'bharatforge',url:C,inspect:(html,fail)=>{
 const doc=publicDocument(html),text=publicText(doc),expertise=doc.nodes(node=>node.tag==='select'&&node.attrs.name==='c_expert'),forms=doc.nodes(node=>node.tag==='form'&&node.attrs.id==='careerForm')
 if(publicTitles(doc).length!==1||publicTitles(doc)[0]!=='Bharat Forge - Careers'||!text.includes('Bharat Forge Limited')||!text.includes('Forge your career with us')||expertise.length!==1||forms.length!==1)throw fail('current corporate employer/general public intake binding changed')
 const options=doc.nodes(node=>node.tag==='option',expertise[0]).map(node=>doc.text(node)),observation={kind:'general-expertise-resume-intake',url:C,vacancy:false,country:null,postingDate:null,descriptionComplete:false,applicationActionPerformed:false,expertiseChoicesAreVacancies:false}
 return{model:{expertiseChoices:options,intakeKind:observation.kind},observations:[observation],activeNativeHandoffs:[]}
}})
