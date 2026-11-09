import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {withCurrentPublicProbe} from '../aurobindopharma/publicProbe.js'
import {readAffordmedRouteProgram} from './routeProgram.js'
const C='https://www.affordmed.com/careers'
export const runCurrentAffordmed=options=>withCurrentPublicProbe('affordmed',options,async context=>{
 const page=await context.read(C),doc=readNativeDocument(page.body),scripts=doc.nodes(n=>n.tag==='script'&&!n.inert&&n.attrs.type==='module'&&!Object.hasOwn(n.attrs,'nomodule')&&/^\/assets\/[a-zA-Z0-9_-]+\.js$/.test(n.attrs.src||''))
 if(page.status!==200||scripts.length!==1)throw context.unavailable('Affordmed configured careers document/module binding unavailable',page.status)
 const asset=new URL(scripts[0].attrs.src,C).href,client=await context.read(asset)
 if(client.status!==200)throw context.unavailable('Affordmed current declared public module unavailable',client.status)
 const routeProof=readAffordmedRouteProgram(client.body)
 await context.audit({configuredSource:C,declaredModuleURL:asset,routeProof,nativeInventoryComplete:false,observations:[],qualification:'configured-careers-path-is-a-general-site-SPA-fallback;not-native-vacancy-or-empty-inventory'})
 throw context.unavailable('Affordmed configured careers path has no current declared careers inventory renderer; native inventory unknown')
})
