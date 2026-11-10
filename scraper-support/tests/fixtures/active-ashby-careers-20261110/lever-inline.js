
// job-board.js
const ACCOUNT_NAME = 'cloudinary';
const API_URL = `https://api.lever.co/v0/postings/${ACCOUNT_NAME}?mode=json`;

const filters = {
  location: '',
  team: ''
};

const locationSelect = document.getElementById('filter-location');
const teamSelect = document.getElementById('filter-team');
const resetButton = document.getElementById('clear-filters');
const listingsContainer = document.getElementById('job-listings');

async function fetchJobs() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(`Unable to load jobs: ${response.status}`);
  }

  const jobs = await response.json();

  if (!Array.isArray(jobs)) {
    throw new Error('Unexpected jobs response.');
  }

  return jobs.filter(job => job && job.categories && job.text);
}

function slugify(str) {
  return str
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/ig, '')
    .toLowerCase();
}

// Restore valid filters from the current URL.
function restoreFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const location = params.get('location') || '';
  const team = params.get('team') || '';

  filters.location = Array.from(locationSelect.options)
    .some(option => option.value === location) ? location : '';

  filters.team = Array.from(teamSelect.options)
    .some(option => option.value === team) ? team : '';

  locationSelect.value = filters.location;
  teamSelect.value = filters.team;
}

// Update this history entry without reloading the page.
function updateFilterUrl() {
  const url = new URL(window.location.href);

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
  });

  if (url.href !== window.location.href) {
    window.history.replaceState(window.history.state, '', url.href);
  }
}

function renderJobs(jobs) {
  listingsContainer.replaceChildren();

  const filtered = jobs
    .filter(job => {
      const locationMatch =
        !filters.location || job.categories.location === filters.location;

      const teamMatch =
        !filters.team || job.categories.team === filters.team;

      return locationMatch && teamMatch;
    })
    .sort((a, b) => a.text.localeCompare(b.text));

  if (filtered.length === 0) {
    listingsContainer.innerHTML =
      '<div class="text-center"><p class="no-results">No jobs found.</p></div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  filtered.forEach(job => {
    const locationSlug = slugify(job.categories.location || 'unknown');
    const titleSlug = slugify(job.text || 'job');

    const posting = document.createElement('div');
    posting.className = 'job-posting';

    const link = document.createElement('a');
    link.className = 'job-link';
    link.href = `/careers/jobs/${locationSlug}/${titleSlug}/`;

    const title = document.createElement('h4');
    title.className = 'job-title';
    title.textContent = job.text;

    const meta = document.createElement('ul');
    meta.className = 'job-meta';

    [
      ['job-location', job.categories.location],
      ['job-team', job.categories.team],
      ['job-type', job.categories.commitment]
    ].forEach(([className, value]) => {
      const item = document.createElement('li');
      item.className = className;
      item.textContent = value || 'N/A';
      meta.appendChild(item);
    });

    const icon = document.createElement('span');
    icon.className = 'job-link-ico';
    icon.textContent = '->';
    icon.setAttribute('aria-hidden', 'true');

    link.append(title, meta, icon);
    posting.appendChild(link);
    fragment.appendChild(posting);
  });

  listingsContainer.appendChild(fragment);
}

function populateFilters(jobs) {
  const locations = new Set();
  const teams = new Set();

  jobs.forEach(job => {
    if (job.categories.location) locations.add(job.categories.location);
    if (job.categories.team) teams.add(job.categories.team);
  });

  locations.forEach(location => {
    locationSelect.add(new Option(location, location));
  });

  teams.forEach(team => {
    teamSelect.add(new Option(team, team));
  });
}

async function initJobBoard() {
  try {
    const jobs = await fetchJobs();

    populateFilters(jobs);
    restoreFiltersFromUrl();
    renderJobs(jobs);

    const applyFilters = () => {
      filters.location = locationSelect.value;
      filters.team = teamSelect.value;

      updateFilterUrl();
      renderJobs(jobs);
    };

    locationSelect.addEventListener('change', applyFilters);
    teamSelect.addEventListener('change', applyFilters);

    resetButton.addEventListener('click', () => {
      locationSelect.value = '';
      teamSelect.value = '';

      applyFilters();
    });

    // Keep the controls and listings synchronized during history navigation.
    const restoreBoard = () => {
      restoreFiltersFromUrl();
      renderJobs(jobs);
    };

    window.addEventListener('popstate', restoreBoard);

    // Also handle browsers restoring the page from their back/forward cache.
    window.addEventListener('pageshow', event => {
      if (event.persisted) {
        restoreBoard();
      }
    });
  } catch (error) {
    console.error('Job board initialization failed:', error);

    listingsContainer.innerHTML =
      '<div class="text-center"><p class="no-results">Unable to load jobs. Please refresh the page to try again.</p></div>';
  }
}

initJobBoard();
