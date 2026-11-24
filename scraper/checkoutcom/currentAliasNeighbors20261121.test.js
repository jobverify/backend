import test from 'node:test'
import assert from 'node:assert/strict'
import './currentDataBoundaries20261121.test.js'
import {feed,hold} from './currentDataBoundaries20261121.test.js'

for(const[name,edit]of[
 ['present empty additional workplace',r=>r.workLocation={}],
 ['present empty additional postal address',r=>r.workLocation={address:{'@type':'PostalAddress'}}],
 ['object-valued publication flag',r=>r.isPublished={value:false}],
 ['object-valued status',r=>r.status={value:'withdrawn'}],
 ['issuer organization contradiction',r=>r.issuer={'@type':'Organization',name:'Other Employer'}],
 ['semantic publisher pair',r=>r.descriptionHtml='<article><p>Publisher</p><p>Other Employer</p></article>'],
 ['semantic allApply pair',r=>r.descriptionHtml='<article><p>AllApply</p><p>https://other.invalid/apply</p></article>'],
 ['semantic first-publication pair',r=>r.descriptionHtml='<article><p>First Published At</p><p>2100-01-01T00:00:00Z</p></article>'],
 ['semantic work-location-country line',r=>r.descriptionHtml='<p>Work Location Country: India</p>'],
 ['MIME-whitespace scoped criteria country',r=>r.descriptionHtml+='<script type=" application/ld+json ">'+JSON.stringify({'@context':'https://schema.org','@type':'WebPage',url:r.jobUrl,country:'India'})+'</script>']
])test('Configured aliases hold '+name,()=>hold(feed(edit)))

test('Configured aliases preserve coherent scoped issuer/application/date fields',()=>{const result=feed(r=>{r.publisher='Checkout.com';r.allApply=[r.applyUrl];r.firstPublishedAt='2020-01-01T00:00:00Z';r.descriptionHtml='<article><p>Publisher</p><p>Checkout.com</p></article><article><p>AllApply</p><p>'+r.applyUrl+'</p></article><article><p>First Published At</p><p>2020-01-01T00:00:00Z</p></article>'})();assert(result.rows.length>0);assert.equal(result.rows[0].countryInferred,false)})
