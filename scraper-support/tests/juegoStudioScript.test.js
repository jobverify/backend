import assert from 'node:assert/strict'
import test from 'node:test'
import {createJuegoStudioScraper,JHUB_APPLICATION_URL} from '../../scraper/juegostudio/script.js'
const oldJhub='<h1>Apply a Job</h1><label>Job Opening:</label><select name="jo_id" class="form-control job_opening"><option value="344">3D Artist I / II</option><option value="334">Intern 3D Artist</option></select>'
test('Juego candidate application options alone cannot establish country or full current JD',async()=>{const urls=[];await assert.rejects(createJuegoStudioScraper().run({fetchText:async url=>{urls.push(url);return oldJhub}}),/canonical|LinkedIn/);assert.ok(urls.every(url=>url!==JHUB_APPLICATION_URL))})
test('Juego rejects unavailable current employer authority rather than returning a fake zero',async()=>{await assert.rejects(createJuegoStudioScraper().run({fetchPage:async url=>({status:403,url,html:'Access denied'})}),/HTTP 403/)})
