import { registerCurrentRecruitmentContract } from './helpers/currentRecruitmentContract.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_SURFACE_HTML = `
  <html>
    <body>
      <main>
        <section>
          <h1>Careers at Cloudphysician</h1>
          <h4>You can't care about people without caring about your own.</h4>
          <p>
            Patient care is at the center of what we do, and we take our job very seriously.
          </p>
          <p>
            We push boundaries with our cutting-edge technology and we push the limits of what
            cannot be done.
          </p>
          Open positions
          <a href="mailto:careers@cloudphysician.net">
            <div class="curved-button">Apply now</div>
          </a>
          <app-accordian>
            <div class="item"><a target="_blank" href="assets/jds/20220331_Clinical-Intensivist.pdf">Clinical Intensivist</a></div>
            <div class="item"><a target="_blank" href="assets/jds/20220331_Specialist-Physician.pdf">Specialist</a></div>
            <div class="item"><a target="_blank" href="assets/jds/20220331_Critical-Care-Registered-Nurse.pdf">Critical Care Registered Nurse</a></div>
            <div class="item"><a target="_blank" href="assets/jds/Nicu-Nurse.pdf">Neonatal Pediatric Care Registered Nurse</a></div>
            <div class="item"><a target="_blank" href="assets/jds/20220331_Registered-Nurse.pdf">Registered Nurse</a></div>
            <div class="item"><a target="_blank" href="assets/jds/20220331_Clinical-Dietitian.pdf">Clinical Dietitian</a></div>
            <div class="item"><a target="_blank" href="assets/jds/20220331_Clinical-Pharmacist.pdf">Clinical Pharmacist</a></div>
          </app-accordian>
          <app-accordian>
            <div class="title">Clinical</div>
            <div class="title">Technology</div>
            <div class="item"><a target="_blank" href="assets/jds/Product_Designer_JD.pdf">Product Designer</a></div>
            <div class="item"><a target="_blank" href="assets/jds/20250606_HeadofComplaince_JD.pdf ">Head of Complaince</a></div>
            <div class="item"><a target="_blank" href="assets/jds/20250606_EngineeringManager_JD.pdf">Engineering Manager</a></div>
            <div class="item"><a target="_blank" href="assets/jds/20220331_Data-Engineer.pdf">Data Engineer</a></div>
            <div class="item"><a target="_blank" href="assets/jds/20240912_DevOpsEngineer_JD.pdf">DevOps Engineer</a></div>
            <div class="item"><a target="_blank" href="assets/jds/20220919_QAEngineer-Automation-Selenium_JD.pdf">QA Engineer</a></div>
            <div class="item"><a target="_blank" href="assets/jds/20250507_MLEngineeJD.pdf">ML Engineer</a></div>
          </app-accordian>
          <app-accordian>
            <div class="title">Business</div>
          </app-accordian>
          <app-accordian>
            <div class="title">Business Enablers</div>
            <div class="item"><a target="_blank" href="assets/jds/20220331_Accounts-Executive.pdf">Accounts Executive</a></div>
            <div class="item"><a target="_blank" href="assets/jds/20220331_Executive-assistant-to-CEO.pdf">Executive Assistant to CEO</a></div>
            <div class="item"><a target="_blank" href="assets/jds/20250613_Marketing_Associate_JD.pdf">Marketing Associate</a></div>
          </app-accordian>
        </section>
        <app-footer>
          <footer>
            <strong>Bengaluru</strong>
            <strong>Singapore</strong>
            <p>info@cloudphysician.net</p>
          </footer>
        </app-footer>
      </main>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/cloudphysician/script.js')
  } catch {
    assert.fail('Expected Cloudphysician scraper module at ../../scraper/cloudphysician/script.js')
  }
}











// Current production extraction replaces the old always-empty contract.
registerCurrentRecruitmentContract('cloudphysician', 'workbookBatch06Cloudphysician')
