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
        // Store master list of all room options
        const allCalRoomOptions = Array.from(calRoomSelect.querySelectorAll('option'));

        const filterCalRooms = (deptId, autoSubmitIfChanged = false) => {
            const currentVal = calRoomSelect.value;
            calRoomSelect.innerHTML = '';
            
            let currentStillVisible = false;
            let firstMatchingOpt = null;

            allCalRoomOptions.forEach(opt => {
                const optDept = opt.getAttribute('data-dept');
                if (!deptId || optDept === deptId) {
                    const clonedOpt = opt.cloneNode(true);
                    clonedOpt.style.display = '';
                    clonedOpt.disabled = false;
                    calRoomSelect.appendChild(clonedOpt);
                    
                    if (!firstMatchingOpt) firstMatchingOpt = clonedOpt;
                    if (clonedOpt.value === currentVal) currentStillVisible = true;
                }
            });

            if (!currentStillVisible && firstMatchingOpt) {
                calRoomSelect.value = firstMatchingOpt.value;
                if (autoSubmitIfChanged && calRoomSelect.form) {
                    calRoomSelect.form.submit();
                }
            } else if (currentStillVisible) {
                calRoomSelect.value = currentVal;
            }
        };

        // Initial filter on load based on current selected category
        if (calCategorySelect.value) {
            filterCalRooms(calCategorySelect.value, false);
        }

        calCategorySelect.addEventListener('change', (e) => {
            const selectedDeptId = e.target.value;
            filterCalRooms(selectedDeptId, true);
            
            // Synchronize the default category form input value
            const defaultCatInput = document.getElementById('default-category-id');
            if (defaultCatInput) {
                defaultCatInput.value = selectedDeptId;
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

window.openEditPeriodModal = function(id, name, start, end, bookable, color = '') {
    document.getElementById('edit-period-id').value = id;
    document.getElementById('edit-period-name').value = name;
    document.getElementById('edit-period-start').value = start;
    document.getElementById('edit-period-end').value = end;
    document.getElementById('edit-period-bookable').checked = parseInt(bookable) === 1;
    if (document.getElementById('edit-period-color')) {
        document.getElementById('edit-period-color').value = color || '';
    }
    if (document.getElementById('edit-period-color-picker')) {
        document.getElementById('edit-period-color-picker').value = color || '#3b82f6';
    }
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

window.setEditUserAccessMode = function(mode) {
    const modeInput = document.getElementById('edit-user-access-mode');
    const btnAll = document.getElementById('btn-user-access-all');
    const btnRestricted = document.getElementById('btn-user-access-restricted');
    const hintAll = document.getElementById('edit-user-access-all-hint');
    const boxRestricted = document.getElementById('edit-user-access-restricted-box');

    if (modeInput) modeInput.value = mode === 'restricted' ? 'restricted' : 'all';

    if (mode === 'restricted') {
        if (btnRestricted) {
            btnRestricted.style.background = 'var(--bg-card, #ffffff)';
            btnRestricted.style.color = 'var(--primary, #2563eb)';
            btnRestricted.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
        }
        if (btnAll) {
            btnAll.style.background = 'transparent';
            btnAll.style.color = 'var(--text-muted)';
            btnAll.style.boxShadow = 'none';
        }
        if (hintAll) hintAll.classList.add('hidden');
        if (boxRestricted) boxRestricted.classList.remove('hidden');
    } else {
        if (btnAll) {
            btnAll.style.background = 'var(--bg-card, #ffffff)';
            btnAll.style.color = 'var(--primary, #2563eb)';
            btnAll.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
        }
        if (btnRestricted) {
            btnRestricted.style.background = 'transparent';
            btnRestricted.style.color = 'var(--text-muted)';
            btnRestricted.style.boxShadow = 'none';
        }
        if (hintAll) hintAll.classList.remove('hidden');
        if (boxRestricted) boxRestricted.classList.add('hidden');
    }
};

window.updateUserAccessSummary = function() {
    const counterEl = document.getElementById('edit-user-access-counter');
    if (!counterEl) return;
    const checkedRooms = document.querySelectorAll('.edit-user-room-cb:checked').length;
    const checkedDepts = document.querySelectorAll('.edit-user-dept-cb:checked').length;
    counterEl.textContent = `${checkedRooms} Medien / ${checkedDepts} ganze Kategorien ausgewählt`;
};

window.onUserDeptCheckboxChange = function(deptCb) {
    if (!deptCb) return;
    const deptId = deptCb.getAttribute('data-dept-id');
    deptCb.indeterminate = false;
    const roomCbs = document.querySelectorAll(`.edit-user-room-cb[data-dept-id="${deptId}"]`);
    roomCbs.forEach(cb => {
        cb.checked = deptCb.checked;
    });
    window.updateUserAccessSummary();
};

window.onUserRoomCheckboxChange = function(roomCb) {
    if (!roomCb) return;
    const deptId = roomCb.getAttribute('data-dept-id');
    if (deptId) {
        const deptCb = document.querySelector(`.edit-user-dept-cb[data-dept-id="${deptId}"]`);
        const roomCbs = Array.from(document.querySelectorAll(`.edit-user-room-cb[data-dept-id="${deptId}"]`));
        if (deptCb && roomCbs.length > 0) {
            const checkedCount = roomCbs.filter(cb => cb.checked).length;
            if (checkedCount === 0) {
                deptCb.checked = false;
                deptCb.indeterminate = false;
            } else if (checkedCount === roomCbs.length) {
                deptCb.checked = true;
                deptCb.indeterminate = false;
            } else {
                deptCb.checked = false;
                deptCb.indeterminate = true;
            }
        }
    }
    window.updateUserAccessSummary();
};

window.toggleAllUserAccessCheckboxes = function(checkAll) {
    document.querySelectorAll('.edit-user-dept-cb').forEach(cb => {
        cb.checked = !!checkAll;
        cb.indeterminate = false;
    });
    document.querySelectorAll('.edit-user-room-cb').forEach(cb => {
        cb.checked = !!checkAll;
    });
    window.updateUserAccessSummary();
};

window.openEditUserModal = function(id, username, first, last, email, auth) {
    document.getElementById('edit-user-id').value = id;
    document.getElementById('edit-user-username').value = username;
    document.getElementById('edit-user-first').value = first || "";
    document.getElementById('edit-user-last').value = last || "";
    document.getElementById('edit-user-email').value = email || "";
    document.getElementById('edit-user-auth').value = auth;
    document.getElementById('edit-user-password').value = ""; // Always clear password field on open

    const accessData = (window.usersAccessData && window.usersAccessData[id])
        ? window.usersAccessData[id]
        : { restricted: false, depts: [], rooms: [] };

    const allowedDepts = Array.isArray(accessData.depts) ? accessData.depts.map(Number) : [];
    const allowedRooms = Array.isArray(accessData.rooms) ? accessData.rooms.map(Number) : [];

    // Reset all checkboxes first
    document.querySelectorAll('.edit-user-dept-cb').forEach(cb => {
        const dId = Number(cb.value);
        cb.checked = accessData.restricted && allowedDepts.includes(dId);
        cb.indeterminate = false;
    });

    document.querySelectorAll('.edit-user-room-cb').forEach(cb => {
        const rId = Number(cb.value);
        const dId = cb.getAttribute('data-dept-id') ? Number(cb.getAttribute('data-dept-id')) : null;
        cb.checked = accessData.restricted && (allowedRooms.includes(rId) || (dId !== null && allowedDepts.includes(dId)));
    });

    // Update indeterminate states for department checkboxes
    document.querySelectorAll('.edit-user-dept-cb').forEach(deptCb => {
        const deptId = deptCb.getAttribute('data-dept-id');
        const roomCbs = Array.from(document.querySelectorAll(`.edit-user-room-cb[data-dept-id="${deptId}"]`));
        if (roomCbs.length > 0 && !deptCb.checked) {
            const checkedCount = roomCbs.filter(cb => cb.checked).length;
            if (checkedCount > 0 && checkedCount < roomCbs.length) {
                deptCb.indeterminate = true;
            } else if (checkedCount === roomCbs.length) {
                deptCb.checked = true;
            }
        }
    });

    window.setEditUserAccessMode(accessData.restricted ? 'restricted' : 'all');
    window.updateUserAccessSummary();
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

window.openShareModal = function(roomId, dateStr) {
    let basePath = '';
    if (window.location.pathname.startsWith('/booking')) {
        basePath = '/booking';
    }
    const fullUrl = `${window.location.origin}${basePath}/public?room_id=${roomId || ''}&date=${dateStr || ''}`;
    
    const input = document.getElementById('share-link-input');
    if (input) input.value = fullUrl;

    const previewBtn = document.getElementById('share-preview-btn');
    if (previewBtn) previewBtn.href = fullUrl;

    const copyBtn = document.getElementById('copy-share-btn');
    if (copyBtn) copyBtn.innerHTML = '<span>📋 Kopieren</span>';

    openModal('share-modal');
};

window.copyShareLink = function() {
    const input = document.getElementById('share-link-input');
    if (!input) return;
    input.select();
    input.setSelectionRange(0, 99999);
    
    const textToCopy = input.value;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            const copyBtn = document.getElementById('copy-share-btn');
            if (copyBtn) {
                copyBtn.innerHTML = '<span>✓ Kopiert!</span>';
                setTimeout(() => { copyBtn.innerHTML = '<span>📋 Kopieren</span>'; }, 2500);
            }
        }).catch(() => fallbackCopy(input));
    } else {
        fallbackCopy(input);
    }
};

function fallbackCopy(input) {
    try {
        input.select();
        document.execCommand('copy');
        const copyBtn = document.getElementById('copy-share-btn');
        if (copyBtn) {
            copyBtn.innerHTML = '<span>✓ Kopiert!</span>';
            setTimeout(() => { copyBtn.innerHTML = '<span>📋 Kopieren</span>'; }, 2500);
        }
    } catch(err) {
        console.error('Fallback copy failed:', err);
    }
}

// Global group cancellation confirmation helper
window.confirmCancelBooking = function(form, hasGroup) {
    const cancelAllInput = form ? form.querySelector('input[name="cancel_all_group"]') : null;
    if (hasGroup) {
        if (confirm('Diese Buchung ist Teil einer mehrtägigen oder mehrstündigen Belegung.\n\nMöchten Sie den GESAMTEN Zeitraum stornieren?\n\n• Klicken Sie auf "OK" für den gesamten Zeitraum.\n• Klicken Sie auf "Abbrechen", um nur diese einzelne Stunde zu stornieren.')) {
            if (cancelAllInput) cancelAllInput.value = '1';
            return true;
        } else {
            if (confirm('Möchten Sie stattdessen nur diese einzelne Stunde stornieren?')) {
                if (cancelAllInput) cancelAllInput.value = '0';
                return true;
            }
            return false;
        }
    }
    return confirm('Möchten Sie diese Buchung wirklich stornieren?');
};

// Document-level click listener for edit booking trigger buttons
document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.btn-edit-booking-trigger');
    if (trigger) {
        window.handleEditBtnClick(e, trigger);
    }
});
