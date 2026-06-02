document.addEventListener('DOMContentLoaded', () => {
    // Theme mechanics (Dark/Light mode)
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            // Add a small scale compression during click
            themeToggle.style.transform = 'scale(0.9)';
            setTimeout(() => {
                themeToggle.style.transform = '';
            }, 100);

            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            console.log(`Theme toggled to: ${newTheme}`);
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

    // Global Header Kaskadierende Schnellwahl (Category -> Room)
    const categorySelect = document.getElementById('header-category-select');
    const roomSelect = document.getElementById('header-room-select');

    if (categorySelect && roomSelect) {
        // Initial sync of room selection with active query param
        const urlParams = new URLSearchParams(window.location.search);
        const activeRoomId = urlParams.get('room_id');
        if (activeRoomId) {
            roomSelect.value = activeRoomId;
            // Also pre-select the category if the room option exists
            const selectedOpt = roomSelect.querySelector(`option[value="${activeRoomId}"]`);
            if (selectedOpt && selectedOpt.getAttribute('data-dept')) {
                categorySelect.value = selectedOpt.getAttribute('data-dept');
                filterHeaderRooms(selectedOpt.getAttribute('data-dept'));
            }
        }

        categorySelect.addEventListener('change', (e) => {
            const selectedDeptId = e.target.value;
            filterHeaderRooms(selectedDeptId);
            roomSelect.value = ""; // Reset room selection
        });

        roomSelect.addEventListener('change', (e) => {
            const selectedRoomId = e.target.value;
            if (selectedRoomId) {
                window.location.href = `/bookings?room_id=${selectedRoomId}`;
            }
        });
    }

    function filterHeaderRooms(deptId) {
        const options = roomSelect.querySelectorAll('option');
        options.forEach(opt => {
            if (!opt.value) return; // Skip placeholder "-- Raum wählen --"
            const optDept = opt.getAttribute('data-dept');
            if (!deptId || optDept === deptId) {
                opt.style.display = '';
                opt.disabled = false;
            } else {
                opt.style.display = 'none';
                opt.disabled = true;
            }
        });
    }
});

// Global Popup Modal Management Helpers (Year 2026 Premium Ergonomics)
window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
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
    if (modal) modal.classList.add('hidden');
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
