import reviewed from './reviewedSurfaces.json' with {type:'json'}
import {structure,sha} from '../alkemlaboratories/publicRead.js'
const key=value=>{const u=new URL(value);return u.origin+u.pathname}
export async function verifyBlueRendering(html,scope,phase){
 const tree=structure(html),styles=tree.nodes.filter(n=>n.tag==='link'&&n.attrs.rel==='stylesheet'&&n.attrs.media!=='print')
 if(!styles.length)return{verified:true,basis:'self-contained-native-html'}
 const actual=styles.map(n=>new URL(n.attrs.href,'https://www.bluebinaries.com/become-a-bluebee/').href),expected=reviewed.stylesheets
 let verified=actual.length===expected.length&&actual.every(url=>expected.some(row=>key(row.url)===key(url)))
 verified&&=JSON.stringify(tree.nodes.filter(n=>n.tag==='style').map(n=>sha(n.raw||'')))===JSON.stringify(reviewed.inlineStyleSHA256)
 const reveal=tree.scripts.filter(s=>s.executable&&!s.attrs.src&&/\.job-details/.test(s.body))
 verified&&=JSON.stringify(reveal.map(s=>s.sha256))===JSON.stringify(reviewed.inlineRevealSHA256)
 for(const url of actual){const known=expected.find(row=>key(row.url)===key(url));if(!known){verified=false;continue}const body=await scope.read(url,{kind:'css',phase,retainBody:false});if(sha(body)!==known.sha256)verified=false}
 return{verified,basis:verified?'current-reviewed-public-CSS-and-exact-accordion-reveal':'external-rendering-context-unreviewed',revealProtocol:reviewed.publicRevealProtocol}
}
