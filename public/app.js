const $ = id => document.getElementById(id);

const video = $('backdrop');

let schedule = null;
let sync = {
  serverAt: Date.now(),
  perfAt: performance.now()
};

let lastSecond = null;
let lastPhase = '';
let lastSyncOk = false;
let videoSrc = '';

const reduce =
  matchMedia('(prefers-reduced-motion: reduce)').matches;

if (reduce) {
  document.body.classList.add('reduce-motion');
}


// ===============================
// TIME
// ===============================

function now() {
  if (!sync.serverAt) {
    return Date.now();
  }

  return sync.serverAt +
    (performance.now() - sync.perfAt);
}


function fmt(ms) {
  ms = Math.max(0, ms);

  let sec = Math.floor(ms / 1000);

  const h = Math.floor(sec / 3600);

  sec %= 3600;

  const m = Math.floor(sec / 60);

  sec %= 60;

  return [h, m, sec]
    .map(x => String(x).padStart(2, '0'))
    .join(':');
}


// ===============================
// EVENT PHASE
// ===============================

function phaseFor(currentTime, s) {

  const start = Date.parse(s.start);
  const end = Date.parse(s.end);

  if (currentTime < start) {
    return ['before', 0];
  }

  if (currentTime >= end) {
    return ['ended', 0];
  }

  const duration = end - start;

  const percent =
    ((end - currentTime) / duration) * 100;

  if (percent > 50) return ['fresh', percent];
  if (percent > 25) return ['warm', percent];
  if (percent > 10) return ['intense', percent];
  if (percent > 0.1666667) return ['urgent', percent];

  return ['finale', percent];
}


// ===============================
// MILESTONES
// ===============================

function milestoneAt(m) {

  if (m.type === 'offset') {

    return Date.parse(schedule.start) +
      Number(m.minutesAfterStart) * 60000;

  }

  return Date.parse(m.exactAt);
}


// ===============================
// PHASE LABEL
// ===============================

function phaseLabel(p) {

  return {
    before: 'GET READY',
    fresh: 'FULL POWER',
    warm: 'HEAT RISING',
    intense: 'FINAL PUSH',
    urgent: 'CRITICAL',
    finale: 'THE FINAL 60',
    ended: 'CELEBRATION'
  }[p];

}


// ===============================
// SCHEDULE
// ===============================

function renderSchedule(t) {

  if (!schedule ||
      !Array.isArray(schedule.milestones)) {

    $('scheduleList').innerHTML =
      '<div class="item">' +
      '<span class="item-name">' +
      'No milestones yet' +
      '</span>' +
      '</div>';

    return;
  }


  const items = schedule.milestones
    .map(m => ({
      ...m,
      at: milestoneAt(m)
    }))
    .filter(m => Number.isFinite(m.at))
    .sort((a, b) => a.at - b.at);


  if (!items.length) {

    $('scheduleList').innerHTML =
      '<div class="item">' +
      '<span class="item-name">' +
      'No milestones yet' +
      '</span>' +
      '</div>';

    return;
  }


  let nextFound = false;


  $('scheduleList').innerHTML =
    items.map((m, index) => {

      const startTime = m.at;
      const endTime = m.at + 120000;

      let status = '';
      let statusClass = '';


      if (t >= startTime && t < endTime) {

        status = 'LIVE';
        statusClass = 'live';

      }

      else if (t >= endTime) {

        status = 'DONE';
        statusClass = 'done';

      }

      else if (!nextFound) {

        status = 'NEXT';
        statusClass = 'next';

        nextFound = true;

      }

      else {

        status = 'UPCOMING';
        statusClass = 'upcoming';

      }


      const timeText =
        new Date(startTime).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });


      const description =
        m.description ||
        m.message ||
        'No additional information';


      return `
        <div class="item ${statusClass}">

          <div class="milestone-left">
            <span class="dot"></span>
          </div>

          <div class="milestone-content">

            <div class="milestone-top">

              <span class="item-name">
                ${esc(m.name || `Round ${index + 1}`)}
              </span>

              <span class="item-time">
                ${timeText}
              </span>

            </div>

            <div class="milestone-description">
              ${esc(description)}
            </div>

            <div class="milestone-status ${statusClass}">
              ${status}
            </div>

          </div>

        </div>
      `;

    }).join('');
}


// ===============================
// VIDEO
// ===============================

function setVideo(p) {

  if (
    reduce ||
    !window.VIDEO_CONFIG
  ) {
    return;
  }


  const src = window.VIDEO_CONFIG[p];

  if (!src || src === videoSrc) {
    return;
  }


  videoSrc = src;

  video.src = src;

  video.play().catch(() => {});

  video.style.opacity = '.12';


  setTimeout(() => {

    video.style.opacity = '.48';

  }, 700);

}


// ===============================
// ESCAPE HTML
// ===============================

function esc(s) {

  const d =
    document.createElement('div');

  d.textContent = s ?? '';

  return d.innerHTML;
}


// ===============================
// ALERT
// ===============================

function renderAlert(t) {

  if (
    !schedule ||
    !Array.isArray(schedule.milestones)
  ) {

    $('alert').classList.add('hidden');

    return;
  }


  const milestones =
    schedule.milestones

      .map(m => ({
        ...m,
        at: milestoneAt(m)
      }))

      .filter(m => Number.isFinite(m.at))

      .sort((a, b) => a.at - b.at);


  if (!milestones.length) {

    $('alert').classList.add('hidden');

    return;
  }


  let active = null;


  for (const milestone of milestones) {

    if (t >= milestone.at) {

      active = milestone;

    }

  }


  if (!active) {

    const next =
      milestones.find(m => {

        const warning =
          (Number(m.warnMinutes) || 5) *
          60 *
          1000;

        return (
          t < m.at &&
          t >= m.at - warning
        );

      });


    if (!next) {

      $('alert').classList.add('hidden');

      return;
    }


    const before =
      next.at - t;


    $('alert').classList.remove('hidden');

    $('alertKicker').textContent =
      'UP NEXT';

    $('alertTitle').textContent =
      `${next.name} begins in`;

    $('alertCount').textContent =
      before < 60000
        ? `${Math.ceil(before / 1000)}s`
        : fmt(before);

    $('alertMessage').textContent =
      next.message ||
      next.description ||
      '';

    return;
  }


  const elapsed =
    t - active.at;


  if (elapsed < 120000) {

    $('alert').classList.remove('hidden');

    $('alertKicker').textContent =
      'NOW';

    $('alertTitle').textContent =
      `${active.name} is starting now`;

    $('alertCount').textContent =
      'LIVE';

    $('alertMessage').textContent =
      active.message ||
      active.description ||
      '';

    return;
  }


  const next =
    milestones.find(m => {

      const warning =
        (Number(m.warnMinutes) || 5) *
        60 *
        1000;

      return (
        t < m.at &&
        t >= m.at - warning
      );

    });


  if (!next) {

    $('alert').classList.add('hidden');

    return;
  }


  const before =
    next.at - t;


  $('alert').classList.remove('hidden');

  $('alertKicker').textContent =
    'UP NEXT';

  $('alertTitle').textContent =
    `${next.name} begins in`;

  $('alertCount').textContent =
    before < 60000
      ? `${Math.ceil(before / 1000)}s`
      : fmt(before);

  $('alertMessage').textContent =
    next.message ||
    next.description ||
    '';

}


// ===============================
// ANNOUNCEMENT
// ===============================

function renderAnnouncement(t) {

  if (
    !schedule ||
    !Array.isArray(schedule.announcements)
  ) {
    return;
  }


  const a =
    schedule.announcements.find(x =>
      t >= Date.parse(x.showFrom) &&
      t < Date.parse(x.showUntil)
    );


  if (!a) {

    $('announcement')
      .classList
      .add('hidden');

    return;
  }


  $('announcement').textContent =
    a.text;

  $('announcement')
    .classList
    .remove('hidden');
}


// ===============================
// MAIN RENDER
// ===============================

function render() {

  if (!schedule) {
    requestAnimationFrame(render);
    return;
  }


  const currentTime = now();


  const result =
    phaseFor(
      currentTime,
      schedule
    );


  const phase = result[0];
  const pct = result[1];


  const start =
    Date.parse(schedule.start);

  const end =
    Date.parse(schedule.end);


  // DEBUG
  console.log(
    'NOW:',
    new Date(currentTime).toLocaleString(),
    'START:',
    new Date(start).toLocaleString(),
    'END:',
    new Date(end).toLocaleString(),
    'PHASE:',
    phase
  );


  if (phase !== lastPhase) {

    document.body.className =
      `phase-${phase}` +
      (reduce ? ' reduce-motion' : '');

    $('phaseLabel').textContent =
      phaseLabel(phase);

    setVideo(phase);

    lastPhase = phase;
  }


  $('eventName').textContent =
    schedule.eventName;


  // ===============================
  // BEFORE EVENT
  // ===============================

  if (phase === 'before') {

    $('ended')
      .classList
      .add('hidden');

    $('timer').textContent =
      fmt(start - currentTime);

    $('timerSub').textContent =
      'Starts in';

    $('progressBar')
      .style
      .transform =
      'scaleX(0)';
  }


  // ===============================
  // EVENT ENDED
  // ===============================

  else if (phase === 'ended') {

    $('ended')
      .classList
      .remove('hidden');

    $('endedName').textContent =
      schedule.eventName;

    $('timer').textContent =
      '00:00:00';

    $('timerSub').textContent =
      'Event ended';

    $('progressBar')
      .style
      .transform =
      'scaleX(1)';
  }


  // ===============================
  // EVENT RUNNING
  // ===============================

  else {

    $('ended')
      .classList
      .add('hidden');

    $('timer').textContent =
      fmt(end - currentTime);

    $('timerSub').textContent =
      'Time remaining';

    $('progressBar')
      .style
      .transform =
      `scaleX(${Math.max(
        0,
        Math.min(1, pct / 100)
      )})`;


    const sec =
      Math.floor(
        (end - currentTime) / 1000
      );


    if (sec !== lastSecond) {

      lastSecond = sec;


      if (phase === 'finale') {

        $('timer').animate(
          [
            { transform: 'scale(.86)' },
            { transform: 'scale(1.05)' },
            { transform: 'scale(1)' }
          ],
          {
            duration: 600,
            easing:
              'cubic-bezier(.2,.8,.2,1)'
          }
        );

      }

    }

  }


  $('status').textContent =
    lastSyncOk
      ? 'SERVER CLOCK SYNCED'
      : 'OFFLINE — COUNTING FROM LAST SYNC';


  renderSchedule(currentTime);

  renderAlert(currentTime);

  renderAnnouncement(currentTime);


  requestAnimationFrame(render);
}


// ===============================
// SERVER SYNC
// ===============================

async function syncServer() {

  const sent =
    performance.now();


  try {

    const response =
      await fetch(
        '/api/state',
        {
          cache: 'no-store'
        }
      );


    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }


    const received =
      performance.now();


    const data =
      await response.json();


    const midpoint =
      sent +
      (received - sent) / 2;


    sync = {
      serverAt:
        Number(data.serverNow),

      perfAt:
        midpoint
    };


    schedule =
      data.schedule;


    lastSyncOk = true;


    console.log(
      'SERVER SYNC:',
      new Date(
        data.serverNow
      ).toLocaleString()
    );


    console.log(
      'EVENT START:',
      new Date(
        Date.parse(data.schedule.start)
      ).toLocaleString()
    );


    console.log(
      'EVENT END:',
      new Date(
        Date.parse(data.schedule.end)
      ).toLocaleString()
    );

  }

  catch (error) {

    console.error(
      'SYNC ERROR:',
      error
    );

    lastSyncOk = false;
  }

}


// ===============================
// START
// ===============================

(async () => {

  await syncServer();

  render();

  setInterval(
    syncServer,
    5000
  );

  window.addEventListener(
    'online',
    syncServer
  );

})();