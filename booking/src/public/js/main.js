document.addEventListener('DOMContentLoaded', () => {
    // Theme mechanics (Dark/Light mode)
    const themeToggle = document.getElementById('theme-toggle');
    const themeToggleDropdown = document.getElementById('theme-toggle-dropdown');
    const htmlElement = document.documentElement;

    const toggleThemeFn = (btn) => {
        if (!btn) return;
        btn.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            btn.style.transform = 'scale(0.9)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 100);

            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            console.log(`Theme toggled to: ${newTheme}`);
        });
    };

    toggleThemeFn(themeToggle);
    toggleThemeFn(themeToggleDropdown);

    // User Dropdown Menu logic (Year 2026 Premium Ergonomics)
    const trigger = document.getElementById('user-menu-trigger');
    const dropdown = document.getElementById('user-dropdown');

    if (trigger && dropdown) {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }

    // Automatically remove alert notifications after 4 seconds
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                alert.remove();
            }, 300);
        }, 4000);
    });


    // Calendar Page Kaskadierende Schnellwahl (Kategorie -> Raum)
    const calCategorySelect = document.getElementById('calendar-category-select');
    const calRoomSelect = document.getElementById('calendar-room-select');

    if (calCategorySelect && calRoomSelect) {
        const filterCalRooms = (deptId) => {
            const options = calRoomSelect.querySelectorAll('option');
            options.forEach(opt => {
                const optDept = opt.getAttribute('data-dept');
                if (!deptId || optDept === deptId) {
                    opt.style.display = '';
                    opt.disabled = false;
                } else {
                    opt.style.display = 'none';
                    opt.disabled = true;
                }
            });
        };

        // Initial filter on load based on current selected category
        if (calCategorySelect.value) {
            filterCalRooms(calCategorySelect.value);
        }

        calCategorySelect.addEventListener('change', (e) => {
            const selectedDeptId = e.target.value;
            filterCalRooms(selectedDeptId);
            
            // Synchronize the default category form input value
            const defaultCatInput = document.getElementById('default-category-id');
            if (defaultCatInput) {
                defaultCatInput.value = selectedDeptId;
            }
            
            // If currently selected room is not in the newly selected category, select the first visible room and reload
            const activeOpt = calRoomSelect.querySelector(`option[value="${calRoomSelect.value}"]`);
            if (activeOpt && activeOpt.disabled) {
                const firstVisibleOpt = calRoomSelect.querySelector('option:not([disabled])');
                if (firstVisibleOpt) {
                    calRoomSelect.value = firstVisibleOpt.value;
                    calRoomSelect.form.submit();
                }
            }
        });
    }
});

// Global Popup Modal Management Helpers (Year 2026 Premium Ergonomics)
window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
        // ESC key listener for modal closing
        const escListener = (e) => {
            if (e.key === 'Escape') {
                window.closeModal(modalId);
                document.removeEventListener('keydown', escListener);
            }
        };
        document.addEventListener('keydown', escListener);
    }
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        // Disable body scroll lock if no other modal is visible
        const visibleModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
        if (visibleModals.length === 0) {
            document.body.classList.remove('modal-open');
        }
    }
};

window.openEditBookingModal = function(bookingId, notes, roomName, periodName, dateStr, isTimetable = false, weekId = '', dateStart = '', dateEnd = '', userName = '', redirectTo = '') {
    try {
        const modal = document.getElementById('edit-booking-modal');
        if (!modal) {
            console.error('Modal #edit-booking-modal not found');
            return;
        }

        if (document.getElementById('edit-booking-id')) document.getElementById('edit-booking-id').value = bookingId || '';
        if (document.getElementById('edit-booking-notes')) document.getElementById('edit-booking-notes').value = notes || '';
        if (document.getElementById('edit-booking-room-name')) document.getElementById('edit-booking-room-name').value = roomName || 'Raum';
        if (document.getElementById('edit-booking-period-name')) document.getElementById('edit-booking-period-name').value = periodName || 'Unterrichtsstunde';

        if (document.getElementById('edit-booking-redirect-to')) {
            document.getElementById('edit-booking-redirect-to').value = redirectTo || '';
        }

        const isTT = (isTimetable === true || isTimetable === 'true');

        const titleElem = document.getElementById('edit-booking-modal-title');
        if (titleElem) {
            titleElem.textContent = isTT ? '✏️ Dauerbuchung bearbeiten' : '✏️ Reservierung bearbeiten';
        }

        const userElem = document.getElementById('edit-booking-user');
        if (userElem) {
            userElem.value = userName || 'Sie selbst';
        }

        const dateFormattedElem = document.getElementById('edit-booking-date-formatted');
        if (dateFormattedElem) {
            if (dateStr && dateStr.split('-').length === 3) {
                const parts = dateStr.split('-');
                const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
                dateFormattedElem.value = isTT ? (dateObj.toLocaleDateString('de-DE', { weekday: 'long' }) + 's') : dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
            } else {
                dateFormattedElem.value = dateStr || (isTT ? 'Stundenplan' : 'Datum');
            }
        }

        const ttGroup = document.getElementById('edit-timetable-fields-group');
        if (ttGroup) {
            if (isTT) {
                ttGroup.classList.remove('hidden');
                const weekSelect = document.getElementById('edit-booking-week-id');
                if (weekSelect) weekSelect.value = weekId || '';

                const dateStartInput = document.getElementById('edit-booking-date-start');
                if (dateStartInput) dateStartInput.value = dateStart || dateStr || '';

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
    } catch (err) {
        console.error('Error opening edit booking modal:', err);
    }
};

window.handleEditBtnClick = function(event, btn) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    if (!btn) return;
    const ds = btn.dataset || {};
    window.openEditBookingModal(
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
};

// Vorkonfigurierte Voreinstellungen für die Bearbeitungs-Modale
window.openEditRoomModal = function(id, name, deptId, notes, bookable) {
    document.getElementById('edit-room-id').value = id;
    document.getElementById('edit-room-name').value = name;
    document.getElementById('edit-room-dept').value = deptId || "";
    document.getElementById('edit-room-notes').value = notes || "";
    document.getElementById('edit-room-bookable').checked = parseInt(bookable) === 1;
    openModal('edit-room-modal');
};

window.openEditPeriodModal = function(id, name, start, end, bookable) {
    document.getElementById('edit-period-id').value = id;
    document.getElementById('edit-period-name').value = name;
    document.getElementById('edit-period-start').value = start;
    document.getElementById('edit-period-end').value = end;
    document.getElementById('edit-period-bookable').checked = parseInt(bookable) === 1;
    openModal('edit-period-modal');
};

window.openEditDepartmentModal = function(id, name, desc, icon) {
    document.getElementById('edit-dept-id').value = id;
    document.getElementById('edit-dept-name').value = name;
    document.getElementById('edit-dept-desc').value = desc || "";
    document.getElementById('edit-dept-icon').value = icon || "general";
    openModal('edit-department-modal');
};

window.openEditHolidayModal = function(id, name, start, end) {
    document.getElementById('edit-holiday-id').value = id;
    document.getElementById('edit-holiday-name').value = name;
    document.getElementById('edit-holiday-start').value = start;
    document.getElementById('edit-holiday-end').value = end;
    openModal('edit-holiday-modal');
};

window.openEditUserModal = function(id, username, first, last, email, auth) {
    document.getElementById('edit-user-id').value = id;
    document.getElementById('edit-user-username').value = username;
    document.getElementById('edit-user-first').value = first || "";
    document.getElementById('edit-user-last').value = last || "";
    document.getElementById('edit-user-email').value = email || "";
    document.getElementById('edit-user-auth').value = auth;
    document.getElementById('edit-user-password').value = ""; // Always clear password field on open
    openModal('edit-user-modal');
};

window.openEditTimetableModal = function(id, roomId, periodId, dayNum, weekId, notes) {
    document.getElementById('edit-tt-id').value = id;
    document.getElementById('edit-tt-room').value = roomId;
    document.getElementById('edit-tt-period').value = periodId;
    document.getElementById('edit-tt-day').value = dayNum;
    document.getElementById('edit-tt-week').value = weekId || "";
    document.getElementById('edit-tt-notes').value = notes;
    openModal('edit-timetable-modal');
};

window.openEditWeekModal = function(id, name) {
    document.getElementById('edit-week-id').value = id;
    document.getElementById('edit-week-name').value = name;
    openModal('edit-week-modal');
};

// Document-level click listener for edit booking trigger buttons
document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.btn-edit-booking-trigger');
    if (trigger) {
        window.handleEditBtnClick(e, trigger);
    }
});
