(function () {
  var API_URL = "https://api.ashbyhq.com/posting-api/job-board/anomalo";
  var allJobs = [];

  function locationIcon() {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>';
  }

  function deptIcon() {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  }

  function arrowIcon() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
  }

  function renderJobs(jobs) {
    var list = document.getElementById("ashby-jobs-list");
    if (!list) return;
    if (!jobs.length) {
      list.innerHTML = '<div id="ashby-no-jobs">No open positions in this department right now.</div>';
      return;
    }
    list.innerHTML = jobs.map(function (job) {
      return (
        '<div class="ashby-job-row">' +
          '<div class="ashby-job-info">' +
            '<p class="ashby-job-title">' + job.title + '</p>' +
            '<div class="ashby-job-meta">' +
              '<span>' + locationIcon() + job.location + '</span>' +
              '<span>' + deptIcon() + job.department + '</span>' +
            '</div>' +
          '</div>' +
          '<a class="ashby-read-more" href="' + job.jobUrl + '" target="_blank" rel="noopener">Read More ' + arrowIcon() + '</a>' +
        '</div>'
      );
    }).join("");
  }

  function populateFilter(jobs) {
    var depts = [];
    jobs.forEach(function (j) {
      if (depts.indexOf(j.department) === -1) depts.push(j.department);
    });
    depts.sort();
    var select = document.getElementById("ashby-dept-filter");
    if (!select) return;
    depts.forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      select.appendChild(opt);
    });
  }

  function init() {
    var select = document.getElementById("ashby-dept-filter");
    if (!select) return;
    select.addEventListener("change", function () {
      var val = this.value;
      var filtered = val ? allJobs.filter(function (j) { return j.department === val; }) : allJobs;
      renderJobs(filtered);
    });

    fetch(API_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        allJobs = (data.jobs || []).filter(function (j) { return j.isListed; });
        populateFilter(allJobs);
        renderJobs(allJobs);
      })
      .catch(function (err) {
        console.error("Ashby fetch error:", err);
        var list = document.getElementById("ashby-jobs-list");
        if (list) list.innerHTML = '<div id="ashby-no-jobs">Unable to load positions. (' + err.message + ')</div>';
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();