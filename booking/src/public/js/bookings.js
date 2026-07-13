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

    // Reveal modal with a smooth micro-animation scaling
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    
    // Focus the notes input directly
    setTimeout(() => {
        const notesInput = document.getElementById('modal-notes');
        if (notesInput) {
            notesInput.value = '';
            notesInput.focus();
        }
    }, 50);
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
    if (!weekGroup) return;
    if (type === 'timetable') {
        weekGroup.classList.remove('hidden');
    } else {
        weekGroup.classList.add('hidden');
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
