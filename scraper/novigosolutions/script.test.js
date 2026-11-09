import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Life @ Novigo</h2>
    <h2>Opportunities <span>with us</span></h2>
    <p>See our current job openings and where you can fit in</p>
    <div class="ns-job-desc-wrap no-border">
      <div class="job-list no-border">
        <h3 class="ns-job-head job-requirements">.Net Developer <span>(2-5 Years)</span></h3>
        <p class="ns-job-text no-bullet">Bangalore / Mangalore / Remote work during Pandemic.</p>
        <div class="job-details">
          <h3 class="ns-job-sub-head">Requirements:</h3>
          <p class="ns-job-text">Overall 2+ years of relevant experience in .Net</p>
          <p class="ns-job-text">In-depth knowledge in .NET / MVC /Entity Framework, HTML, CSS, Javascript.</p>
        </div>
      </div>
      <div class="panel-default">
        <div id="modal-jobs1" class="panel-collapse collapse">
          <p class="ns-job-text">Knowledge of OOPs, MVC, DB Design, Git</p>
        </div>
        <a class="see-more job-more" href="#modal-jobs1">See More</a>
        <a href="javascript:void(0);">Apply Now</a>
      </div>
      <div class="job-list no-border">
        <h3 class="ns-job-head job-requirements">Angular Developer <span>(3-6 Years)</span></h3>
        <p class="ns-job-text no-bullet">Bangalore / Mangalore / Remote work during Pandemic.</p>
        <div class="job-details">
          <h3 class="ns-job-sub-head">Requirements:</h3>
          <p class="ns-job-text">Minimum of 3 years experience of JavaScript front end development.</p>
          <p class="ns-job-text">Minimum of 3-5 years experience with Angular and AngularJS.</p>
        </div>
      </div>
      <div class="panel-default">
        <div id="modal-jobs2" class="panel-collapse collapse">
          <p class="ns-job-text">Experience with HTML5, JavaScript and CSS3.</p>
        </div>
        <a class="see-more job-more" href="#modal-jobs2">See More</a>
        <a href="javascript:void(0);">Apply Now</a>
      </div>
    </div>
    <h2>Apply Online</h2>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Novigo Solutions scraper module at ./script.js')
  }
}

test('Novigo Solutions recognizes the current first-party careers shell and inline role sections', async () => {
  const novigo = await loadModule()

  assert.equal(novigo.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(
    novigo.extractVisibleRoles(careersHtml).map((role) => ({
      title: role.title,
      experienceRequired: role.experienceRequired,
      location: role.location,
      requirementCount: role.requirements.length,
    })),
    [
      {
        title: '.Net Developer',
        experienceRequired: '2-5 Years',
        location: 'Bangalore / Mangalore / Remote work during Pandemic.',
        requirementCount: 3,
      },
      {
        title: 'Angular Developer',
        experienceRequired: '3-6 Years',
        location: 'Bangalore / Mangalore / Remote work during Pandemic.',
        requirementCount: 3,
      },
    ],
  )
})
