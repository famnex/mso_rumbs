// Modern Interactive Weekly Calendar Overlay mechanics

function openBookingModal(roomId, roomName, periodId, periodName, dateStr) {
    const modal = document.getElementById('booking-modal');
    if (!modal) return;

    // Populate hidden input forms
    document.getElementById('modal-room-id').value = roomId;
    document.getElementById('modal-period-id').value = periodId;
    document.getElementById('modal-date').value = dateStr;

    // Populate visible read-only preview fields
    document.getElementById('modal-room-name').value = roomName;
    document.getElementById('modal-period-name').value = periodName;
    
    // Format date nicely (de-DE)
    const dateObj = new Date(dateStr);
    const dateFormatted = dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const weekdayName = dateObj.toLocaleDateString('de-DE', { weekday: 'long' });
    const weekdayPlural = weekdayName + 's';

    const dateFormattedInput = document.getElementById('modal-date-formatted');
    if (dateFormattedInput) {
        dateFormattedInput.dataset.fullDateFormatted = dateFormatted;
        dateFormattedInput.dataset.weekdayPlural = weekdayPlural;
        dateFormattedInput.value = dateFormatted;
    }

    // Set default "Von" date_start to clicked dateStr
    const dateStartInput = document.getElementById('modal-date-start');
    if (dateStartInput) {
        dateStartInput.value = dateStr;
    }

    // Set "Bis" date_end from last used localStorage value
    const dateEndInput = document.getElementById('modal-date-end');
    if (dateEndInput) {
        const lastBis = localStorage.getItem('last_timetable_date_end') || '';
        dateEndInput.value = lastBis;
    }

    // Reveal modal with a smooth micro-animation scaling
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    
    // Reset admin booking type selector
    const bookingTypeSelect = document.getElementById('modal-booking-type');
    if (bookingTypeSelect) {
        bookingTypeSelect.value = 'single';
        toggleBookingTypeFields('single');
    } else {
        checkModalCollisions();
    }

    // Focus the notes input directly
    setTimeout(() => {
        const notesInput = document.getElementById('modal-notes');
        if (notesInput) {
            notesInput.value = '';
            notesInput.focus();
        }
    }, 50);
}

function onBisDateChange(val) {
    if (val) {
        localStorage.setItem('last_timetable_date_end', val);
    }
    checkModalCollisions();
}

function closeBookingModal(event = null, force = false) {
    const modal = document.getElementById('booking-modal');
    if (!modal) return;

    // Hide modal
    modal.classList.add('hidden');
    
    // Disable body scroll lock if no other modal is visible
    const visibleModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
    if (visibleModals.length === 0) {
        document.body.classList.remove('modal-open');
    }
    
    // Reset values safely
    const notesInput = document.getElementById('modal-notes');
    if (notesInput) notesInput.value = '';

    // Reset admin booking type selector
    const bookingTypeSelect = document.getElementById('modal-booking-type');
    if (bookingTypeSelect) {
        bookingTypeSelect.value = 'single';
        toggleBookingTypeFields('single');
    }
}

function toggleBookingTypeFields(type) {
    const weekGroup = document.getElementById('modal-week-rotation-group');
    const dateRangeGroup = document.getElementById('modal-date-range-group');
    const dateFormattedInput = document.getElementById('modal-date-formatted');

    if (type === 'timetable') {
        if (weekGroup) weekGroup.classList.remove('hidden');
        if (dateRangeGroup) dateRangeGroup.classList.remove('hidden');
        if (dateFormattedInput && dateFormattedInput.dataset.weekdayPlural) {
            dateFormattedInput.value = dateFormattedInput.dataset.weekdayPlural;
        }
    } else {
        if (weekGroup) weekGroup.classList.add('hidden');
        if (dateRangeGroup) dateRangeGroup.classList.add('hidden');
        if (dateFormattedInput && dateFormattedInput.dataset.fullDateFormatted) {
            dateFormattedInput.value = dateFormattedInput.dataset.fullDateFormatted;
        }
    }
    checkModalCollisions();
}

function checkModalCollisions() {
    const bookingTypeSelect = document.getElementById('modal-booking-type');
    const bookingType = bookingTypeSelect ? bookingTypeSelect.value : 'single';

    const collisionInfo = document.getElementById('modal-collision-info');
    const collisionDetails = document.getElementById('modal-collision-details');
    const overwriteContainer = document.getElementById('modal-overwrite-container');
    const overwriteCheckbox = document.getElementById('modal-overwrite');
    const submitBtn = document.getElementById('modal-submit-btn');

    if (!submitBtn) return;

    // Requirement 1: If single booking, hide collision warning & overwrite checkbox completely, enable submit button
    if (bookingType !== 'timetable') {
        if (collisionInfo) collisionInfo.classList.add('hidden');
        if (overwriteContainer) overwriteContainer.classList.add('hidden');
        if (overwriteCheckbox) overwriteCheckbox.checked = false;

        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.removeAttribute('title');
        return;
    }

    // Evaluate collision ONLY for timetable bookings
    const weekSelect = document.getElementById('modal-week-id');
    const targetWeekId = (weekSelect && weekSelect.value) ? parseInt(weekSelect.value) : null;
    const dateStr = document.getElementById('modal-date') ? document.getElementById('modal-date').value : '';
    const dateStartVal = document.getElementById('modal-date-start') && document.getElementById('modal-date-start').value ? document.getElementById('modal-date-start').value : dateStr;
    let dateEndVal = document.getElementById('modal-date-end') ? document.getElementById('modal-date-end').value : '';
    if (dateEndVal && dateStartVal && dateEndVal < dateStartVal) {
        dateEndVal = ''; // ignore inverted / invalid date_end
    }

    const roomId = document.getElementById('modal-room-id') ? parseInt(document.getElementById('modal-room-id').value) : null;
    const periodId = document.getElementById('modal-period-id') ? parseInt(document.getElementById('modal-period-id').value) : null;

    // Read stored room bookings array
    const bookings = window.currentRoomBookings || [];

    // Determine day_num (1 = Mon, ..., 5 = Fri) for dateStr
    let dayNum = null;
    if (dateStr) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            dayNum = dateObj.getDay(); // 1=Mon...5=Fri
        }
    }

    let conflictingBooking = null;

    conflictingBooking = bookings.find(b => {
        if (b.period_id !== periodId) return false;

        // Calculate weekday for existing booking (whether single-date or timetable)
        let bDayNum = b.day_num;
        if (b.date) {
            const p = b.date.split('-');
            if (p.length === 3) {
                bDayNum = new Date(p[0], p[1] - 1, p[2]).getDay();
            }
        }

        if (bDayNum !== dayNum) return false;

        // Check Turnus compatibility (e.g. Ungerade vs Gerade)
        if (targetWeekId) {
            let bWeekId = b.week_id;
            if (b.date) {
                // Determine Monday of b.date to look up turnus in window.currentWeekDatesMap
                const p = b.date.split('-');
                if (p.length === 3) {
                    const d = new Date(p[0], p[1] - 1, p[2]);
                    const dDay = d.getDay();
                    const mOffset = dDay === 0 ? -6 : 1 - dDay;
                    d.setDate(d.getDate() + mOffset);
                    const bMondayStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                    if (window.currentWeekDatesMap && window.currentWeekDatesMap[bMondayStr]) {
                        bWeekId = parseInt(window.currentWeekDatesMap[bMondayStr]);
                    }
                }
            }

            if (bWeekId && bWeekId !== targetWeekId) {
                return false; // Different turnus (e.g. Ungerade vs Gerade), no collision!
            }
        }

        // Check Date Range overlap (Von / Bis)
        if (b.date) {
            // Existing is single-date booking
            if (dateStartVal && b.date < dateStartVal) return false;
            if (dateEndVal && b.date > dateEndVal) return false;
            return true;
        }

        if (b.date === null) {
            // Existing is timetable block
            if (dateStartVal && b.date_end && b.date_end < dateStartVal) return false;
            if (dateEndVal && b.date_start && b.date_start > dateEndVal) return false;
            return true;
        }

        return false;
    });

    if (conflictingBooking) {
        // Conflict found for timetable block!
        const userName = conflictingBooking.displayname || conflictingBooking.username || 'Unbekannt';
        const noteText = conflictingBooking.notes ? `"${conflictingBooking.notes}"` : 'Keine Notiz';
        
        function formatDE(s) {
            if (!s) return 'Unbegrenzt';
            const p = s.split('-');
            return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : s;
        }

        let typeInfo = '';
        let periodInfo = '';

        if (conflictingBooking.date) {
            typeInfo = `Einzelbuchung`;
            periodInfo = `Datum: ${formatDE(conflictingBooking.date)}`;
        } else {
            typeInfo = `Stundenplaneintrag [${conflictingBooking.week_name || 'Jede Woche'}]`;
            periodInfo = `Von ${formatDE(conflictingBooking.date_start)} bis ${formatDE(conflictingBooking.date_end)}`;
        }

        if (collisionDetails) {
            collisionDetails.innerHTML = `
                • <strong>Gebucht von:</strong> ${userName}<br>
                • <strong>Zweck / Notiz:</strong> ${noteText}<br>
                • <strong>Typ & Turnus:</strong> ${typeInfo}<br>
                • <strong>Gültigkeitszeitraum:</strong> ${periodInfo}<br>
                <span style="color: var(--text-muted); font-size: 11.5px; margin-top: 6px; display: block;">
                    Aktivieren Sie die Checkbox "Kollisionen überschreiben", um den Speicherbutton zu aktivieren und diese Buchung zu ersetzen.
                </span>`;
        }

        if (collisionInfo) collisionInfo.classList.remove('hidden');
        if (overwriteContainer) overwriteContainer.classList.remove('hidden');

        const isChecked = overwriteCheckbox && overwriteCheckbox.checked;
        if (!isChecked) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.4';
            submitBtn.style.cursor = 'not-allowed';
            submitBtn.title = 'Aktivieren Sie die Checkbox "Kollisionen überschreiben", um zu speichern.';
        } else {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
            submitBtn.removeAttribute('title');
        }

    } else {
        // No collision!
        if (collisionInfo) collisionInfo.classList.add('hidden');
        if (overwriteContainer) overwriteContainer.classList.add('hidden');
        if (overwriteCheckbox) overwriteCheckbox.checked = false;

        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.removeAttribute('title');
    }
}

// Support hitting ESC key to instantly close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeBookingModal(null, true);
        closeModal('admin-edit-booking-modal');
        closeModal('admin-edit-timetable-modal');
    }
});

function handleEditBtnClick(event, btn) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    if (!btn) return;
    const ds = btn.dataset || {};
    openEditBookingModal(
        ds.bookingId,
        ds.notes || '',
        ds.roomName || '',
        ds.periodName || '',
        ds.date || '',
        ds.isTimetable === 'true',
        ds.weekId || '',
        ds.dateStart || '',
        ds.dateEnd || '',
        ds.userName || '',
        ds.redirectTo || ''
    );
}

function openEditBookingModal(bookingId, notes, roomName, periodName, dateStr, isTimetable = false, weekId = '', dateStart = '', dateEnd = '', userName = '', redirectTo = '') {
    const modal = document.getElementById('edit-booking-modal');
    if (!modal) return;

    if (document.getElementById('edit-booking-id')) document.getElementById('edit-booking-id').value = bookingId;
    if (document.getElementById('edit-booking-notes')) document.getElementById('edit-booking-notes').value = notes || '';
    if (document.getElementById('edit-booking-room-name')) document.getElementById('edit-booking-room-name').value = roomName || 'Raum';
    if (document.getElementById('edit-booking-period-name')) document.getElementById('edit-booking-period-name').value = periodName || 'Unterrichtsstunde';

    if (document.getElementById('edit-booking-redirect-to')) {
        document.getElementById('edit-booking-redirect-to').value = redirectTo || '';
    }

    const titleElem = document.getElementById('edit-booking-modal-title');
    if (titleElem) {
        titleElem.textContent = isTimetable ? '✏️ Dauerbuchung bearbeiten' : '✏️ Reservierung bearbeiten';
    }

    const userElem = document.getElementById('edit-booking-user');
    if (userElem) {
        userElem.value = userName || 'Sie selbst';
    }

    const dateFormattedElem = document.getElementById('edit-booking-date-formatted');
    if (dateFormattedElem && dateStr) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            dateFormattedElem.value = isTimetable ? (dateObj.toLocaleDateString('de-DE', { weekday: 'long' }) + 's') : dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
        } else {
            dateFormattedElem.value = dateStr;
        }
    }

    const ttGroup = document.getElementById('edit-timetable-fields-group');
    if (ttGroup) {
        if (isTimetable) {
            ttGroup.classList.remove('hidden');
            const weekSelect = document.getElementById('edit-booking-week-id');
            if (weekSelect) weekSelect.value = weekId || '';

            const dateStartInput = document.getElementById('edit-booking-date-start');
            if (dateStartInput) dateStartInput.value = dateStart || dateStr;

            const dateEndInput = document.getElementById('edit-booking-date-end');
            if (dateEndInput) dateEndInput.value = dateEnd || '';
        } else {
            ttGroup.classList.add('hidden');
        }
    }

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');

    setTimeout(() => {
        const notesInput = document.getElementById('edit-booking-notes');
        if (notesInput) notesInput.focus();
    }, 50);
}

function openAdminEditBookingModal(bookingId, roomId, roomName, periodId, periodName, dateStr, userName, notes) {
    openEditBookingModal(bookingId, notes, roomName, periodName, dateStr, false, '', '', '', userName);
}

function openAdminEditTimetableModal(bookingId, roomId, roomName, periodId, periodName, dateStr, dayNum, notes, weekId) {
    openEditBookingModal(bookingId, notes, roomName, periodName, dateStr, true, weekId, dateStr, '', 'Stundenplan');
}

function openDetailModal(roomName, periodName, dateStr, userStr, notesStr) {
    const modal = document.getElementById('detail-modal');
    if (!modal) return;

    document.getElementById('detail-room-name').value = roomName;
    document.getElementById('detail-period-name').value = periodName;
    document.getElementById('detail-user').value = userStr;
    document.getElementById('detail-notes').value = notesStr || 'Keine Angabe';

    // Format date nicely (de-DE)
    const dateObj = new Date(dateStr);
    const dateFormatted = dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    document.getElementById('detail-date-formatted').value = dateFormatted;

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    if (modal) {
        modal.classList.add('hidden');
        // Disable body scroll lock if no other modal is visible
        const visibleModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
        if (visibleModals.length === 0) {
            document.body.classList.remove('modal-open');
        }
    }
}

// Extend existing escape key listener to close detail modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeDetailModal();
    }
});

// Calendar Page: Redirect when a new date is selected via week-datepicker-input
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('week-datepicker-input');
    if (input) {
        // Force opening picker on click anywhere on the input (especially Chrome desktop text area)
        // Since pointer-events: auto is active, this click handler is triggered directly by the user on the input,
        // which iOS Safari permits under its user-gesture security policies.
        input.addEventListener('click', () => {
            if (typeof input.showPicker === 'function') {
                input.showPicker();
            }
        });

        input.addEventListener('change', (e) => {
            const selectedDate = e.target.value;
            if (selectedDate) {
                const urlParams = new URLSearchParams(window.location.search);
                const roomId = urlParams.get('room_id') || '';
                window.location.href = `${window.location.pathname}?room_id=${roomId}&date=${selectedDate}`;
            }
        });
    }
});
