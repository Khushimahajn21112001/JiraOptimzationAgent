document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:8000';
    
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const createTicketForm = document.getElementById('createTicketForm');
    const createResultBox = document.getElementById('createResultBox');
    const moveResultBox = document.getElementById('moveResultBox');
    const bulkResultsBox = document.getElementById('bulkResultsBox');
    const resultsEmpty = document.getElementById('resultsEmpty');
    const newTicketLink = document.getElementById('newTicketLink');
    const movedTicketIdSpan = document.getElementById('movedTicketId');
    const newStatusValueSpan = document.getElementById('newStatusValue');
    const toastContainer = document.getElementById('toastContainer');

    // ---- Project toggle (Create Ticket) ----
    const projectKeySelect = document.getElementById('projectKey');
    const issueTypeGroup = document.getElementById('issueTypeGroup');
    const productGroup = document.getElementById('productGroup');
    const sprintGroup = document.getElementById('sprintGroup');
    const projectBadge = document.getElementById('projectBadge');

    function updateFormForProject() {
        const project = projectKeySelect.value;
        projectBadge.textContent = `Project: ${project}`;
        if (project === 'DEVOP') {
            productGroup.classList.remove('hidden');
            sprintGroup.classList.add('hidden');
        } else {
            productGroup.classList.add('hidden');
            sprintGroup.classList.remove('hidden');
        }
    }
    projectKeySelect.addEventListener('change', updateFormForProject);
    updateFormForProject();

    // ---- Fetch Sprints ----
    async function loadSprints() {
        const sprintSelect = document.getElementById('sprint');
        try {
            const response = await fetch(`${API_BASE_URL}/sprints/GRA`);
            if (response.ok) {
                const data = await response.json();
                sprintSelect.innerHTML = '<option value="" selected>Select a sprint (Optional)</option>';
                data.sprints.forEach(sprint => {
                    const opt = document.createElement('option');
                    opt.value = sprint.id;
                    opt.textContent = `${sprint.name} (${sprint.state})`;
                    sprintSelect.appendChild(opt);
                });
            }
        } catch (error) {
            console.error('Failed to load sprints:', error);
            sprintSelect.innerHTML = '<option value="" selected>Failed to load sprints</option>';
        }
    }
    loadSprints();

    // ---- Tab Switching ----
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            tabContents.forEach(tab => tab.style.display = 'none');
            item.classList.add('active');
            document.getElementById(item.getAttribute('data-tab')).style.display = 'block';
            createResultBox.classList.add('hidden');
            moveResultBox.classList.add('hidden');
            bulkResultsBox.classList.add('hidden');
        });
    });

    // ---- Toast ----
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? 'ph-check-circle' : 'ph-warning-circle';
        toast.innerHTML = `<i class="ph-fill ${icon}"></i><span class="toast-message">${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 4000);
    }

    // ============ MOVE TICKET: Mode toggle ============
    let moveMode = 'single';
    const singleGroup = document.getElementById('singleTicketGroup');
    const bulkGroup = document.getElementById('bulkUploadGroup');

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            moveMode = btn.getAttribute('data-mode');
            if (moveMode === 'single') {
                singleGroup.classList.remove('hidden');
                bulkGroup.classList.add('hidden');
            } else {
                singleGroup.classList.add('hidden');
                bulkGroup.classList.remove('hidden');
            }
            moveResultBox.classList.add('hidden');
            bulkResultsBox.classList.add('hidden');
        });
    });

    // ============ File Upload ============
    const fileInput = document.getElementById('bulkFile');
    const dropArea = document.getElementById('fileDropArea');
    const fileSelectedInfo = document.getElementById('fileSelectedInfo');
    const selectedFileName = document.getElementById('selectedFileName');
    const clearFileBtn = document.getElementById('clearFileBtn');

    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.classList.add('drag-over'); });
    dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            showSelectedFile(e.dataTransfer.files[0].name);
        }
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) showSelectedFile(fileInput.files[0].name);
    });
    clearFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.value = '';
        fileSelectedInfo.classList.add('hidden');
    });

    function showSelectedFile(name) {
        selectedFileName.textContent = name;
        fileSelectedInfo.classList.remove('hidden');
    }

    // ============ Create Ticket Attachment UI ============
    const createFileInput = document.getElementById('createAttachment');
    const createDropArea = document.getElementById('createFileDropArea');
    const createFileSelectedInfo = document.getElementById('createFileSelectedInfo');
    const createSelectedFileName = document.getElementById('createSelectedFileName');
    const createClearFileBtn = document.getElementById('createClearFileBtn');

    createDropArea.addEventListener('click', () => createFileInput.click());
    createDropArea.addEventListener('dragover', (e) => { e.preventDefault(); createDropArea.classList.add('drag-over'); });
    createDropArea.addEventListener('dragleave', () => createDropArea.classList.remove('drag-over'));
    createDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        createDropArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            createFileInput.files = e.dataTransfer.files;
            showCreateSelectedFile(e.dataTransfer.files[0].name);
        }
    });
    createFileInput.addEventListener('change', () => {
        if (createFileInput.files.length) showCreateSelectedFile(createFileInput.files[0].name);
    });
    createClearFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        createFileInput.value = '';
        createFileSelectedInfo.classList.add('hidden');
    });

    function showCreateSelectedFile(name) {
        createSelectedFileName.textContent = name;
        createFileSelectedInfo.classList.remove('hidden');
    }

    // ============ Create Ticket ============
    createTicketForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-create');
        const formData = new FormData(createTicketForm);

        btn.classList.add('loading'); btn.disabled = true;
        createResultBox.classList.add('hidden');

        try {
            const response = await fetch(`${API_BASE_URL}/create-ticket`, {
                method: 'POST',
                body: formData // Send as multipart/form-data
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                let message = "Unknown error occurred";
                if (errData && errData.detail) {
                    if (Array.isArray(errData.detail)) {
                        message = errData.detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ');
                    } else {
                        message = errData.detail;
                    }
                }
                throw new Error(message);
            }
            const data = await response.json();
            newTicketLink.textContent = data.ticketId;
            newTicketLink.href = data.url;
            createResultBox.classList.remove('hidden');
            showToast(`Ticket ${data.ticketId} created!`, 'success');
            // Reset attachment UI
            createFileInput.value = '';
            createFileSelectedInfo.classList.add('hidden');
        } catch (error) {
            console.error(error);
            showToast(`Failed: ${error.message}`, 'error');
        } finally {
            btn.classList.remove('loading'); btn.disabled = false;
        }
    });

    // ============ Move Ticket (single or bulk) ============
    document.getElementById('btn-move').addEventListener('click', async () => {
        const btn = document.getElementById('btn-move');
        const transitionSelect = document.getElementById('transition');
        const transitionValue = transitionSelect.value;

        if (!transitionValue) {
            showToast('Please select a transition', 'error');
            return;
        }

        const [sourceStatus, targetStatus] = transitionValue.split('|');

        btn.classList.add('loading'); btn.disabled = true;
        moveResultBox.classList.add('hidden');
        bulkResultsBox.classList.add('hidden');
        resultsEmpty.classList.add('hidden');

        if (moveMode === 'single') {
            // ---- Single Ticket ----
            const ticketNumber = document.getElementById('ticketNumber').value.trim().toUpperCase();
            if (!ticketNumber) {
                showToast('Please enter a ticket number', 'error');
                btn.classList.remove('loading'); btn.disabled = false;
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/move-ticket`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticketNumber, targetStatus, sourceStatus })
                });
                if (!response.ok) {
                    const errData = await response.json().catch(() => null);
                    throw new Error(errData?.detail || `Server error ${response.status}`);
                }
                const data = await response.json();
                movedTicketIdSpan.textContent = ticketNumber;
                newStatusValueSpan.textContent = data.newStatus;
                moveResultBox.classList.remove('hidden');
                resultsEmpty.classList.add('hidden');
                showToast(`${ticketNumber} moved to ${data.newStatus}`, 'success');
            } catch (error) {
                showToast(`Failed: ${error.message}`, 'error');
            }
        } else {
            // ---- Bulk Upload ----
            if (!fileInput.files.length) {
                showToast('Please upload an Excel or CSV file', 'error');
                btn.classList.remove('loading'); btn.disabled = false;
                return;
            }

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('sourceStatus', sourceStatus);
            formData.append('targetStatus', targetStatus);

            try {
                const response = await fetch(`${API_BASE_URL}/move-tickets-bulk`, {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) {
                    const errData = await response.json().catch(() => null);
                    throw new Error(errData?.detail || `Server error ${response.status}`);
                }
                const data = await response.json();
                renderBulkResults(data);
            } catch (error) {
                showToast(`Failed: ${error.message}`, 'error');
            }
        }

        btn.classList.remove('loading'); btn.disabled = false;
    });

    function renderBulkResults(data) {
        const list = document.getElementById('bulkResultsList');
        const summary = document.getElementById('bulkSummary');
        list.innerHTML = '';

        const updated = data.results.filter(r => r.action === 'updated').length;
        const skipped = data.results.filter(r => r.action === 'skipped').length;
        const failed = data.results.filter(r => r.action === 'failed').length;
        summary.innerHTML = `<span class="chip success-chip">${updated} moved</span> <span class="chip skip-chip">${skipped} skipped</span> <span class="chip error-chip">${failed} failed</span>`;

        data.results.forEach(r => {
            const row = document.createElement('div');
            row.className = `bulk-row ${r.action}`;
            const icon = r.action === 'updated' ? 'ph-check-circle' : r.action === 'skipped' ? 'ph-minus-circle' : 'ph-warning-circle';
            row.innerHTML = `
                <i class="ph-fill ${icon}"></i>
                <strong>${r.ticket_id}</strong>
                <span class="bulk-status">${r.current_status || ''}</span>
                <span class="bulk-detail">${r.details}</span>
            `;
            list.appendChild(row);
        });

        bulkResultsBox.classList.remove('hidden');
        showToast(`Bulk move complete: ${updated} moved, ${skipped} skipped, ${failed} failed`, updated > 0 ? 'success' : 'error');
    }
});
