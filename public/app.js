const $=id=>document.getElementById(id); const video=$('backdrop');
let schedule=null, sync={serverAt:Date.now(),perfAt:performance.now()}, lastSecond=null, lastPhase='', lastSyncOk=false, videoSrc='';
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches; if(reduce) document.body.classList.add('reduce-motion');
const phaseFor=(now,s)=>{const a=Date.parse(s.start),b=Date.parse(s.end),dur=b-a;if(now<a)return ['before',0];if(now>=b)return ['ended',0];const p=(b-now)/dur*100;if(p>50)return ['fresh',p];if(p>25)return ['warm',p];if(p>10)return ['intense',p];if(p>0.1666667)return ['urgent',p];return ['finale',p]};
function now(){return sync.serverAt+(performance.now()-sync.perfAt)}
function fmt(ms){ms=Math.max(0,ms);let sec=Math.floor(ms/1000);const h=Math.floor(sec/3600);sec%=3600;const m=Math.floor(sec/60);sec%=60;return [h,m,sec].map(x=>String(x).padStart(2,'0')).join(':')}
function milestoneAt(m){return m.type==='offset'?Date.parse(schedule.start)+Number(m.minutesAfterStart)*60000:Date.parse(m.exactAt)}
function phaseLabel(p){return ({before:'GET READY',fresh:'FULL POWER',warm:'HEAT RISING',intense:'FINAL PUSH',urgent:'CRITICAL',finale:'THE FINAL 60',ended:'CELEBRATION'})[p]}
function renderSchedule(t) {
  if (!schedule || !Array.isArray(schedule.milestones)) {
    $('scheduleList').innerHTML =
      '<div class="item"><span class="item-name">No milestones yet</span></div>';
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
      '<div class="item"><span class="item-name">No milestones yet</span></div>';
    return;
  }

  let nextFound = false;

  $('scheduleList').innerHTML = items.map((m, index) => {

    const startTime = m.at;
    const endTime = m.at + 120000; // 2-minute LIVE period

    let status = '';
    let statusClass = '';

    // LIVE
    if (t >= startTime && t < endTime) {
      status = 'LIVE';
      statusClass = 'live';
    }

    // DONE
    else if (t >= endTime) {
      status = 'DONE';
      statusClass = 'done';
    }

    // NEXT
    else if (!nextFound) {
      status = 'NEXT';
      statusClass = 'next';
      nextFound = true;
    }

    // UPCOMING
    else {
      status = 'UPCOMING';
      statusClass = 'upcoming';
    }

    const timeText = new Date(startTime).toLocaleTimeString([], {
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
function setVideo(p){if(reduce||!window.VIDEO_CONFIG)return;const src=window.VIDEO_CONFIG[p];if(!src||src===videoSrc)return;const old=video.currentSrc;videoSrc=src;video.src=src;video.play().catch(()=>{});video.style.opacity='.12';setTimeout(()=>video.style.opacity='.48',700);if(old){} }
function esc(s){const d=document.createElement('div');d.textContent=s??'';return d.innerHTML}
function renderAlert(t) {
  if (!schedule || !Array.isArray(schedule.milestones)) {
    $('alert').classList.add('hidden');
    return;
  }

  const milestones = schedule.milestones
    .map(m => ({
      ...m,
      at: milestoneAt(m)
    }))
    .filter(m => Number.isFinite(m.at))
    .sort((a, b) => a.at - b.at);

  if (milestones.length === 0) {
    $('alert').classList.add('hidden');
    return;
  }

  /*
   * Find the latest milestone that has started.
   */
  let active = null;

  for (const milestone of milestones) {
    if (t >= milestone.at) {
      active = milestone;
    }
  }

  /*
   * If no milestone has started,
   * show the next milestone during its warning period.
   */
  if (!active) {
    const next = milestones.find(m => {
      const warning =
        (Number(m.warnMinutes) || 5) * 60 * 1000;

      return (
        t < m.at &&
        t >= m.at - warning
      );
    });

    if (!next) {
      $('alert').classList.add('hidden');
      return;
    }

    const before = next.at - t;

    $('alert').classList.remove('hidden');

    $('alertKicker').textContent = 'UP NEXT';

    $('alertTitle').textContent =
      `${next.name} begins in`;

    $('alertCount').textContent =
      before < 60000
        ? `${Math.ceil(before / 1000)}s`
        : fmt(before);

    /*
     * IMPORTANT:
     * Show the message belonging to THIS milestone.
     */
    $('alertMessage').textContent =
      next.message ||
      next.description ||
      '';

    return;
  }

  /*
   * Current milestone is active.
   */
  const elapsed = t - active.at;

  if (elapsed < 120000) {

    $('alert').classList.remove('hidden');

    $('alertKicker').textContent = 'NOW';

    $('alertTitle').textContent =
      `${active.name} is starting now`;

    $('alertCount').textContent = 'LIVE';

    /*
     * IMPORTANT:
     * This uses the message of the CURRENT
     * milestone, not milestone 1.
     */
    $('alertMessage').textContent =
      active.message ||
      active.description ||
      '';

    return;
  }

  /*
   * Current milestone's 2-minute alert is over.
   * Find the next upcoming milestone.
   */
  const next = milestones.find(m => {
    const warning =
      (Number(m.warnMinutes) || 5) * 60 * 1000;

    return (
      t < m.at &&
      t >= m.at - warning
    );
  });

  if (!next) {
    $('alert').classList.add('hidden');
    return;
  }

  const before = next.at - t;

  $('alert').classList.remove('hidden');

  $('alertKicker').textContent = 'UP NEXT';

  $('alertTitle').textContent =
    `${next.name} begins in`;

  $('alertCount').textContent =
    before < 60000
      ? `${Math.ceil(before / 1000)}s`
      : fmt(before);

  /*
   * Show the NEXT milestone's own message.
   */
  $('alertMessage').textContent =
    next.message ||
    next.description ||
    '';
}
function renderAnnouncement(t){const a=schedule.announcements.find(x=>t>=Date.parse(x.showFrom)&&t<Date.parse(x.showUntil));if(!a){$('announcement').classList.add('hidden');return}$('announcement').textContent=a.text;$('announcement').classList.remove('hidden')}
function render(){if(!schedule)return;const t=now(),[phase,pct]=phaseFor(t,schedule),start=Date.parse(schedule.start),end=Date.parse(schedule.end);if(phase!==lastPhase){document.body.className=`phase-${phase}`+(reduce?' reduce-motion':'');$('phaseLabel').textContent=phaseLabel(phase);setVideo(phase);lastPhase=phase}$('eventName').textContent=schedule.eventName; if(phase==='before'){ $('timer').textContent=fmt(start-t);$('timerSub').textContent='Starts in';$('progressBar').style.transform='scaleX(0)';}else if(phase==='ended'){$('ended').classList.remove('hidden');$('endedName').textContent=schedule.eventName;$('timerSub').textContent='Event ended';}else{$('ended').classList.add('hidden');$('timer').textContent=fmt(end-t);$('timerSub').textContent='Time remaining';$('progressBar').style.transform=`scaleX(${Math.max(0,Math.min(1,pct/100))})`;const sec=Math.floor((end-t)/1000);if(sec!==lastSecond){lastSecond=sec;if(phase==='finale'){$('timer').animate([{transform:'scale(.86)'},{transform:'scale(1.05)'},{transform:'scale(1)'}],{duration:600,easing:'cubic-bezier(.2,.8,.2,1)'});}}}$('status').textContent=lastSyncOk?'SERVER CLOCK SYNCED':'OFFLINE — COUNTING FROM LAST SYNC';renderSchedule(t);renderAlert(t);renderAnnouncement(t);requestAnimationFrame(render)}
async function syncServer(){const sent=performance.now();try{const r=await fetch('/api/state',{cache:'no-store'});if(!r.ok)throw new Error();const received=performance.now();const d=await r.json();const midpoint=sent+(received-sent)/2;sync={serverAt:d.serverNow,perfAt:midpoint};schedule=d.schedule;lastSyncOk=true}catch{lastSyncOk=false}}
(async()=>{await syncServer();render();setInterval(syncServer,5000);window.addEventListener('online',syncServer)})();
