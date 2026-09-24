const grid = document.querySelector('#course-grid');
const resultCount = document.querySelector('#result-count');
const emptyState = document.querySelector('#empty-state');
const searchInput = document.querySelector('#course-search');
const filterButtons = [...document.querySelectorAll('[data-category]')];
const courseDialog = document.querySelector('#course-dialog');
const assistantDialog = document.querySelector('#assistant-dialog');
const courseDetail = document.querySelector('#course-detail');
const money = new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 });
let courses = [];
let category = 'All';

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function imageURL(id, width = 720) {
  return `https://images.unsplash.com/photo-${encodeURIComponent(id)}?auto=format&fit=crop&w=${width}&q=75`;
}

function card(course) {
  const title = escapeHTML(course.title);
  return `<article class="course-card">
    <div class="card-photo"><img src="${imageURL(course.img)}" alt="${title} course food" loading="lazy" width="720" height="520"></div>
    <div class="card-body">
      <div class="card-meta"><span>${escapeHTML(course.code)}</span><span>${escapeHTML(course.level)}</span></div>
      <p class="card-campus">⌖ ${escapeHTML(course.campus)}</p>
      <h3>${title}</h3>
      <p class="card-summary">${escapeHTML(course.summary)}</p>
      <dl class="card-facts"><div><dt>Duration</dt><dd>${course.weeks} ${course.weeks === 1 ? 'week' : 'weeks'}</dd></div><div><dt>Schedule</dt><dd>${escapeHTML(course.when)}</dd></div></dl>
    </div>
    <div class="card-bottom"><div class="card-price"><small>Full course fee</small><strong>${money.format(course.fee)}</strong></div><button type="button" data-course="${escapeHTML(course.code)}" aria-label="View details for ${title}">View details ↗</button></div>
  </article>`;
}

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visible = courses.filter(course => (category === 'All' || course.cat === category) &&
    [course.title, course.summary, course.code, course.level, course.campus, course.when].some(value => String(value).toLocaleLowerCase().includes(query)));
  grid.innerHTML = visible.map(card).join('');
  grid.setAttribute('aria-busy', 'false');
  resultCount.textContent = `Showing ${visible.length} ${visible.length === 1 ? 'course' : 'courses'}`;
  emptyState.hidden = visible.length !== 0;
}

function selectCategory(next) {
  category = next;
  filterButtons.forEach(button => {
    const active = button.dataset.category === next;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  render();
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

function openCourse(course) {
  const outcomes = (course.learn || []).map(item => `<li>${escapeHTML(item)}</li>`).join('');
  const dates = (course.intakes || []).map(formatDate).join(', ');
  courseDetail.innerHTML = `<p class="detail-meta">${escapeHTML(course.code)} · ${escapeHTML(course.cat)} · ${escapeHTML(course.level)}</p>
    <h2 id="detail-title">${escapeHTML(course.title)}</h2>
    <p class="detail-summary">${escapeHTML(course.summary)}</p>
    <dl class="detail-grid">
      <div><dt>Campus</dt><dd>${escapeHTML(course.campus)}</dd></div>
      <div><dt>Duration</dt><dd>${course.weeks} ${course.weeks === 1 ? 'week' : 'weeks'}</dd></div>
      <div><dt>Schedule</dt><dd>${escapeHTML(course.when)}</dd></div>
      <div><dt>Full fee</dt><dd>${money.format(course.fee)}</dd></div>
      <div><dt>Fee per session</dt><dd>${money.format(course.fee / course.weeks)} <small>(one session per week)</small></dd></div>
      <div><dt>Class size</dt><dd>Up to ${escapeHTML(course.class_size)} learners</dd></div>
    </dl>
    <div class="detail-section"><h3>What you’ll learn</h3><ul>${outcomes}</ul></div>
    <div class="detail-section"><h3>Upcoming starts</h3><p>${escapeHTML(dates || 'Dates to be announced')}</p></div>
    <div class="detail-section"><h3>Before you come</h3><p><strong>Allergens:</strong> ${escapeHTML(course.allergens)}<br><strong>Bring:</strong> ${escapeHTML(course.bring)}</p></div>`;
  courseDialog.showModal();
}

filterButtons.forEach(button => button.addEventListener('click', () => selectCategory(button.dataset.category)));
searchInput.addEventListener('input', render);
grid.addEventListener('click', event => {
  const button = event.target.closest('[data-course]');
  if (button) {
    const course = courses.find(item => item.code === button.dataset.course);
    if (course) openCourse(course);
  }
});

document.querySelectorAll('[data-campus]').forEach(button => button.addEventListener('click', () => {
  searchInput.value = '';
  selectCategory(button.dataset.campus === 'Orchard Road' ? 'Bakery' : 'Cooking');
  document.querySelector('#courses').scrollIntoView({ behavior: 'smooth' });
}));

document.querySelector('[data-open-assistant]').addEventListener('click', () => assistantDialog.showModal());
document.querySelectorAll('[data-assistant-category]').forEach(button => button.addEventListener('click', () => {
  searchInput.value = button.dataset.assistantSearch || '';
  selectCategory(button.dataset.assistantCategory);
  assistantDialog.close();
  document.querySelector('#courses').scrollIntoView({ behavior: 'smooth' });
}));
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
}));

fetch('data/courses.json')
  .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
  .then(data => {
    if (!Array.isArray(data)) throw new Error('Course data must be an array');
    courses = data;
    document.querySelector('#count-all').textContent = data.length;
    document.querySelector('#count-bakery').textContent = data.filter(course => course.cat === 'Bakery').length;
    document.querySelector('#count-cooking').textContent = data.filter(course => course.cat === 'Cooking').length;
    render();
  })
  .catch(error => {
    grid.setAttribute('aria-busy', 'false');
    resultCount.textContent = 'Courses could not be loaded. Please refresh the page.';
    console.error('Failed to load courses:', error);
  });
