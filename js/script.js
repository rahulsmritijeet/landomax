// =====================================================
// script.js - Main JavaScript for ATL Dashboard
// =====================================================

// =====================================================
// API Helper Functions
// =====================================================

async function apiCall(action, params = {}) {
    try {
        const url = new URL(API_URL);
        url.searchParams.append('action', action);
        
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'object') {
                url.searchParams.append(key, JSON.stringify(value));
            } else {
                url.searchParams.append(key, value);
            }
        }
        
        const response = await fetch(url.toString());
        const result = await response.json();
        
        if (!result.success && result.error) {
            throw new Error(result.error);
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        showNotification('Error: ' + error.message, 'error');
        throw error;
    }
}

// =====================================================
// UI Helper Functions
// =====================================================

function showLoading() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'flex';
}

function hideLoading() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// =====================================================
// PROJECTS MODULE
// =====================================================

async function loadProjects() {
    showLoading();
    try {
        const result = await apiCall('getProjects');
        const tbody = document.getElementById('projectsTableBody');
        tbody.innerHTML = '';
        
        if (result.data && result.data.length > 0) {
            result.data.forEach(project => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${project.ProjectID}</td>
                    <td>${project.ProjectName}</td>
                    <td>${project.Overview ? project.Overview.substring(0, 50) + '...' : ''}</td>
                    <td>${project.ComponentsUsed || '-'}</td>
                    <td>${formatDate(project.LastUpdated)}</td>
                    <td class="actions">
                        <button class="btn btn-sm btn-primary" onclick="editProject('${project.ProjectID}')">
                            <i class="icon">✏️</i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteProject('${project.ProjectID}')">
                            <i class="icon">🗑️</i> Delete
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No projects found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading projects:', error);
    }
    hideLoading();
}

async function loadProjectForm() {
    const projectId = getUrlParam('id');
    const formTitle = document.getElementById('formTitle');
    
    await loadComponentsMultiSelect();
    
    if (projectId) {
        formTitle.textContent = 'Edit Project';
        showLoading();
        try {
            const result = await apiCall('getProject', { id: projectId });
            if (result.success && result.data) {
                document.getElementById('projectId').value = result.data.ProjectID;
                document.getElementById('projectName').value = result.data.ProjectName || '';
                document.getElementById('overview').value = result.data.Overview || '';
                document.getElementById('code').value = result.data.Code || '';
                
                if (result.data.ComponentsUsed) {
                    const selectedComponents = result.data.ComponentsUsed.split(',').map(c => c.trim());
                    const checkboxes = document.querySelectorAll('#componentsUsed input[type="checkbox"]');
                    checkboxes.forEach(cb => {
                        if (selectedComponents.includes(cb.value)) {
                            cb.checked = true;
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error loading project:', error);
        }
        hideLoading();
    } else {
        formTitle.textContent = 'Add New Project';
    }
}

async function loadComponentsMultiSelect() {
    try {
        const result = await apiCall('getComponents');
        const container = document.getElementById('componentsUsed');
        
        if (result.data && result.data.length > 0) {
            container.innerHTML = result.data.map(comp => `
                <label class="checkbox-label">
                    <input type="checkbox" name="components" value="${comp.ComponentID}">
                    ${comp.ComponentID} - ${comp.ComponentName} (Qty: ${comp.Quantity || 0})
                </label>
            `).join('');
        } else {
            container.innerHTML = '<p class="no-data">No components available</p>';
        }
    } catch (error) {
        console.error('Error loading components:', error);
    }
}

async function saveProject(event) {
    event.preventDefault();
    showLoading();
    
    const projectId = document.getElementById('projectId').value;
    const selectedComponents = Array.from(document.querySelectorAll('#componentsUsed input[type="checkbox"]:checked'))
        .map(cb => cb.value).join(', ');
    
    const projectData = {
        ProjectName: document.getElementById('projectName').value,
        Overview: document.getElementById('overview').value,
        Code: document.getElementById('code').value,
        ComponentsUsed: selectedComponents
    };
    
    try {
        if (projectId) {
            await apiCall('updateProject', { id: projectId, data: projectData });
            showNotification('Project updated successfully!');
        } else {
            await apiCall('addProject', { data: projectData });
            showNotification('Project added successfully!');
        }
        window.location.href = 'projects.html';
    } catch (error) {
        console.error('Error saving project:', error);
    }
    hideLoading();
}

function editProject(id) {
    window.location.href = `project_form.html?id=${id}`;
}

async function deleteProject(id) {
    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
        showLoading();
        try {
            await apiCall('deleteProject', { id: id });
            showNotification('Project deleted successfully!');
            loadProjects();
        } catch (error) {
            console.error('Error deleting project:', error);
        }
        hideLoading();
    }
}

// =====================================================
// COMPONENTS MODULE (Updated with Excel Import)
// =====================================================

// Store parsed Excel data
let parsedExcelData = [];
let columnMapping = {};
let excelHeaders = [];

async function loadComponents() {
    showLoading();
    try {
        const result = await apiCall('getComponents');
        const tbody = document.getElementById('componentsTableBody');
        tbody.innerHTML = '';
        
        if (result.data && result.data.length > 0) {
            result.data.forEach(component => {
                const row = document.createElement('tr');
                const quantity = parseInt(component.Quantity) || 0;
                const quantityClass = quantity <= 0 ? 'qty-zero' : quantity <= 5 ? 'qty-low' : 'qty-ok';
                
                row.innerHTML = `
                    <td>${component.ComponentID}</td>
                    <td><strong>${component.ComponentName}</strong></td>
                    <td>${component.Type || '-'}</td>
                    <td>${component.Description ? component.Description.substring(0, 50) + '...' : '-'}</td>
                    <td>
                        <span class="quantity-badge ${quantityClass}" onclick="openQuantityModal('${component.ComponentID}', '${escapeHtml(component.ComponentName)}', ${quantity})">
                            ${quantity}
                            <span class="qty-edit-icon">✏️</span>
                        </span>
                    </td>
                    <td class="actions">
                        <button class="btn btn-sm btn-primary" onclick="editComponent('${component.ComponentID}')">
                            <i class="icon">✏️</i> Edit
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No components found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading components:', error);
    }
    hideLoading();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/'/g, "\\'");
}

async function loadComponentForm() {
    const componentId = getUrlParam('id');
    const formTitle = document.getElementById('formTitle');
    
    if (componentId) {
        formTitle.textContent = 'Edit Component';
        showLoading();
        try {
            const result = await apiCall('getComponent', { id: componentId });
            if (result.success && result.data) {
                document.getElementById('componentId').value = result.data.ComponentID;
                document.getElementById('componentName').value = result.data.ComponentName || '';
                document.getElementById('type').value = result.data.Type || '';
                document.getElementById('description').value = result.data.Description || '';
                document.getElementById('quantity').value = result.data.Quantity || 0;
            }
        } catch (error) {
            console.error('Error loading component:', error);
        }
        hideLoading();
    } else {
        formTitle.textContent = 'Add New Component';
    }
}

async function saveComponent(event) {
    event.preventDefault();
    showLoading();
    
    const componentId = document.getElementById('componentId').value;
    
    const componentData = {
        ComponentName: document.getElementById('componentName').value,
        Type: document.getElementById('type').value,
        Description: document.getElementById('description').value,
        Quantity: parseInt(document.getElementById('quantity').value) || 0
    };
    
    try {
        if (componentId) {
            await apiCall('updateComponent', { id: componentId, data: componentData });
            showNotification('Component updated successfully!');
        } else {
            await apiCall('addComponent', { data: componentData });
            showNotification('Component added successfully!');
        }
        window.location.href = 'components.html';
    } catch (error) {
        console.error('Error saving component:', error);
    }
    hideLoading();
}

function editComponent(id) {
    window.location.href = `component_form.html?id=${id}`;
}

// =====================================================
// Quantity Modal Functions
// =====================================================

let currentQuantityComponentId = null;

function openQuantityModal(componentId, componentName, currentQuantity) {
    currentQuantityComponentId = componentId;
    document.getElementById('quantityComponentName').textContent = componentName;
    document.getElementById('quantityInput').value = currentQuantity;
    document.getElementById('quantityModal').classList.add('show');
}

function closeQuantityModal() {
    document.getElementById('quantityModal').classList.remove('show');
    currentQuantityComponentId = null;
}

function adjustQuantity(amount) {
    const input = document.getElementById('quantityInput');
    const newValue = Math.max(0, parseInt(input.value || 0) + amount);
    input.value = newValue;
}

async function saveQuantity() {
    if (!currentQuantityComponentId) return;
    
    const newQuantity = parseInt(document.getElementById('quantityInput').value) || 0;
    
    showLoading();
    try {
        await apiCall('updateComponentQuantity', { 
            id: currentQuantityComponentId, 
            quantity: newQuantity 
        });
        showNotification('Quantity updated successfully!');
        closeQuantityModal();
        loadComponents();
    } catch (error) {
        console.error('Error updating quantity:', error);
    }
    hideLoading();
}

// =====================================================
// Excel Import Functions
// =====================================================

function openExcelUploadModal() {
    document.getElementById('uploadCard').style.display = 'block';
    document.getElementById('uploadCard').scrollIntoView({ behavior: 'smooth' });
}

function closeExcelUpload() {
    document.getElementById('uploadCard').style.display = 'none';
    clearPreview();
}

function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (file) {
        handleExcelFile(file);
    }
}

function handleExcelFile(file) {
    const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
    ];
    
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
        showNotification('Please upload a valid Excel file (.xlsx, .xls, .csv)', 'error');
        return;
    }
    
    showLoading();
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            if (jsonData.length < 2) {
                showNotification('Excel file is empty or has no data rows', 'error');
                hideLoading();
                return;
            }
            
            // Process with AI mapping
            processExcelData(jsonData);
            hideLoading();
            
        } catch (error) {
            console.error('Error parsing Excel:', error);
            showNotification('Error parsing Excel file: ' + error.message, 'error');
            hideLoading();
        }
    };
    
    reader.readAsArrayBuffer(file);
}

function processExcelData(jsonData) {
    // First row is headers
    excelHeaders = jsonData[0].map(h => (h || '').toString().trim());
    
    // Data rows
    const dataRows = jsonData.slice(1).filter(row => row.some(cell => cell !== null && cell !== ''));
    
    // AI-powered column mapping
    columnMapping = autoDetectColumns(excelHeaders);
    
    // Store parsed data
    parsedExcelData = dataRows.map(row => {
        const obj = {};
        excelHeaders.forEach((header, index) => {
            obj[header] = row[index] !== undefined ? row[index] : '';
        });
        return obj;
    });
    
    // Show preview
    showPreview();
}

function autoDetectColumns(headers) {
    const mapping = {
        ComponentName: null,
        Type: null,
        Description: null,
        Quantity: null
    };
    
    // Patterns for AI detection
    const patterns = {
        ComponentName: [
            /^name$/i, /component\s*name/i, /^item$/i, /item\s*name/i, 
            /product\s*name/i, /^component$/i, /^part$/i, /part\s*name/i,
            /material/i, /^title$/i
        ],
        Type: [
            /^type$/i, /^category$/i, /^kind$/i, /component\s*type/i,
            /^class$/i, /classification/i, /^group$/i
        ],
        Description: [
            /^description$/i, /^details$/i, /^info$/i, /^notes$/i,
            /^specification/i, /^specs$/i, /^about$/i, /^remarks$/i
        ],
        Quantity: [
            /^qty$/i, /^quantity$/i, /^count$/i, /^stock$/i, /^amount$/i,
            /^no\.?$/i, /^number$/i, /^units$/i, /in\s*stock/i, /available/i
        ]
    };
    
    // Match headers to fields
    headers.forEach((header, index) => {
        const headerLower = header.toLowerCase().trim();
        
        for (const [field, fieldPatterns] of Object.entries(patterns)) {
            if (mapping[field] === null) {
                for (const pattern of fieldPatterns) {
                    if (pattern.test(headerLower)) {
                        mapping[field] = index;
                        break;
                    }
                }
            }
        }
    });
    
    // Fallback: if no name found, use first text column
    if (mapping.ComponentName === null) {
        mapping.ComponentName = 0;
    }
    
    return mapping;
}

function showPreview() {
    document.getElementById('previewSection').style.display = 'block';
    document.getElementById('rowCount').textContent = `${parsedExcelData.length} rows detected`;
    document.getElementById('importCount').textContent = parsedExcelData.length;
    
    // Build mapping UI
    const mappingGrid = document.getElementById('mappingGrid');
    mappingGrid.innerHTML = '';
    
    const fields = ['ComponentName', 'Type', 'Description', 'Quantity'];
    const fieldLabels = {
        ComponentName: '📦 Component Name *',
        Type: '🏷️ Type',
        Description: '📝 Description',
        Quantity: '🔢 Quantity'
    };
    
    fields.forEach(field => {
        const div = document.createElement('div');
        div.className = 'mapping-item';
        div.innerHTML = `
            <label>${fieldLabels[field]}</label>
            <select id="map_${field}" onchange="updatePreview()">
                <option value="-1">-- Skip --</option>
                ${excelHeaders.map((h, i) => `
                    <option value="${i}" ${columnMapping[field] === i ? 'selected' : ''}>
                        ${h || `Column ${i + 1}`}
                    </option>
                `).join('')}
            </select>
        `;
        mappingGrid.appendChild(div);
    });
    
    updatePreview();
}

function updatePreview() {
    // Update mapping from selects
    columnMapping.ComponentName = parseInt(document.getElementById('map_ComponentName').value);
    columnMapping.Type = parseInt(document.getElementById('map_Type').value);
    columnMapping.Description = parseInt(document.getElementById('map_Description').value);
    columnMapping.Quantity = parseInt(document.getElementById('map_Quantity').value);
    
    // Build preview table
    const thead = document.getElementById('previewHead');
    const tbody = document.getElementById('previewBody');
    
    thead.innerHTML = `
        <tr>
            <th>#</th>
            <th>Component Name</th>
            <th>Type</th>
            <th>Description</th>
            <th>Quantity</th>
        </tr>
    `;
    
    tbody.innerHTML = '';
    
    // Show first 10 rows
    const previewRows = parsedExcelData.slice(0, 10);
    
    previewRows.forEach((row, index) => {
        const tr = document.createElement('tr');
        
        const name = getMappedValue(row, 'ComponentName');
        const type = getMappedValue(row, 'Type');
        const desc = getMappedValue(row, 'Description');
        const qty = getMappedValue(row, 'Quantity');
        
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${name || '<em class="text-muted">Empty</em>'}</td>
            <td>${type || '-'}</td>
            <td>${desc ? (desc.length > 30 ? desc.substring(0, 30) + '...' : desc) : '-'}</td>
            <td>${qty || 0}</td>
        `;
        
        if (!name) {
            tr.classList.add('row-warning');
        }
        
        tbody.appendChild(tr);
    });
    
    if (parsedExcelData.length > 10) {
        tbody.innerHTML += `
            <tr class="more-rows">
                <td colspan="5">... and ${parsedExcelData.length - 10} more rows</td>
            </tr>
        `;
    }
}

function getMappedValue(row, field) {
    const colIndex = columnMapping[field];
    if (colIndex === -1 || colIndex === null || colIndex === undefined) return '';
    
    const header = excelHeaders[colIndex];
    let value = row[header];
    
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function clearPreview() {
    document.getElementById('previewSection').style.display = 'none';
    document.getElementById('excelFile').value = '';
    parsedExcelData = [];
    columnMapping = {};
    excelHeaders = [];
}

async function importComponents() {
    if (parsedExcelData.length === 0) {
        showNotification('No data to import', 'error');
        return;
    }
    
    // Prepare components array
    const components = parsedExcelData.map(row => ({
        ComponentName: getMappedValue(row, 'ComponentName'),
        Type: getMappedValue(row, 'Type'),
        Description: getMappedValue(row, 'Description'),
        Quantity: parseInt(getMappedValue(row, 'Quantity')) || 0
    })).filter(c => c.ComponentName); // Filter out rows without name
    
    if (components.length === 0) {
        showNotification('No valid components found. Make sure Component Name is mapped.', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to import ${components.length} components?`)) {
        return;
    }
    
    showLoading();
    
    try {
        const result = await apiCall('bulkAddComponents', { data: components });
        showNotification(`Successfully imported ${result.addedCount} components!`);
        closeExcelUpload();
        loadComponents();
    } catch (error) {
        console.error('Error importing components:', error);
    }
    
    hideLoading();
}

// =====================================================
// COMPETITIONS MODULE
// =====================================================

async function loadCompetitions() {
    showLoading();
    try {
        const result = await apiCall('getCompetitions');
        const tbody = document.getElementById('competitionsTableBody');
        const calendarView = document.getElementById('calendarView');
        tbody.innerHTML = '';
        calendarView.innerHTML = '';
        
        if (result.data && result.data.length > 0) {
            result.data.forEach(competition => {
                const row = document.createElement('tr');
                const eventDate = new Date(competition.Date);
                const isPast = eventDate < new Date();
                
                row.className = isPast ? 'past-event' : '';
                row.innerHTML = `
                    <td>${competition.EventID}</td>
                    <td>${competition.EventName}</td>
                    <td>${formatDate(competition.Date)}</td>
                    <td>${competition.Location || '-'}</td>
                    <td>${competition.Details ? competition.Details.substring(0, 50) + '...' : '-'}</td>
                    <td class="actions">
                        <button class="btn btn-sm btn-primary" onclick="editCompetition('${competition.EventID}')">
                            <i class="icon">✏️</i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCompetition('${competition.EventID}')">
                            <i class="icon">🗑️</i> Delete
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            result.data.forEach(competition => {
                const card = document.createElement('div');
                const eventDate = new Date(competition.Date);
                const isPast = eventDate < new Date();
                
                card.className = `calendar-card ${isPast ? 'past' : 'upcoming'}`;
                card.innerHTML = `
                    <div class="calendar-date">
                        <span class="month">${eventDate.toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span class="day">${eventDate.getDate()}</span>
                        <span class="year">${eventDate.getFullYear()}</span>
                    </div>
                    <div class="calendar-details">
                        <h4>${competition.EventName}</h4>
                        <p><i class="icon">📍</i> ${competition.Location || 'TBD'}</p>
                        <p class="event-details">${competition.Details || ''}</p>
                    </div>
                `;
                calendarView.appendChild(card);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No competitions found</td></tr>';
            calendarView.innerHTML = '<p class="no-data">No competitions scheduled</p>';
        }
    } catch (error) {
        console.error('Error loading competitions:', error);
    }
    hideLoading();
}

async function loadCompetitionForm() {
    const eventId = getUrlParam('id');
    const formTitle = document.getElementById('formTitle');
    
    if (eventId) {
        formTitle.textContent = 'Edit Competition';
        showLoading();
        try {
            const result = await apiCall('getCompetition', { id: eventId });
            if (result.success && result.data) {
                document.getElementById('eventId').value = result.data.EventID;
                document.getElementById('eventName').value = result.data.EventName || '';
                document.getElementById('eventDate').value = result.data.Date || '';
                document.getElementById('location').value = result.data.Location || '';
                document.getElementById('details').value = result.data.Details || '';
            }
        } catch (error) {
            console.error('Error loading competition:', error);
        }
        hideLoading();
    } else {
        formTitle.textContent = 'Add New Competition';
    }
}

async function saveCompetition(event) {
    event.preventDefault();
    showLoading();
    
    const eventId = document.getElementById('eventId').value;
    
    const competitionData = {
        EventName: document.getElementById('eventName').value,
        Date: document.getElementById('eventDate').value,
        Location: document.getElementById('location').value,
        Details: document.getElementById('details').value
    };
    
    try {
        if (eventId) {
            await apiCall('updateCompetition', { id: eventId, data: competitionData });
            showNotification('Competition updated successfully!');
        } else {
            await apiCall('addCompetition', { data: competitionData });
            showNotification('Competition added successfully!');
        }
        window.location.href = 'competitions.html';
    } catch (error) {
        console.error('Error saving competition:', error);
    }
    hideLoading();
}

function editCompetition(id) {
    window.location.href = `competition_form.html?id=${id}`;
}

async function deleteCompetition(id) {
    if (confirm('Are you sure you want to delete this competition? This action cannot be undone.')) {
        showLoading();
        try {
            await apiCall('deleteCompetition', { id: id });
            showNotification('Competition deleted successfully!');
            loadCompetitions();
        } catch (error) {
            console.error('Error deleting competition:', error);
        }
        hideLoading();
    }
}

function toggleView(view) {
    const tableView = document.getElementById('tableView');
    const calendarView = document.getElementById('calendarView');
    const tableBtn = document.getElementById('tableViewBtn');
    const calendarBtn = document.getElementById('calendarViewBtn');
    
    if (view === 'table') {
        tableView.style.display = 'block';
        calendarView.style.display = 'none';
        tableBtn.classList.add('active');
        calendarBtn.classList.remove('active');
    } else {
        tableView.style.display = 'none';
        calendarView.style.display = 'grid';
        tableBtn.classList.remove('active');
        calendarBtn.classList.add('active');
    }
}

// =====================================================
// ORDERS MODULE
// =====================================================

async function loadOrders() {
    showLoading();
    try {
        const result = await apiCall('getOrders');
        const tbody = document.getElementById('ordersTableBody');
        tbody.innerHTML = '';
        
        if (result.data && result.data.length > 0) {
            result.data.forEach(order => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${order.OrderID}</td>
                    <td>${order.ComponentID}</td>
                    <td>${order.ComponentName}</td>
                    <td>${order.Quantity}</td>
                    <td>${order.Vendor || '-'}</td>
                    <td>${formatDate(order.OrderDate)}</td>
                    <td>${formatDate(order.ExpectedDelivery)}</td>
                    <td><span class="status-badge status-${order.Status ? order.Status.toLowerCase() : 'ordered'}">${order.Status || 'Ordered'}</span></td>
                    <td class="actions">
                        <button class="btn btn-sm btn-primary" onclick="editOrder('${order.OrderID}')">
                            <i class="icon">✏️</i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteOrder('${order.OrderID}')">
                            <i class="icon">🗑️</i> Delete
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="9" class="no-data">No orders found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
    hideLoading();
}

async function loadOrderForm() {
    const orderId = getUrlParam('id');
    const formTitle = document.getElementById('formTitle');
    
    await loadComponentsDropdown();
    loadStatusDropdown();
    
    const orderDateInput = document.getElementById('orderDate');
    if (!orderId && orderDateInput) {
        orderDateInput.value = new Date().toISOString().split('T')[0];
    }
    
    if (orderId) {
        formTitle.textContent = 'Edit Order';
        showLoading();
        try {
            const result = await apiCall('getOrder', { id: orderId });
            if (result.success && result.data) {
                document.getElementById('orderId').value = result.data.OrderID;
                document.getElementById('componentId').value = result.data.ComponentID || '';
                document.getElementById('componentName').value = result.data.ComponentName || '';
                document.getElementById('quantity').value = result.data.Quantity || 0;
                document.getElementById('vendor').value = result.data.Vendor || '';
                document.getElementById('orderDate').value = result.data.OrderDate || '';
                document.getElementById('expectedDelivery').value = result.data.ExpectedDelivery || '';
                document.getElementById('status').value = result.data.Status || 'Ordered';
                document.getElementById('notes').value = result.data.Notes || '';
            }
        } catch (error) {
            console.error('Error loading order:', error);
        }
        hideLoading();
    } else {
        formTitle.textContent = 'Add New Order';
    }
}

async function loadComponentsDropdown() {
    try {
        const result = await apiCall('getComponents');
        const select = document.getElementById('componentId');
        
        select.innerHTML = '<option value="">-- Select Component --</option>';
        
        if (result.data && result.data.length > 0) {
            result.data.forEach(comp => {
                const option = document.createElement('option');
                option.value = comp.ComponentID;
                option.textContent = `${comp.ComponentID} - ${comp.ComponentName} (Stock: ${comp.Quantity || 0})`;
                option.dataset.name = comp.ComponentName;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading components dropdown:', error);
    }
}

function loadStatusDropdown() {
    const select = document.getElementById('status');
    select.innerHTML = '';
    
    ORDER_STATUS_OPTIONS.forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        select.appendChild(option);
    });
}

function onComponentChange() {
    const componentSelect = document.getElementById('componentId');
    const componentNameInput = document.getElementById('componentName');
    const selectedOption = componentSelect.options[componentSelect.selectedIndex];
    
    if (selectedOption && selectedOption.dataset.name) {
        componentNameInput.value = selectedOption.dataset.name;
    } else {
        componentNameInput.value = '';
    }
}

async function saveOrder(event) {
    event.preventDefault();
    showLoading();
    
    const orderId = document.getElementById('orderId').value;
    
    const orderData = {
        ComponentID: document.getElementById('componentId').value,
        ComponentName: document.getElementById('componentName').value,
        Quantity: parseInt(document.getElementById('quantity').value) || 0,
        Vendor: document.getElementById('vendor').value,
        OrderDate: document.getElementById('orderDate').value,
        ExpectedDelivery: document.getElementById('expectedDelivery').value,
        Status: document.getElementById('status').value,
        Notes: document.getElementById('notes').value
    };
    
    try {
        if (orderId) {
            await apiCall('updateOrder', { id: orderId, data: orderData });
            showNotification('Order updated successfully!');
        } else {
            await apiCall('addOrder', { data: orderData });
            showNotification('Order added successfully!');
        }
        window.location.href = 'orders.html';
    } catch (error) {
        console.error('Error saving order:', error);
    }
    hideLoading();
}

function editOrder(id) {
    window.location.href = `order_form.html?id=${id}`;
}

async function deleteOrder(id) {
    if (confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
        showLoading();
        try {
            await apiCall('deleteOrder', { id: id });
            showNotification('Order deleted successfully!');
            loadOrders();
        } catch (error) {
            console.error('Error deleting order:', error);
        }
        hideLoading();
    }
}
