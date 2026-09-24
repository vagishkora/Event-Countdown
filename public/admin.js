// =====================================================
// EVENT COUNTDOWN - ADMIN CONTROL ROOM
// =====================================================

const eventNameInput = document.getElementById('eventName');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');

const editBtn = document.getElementById('editBtn');
const cancelBtn = document.getElementById('cancelEditBtn');
const saveBtn = document.getElementById('saveBtn');
const stopBtn = document.getElementById('stopBtn');

const addMilestoneBtn = document.getElementById('addMilestone');
const addAnnouncementBtn = document.getElementById('addAnnouncement');

const milestonesContainer = document.getElementById('milestones');
const announcementsContainer = document.getElementById('announcements');

const saveState = document.getElementById('saveState');
const formError = document.getElementById('formError');


// =====================================================
// CURRENT DATA
// =====================================================

let schedule = {
    eventName: '',
    start: '',
    end: '',
    milestones: [],
    announcements: []
};

let lastSavedValues = {
    eventName: '',
    start: '',
    end: ''
};


// =====================================================
// LOAD DATA FROM SERVER
// =====================================================

async function loadState() {

    try {

        const response = await fetch('/api/state', {
            cache: 'no-store',
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error('Failed to load event state.');
        }

        const data = await response.json();

        schedule = data.schedule || {
            eventName: '',
            start: '',
            end: '',
            milestones: [],
            announcements: []
        };

        schedule.milestones =
            Array.isArray(schedule.milestones)
                ? schedule.milestones
                : [];

        schedule.announcements =
            Array.isArray(schedule.announcements)
                ? schedule.announcements
                : [];

        eventNameInput.value =
            schedule.eventName || '';

        startInput.value =
            toDateTimeLocal(schedule.start);

        endInput.value =
            toDateTimeLocal(schedule.end);

        lastSavedValues = {
            eventName: eventNameInput.value,
            start: startInput.value,
            end: endInput.value
        };

        renderMilestones();
        renderAnnouncements();

        saveState.textContent = 'Saved';

        console.log('Loaded schedule:', schedule);

    } catch (error) {

        console.error(error);

        formError.textContent =
            'Could not load event data from server.';
    }
}


// =====================================================
// DATE HELPERS
// =====================================================

function toDateTimeLocal(value) {

    if (!value) {
        return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const offset =
        date.getTimezoneOffset();

    const localDate =
        new Date(
            date.getTime() -
            offset * 60000
        );

    return localDate
        .toISOString()
        .slice(0, 16);
}


function toISOString(value) {

    if (!value) {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString();
}


// =====================================================
// EDIT MODE
// =====================================================

function enableEditing() {

    eventNameInput.disabled = false;
    startInput.disabled = false;
    endInput.disabled = false;

    saveBtn.disabled = false;

    addMilestoneBtn.disabled = false;
    addAnnouncementBtn.disabled = false;

    editBtn.classList.add('hidden');
    cancelBtn.classList.remove('hidden');

    formError.textContent = '';

    saveState.textContent = 'Editing';

    eventNameInput.focus();
}


function disableEditing() {

    eventNameInput.disabled = true;
    startInput.disabled = true;
    endInput.disabled = true;

    saveBtn.disabled = true;

    addMilestoneBtn.disabled = true;
    addAnnouncementBtn.disabled = true;

    editBtn.classList.remove('hidden');
    cancelBtn.classList.add('hidden');
}


// =====================================================
// EDIT BUTTON
// =====================================================

editBtn.addEventListener('click', () => {

    enableEditing();

});


// =====================================================
// CANCEL BUTTON
// =====================================================

cancelBtn.addEventListener('click', () => {

    eventNameInput.value =
        lastSavedValues.eventName;

    startInput.value =
        lastSavedValues.start;

    endInput.value =
        lastSavedValues.end;

    formError.textContent = '';

    saveState.textContent = 'Saved';

    disableEditing();

});


// =====================================================
// PUBLISH SCHEDULE
// =====================================================

saveBtn.addEventListener('click', async () => {

    formError.textContent = '';

    const eventName =
        eventNameInput.value.trim();

    const start =
        toISOString(startInput.value);

    const end =
        toISOString(endInput.value);


    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if (!eventName) {

        formError.textContent =
            'Event name is required.';

        return;
    }

    if (!start) {

        formError.textContent =
            'Start time is required.';

        return;
    }

    if (!end) {

        formError.textContent =
            'End time is required.';

        return;
    }

    if (new Date(end) <= new Date(start)) {

        formError.textContent =
            'End time must be after start time.';

        return;
    }


    // -------------------------------------------------
    // VALIDATE MILESTONES
    // -------------------------------------------------

    for (const milestone of schedule.milestones) {

        if (!milestone.name) {

            formError.textContent =
                'Every milestone needs a name.';

            return;
        }

        if (milestone.type === 'offset') {

            if (
                !Number.isFinite(
                    Number(milestone.minutesAfterStart)
                )
            ) {

                formError.textContent =
                    'Invalid milestone offset.';

                return;
            }

        } else if (milestone.type === 'exact') {

            if (!milestone.exactAt) {

                formError.textContent =
                    'Every exact milestone needs a date and time.';

                return;
            }

        }
    }


    // -------------------------------------------------
    // DISABLE WHILE SAVING
    // -------------------------------------------------

    saveBtn.disabled = true;

    saveState.textContent =
        'Publishing...';


    try {

        // ---------------------------------------------
        // CREATE CLEAN PAYLOAD
        // ---------------------------------------------

        const updatedSchedule = {

            eventName,

            start,

            end,

            milestones:
                schedule.milestones.map(m => ({

                    id:
                        m.id ||
                        crypto.randomUUID(),

                    name:
                        String(m.name || '').trim(),

                    type:
                        m.type,

                    minutesAfterStart:
                        m.type === 'offset'
                            ? Number(
                                m.minutesAfterStart
                              )
                            : null,

                    exactAt:
                        m.type === 'exact'
                            ? toISOString(
                                m.exactAt
                              )
                            : null,

                    warnMinutes:
                        Number(
                            m.warnMinutes ?? 5
                        ),

                    message:
                        String(
                            m.message || ''
                        ).trim()
                })),

            announcements:
                schedule.announcements.map(a => ({

                    id:
                        a.id ||
                        crypto.randomUUID(),

                    text:
                        String(
                            a.text || ''
                        ).trim(),

                    showFrom:
                        toISOString(
                            a.showFrom
                        ),

                    showUntil:
                        toISOString(
                            a.showUntil
                        )
                }))
        };


        console.log(
            'Publishing schedule:',
            updatedSchedule
        );


        // ---------------------------------------------
        // SEND TO SERVER
        // ---------------------------------------------

        const response =
            await fetch('/api/state', {

                method: 'PUT',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                credentials:
                    'same-origin',

                cache:
                    'no-store',

                body:
                    JSON.stringify(
                        updatedSchedule
                    )
            });


        const data =
            await response.json();


        console.log(
            'Server response:',
            data
        );


        if (!response.ok) {

            throw new Error(
                data.error ||
                'Failed to publish schedule.'
            );
        }


        // ---------------------------------------------
        // USE SERVER VERSION
        // ---------------------------------------------

        schedule =
            data.schedule;


        eventNameInput.value =
            schedule.eventName;

        startInput.value =
            toDateTimeLocal(
                schedule.start
            );

        endInput.value =
            toDateTimeLocal(
                schedule.end
            );


        lastSavedValues = {

            eventName:
                eventNameInput.value,

            start:
                startInput.value,

            end:
                endInput.value
        };


        // ---------------------------------------------
        // UPDATE UI
        // ---------------------------------------------

        renderMilestones();
        renderAnnouncements();

        saveState.textContent =
            'Published ✓';

        formError.textContent = '';

        disableEditing();


        // ---------------------------------------------
        // DEBUG INFORMATION
        // ---------------------------------------------

        console.log(
            '================================='
        );

        console.log(
            'COUNTDOWN UPDATED'
        );

        console.log(
            'Event:',
            schedule.eventName
        );

        console.log(
            'Start:',
            schedule.start
        );

        console.log(
            'End:',
            schedule.end
        );

        console.log(
            '================================='
        );


    } catch (error) {

        console.error(
            'Publish error:',
            error
        );

        saveState.textContent =
            'Not saved';

        formError.textContent =
            error.message ||
            'Could not publish schedule.';

        saveBtn.disabled = false;
    }

});


// =====================================================
// MILESTONES
// =====================================================

function renderMilestones() {

    milestonesContainer.innerHTML = '';


    if (schedule.milestones.length === 0) {

        milestonesContainer.innerHTML =
            '<div class="item">' +
            '<span class="item-name">' +
            'No milestones yet' +
            '</span>' +
            '</div>';

        return;
    }


    schedule.milestones.forEach(
        (milestone, index) => {

            const item =
                document.createElement('div');

            item.className =
                'admin-item';


            let timing = '';


            if (milestone.type === 'offset') {

                timing =
                    `${milestone.minutesAfterStart} minutes after start`;

            } else {

                timing =
                    new Date(
                        milestone.exactAt
                    ).toLocaleString();
            }


            item.innerHTML = `

                <div class="item-content">

                    <strong>
                        ${escapeHTML(
                            milestone.name
                        )}
                    </strong>

                    <span>
                        ${escapeHTML(timing)}
                    </span>

                    ${
                        milestone.message
                            ? `
                                <span>
                                    ${escapeHTML(
                                        milestone.message
                                    )}
                                </span>
                              `
                            : ''
                    }

                </div>

                <button
                    type="button"
                    class="small danger">

                    Delete

                </button>
            `;


            const deleteBtn =
                item.querySelector('button');


            deleteBtn.addEventListener(
                'click',
                () => {

                    schedule.milestones.splice(
                        index,
                        1
                    );

                    renderMilestones();

                    saveState.textContent =
                        'Unsaved changes';
                }
            );


            milestonesContainer.appendChild(
                item
            );

        }
    );
}


// =====================================================
// ADD MILESTONE
// =====================================================

addMilestoneBtn.addEventListener(
    'click',
    () => {

        const name =
            prompt(
                'Milestone name:'
            );


        if (!name || !name.trim()) {
            return;
        }


        const type =
            prompt(
                'Type "offset" for minutes after start, or "exact" for a specific time:',
                'offset'
            );


        if (
            type !== 'offset' &&
            type !== 'exact'
        ) {

            alert(
                'Please enter either offset or exact.'
            );

            return;
        }


        const milestone = {

            id:
                crypto.randomUUID(),

            name:
                name.trim(),

            type,

            minutesAfterStart:
                null,

            exactAt:
                null,

            warnMinutes:
                5,

            message:
                ''
        };


        // ---------------------------------------------
        // OFFSET MILESTONE
        // ---------------------------------------------

        if (type === 'offset') {

            const minutes =
                prompt(
                    'How many minutes after the event starts?',
                    '0'
                );


            const number =
                Number(minutes);


            if (
                !Number.isFinite(number) ||
                number < 0
            ) {

                alert(
                    'Please enter a valid number of minutes.'
                );

                return;
            }


            milestone.minutesAfterStart =
                number;
        }


        // ---------------------------------------------
        // EXACT MILESTONE
        // ---------------------------------------------

        else {

            const exact =
                prompt(
                    'Enter milestone date and time in this format:\nYYYY-MM-DDTHH:MM',
                    startInput.value
                );


            if (!exact) {
                return;
            }


            const date =
                new Date(exact);


            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {

                alert(
                    'Invalid date and time.'
                );

                return;
            }


            milestone.exactAt =
                date.toISOString();
        }


        // ---------------------------------------------
        // WARNING
        // ---------------------------------------------

        const warning =
            prompt(
                'Show warning how many minutes before?',
                '5'
            );


        const warnNumber =
            Number(warning);


        milestone.warnMinutes =
            Number.isFinite(warnNumber) &&
            warnNumber >= 0
                ? warnNumber
                : 5;


        // ---------------------------------------------
        // MESSAGE
        // ---------------------------------------------

        const message =
            prompt(
                'Milestone message (optional):',
                ''
            );


        milestone.message =
            message
                ? message.trim()
                : '';


        schedule.milestones.push(
            milestone
        );


        renderMilestones();

        saveState.textContent =
            'Unsaved changes';

    }
);


// =====================================================
// ANNOUNCEMENTS
// =====================================================

function renderAnnouncements() {

    announcementsContainer.innerHTML = '';


    if (
        schedule.announcements.length === 0
    ) {

        announcementsContainer.innerHTML =
            '<div class="item">' +
            '<span class="item-name">' +
            'No announcements yet' +
            '</span>' +
            '</div>';

        return;
    }


    schedule.announcements.forEach(
        (announcement, index) => {

            const item =
                document.createElement('div');

            item.className =
                'admin-item';


            const from =
                new Date(
                    announcement.showFrom
                ).toLocaleString();


            const until =
                new Date(
                    announcement.showUntil
                ).toLocaleString();


            item.innerHTML = `

                <div class="item-content">

                    <strong>
                        ${escapeHTML(
                            announcement.text
                        )}
                    </strong>

                    <span>
                        From:
                        ${escapeHTML(from)}
                    </span>

                    <span>
                        Until:
                        ${escapeHTML(until)}
                    </span>

                </div>

                <button
                    type="button"
                    class="small danger">

                    Delete

                </button>
            `;


            const deleteBtn =
                item.querySelector('button');


            deleteBtn.addEventListener(
                'click',
                () => {

                    schedule.announcements.splice(
                        index,
                        1
                    );

                    renderAnnouncements();

                    saveState.textContent =
                        'Unsaved changes';
                }
            );


            announcementsContainer.appendChild(
                item
            );

        }
    );
}


// =====================================================
// ADD ANNOUNCEMENT
// =====================================================

addAnnouncementBtn.addEventListener(
    'click',
    () => {

        const text =
            prompt(
                'Enter announcement:'
            );


        if (!text || !text.trim()) {
            return;
        }


        const showFrom =
            prompt(
                'Show from (YYYY-MM-DDTHH:MM):',
                startInput.value
            );


        if (!showFrom) {
            return;
        }


        const showUntil =
            prompt(
                'Show until (YYYY-MM-DDTHH:MM):',
                endInput.value
            );


        if (!showUntil) {
            return;
        }


        const fromDate =
            new Date(showFrom);

        const untilDate =
            new Date(showUntil);


        if (
            Number.isNaN(
                fromDate.getTime()
            ) ||
            Number.isNaN(
                untilDate.getTime()
            )
        ) {

            alert(
                'Invalid announcement date/time.'
            );

            return;
        }


        if (untilDate <= fromDate) {

            alert(
                'Show until must be after Show from.'
            );

            return;
        }


        schedule.announcements.push({

            id:
                crypto.randomUUID(),

            text:
                text.trim(),

            showFrom:
                fromDate.toISOString(),

            showUntil:
                untilDate.toISOString()
        });


        renderAnnouncements();

        saveState.textContent =
            'Unsaved changes';

    }
);


// =====================================================
// STOP EVENT
// =====================================================

stopBtn.addEventListener(
    'click',
    async () => {

        const confirmed =
            confirm(
                'Are you sure you want to stop the event?'
            );


        if (!confirmed) {
            return;
        }


        try {

            const response =
                await fetch(
                    '/api/stop',
                    {
                        method: 'POST',
                        credentials: 'same-origin',
                        cache: 'no-store'
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    'Could not stop event.'
                );
            }


            schedule =
                data.schedule;


            eventNameInput.value =
                schedule.eventName;

            startInput.value =
                toDateTimeLocal(
                    schedule.start
                );

            endInput.value =
                toDateTimeLocal(
                    schedule.end
                );


            lastSavedValues = {

                eventName:
                    eventNameInput.value,

                start:
                    startInput.value,

                end:
                    endInput.value
            };


            renderMilestones();
            renderAnnouncements();


            saveState.textContent =
                'Event stopped';

            disableEditing();


            alert(
                'Event stopped.'
            );


        } catch (error) {

            console.error(error);

            alert(
                error.message ||
                'Could not stop event.'
            );
        }

    }
);


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    const div =
        document.createElement('div');

    div.textContent =
        value ?? '';

    return div.innerHTML;
}


// =====================================================
// INITIAL LOAD
// =====================================================

loadState();


// =====================================================
// INITIAL BUTTON STATE
// =====================================================

disableEditing();