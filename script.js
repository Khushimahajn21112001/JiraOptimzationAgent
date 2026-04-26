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
        const viewSprintSelect = document.getElementById('viewSprintSelect');
        try {
            const response = await fetch(`${API_BASE_URL}/sprints/GRA`);
            if (response.ok) {
                const data = await response.json();
                
                if (sprintSelect) {
                    sprintSelect.innerHTML = '<option value="" selected>Select a sprint (Optional)</option>';
                    data.sprints.forEach(sprint => {
                        const opt = document.createElement('option');
                        opt.value = sprint.id;
                        opt.textContent = `${sprint.name} (${sprint.state})`;
                        sprintSelect.appendChild(opt);
                    });
                }
                
                if (viewSprintSelect) {
                    viewSprintSelect.innerHTML = '<option value="" selected>Select a sprint...</option>';
                    data.sprints.forEach(sprint => {
                        const opt = document.createElement('option');
                        opt.value = sprint.id;
                        opt.textContent = `${sprint.name} (${sprint.state})`;
                        viewSprintSelect.appendChild(opt);
                    });
                }

                const reportSprintSelect = document.getElementById('reportSprintSelect');
                if (reportSprintSelect) {
                    reportSprintSelect.innerHTML = '<option value="" selected>Select a sprint...</option>';
                    data.sprints.forEach(sprint => {
                        const opt = document.createElement('option');
                        opt.value = sprint.id;
                        opt.textContent = `${sprint.name} (${sprint.state})`;
                        reportSprintSelect.appendChild(opt);
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load sprints:', error);
            if (sprintSelect) sprintSelect.innerHTML = '<option value="" selected>Failed to load sprints</option>';
            if (viewSprintSelect) viewSprintSelect.innerHTML = '<option value="" selected>Failed to load sprints</option>';
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

    // ============ Create Sprint ============
    // Default dates
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    if (startDateInput && endDateInput) {
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        startDateInput.value = formatDate(today);
        endDateInput.value = formatDate(nextWeek);
    }

    let sprintInputMode = 'none';
    const sprintManualGroup = document.getElementById('sprintManualGroup');
    const sprintUploadGroup = document.getElementById('sprintUploadGroup');
    const sprintModeBtns = document.querySelectorAll('.sprint-mode-btn');

    sprintModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sprintModeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sprintInputMode = btn.getAttribute('data-mode');
            
            sprintManualGroup.classList.add('hidden');
            sprintUploadGroup.classList.add('hidden');
            
            if (sprintInputMode === 'manual') sprintManualGroup.classList.remove('hidden');
            if (sprintInputMode === 'upload') sprintUploadGroup.classList.remove('hidden');
        });
    });

    const sprintFileInput = document.getElementById('sprintFile');
    const sprintDropArea = document.getElementById('sprintUploadGroup');
    const sprintFileSelectedInfo = document.getElementById('sprintFileSelectedInfo');
    const sprintSelectedFileName = document.getElementById('sprintSelectedFileName');
    const sprintClearFileBtn = document.getElementById('sprintClearFileBtn');

    sprintDropArea.addEventListener('click', (e) => {
        if (!e.target.closest('.clear-file-btn')) sprintFileInput.click();
    });
    sprintDropArea.addEventListener('dragover', (e) => { e.preventDefault(); sprintDropArea.classList.add('drag-over'); });
    sprintDropArea.addEventListener('dragleave', () => sprintDropArea.classList.remove('drag-over'));
    sprintDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        sprintDropArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            sprintFileInput.files = e.dataTransfer.files;
            showSprintSelectedFile(e.dataTransfer.files[0].name);
        }
    });
    sprintFileInput.addEventListener('change', () => {
        if (sprintFileInput.files.length) showSprintSelectedFile(sprintFileInput.files[0].name);
    });
    sprintClearFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sprintFileInput.value = '';
        sprintFileSelectedInfo.classList.add('hidden');
    });

    function showSprintSelectedFile(name) {
        sprintSelectedFileName.textContent = name;
        sprintFileSelectedInfo.classList.remove('hidden');
    }

    const createSprintForm = document.getElementById('createSprintForm');
    const btnCreateSprint = document.getElementById('btn-create-sprint');
    const createSprintResultBox = document.getElementById('createSprintResultBox');

    createSprintForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        btnCreateSprint.classList.add('loading');
        btnCreateSprint.disabled = true;
        createSprintResultBox.classList.add('hidden');
        
        const formData = new FormData(createSprintForm);
        
        if (sprintInputMode !== 'upload') formData.delete('file');
        if (sprintInputMode !== 'manual') formData.delete('issues');

        try {
            const response = await fetch(`${API_BASE_URL}/create-sprint`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.detail || `Server error ${response.status}`);
            }
            const data = await response.json();
            
            document.getElementById('sprintResultTitle').textContent = `Sprint '${data.sprintName}' Created`;
            let msg = `ID: ${data.sprintId}`;
            if (data.mappedIssuesCount > 0) {
                msg += ` | Mapped to ${data.mappedIssuesCount} tickets.`;
            }
            document.getElementById('sprintResultMessage').textContent = msg;
            
            createSprintResultBox.classList.remove('hidden');
            showToast(`Sprint created successfully!`, 'success');
            
            loadSprints();
            
        } catch (error) {
            console.error(error);
            showToast(`Failed: ${error.message}`, 'error');
        } finally {
            btnCreateSprint.classList.remove('loading');
            btnCreateSprint.disabled = false;
        }
    });

    // ============ View Sprint Tickets ============
    const viewSprintSelect = document.getElementById('viewSprintSelect');
    const sprintViewEmpty = document.getElementById('sprintViewEmpty');
    const sprintTicketsList = document.getElementById('sprintTicketsList');

    if (viewSprintSelect) {
        viewSprintSelect.addEventListener('change', async (e) => {
            const sprintId = e.target.value;
            if (!sprintId) {
                sprintViewEmpty.classList.remove('hidden');
                sprintTicketsList.classList.add('hidden');
                return;
            }

            sprintViewEmpty.classList.add('hidden');
            sprintTicketsList.classList.remove('hidden');
            sprintTicketsList.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="ph ph-spinner ph-spin" style="font-size: 24px;"></i><p>Loading tickets...</p></div>';

            try {
                const response = await fetch(`${API_BASE_URL}/sprint-issues/${sprintId}`);
                if (!response.ok) throw new Error('Failed to fetch tickets');
                const data = await response.json();
                
                if (data.issues.length === 0) {
                    sprintTicketsList.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="ph ph-ticket" style="font-size: 24px; color: var(--text-muted);"></i><p style="color: var(--text-muted);">No tickets in this sprint.</p></div>';
                    return;
                }

                sprintTicketsList.innerHTML = data.issues.map(issue => `
                    <div class="bulk-row updated" style="flex-direction: column; align-items: flex-start; gap: 5px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <i class="ph-fill ph-ticket" style="color: var(--primary);"></i>
                                <a href="${API_BASE_URL.replace('8000', '') /* rough guess, link won't be fully correct unless we pass JIRA_SERVER */}#" onclick="window.open('${issue.key}')" style="font-weight: bold; color: var(--primary); text-decoration: none;">${issue.key}</a>
                            </div>
                            <span class="bulk-status" style="background: var(--surface); padding: 2px 8px; border-radius: 4px; font-size: 11px;">${issue.status}</span>
                        </div>
                        <div style="width: 100%; margin-top: 5px;">
                            <strong style="display: block; font-size: 13px; color: var(--text);">${issue.summary}</strong>
                            <p style="margin: 4px 0 0; font-size: 12px; color: var(--text-muted); line-height: 1.4;">${issue.description || '<i>No description provided.</i>'}</p>
                        </div>
                    </div>
                `).join('');
                
            } catch (error) {
                sprintTicketsList.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger);"><i class="ph ph-warning-circle" style="font-size: 24px;"></i><p>${error.message}</p></div>`;
            }
        });
    }

    // ============ Reopen Report ============
    const reopenReportForm = document.getElementById('reopenReportForm');
    const btnGenerateReport = document.getElementById('btn-generate-report');
    const reportResultsBox = document.getElementById('reportResultsBox');
    const reportTableBody = document.getElementById('reportTableBody');

    if (reopenReportForm) {
        reopenReportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const ticketIds = document.getElementById('reportTicketIds').value.trim();
            const sprintId = document.getElementById('reportSprintSelect').value;

            if (!ticketIds && !sprintId) {
                showToast('Please enter Ticket IDs OR select a Sprint.', 'error');
                return;
            }

            btnGenerateReport.classList.add('loading');
            btnGenerateReport.disabled = true;
            reportResultsBox.classList.add('hidden');
            const reportExportWrapper = document.getElementById('reportExportWrapper');
            if (reportExportWrapper) reportExportWrapper.classList.add('hidden');

            try {
                let url = `${API_BASE_URL}/reopen-report?`;
                if (ticketIds) url += `ticket_ids=${encodeURIComponent(ticketIds)}`;
                else if (sprintId) url += `sprint_id=${encodeURIComponent(sprintId)}`;

                const response = await fetch(url);
                if (!response.ok) {
                    const errData = await response.json().catch(() => null);
                    throw new Error(errData?.detail || `Server error ${response.status}`);
                }

                const data = await response.json();
                reportTableBody.innerHTML = '';

                if (data.report.length === 0) {
                    reportTableBody.innerHTML = `
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">
                                No matching issues found.
                            </td>
                        </tr>
                    `;
                } else {
                    data.report.forEach(row => {
                        const tr = document.createElement('tr');
                        tr.style.borderBottom = '1px solid var(--border-light)';
                        
                        // Build the chip with data attributes if there are reopens
                        const chipHtml = row.total_reopen_count > 0 
                            ? `<span class="chip error-chip reopen-details-btn" style="cursor: pointer; padding: 4px 10px; border-radius: 12px; font-weight: 600; background: rgba(239, 68, 68, 0.15); color: var(--danger);" data-ticket="${row.ticket_id}" data-events="${encodeURIComponent(JSON.stringify(row.all_reopen_events))}">${row.total_reopen_count} <i class="ph ph-eye" style="font-size:12px; margin-left: 4px;"></i></span>`
                            : `<span class="chip success-chip" style="padding: 4px 10px; border-radius: 12px; font-weight: 600; background: rgba(16, 185, 129, 0.15); color: var(--success);">${row.total_reopen_count}</span>`;

                        tr.innerHTML = `
                            <td style="padding: 12px 16px; font-weight: 600; color: var(--primary);">${row.ticket_id}</td>
                            <td style="padding: 12px 16px; color: var(--text-main); font-weight: 500; min-width: 200px;" title="${row.summary}">${row.summary}</td>
                            <td style="padding: 12px 16px;">${row.developer_name}</td>
                            <td style="padding: 12px 16px; text-align: center;">${chipHtml}</td>
                            <td style="padding: 12px 16px;">${row.first_reopened_by}</td>
                            <td style="padding: 12px 16px;">${row.first_reopened_on}</td>
                            <td style="padding: 12px 16px;">${row.second_reopened_by}</td>
                            <td style="padding: 12px 16px;">${row.second_reopened_on}</td>
                        `;
                        reportTableBody.appendChild(tr);
                    });
                }

                reportResultsBox.classList.remove('hidden');
                if (reportExportWrapper) reportExportWrapper.classList.remove('hidden');
                showToast('Report generated successfully.', 'success');

            } catch (error) {
                showToast(`Failed: ${error.message}`, 'error');
            } finally {
                btnGenerateReport.classList.remove('loading');
                btnGenerateReport.disabled = false;
            }
        });
    }

    // ============ Reopen Modal Handlers ============
    const reopensModal = document.getElementById('reopensModal');
    const modalTicketId = document.getElementById('modalTicketId');
    const modalEventsList = document.getElementById('modalEventsList');
    const closeModalBtn = document.getElementById('closeModalBtn');

    if (reportTableBody) {
        reportTableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('.reopen-details-btn');
            if (!btn) return;

            const ticketId = btn.getAttribute('data-ticket');
            const eventsRaw = btn.getAttribute('data-events');
            
            if (!ticketId || !eventsRaw) return;

            const events = JSON.parse(decodeURIComponent(eventsRaw));
            modalTicketId.textContent = ticketId;
            modalEventsList.innerHTML = '';

            events.forEach((evt, index) => {
                const div = document.createElement('div');
                div.style.padding = '12px';
                div.style.background = 'var(--bg-surface-elevated)';
                div.style.border = '1px solid var(--border)';
                div.style.borderRadius = 'var(--border-radius-sm)';
                div.style.display = 'flex';
                div.style.flexDirection = 'column';
                div.style.gap = '6px';
                
                // Format created date nicely
                const dateStr = evt.reopened_on.substring(0, 16).replace('T', ' ');

                div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: bold; color: var(--primary);">#${index + 1} Reopen</span>
                        <span style="font-size: 12px; color: var(--text-muted);">${dateStr}</span>
                    </div>
                    <div style="font-size: 13px; color: var(--text-main);">
                        Reopened by: <strong style="color: var(--success);">${evt.reopened_by}</strong>
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted);">
                        Status Change: <span style="color: var(--text-main);">${evt.from_status || 'Any'}</span> <i class="ph ph-arrow-right"></i> <span style="color: var(--danger); font-weight: bold;">${evt.to_status}</span>
                    </div>
                `;
                modalEventsList.appendChild(div);
            });

            reopensModal.classList.remove('hidden');
        });
    }

    if (closeModalBtn && reopensModal) {
        closeModalBtn.addEventListener('click', () => {
            reopensModal.classList.add('hidden');
        });
        
        // Click outside to close
        reopensModal.addEventListener('click', (e) => {
            if (e.target === reopensModal) {
                reopensModal.classList.add('hidden');
            }
        });
    }

    // ============ Export Reopen Report CSV ============
    const btnExportReport = document.getElementById('btn-export-report');
    if (btnExportReport) {
        btnExportReport.addEventListener('click', () => {
            const rows = document.querySelectorAll('#reportTableBody tr');
            if (!rows.length || rows[0].cells.length < 8) {
                showToast('No valid data to export.', 'error');
                return;
            }

            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Ticket ID,Summary,Developer,Total Reopened,1st Reopened By,1st Reopened On,2nd Reopened By,2nd Reopened On\n";

            rows.forEach(tr => {
                const cells = tr.cells;
                if (cells.length >= 8) {
                    const ticketId = cells[0].textContent.trim();
                    const summary = cells[1].textContent.trim().replace(/"/g, '""');
                    const dev = cells[2].textContent.trim();
                    // Strip away any eye icon text or extra space
                    const total = cells[3].textContent.trim().split(' ')[0].trim(); 
                    const firstBy = cells[4].textContent.trim();
                    const firstOn = cells[5].textContent.trim();
                    const secondBy = cells[6].textContent.trim();
                    const secondOn = cells[7].textContent.trim();

                    const rowString = `"${ticketId}","${summary}","${dev}","${total}","${firstBy}","${firstOn}","${secondBy}","${secondOn}"`;
                    csvContent += rowString + "\n";
                }
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `jira_reopen_report_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('CSV Export successful!', 'success');
        });
    }

    // ============ Search/Filter Reopen Report ============
    const reopenSearchInput = document.getElementById('reopenSearchInput');
    if (reopenSearchInput) {
        reopenSearchInput.addEventListener('input', (e) => {
            const filterText = e.target.value.trim().toLowerCase();
            const rows = document.querySelectorAll('#reportTableBody tr');
            
            rows.forEach(row => {
                const rowText = row.textContent.toLowerCase();
                if (rowText.includes(filterText)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }
});
