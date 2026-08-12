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
    document.getElementById('modal-date-formatted').value = dateFormatted;

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

    if (type === 'timetable') {
        if (weekGroup) weekGroup.classList.remove('hidden');
        if (dateRangeGroup) dateRangeGroup.classList.remove('hidden');
    } else {
        if (weekGroup) weekGroup.classList.add('hidden');
        if (dateRangeGroup) dateRangeGroup.classList.add('hidden');
    }
    checkModalCollisions();
}

function checkModalCollisions() {
    const bookingTypeSelect = document.getElementById('modal-booking-type');
    const bookingType = bookingTypeSelect ? bookingTypeSelect.value : 'single';
    const weekSelect = document.getElementById('modal-week-id');
    const targetWeekId = (weekSelect && weekSelect.value) ? parseInt(weekSelect.value) : null;
    const dateStr = document.getElementById('modal-date') ? document.getElementById('modal-date').value : '';
    const roomId = document.getElementById('modal-room-id') ? parseInt(document.getElementById('modal-room-id').value) : null;
    const periodId = document.getElementById('modal-period-id') ? parseInt(document.getElementById('modal-period-id').value) : null;

    const collisionInfo = document.getElementById('modal-collision-info');
    const collisionDetails = document.getElementById('modal-collision-details');
    const overwriteContainer = document.getElementById('modal-overwrite-container');
    const overwriteCheckbox = document.getElementById('modal-overwrite');
    const submitBtn = document.getElementById('modal-submit-btn');

    if (!collisionInfo || !submitBtn) return;

    // Read stored bookings array
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

    const dateStartVal = document.getElementById('modal-date-start') ? document.getElementById('modal-date-start').value : dateStr;
    const dateEndVal = document.getElementById('modal-date-end') ? document.getElementById('modal-date-end').value : '';

    let conflictingBooking = null;

    if (bookingType === 'timetable') {
        // Check collision for timetable booking
        conflictingBooking = bookings.find(b => {
            if (b.period_id !== periodId) return false;
            if (b.day_num !== dayNum) return false;
            
            // If existing is single-date booking
            if (b.date) {
                if (dateStartVal && b.date < dateStartVal) return false;
                if (dateEndVal && b.date > dateEndVal) return false;
                return true;
            }
            // If existing is timetable block
            if (b.date === null) {
                if (!targetWeekId || !b.week_id || b.week_id === targetWeekId) {
                    if (dateStartVal && b.date_end && b.date_end < dateStartVal) return false;
                    if (dateEndVal && b.date_start && b.date_start > dateEndVal) return false;
                    return true;
                }
            }
            return false;
        });
    } else {
        // Check collision for single booking
        conflictingBooking = bookings.find(b => {
            if (b.period_id !== periodId) return false;
            if (b.date === dateStr) return true;
            if (b.date === null && b.day_num === dayNum) {
                // Check if timetable block date range covers dateStr
                if (b.date_start && b.date_start > dateStr) return false;
                if (b.date_end && b.date_end < dateStr) return false;
                return true;
            }
            return false;
        });
    }

    if (conflictingBooking) {
        // Conflict found!
        const userName = conflictingBooking.displayname || conflictingBooking.username || 'Unbekannt';
        const noteText = conflictingBooking.notes ? ` (Zweck: "${conflictingBooking.notes}")` : '';
        let typeInfo = '';
        if (conflictingBooking.date) {
            typeInfo = `Einzelbuchung am ${conflictingBooking.date}`;
        } else if (conflictingBooking.week_name) {
            typeInfo = `Stundenplaneintrag [${conflictingBooking.week_name}]`;
        } else {
            typeInfo = `Stundenplaneintrag [Jede Woche]`;
        }

        collisionDetails.innerHTML = `• <strong>Gebucht von:</strong> ${userName}${noteText}<br>• <strong>Belegungstyp:</strong> ${typeInfo}<br><span style="color: var(--text-muted); font-size: 11.5px; margin-top: 4px; display: block;">Aktivieren Sie die Checkbox "Kollisionen überschreiben", um den Speicherbutton zu aktivieren und diese Buchung zu ersetzen.</span>`;
        collisionInfo.classList.remove('hidden');

        if (overwriteContainer) overwriteContainer.classList.remove('hidden');

        const isChecked = overwriteCheckbox && overwriteCheckbox.checked;
        if (!isChecked) {
            // Disable submit button as requested
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.4';
            submitBtn.style.cursor = 'not-allowed';
            submitBtn.title = 'Aktivieren Sie die Checkbox "Kollisionen überschreiben", um zu speichern.';
        } else {
            // Enable submit button
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
            submitBtn.removeAttribute('title');
        }

    } else {
        // No collision!
        collisionInfo.classList.add('hidden');
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

function openAdminEditBookingModal(bookingId, roomId, roomName, periodId, periodName, dateStr, userStr, notesStr) {
    document.getElementById('admin-edit-booking-id').value = bookingId;
    document.getElementById('admin-edit-booking-room-id').value = roomId;
    document.getElementById('admin-edit-booking-date').value = dateStr;
    document.getElementById('admin-edit-booking-room-name').value = roomName;
    document.getElementById('admin-edit-booking-period-name').value = periodName;
    document.getElementById('admin-edit-booking-user').value = userStr;
    document.getElementById('admin-edit-booking-notes').value = notesStr;
    
    // Formatting date
    const dateObj = new Date(dateStr);
    const dateFormatted = dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    document.getElementById('admin-edit-booking-date-formatted').value = dateFormatted;
    
    // Set for cancellation form too
    document.getElementById('admin-cancel-booking-id').value = bookingId;
    document.getElementById('admin-cancel-booking-room-id').value = roomId;
    document.getElementById('admin-cancel-booking-date').value = dateStr;
    
    openModal('admin-edit-booking-modal');
}

function openAdminEditTimetableModal(bookingId, roomId, roomName, periodId, periodName, dateStr, dayNum, notesStr, weekId) {
    document.getElementById('admin-edit-tt-id').value = bookingId;
    document.getElementById('admin-edit-tt-room-id').value = roomId;
    document.getElementById('admin-edit-tt-period-id').value = periodId;
    document.getElementById('admin-edit-tt-day-num').value = dayNum;
    document.getElementById('admin-edit-tt-room-name').value = roomName;
    document.getElementById('admin-edit-tt-period-name').value = periodName;
    document.getElementById('admin-edit-tt-notes').value = notesStr;
    document.getElementById('admin-edit-tt-week-id').value = weekId || "";
    
    // Convert dayNum to readable German day name
    const daysMap = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
    document.getElementById('admin-edit-tt-day-name').value = daysMap[dayNum] || 'Wochentag';
    
    // Redirect back to this current calendar URL after edit or delete!
    const currentUrl = window.location.pathname + window.location.search;
    document.getElementById('admin-edit-tt-redirect').value = currentUrl;
    document.getElementById('admin-delete-tt-id').value = bookingId;
    document.getElementById('admin-delete-tt-redirect').value = currentUrl;
    
    openModal('admin-edit-timetable-modal');
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
