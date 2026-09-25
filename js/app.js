const grid = document.querySelector('#course-grid');
const resultCount = document.querySelector('#result-count');
const emptyState = document.querySelector('#empty-state');
const searchInput = document.querySelector('#course-search');
const filterButtons = [...document.querySelectorAll('[data-category]')];
const courseDialog = document.querySelector('#course-dialog');
const signupDialog = document.querySelector('#signup-dialog');
const signupForm = document.querySelector('#signup-form');
const signupCourse = document.querySelector('#signup-course');
const allergyWarning = document.querySelector('#allergy-warning');
const courseDetail = document.querySelector('#course-detail');
const money = new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 });
let courses = [];
let category = 'All';
let signupCourseCode = null;
const signupsKey = 'cb_signups';
const workshopSeenKey = 'cb_workshop_invitation_seen';
const workshopDialog = document.querySelector('#workshop-dialog');
const workshopForm = document.querySelector('#workshop-form');
let workshopDate = '';
const leadMagnetForm = document.querySelector('#lead-magnet-form');
const leadEntriesKey = 'cb_lead_magnet_optins';
const leadGuidePath = 'output/pdf/home-bakers-sourdough-starter-guide.pdf';

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function saveLeadMagnetRequest(event) {
  event.preventDefault();
  const email = leadMagnetForm.elements.email.value.trim();
  const consent = leadMagnetForm.elements.consent.checked;
  const emailError = email && leadMagnetForm.elements.email.validity.valid ? '' : 'Enter a valid email address.';
  const consentError = consent ? '' : 'Consent is required to save your guide request.';
  document.querySelector('#lead-email-error').textContent = emailError;
  document.querySelector('#lead-consent-error').textContent = consentError;
  document.querySelector('#lead-storage-error').textContent = '';
  leadMagnetForm.elements.email.toggleAttribute('aria-invalid', Boolean(emailError));
  leadMagnetForm.elements.consent.toggleAttribute('aria-invalid', Boolean(consentError));
  if (emailError || consentError) {
    (emailError ? leadMagnetForm.elements.email : leadMagnetForm.elements.consent).focus();
    return;
  }
  const params = new URLSearchParams(location.search);
  const utm = Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign'].map(key => {
    const value = params.get(key) || '';
    return [key, /^[a-z0-9_-]{1,50}$/.test(value) ? value : ''];
  }));
  const record = {
    email,
    consent: 'yes',
    consent_date: new Date().toISOString().slice(0, 10),
    source: 'lead magnet',
    marketing_opt_in: leadMagnetForm.elements.newsletter.checked ? 'yes' : 'no',
    ...utm
  };
  try {
    const saved = JSON.parse(localStorage.getItem(leadEntriesKey) || '[]');
    if (!Array.isArray(saved)) throw new Error('Invalid lead data');
    localStorage.setItem(leadEntriesKey, JSON.stringify([...saved, record]));
  } catch (error) {
    document.querySelector('#lead-storage-error').textContent = 'Your request could not be saved in this browser. Check that storage is enabled and try again.';
    return;
  }
  document.querySelector('#lead-magnet-success').innerHTML = `<h3 id="lead-success-title" tabindex="-1">Your guide is ready.</h3><p>Thanks. Your request is saved in this browser. Download your copy below.</p><a class="button button-primary" href="${leadGuidePath}" download>Download the guide ↗</a>`;
  leadMagnetForm.hidden = true;
  document.querySelector('#lead-magnet-success').hidden = false;
  document.querySelector('#lead-success-title').focus();
}

function imageURL(id, width = 720) {
  return `https://images.unsplash.com/photo-${encodeURIComponent(id)}?auto=format&fit=crop&w=${width}&q=75`;
}

function card(course) {
  const title = escapeHTML(course.title);
  return `<article class="course-card" id="course-${escapeHTML(course.code)}">
    <div class="card-photo"><img src="${imageURL(course.img)}" alt="${title} course food" loading="lazy" width="720" height="520"></div>
    <div class="card-body">
      <div class="card-meta"><span>${escapeHTML(course.code)}</span><span>${escapeHTML(course.level)}</span></div>
      <p class="card-campus">⌖ ${escapeHTML(course.campus)}</p>
      <h3>${title}</h3>
      <p class="card-summary">${escapeHTML(course.summary)}</p>
      <dl class="card-facts"><div><dt>Duration</dt><dd>${course.weeks} ${course.weeks === 1 ? 'week' : 'weeks'}</dd></div><div><dt>Schedule</dt><dd>${escapeHTML(course.when)}</dd></div></dl>
    </div>
    <div class="card-bottom"><div class="card-price"><small>Full course fee</small><strong>${money.format(course.fee)}</strong></div><div class="card-actions"><button type="button" data-course="${escapeHTML(course.code)}" aria-label="View details for ${title}">View details ↗</button><button type="button" data-signup="${escapeHTML(course.code)}" aria-label="Sign up for ${title}">Sign up ↗</button></div></div>
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

function nextWorkshopDate() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).map(part => [part.type, part.value]));
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const daysUntilWednesday = (3 - date.getUTCDay() + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilWednesday);
  return date.toISOString().slice(0, 10);
}

function showWorkshopInvitation() {
  if (workshopDialog.open) return;
  if ([courseDialog, signupDialog].some(dialog => dialog.open)) {
    [courseDialog, signupDialog].forEach(dialog => {
      if (dialog.open) dialog.addEventListener('close', showWorkshopInvitation, { once: true });
    });
    return;
  }
  workshopDate = nextWorkshopDate();
  document.querySelector('#workshop-when').textContent = `Next Wednesday, ${formatDate(workshopDate)}, 1:00–2:00 PM`;
  workshopDialog.showModal();
  document.querySelector('#workshop-title').focus();
  try { localStorage.setItem(workshopSeenKey, '1'); } catch (error) { /* The form will report storage errors on submit. */ }
}

function saveWorkshopSignup(event) {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(workshopForm));
  const errors = {
    full_name: values.full_name?.trim().length >= 2 ? '' : 'Enter your name (at least 2 characters).',
    mobile: /^[89]\d{7}$/.test(values.mobile?.trim() || '') ? '' : 'Enter 8 digits beginning with 8 or 9.',
    email: workshopForm.elements.email.validity.valid && values.email?.trim() ? '' : 'Enter a valid email address.'
  };
  const firstInvalid = Object.keys(errors).find(name => errors[name]);
  Object.entries(errors).forEach(([name, message]) => {
    const field = workshopForm.elements[name];
    const errorId = name === 'full_name' ? 'name' : name;
    document.querySelector(`#workshop-error-${errorId}`).textContent = message;
    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  });
  if (firstInvalid) {
    workshopForm.elements[firstInvalid].focus();
    return;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(signupsKey) || '[]');
    if (!Array.isArray(saved)) throw new Error('Invalid sign-up data');
    const signup = {
      ref: `CBW-${Date.now()}`,
      submitted: new Date().toISOString().slice(0, 10),
      course_code: 'WORKSHOP',
      course_title: 'Free 1-hour Pastries Workshop & Treat',
      intake: workshopDate,
      full_name: values.full_name.trim(),
      email: values.email.trim(),
      mobile: `+65 ${values.mobile.trim()}`,
      experience: '', allergies: '', marketing_opt_in: 'no', paid: 'no'
    };
    localStorage.setItem(signupsKey, JSON.stringify([...saved, signup]));
  } catch (error) {
    document.querySelector('#workshop-storage-error').textContent = 'Your sign-up could not be saved in this browser. Check that storage is enabled and try again.';
    return;
  }
  document.querySelector('#workshop-content').hidden = true;
  document.querySelector('#workshop-success').hidden = false;
  workshopDialog.setAttribute('aria-labelledby', 'workshop-success-title');
  workshopDialog.removeAttribute('aria-describedby');
  document.querySelector('#workshop-success-title').focus();
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
    <div class="detail-section"><h3>Before you come</h3><p><strong>Allergens:</strong> ${escapeHTML(course.allergens)}<br><strong>Bring:</strong> ${escapeHTML(course.bring)}</p></div>
    <button class="button button-primary detail-signup" type="button" data-detail-signup="${escapeHTML(course.code)}">Sign up for this course ↗</button>`;
  courseDialog.showModal();
}

function getSignupCourse() {
  return courses.find(course => course.code === signupCourseCode);
}

function openSignup(course) {
  signupCourseCode = course.code;
  signupForm.reset();
  signupCourse.innerHTML = `<div><dt>Code</dt><dd>${escapeHTML(course.code)}</dd></div><div><dt>Course</dt><dd>${escapeHTML(course.title)}</dd></div><div><dt>Full fee</dt><dd>${money.format(course.fee)}</dd></div><div><dt>Duration</dt><dd>${escapeHTML(course.weeks)} ${course.weeks === 1 ? 'week' : 'weeks'}</dd></div><div><dt>Schedule</dt><dd>${escapeHTML(course.when)}</dd></div><div><dt>Campus</dt><dd>${escapeHTML(course.campus)}</dd></div>`;
  const intake = signupForm.elements.intake;
  intake.replaceChildren(new Option('Choose an intake', ''));
  (course.intakes || []).forEach(date => intake.add(new Option(formatDate(date), date)));
  document.querySelectorAll('#signup-form .field-error').forEach(error => { error.textContent = ''; });
  signupForm.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
  allergyWarning.hidden = true;
  document.querySelector('#signup-content').hidden = false;
  document.querySelector('#signup-success').hidden = true;
  signupDialog.setAttribute('aria-labelledby', 'signup-title');
  if (courseDialog.open) courseDialog.close();
  signupDialog.showModal();
  intake.focus();
}

function updateAllergyWarning() {
  const course = getSignupCourse();
  const mentionsNuts = /\b(nuts?|peanuts?|almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|macadamias?)\b/i.test(signupForm.elements.allergies.value);
  const usesNuts = /\b(nuts?|peanuts?|almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?|macadamias?)\b/i.test(course?.allergens || '');
  allergyWarning.hidden = !(mentionsNuts && usesNuts);
  allergyWarning.textContent = allergyWarning.hidden ? '' : `Allergy warning: ${course.title} lists ${course.allergens}. Please check with the academy before attending.`;
}

function setFieldError(name, message) {
  const field = signupForm.elements[name];
  document.querySelector(`#error-${name === 'full_name' ? 'name' : name}`).textContent = message;
  if (message) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
}

function validateSignup() {
  const values = Object.fromEntries(new FormData(signupForm));
  const course = getSignupCourse();
  const mobile = (values.mobile || '').replace(/[\s-]/g, '').replace(/^\+65/, '');
  const errors = {
    intake: course?.intakes?.includes(values.intake) ? '' : 'Choose an available intake.',
    full_name: (values.full_name?.trim().length || 0) >= 2 ? '' : 'Enter your full name (at least 2 characters).',
    email: signupForm.elements.email.validity.valid && values.email?.trim() ? '' : 'Enter a valid email address.',
    mobile: /^[689]\d{7}$/.test(mobile) ? '' : 'Enter a valid Singapore number beginning with 6, 8 or 9.',
    experience: ['None', 'Some', 'Confident'].includes(values.experience) ? '' : 'Choose your experience level.',
    consent: signupForm.elements.consent.checked ? '' : 'Consent is required to save your sign-up.'
  };
  const invalid = Object.keys(errors).find(name => errors[name]);
  Object.entries(errors).forEach(([name, message]) => setFieldError(name, name === invalid ? message : ''));
  Object.entries(errors).forEach(([name, message]) => { if (message) signupForm.elements[name].setAttribute('aria-invalid', 'true'); });
  if (invalid) signupForm.elements[invalid].focus();
  return invalid ? null : { ...values, full_name: values.full_name.trim(), email: values.email.trim(), mobile: `+65 ${mobile}`, allergies: values.allergies?.trim() || '', consent: true, marketing_opt_in: signupForm.elements.newsletter.checked ? 'yes' : 'no' };
}

function saveSignup(event) {
  event.preventDefault();
  const values = validateSignup();
  if (!values) return;
  const course = getSignupCourse();
  const today = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  const submitted = `${today.year}-${today.month}-${today.day}`;
  const dateCode = `${today.year}${today.month}${today.day}`;
  let signup;
  try {
    const saved = JSON.parse(localStorage.getItem(signupsKey) || '[]');
    if (!Array.isArray(saved)) throw new Error('Invalid sign-up data');
    const lastNumber = saved.reduce((max, item) => {
      const match = new RegExp(`^CB-${dateCode}-(\\d{4})$`).exec(item.ref || '');
      return Math.max(max, match ? Number(match[1]) : 1000);
    }, 1000);
    if (lastNumber >= 9999) throw new Error('No reference numbers remain today');
    const ref = `CB-${dateCode}-${String(lastNumber + 1).padStart(4, '0')}`;
    signup = { ref, submitted, course_code: course.code, course_title: course.title, intake: values.intake, full_name: values.full_name, email: values.email, mobile: values.mobile, experience: values.experience, allergies: values.allergies, marketing_opt_in: values.marketing_opt_in, paid: 'no', consent: true };
    localStorage.setItem(signupsKey, JSON.stringify([...saved, signup]));
  } catch (error) {
    document.querySelector('#signup-storage-error').textContent = 'Your sign-up could not be saved in this browser. Check that storage is enabled and try again.';
    return;
  }
  const subject = `Course sign-up ${signup.ref}: ${course.title}`;
  const body = `Reference: ${signup.ref}\nCourse: ${course.code} — ${course.title}\nFee: ${money.format(course.fee)}\nDuration: ${course.weeks} ${course.weeks === 1 ? 'week' : 'weeks'}\nSchedule: ${course.when}\nCampus: ${course.campus}\nIntake: ${values.intake}\nName: ${values.full_name}\nEmail: ${values.email}\nMobile: ${values.mobile}\nExperience: ${values.experience}\nAllergies or dietary needs: ${values.allergies || 'None stated'}\nMarketing opt-in: ${values.marketing_opt_in}`;
  document.querySelector('#signup-success').innerHTML = `<p class="eyebrow">SIGN-UP SAVED</p><h2 id="signup-success-title" tabindex="-1">Your reference is ${escapeHTML(signup.ref)}</h2><p>Keep this reference. Your sign-up is saved in this browser; email it to the academy to complete your enquiry.</p><a class="button button-primary" href="mailto:enrol@cookbakeacademy.sg?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}">Email the academy ↗</a>`;
  document.querySelector('#signup-content').hidden = true;
  document.querySelector('#signup-success').hidden = false;
  signupDialog.setAttribute('aria-labelledby', 'signup-success-title');
  document.querySelector('#signup-success h2').focus();
}

filterButtons.forEach(button => button.addEventListener('click', () => selectCategory(button.dataset.category)));
searchInput.addEventListener('input', render);
grid.addEventListener('click', event => {
  const signupButton = event.target.closest('[data-signup]');
  if (signupButton) {
    const course = courses.find(item => item.code === signupButton.dataset.signup);
    if (course) openSignup(course);
    return;
  }
  const button = event.target.closest('[data-course]');
  if (button) {
    const course = courses.find(item => item.code === button.dataset.course);
    if (course) openCourse(course);
  }
});

courseDetail.addEventListener('click', event => {
  const button = event.target.closest('[data-detail-signup]');
  if (button) {
    const course = courses.find(item => item.code === button.dataset.detailSignup);
    if (course) openSignup(course);
  }
});
signupForm.addEventListener('submit', saveSignup);
workshopForm.addEventListener('submit', saveWorkshopSignup);
leadMagnetForm.addEventListener('submit', saveLeadMagnetRequest);
leadMagnetForm.addEventListener('input', event => {
  if (event.target.name === 'email') {
    event.target.removeAttribute('aria-invalid');
    document.querySelector('#lead-email-error').textContent = '';
  }
  if (event.target.name === 'consent') {
    event.target.removeAttribute('aria-invalid');
    document.querySelector('#lead-consent-error').textContent = '';
  }
  document.querySelector('#lead-storage-error').textContent = '';
});
workshopForm.addEventListener('input', event => {
  if (!event.target.name) return;
  event.target.removeAttribute('aria-invalid');
  document.querySelector(`#workshop-error-${event.target.name === 'full_name' ? 'name' : event.target.name}`).textContent = '';
  document.querySelector('#workshop-storage-error').textContent = '';
});
signupForm.addEventListener('input', event => {
  if (event.target.name === 'allergies') updateAllergyWarning();
  if (event.target.name && event.target.name !== 'allergies' && event.target.name !== 'newsletter') setFieldError(event.target.name, '');
});
signupForm.addEventListener('change', event => {
  if (event.target.name && event.target.name !== 'allergies' && event.target.name !== 'newsletter') setFieldError(event.target.name, '');
});

document.querySelectorAll('[data-campus]').forEach(button => button.addEventListener('click', () => {
  searchInput.value = '';
  selectCategory(button.dataset.campus === 'Orchard Road' ? 'Bakery' : 'Cooking');
  document.querySelector('#courses').scrollIntoView({ behavior: 'smooth' });
}));

document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
}));

try {
  if (localStorage.getItem(workshopSeenKey) !== '1') setTimeout(showWorkshopInvitation, 10000);
} catch (error) {
  setTimeout(showWorkshopInvitation, 10000);
}

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
