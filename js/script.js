// =====================================================
// script.js - ATL Dashboard Complete
// All Modules: Projects, Components, Competitions, Orders
// =====================================================

// =====================================================
// API HELPER FUNCTIONS
// =====================================================

async function apiCall(action, params = {}) {
    try {
        const url = new URL(API_URL);
        url.searchParams.append('action', action);
        
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
        }
        
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error('HTTP error: ' + response.status);
        
        const text = await response.text();
        const result = JSON.parse(text);
        
        if (!result.success && result.error) throw new Error(result.error);
        return result;
    } catch (error) {
        console.error('API Error:', error);
        showNotification('Error: ' + error.message, 'error');
        throw error;
    }
}

// =====================================================
// UI HELPER FUNCTIONS
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
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = 'notification ' + type;
    
    const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '❌';
    notification.innerHTML = '<span>' + icon + ' ' + message + '</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;margin-left:10px;">✕</button>';
    
    document.body.appendChild(notification);
    setTimeout(function() { notification.classList.add('show'); }, 10);
    setTimeout(function() {
        notification.classList.remove('show');
        setTimeout(function() { notification.remove(); }, 300);
    }, 5000);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getUrlParam(param) {
    return new URLSearchParams(window.location.search).get(param);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function getTypeIcon(type) {
    const icons = {
        'microcontroller': '🎛️',
        'sensor': '📡',
        'motor': '⚙️',
        'led': '💡',
        'resistor': '🔧',
        'capacitor': '🔋',
        'wire': '🔌',
        'display': '📺',
        'module': '📦',
        'board': '🎚️',
        'battery': '🔋',
        'switch': '🔘'
    };
    return icons[(type || '').toLowerCase()] || '📦';
}

// =====================================================
// COMPONENTS MODULE
// =====================================================

var allComponents = [];
var currentStockFilter = 'all';
var importData = [];
var currentQuantityComponentId = null;

async function loadComponents() {
    showLoading();
    try {
        var result = await apiCall('getComponents');
        allComponents = result.data || [];
        updateComponentStats();
        renderComponentsTable(allComponents);
    } catch (e) {
        console.error(e);
    }
    hideLoading();
}

function updateComponentStats() {
    var total = allComponents.length;
    var inStock = allComponents.filter(function(c) { return (parseInt(c.Quantity) || 0) > 5; }).length;
    var lowStock = allComponents.filter(function(c) { 
        var q = parseInt(c.Quantity) || 0; 
        return q > 0 && q <= 5; 
    }).length;
    var outOfStock = allComponents.filter(function(c) { return (parseInt(c.Quantity) || 0) === 0; }).length;
    
    if (document.getElementById('totalComponents')) document.getElementById('totalComponents').textContent = total;
    if (document.getElementById('inStockCount')) document.getElementById('inStockCount').textContent = inStock;
    if (document.getElementById('lowStockCount')) document.getElementById('lowStockCount').textContent = lowStock;
    if (document.getElementById('outOfStockCount')) document.getElementById('outOfStockCount').textContent = outOfStock;
}

function renderComponentsTable(components) {
    var tbody = document.getElementById('componentsTableBody');
    if (!tbody) return;
    
    if (!components || components.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">No components found</td></tr>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < components.length; i++) {
        var c = components[i];
        var qty = parseInt(c.Quantity) || 0;
        var cls = qty === 0 ? 'qty-zero' : qty <= 5 ? 'qty-low' : 'qty-ok';
        var safeName = escapeHtml(c.ComponentName).replace(/'/g, "\\'");
        
        html += '<tr>';
        html += '<td><code>' + c.ComponentID + '</code></td>';
        html += '<td><span class="type-icon">' + getTypeIcon(c.Type) + '</span> <strong>' + escapeHtml(c.ComponentName) + '</strong></td>';
        html += '<td><span class="type-badge">' + (c.Type || '-') + '</span></td>';
        html += '<td>' + escapeHtml((c.Description || '').substring(0, 40)) + '</td>';
        html += '<td><span class="quantity-badge ' + cls + '" onclick="openQuantityModal(\'' + c.ComponentID + '\',\'' + safeName + '\',' + qty + ')">' + qty + ' ✏️</span></td>';
        html += '<td><button class="btn btn-sm btn-primary" onclick="editComponent(\'' + c.ComponentID + '\')">✏️</button></td>';
        html += '</tr>';
    }
    tbody.innerHTML = html;
}

function searchComponents() {
    var q = (document.getElementById('searchComponents') ? document.getElementById('searchComponents').value : '').toLowerCase();
    var filtered = allComponents.filter(function(c) {
        return (c.ComponentName || '').toLowerCase().includes(q) ||
               (c.ComponentID || '').toLowerCase().includes(q) ||
               (c.Type || '').toLowerCase().includes(q);
    });
    if (currentStockFilter !== 'all') {
        filtered = applyStockFilter(filtered, currentStockFilter);
    }
    renderComponentsTable(filtered);
}

function filterComponentsByStock(filter, btn) {
    currentStockFilter = filter;
    var tabs = document.querySelectorAll('.filter-tabs .filter-tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
    }
    if (btn) btn.classList.add('active');
    searchComponents();
}

function applyStockFilter(arr, filter) {
    return arr.filter(function(c) {
        var q = parseInt(c.Quantity) || 0;
        if (filter === 'instock') return q > 5;
        if (filter === 'low') return q > 0 && q <= 5;
        if (filter === 'out') return q === 0;
        return true;
    });
}

function exportComponentsToExcel() {
    if (!allComponents.length) {
        showNotification('No components to export', 'warning');
        return;
    }
    
    var data = allComponents.map(function(c) {
        return {
            'Component ID': c.ComponentID,
            'Name': c.ComponentName,
            'Type': c.Type || '',
            'Description': c.Description || '',
            'Quantity': parseInt(c.Quantity) || 0
        };
    });
    
    var ws = XLSX.utils.json_to_sheet(data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Components');
    XLSX.writeFile(wb, 'ATL_Components_' + new Date().toISOString().split('T')[0] + '.xlsx');
    showNotification('Components exported!');
}

function downloadComponentTemplate() {
    var template = [
        { ComponentName: 'Arduino Uno', Type: 'Microcontroller', Quantity: 5, Description: 'ATmega328P board' },
        { ComponentName: 'ESP32', Type: 'Microcontroller', Quantity: 10, Description: 'WiFi+BT module' }
    ];
    var ws = XLSX.utils.json_to_sheet(template);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Components_Template.xlsx');
    showNotification('Template downloaded!');
}

function openQuantityModal(id, name, qty) {
    currentQuantityComponentId = id;
    document.getElementById('quantityComponentName').textContent = name;
    document.getElementById('quantityInput').value = qty;
    document.getElementById('quantityModal').classList.add('show');
}

function closeQuantityModal() {
    document.getElementById('quantityModal').classList.remove('show');
    currentQuantityComponentId = null;
}

function adjustQuantity(amt) {
    var input = document.getElementById('quantityInput');
    input.value = Math.max(0, (parseInt(input.value) || 0) + amt);
}

async function saveQuantity() {
    if (!currentQuantityComponentId) return;
    showLoading();
    try {
        await apiCall('updateComponentQuantity', {
            id: currentQuantityComponentId,
            quantity: parseInt(document.getElementById('quantityInput').value) || 0
        });
        showNotification('Quantity updated!');
        closeQuantityModal();
        loadComponents();
    } catch (e) {
        console.error(e);
    }
    hideLoading();
}

function openImportModal() {
    document.getElementById('importModal').classList.add('show');
    importData = [];
    document.getElementById('previewSection').style.display = 'none';
    document.getElementById('confirmImportBtn').disabled = true;
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('show');
    importData = [];
}

function setupDropZone() {
    var dz = document.getElementById('dropZone');
    if (!dz) return;
    
    dz.addEventListener('dragover', function(e) {
        e.preventDefault();
        dz.classList.add('dragover');
    });
    
    dz.addEventListener('dragleave', function() {
        dz.classList.remove('dragover');
    });
    
    dz.addEventListener('drop', function(e) {
        e.preventDefault();
        dz.classList.remove('dragover');
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
}

function handleFile(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var wb = XLSX.read(e.target.result, { type: 'binary' });
            importData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            showPreview(importData);
        } catch (err) {
            showNotification('Error reading file', 'error');
        }
    };
    reader.readAsBinaryString(file);
}

function showPreview(data) {
    if (!data.length) {
        showNotification('No data found', 'error');
        return;
    }
    var headers = Object.keys(data[0]);
    var html = '<table class="preview-table"><thead><tr>';
    for (var i = 0; i < headers.length; i++) {
        html += '<th>' + headers[i] + '</th>';
    }
    html += '</tr></thead><tbody>';
    for (var j = 0; j < Math.min(5, data.length); j++) {
        html += '<tr>';
        for (var k = 0; k < headers.length; k++) {
            html += '<td>' + (data[j][headers[k]] || '') + '</td>';
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    
    document.getElementById('previewTable').innerHTML = html;
    document.getElementById('previewNote').textContent = data.length + ' rows total';
    document.getElementById('previewSection').style.display = 'block';
    document.getElementById('confirmImportBtn').disabled = false;
}

async function confirmImport() {
    if (!importData.length) return;
    showLoading();
    try {
        var dataToSend = importData.map(function(item) {
            return {
                ComponentName: item.ComponentName || item.Name || '',
                Type: item.Type || '',
                Quantity: parseInt(item.Quantity) || 0,
                Description: item.Description || ''
            };
        });
        var result = await apiCall('bulkAddComponents', { data: dataToSend });
        showNotification('Imported ' + (result.addedCount || importData.length) + ' components!');
        closeImportModal();
        loadComponents();
    } catch (e) {
        console.error(e);
    }
    hideLoading();
}

function editComponent(id) {
    window.location.href = 'component_form.html?id=' + id;
}

async function loadComponentForm() {
    var id = getUrlParam('id');
    if (id) {
        document.getElementById('formTitle').textContent = 'Edit Component';
        showLoading();
        try {
            var result = await apiCall('getComponent', { id: id });
            if (result.success && result.data) {
                document.getElementById('componentId').value = result.data.ComponentID;
                document.getElementById('componentName').value = result.data.ComponentName || '';
                document.getElementById('type').value = result.data.Type || '';
                document.getElementById('description').value = result.data.Description || '';
                document.getElementById('quantity').value = result.data.Quantity || 0;
            }
        } catch (e) {
            console.error(e);
        }
        hideLoading();
    }
}

async function saveComponent(event) {
    event.preventDefault();
    showLoading();
    
    var id = document.getElementById('componentId').value;
    var data = {
        ComponentName: document.getElementById('componentName').value,
        Type: document.getElementById('type').value,
        Description: document.getElementById('description').value,
        Quantity: parseInt(document.getElementById('quantity').value) || 0
    };
    
    try {
        if (id) {
            await apiCall('updateComponent', { id: id, data: data });
            showNotification('Component updated!');
        } else {
            await apiCall('addComponent', { data: data });
            showNotification('Component added!');
        }
        window.location.href = 'components.html';
    } catch (e) {
        console.error(e);
    }
    hideLoading();
}

// =====================================================
// PROJECTS MODULE
// =====================================================

var allProjects = [];
var allProjectComponents = [];
var selectedProjectComponents = {};
var teamMembersList = [];
var currentTypeFilter = 'all';

async function loadProjects() {
    showLoading();
    try {
        var result = await apiCall('getProjects');
        allProjects = result.data || [];
        updateProjectStats();
        renderProjectsList(allProjects);
    } catch (e) {
        console.error(e);
        var container = document.getElementById('projectsContainer');
        if (container) {
            container.innerHTML = '<div class="empty-state"><h3>Failed to load</h3><button onclick="loadProjects()" class="btn btn-primary">Retry</button></div>';
        }
    }
    hideLoading();
}

function updateProjectStats() {
    var allStudents = {};
    var totalComponentUsage = 0;
    
    for (var i = 0; i < allProjects.length; i++) {
        var project = allProjects[i];
        if (project.TeamMembers) {
            var members = project.TeamMembers.split(',');
            for (var j = 0; j < members.length; j++) {
                var m = members[j].trim().toLowerCase();
                if (m) allStudents[m] = true;
            }
        }
        if (project.ComponentsUsed) {
            var parts = project.ComponentsUsed.split(',');
            for (var k = 0; k < parts.length; k++) {
                var part = parts[k].trim();
                if (part.includes(':')) {
                    totalComponentUsage += parseInt(part.split(':')[1]) || 1;
                } else {
                    totalComponentUsage += 1;
                }
            }
        }
    }
    
    if (document.getElementById('totalProjects')) {
        document.getElementById('totalProjects').textContent = allProjects.length;
    }
    if (document.getElementById('totalStudents')) {
        document.getElementById('totalStudents').textContent = Object.keys(allStudents).length;
    }
    if (document.getElementById('totalComponentsUsed')) {
        document.getElementById('totalComponentsUsed').textContent = totalComponentUsage;
    }
}

function renderProjectsList(projects) {
    var container = document.getElementById('projectsContainer');
    if (!container) return;
    
    if (!projects || projects.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📁</div><h3>No Projects Found</h3><a href="project_form.html" class="btn btn-primary">➕ Create Project</a></div>';
        return;
    }
    
    var html = '<div class="projects-grid">';
    for (var i = 0; i < projects.length; i++) {
        html += createProjectCard(projects[i]);
    }
    html += '</div>';
    container.innerHTML = html;
}

function createProjectCard(project) {
    var teamMembers = project.TeamMembers ? project.TeamMembers.split(',').map(function(m) { return m.trim(); }).filter(function(m) { return m; }) : [];
    var componentsData = parseComponentsUsed(project.ComponentsUsed);
    
    var html = '<div class="project-card" onclick="viewProject(\'' + project.ProjectID + '\')">';
    html += '<div class="project-card-header">';
    html += '<code class="project-id">' + project.ProjectID + '</code>';
    html += '<span class="project-date">' + formatDate(project.LastUpdated) + '</span>';
    html += '</div>';
    html += '<h3 class="project-title">' + (escapeHtml(project.ProjectName) || 'Untitled') + '</h3>';
    
    if (project.Overview) {
        html += '<p class="project-overview">' + escapeHtml(project.Overview).substring(0, 100) + '...</p>';
    }
    
    if (teamMembers.length > 0) {
        html += '<div class="project-team">👥 ' + teamMembers.slice(0, 3).join(', ');
        if (teamMembers.length > 3) html += ' +' + (teamMembers.length - 3);
        html += '</div>';
    }
    
    if (componentsData.length > 0) {
        html += '<div class="project-components">⚙️ ' + componentsData.length + ' components</div>';
    }
    
    html += '<div class="project-card-actions" onclick="event.stopPropagation()">';
    html += '<button class="btn btn-sm btn-primary" onclick="editProject(\'' + project.ProjectID + '\')">✏️</button>';
    html += '<button class="btn btn-sm btn-danger" onclick="deleteProject(\'' + project.ProjectID + '\')">🗑️</button>';
    html += '</div></div>';
    
    return html;
}

function parseComponentsUsed(str) {
    if (!str) return [];
    var result = [];
    var parts = str.split(',');
    for (var i = 0; i < parts.length; i++) {
        var part = parts[i].trim();
        if (!part) continue;
        if (part.includes(':')) {
            var split = part.split(':');
            result.push({ id: split[0].trim(), quantity: parseInt(split[1]) || 1 });
        } else {
            result.push({ id: part, quantity: 1 });
        }
    }
    return result;
}

function searchProjects() {
    var query = (document.getElementById('searchProjects') ? document.getElementById('searchProjects').value : '').toLowerCase();
    var filtered = allProjects.filter(function(p) {
        return (p.ProjectName || '').toLowerCase().includes(query) ||
               (p.Overview || '').toLowerCase().includes(query) ||
               (p.TeamMembers || '').toLowerCase().includes(query);
    });
    renderProjectsList(filtered);
}

function viewProject(projectId) {
    var project = allProjects.find(function(p) { return p.ProjectID === projectId; });
    if (!project) return;
    
    document.getElementById('modalProjectName').textContent = project.ProjectName || 'Untitled';
    
    var html = '<div class="project-detail">';
    html += '<div class="detail-section"><h4>📋 Overview</h4><p>' + (escapeHtml(project.Overview) || 'No overview') + '</p></div>';
    html += '<div class="detail-section"><h4>👥 Team</h4><p>' + (escapeHtml(project.TeamMembers) || 'No team members') + '</p></div>';
    html += '<div class="detail-section"><h4>⚙️ Components</h4><p>' + (escapeHtml(project.ComponentsUsed) || 'No components') + '</p></div>';
    if (project.Code) {
        html += '<div class="detail-section"><h4>💻 Code</h4><pre class="code-block">' + escapeHtml(project.Code) + '</pre></div>';
    }
    html += '</div>';
    
    document.getElementById('modalProjectBody').innerHTML = html;
    document.getElementById('modalEditBtn').onclick = function() {
        window.location.href = 'project_form.html?id=' + projectId;
    };
    document.getElementById('projectModal').classList.add('show');
}

function closeProjectModal() {
    document.getElementById('projectModal').classList.remove('show');
}

function editProject(id) {
    window.location.href = 'project_form.html?id=' + id;
}

async function deleteProject(id) {
    if (!confirm('Delete this project?')) return;
    showLoading();
    try {
        await apiCall('deleteProject', { id: id });
        showNotification('Project deleted!');
        loadProjects();
    } catch (e) {
        console.error(e);
    }
    hideLoading();
}

async function loadProjectForm() {
    var projectId = getUrlParam('id');
    selectedProjectComponents = {};
    teamMembersList = [];
    
    await loadComponentsForSelection();
    await loadPreviousStudents();
    renderTeamMembersChips();
    
    if (projectId) {
        document.getElementById('formTitle').textContent = 'Edit Project';
        showLoading();
        try {
            var result = await apiCall('getProject', { id: projectId });
            if (result.success && result.data) {
                document.getElementById('projectId').value = result.data.ProjectID;
                document.getElementById('projectName').value = result.data.ProjectName || '';
                document.getElementById('overview').value = result.data.Overview || '';
                document.getElementById('code').value = result.data.Code || '';
                
                if (result.data.TeamMembers) {
                    teamMembersList = result.data.TeamMembers.split(',').map(function(m) { return m.trim(); }).filter(function(m) { return m; });
                    renderTeamMembersChips();
                }
                
                if (result.data.ComponentsUsed) {
                    var components = parseComponentsUsed(result.data.ComponentsUsed);
                    for (var i = 0; i < components.length; i++) {
                        var comp = components[i];
                        var full = allProjectComponents.find(function(c) { return c.ComponentID === comp.id; });
                        if (full) {
                            selectedProjectComponents[comp.id] = Object.assign({}, full, { selectedQuantity: comp.quantity });
                        }
                    }
                    renderSelectedComponents();
                    updateSelectedCount();
                }
            }
        } catch (e) {
            console.error(e);
        }
        hideLoading();
    }
}

async function loadComponentsForSelection() {
    try {
        var result = await apiCall('getComponents');
        allProjectComponents = result.data || [];
        renderAvailableComponents(allProjectComponents);
    } catch (e) {
        var container = document.getElementById('availableComponentsList');
        if (container) container.innerHTML = '<div class="error-message">Failed to load</div>';
    }
}

function renderAvailableComponents(components) {
    var container = document.getElementById('availableComponentsList');
    if (!container) return;
    
    if (!components || components.length === 0) {
        container.innerHTML = '<div class="no-data">No components available</div>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < components.length; i++) {
        var comp = components[i];
        var isSelected = selectedProjectComponents.hasOwnProperty(comp.ComponentID);
        var stock = parseInt(comp.Quantity) || 0;
        var outOfStock = stock === 0;
        var qtyClass = stock === 0 ? 'qty-zero' : stock <= 5 ? 'qty-low' : 'qty-ok';
        
        html += '<div class="component-item ' + (isSelected ? 'selected' : '') + ' ' + (outOfStock ? 'out-of-stock' : '') + '"';
        html += ' data-id="' + comp.ComponentID + '"';
        html += ' data-type="' + (comp.Type || '').toLowerCase() + '"';
        html += ' data-name="' + (comp.ComponentName || '').toLowerCase() + '"';
        html += ' data-stock="' + stock + '"';
        html += ' onclick="' + (outOfStock ? 'showOutOfStockWarning()' : 'toggleComponent(\'' + comp.ComponentID + '\')') + '">';
        
        html += '<div class="component-item-main">';
        html += '<span class="component-icon">' + getTypeIcon(comp.Type) + '</span>';
        html += '<div class="component-info">';
        html += '<span class="component-name">' + escapeHtml(comp.ComponentName) + '</span>';
        html += '<span class="component-meta"><code>' + comp.ComponentID + '</code></span>';
        html += '</div></div>';
        
        html += '<div class="component-stock ' + qtyClass + '">' + (outOfStock ? '❌ Out' : stock + ' available') + '</div>';
        html += '<div class="component-add-btn ' + (outOfStock ? 'disabled' : '') + '">' + (outOfStock ? '🚫' : isSelected ? '✓' : '+') + '</div>';
        html += '</div>';
    }
    container.innerHTML = html;
}

function showOutOfStockWarning() {
    showNotification('Component is out of stock!', 'warning');
}

function toggleComponent(componentId) {
    var comp = allProjectComponents.find(function(c) { return c.ComponentID === componentId; });
    if (!comp || (parseInt(comp.Quantity) || 0) === 0) {
        showNotification('Cannot add - out of stock!', 'error');
        return;
    }
    
    if (selectedProjectComponents[componentId]) {
        delete selectedProjectComponents[componentId];
    } else {
        selectedProjectComponents[componentId] = Object.assign({}, comp, { selectedQuantity: 1 });
    }
    
    renderAvailableComponents(allProjectComponents);
    renderSelectedComponents();
    updateSelectedCount();
}

function renderSelectedComponents() {
    var container = document.getElementById('selectedComponentsList');
    if (!container) return;
    
    var keys = Object.keys(selectedProjectComponents);
    if (keys.length === 0) {
        container.innerHTML = '<div class="no-selection-message">👈 Click components to add</div>';
        var totalEl = document.getElementById('selectedTotal');
        if (totalEl) totalEl.textContent = '(0)';
        return;
    }
    
    var total = 0;
    var html = '';
    
    for (var i = 0; i < keys.length; i++) {
        var id = keys[i];
        var comp = selectedProjectComponents[id];
        var qty = comp.selectedQuantity || 1;
        total += qty;
        var stock = parseInt(comp.Quantity) || 0;
        var over = qty > stock;
        
        html += '<div class="selected-component-item ' + (over ? 'over-stock-warning' : '') + '">';
        html += '<div class="selected-component-info">';
        html += '<span class="component-icon">' + getTypeIcon(comp.Type) + '</span>';
        html += '<div>';
        html += '<div class="component-name">' + escapeHtml(comp.ComponentName) + '</div>';
        html += '<code>' + comp.ComponentID + '</code>';
        html += '<span class="stock-info ' + (over ? 'over-stock' : '') + '">(' + stock + ' available)</span>';
        if (over) html += '<span class="warning-badge">⚠️ Exceeds!</span>';
        html += '</div></div>';
        
        html += '<div class="quantity-control">';
        html += '<button type="button" class="qty-btn" onclick="changeComponentQty(\'' + id + '\', -1)">−</button>';
        html += '<input type="number" class="qty-input" value="' + qty + '" min="1" max="' + stock + '" onchange="setComponentQty(\'' + id + '\', this.value)">';
        html += '<button type="button" class="qty-btn" onclick="changeComponentQty(\'' + id + '\', 1)">+</button>';
        html += '</div>';
        
        html += '<button type="button" class="remove-btn" onclick="removeComponent(\'' + id + '\')">✕</button>';
        html += '</div>';
    }
    
    container.innerHTML = html;
    var totalEl = document.getElementById('selectedTotal');
    if (totalEl) totalEl.textContent = '(' + total + ' total)';
}

function changeComponentQty(id, delta) {
    if (!selectedProjectComponents[id]) return;
    var comp = selectedProjectComponents[id];
    var stock = parseInt(comp.Quantity) || 0;
    var newQty = (comp.selectedQuantity || 1) + delta;
    
    if (newQty < 1) newQty = 1;
    if (newQty > stock) {
        showNotification('Only ' + stock + ' available!', 'warning');
        newQty = stock;
    }
    
    selectedProjectComponents[id].selectedQuantity = newQty;
    renderSelectedComponents();
}

function setComponentQty(id, value) {
    if (!selectedProjectComponents[id]) return;
    var stock = parseInt(selectedProjectComponents[id].Quantity) || 0;
    var qty = parseInt(value) || 1;
    
    if (qty < 1) qty = 1;
    if (qty > stock) {
        showNotification('Only ' + stock + ' available!', 'warning');
        qty = stock;
    }
    
    selectedProjectComponents[id].selectedQuantity = qty;
    renderSelectedComponents();
}

function removeComponent(id) {
    delete selectedProjectComponents[id];
    renderAvailableComponents(allProjectComponents);
    renderSelectedComponents();
    updateSelectedCount();
}

function updateSelectedCount() {
    var count = Object.keys(selectedProjectComponents).length;
    var el = document.getElementById('selectedCount');
    if (el) el.textContent = '(' + count + ' component' + (count !== 1 ? 's' : '') + ')';
}

function searchComponentsInForm(query) {
    var term = (query || '').toLowerCase();
    var items = document.querySelectorAll('#availableComponentsList .component-item');
    
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var matchName = (item.dataset.name || '').includes(term);
        var matchType = (item.dataset.type || '').includes(term);
        var matchId = (item.dataset.id || '').toLowerCase().includes(term);
        var matchSearch = !term || matchName || matchType || matchId;
        var matchTypeFilter = currentTypeFilter === 'all' || (item.dataset.type || '') === currentTypeFilter.toLowerCase();
        
        item.style.display = (matchSearch && matchTypeFilter) ? 'flex' : 'none';
    }
}

function clearComponentSearch() {
    var input = document.getElementById('componentSearch');
    if (input) {
        input.value = '';
        searchComponentsInForm('');
    }
}

function filterByType(type) {
    currentTypeFilter = type;
    var chips = document.querySelectorAll('.quick-filters .filter-chip');
    for (var i = 0; i < chips.length; i++) {
        chips[i].classList.remove('active');
    }
    event.target.classList.add('active');
    var searchVal = document.getElementById('componentSearch') ? document.getElementById('componentSearch').value : '';
    searchComponentsInForm(searchVal);
}

async function loadPreviousStudents() {
    try {
        var result = await apiCall('getProjects');
        var students = {};
        var projects = result.data || [];
        
        for (var i = 0; i < projects.length; i++) {
            if (projects[i].TeamMembers) {
                var members = projects[i].TeamMembers.split(',');
                for (var j = 0; j < members.length; j++) {
                    var m = members[j].trim();
                    if (m) students[m] = true;
                }
            }
        }
        
        var container = document.getElementById('previousStudents');
        var studentList = Object.keys(students).sort().slice(0, 10);
        
        if (container && studentList.length) {
            var html = '';
            for (var k = 0; k < studentList.length; k++) {
                var s = studentList[k];
                html += '<button type="button" class="quick-add-chip" onclick="quickAddTeamMember(\'' + escapeHtml(s).replace(/'/g, "\\'") + '\')">➕ ' + escapeHtml(s) + '</button>';
            }
            container.innerHTML = html;
        } else if (container) {
            container.innerHTML = '<span class="no-previous">No previous students</span>';
        }
    } catch (e) {
        console.error(e);
    }
}

function handleTeamMemberKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        addTeamMember();
    }
}

function addTeamMember() {
    var input = document.getElementById('teamMemberInput');
    var name = input.value.trim();
    if (name && teamMembersList.indexOf(name) === -1) {
        teamMembersList.push(name);
        renderTeamMembersChips();
        input.value = '';
    }
}

function quickAddTeamMember(name) {
    if (teamMembersList.indexOf(name) === -1) {
        teamMembersList.push(name);
        renderTeamMembersChips();
        showNotification('Added ' + name);
    }
}

function removeTeamMember(index) {
    teamMembersList.splice(index, 1);
    renderTeamMembersChips();
}

function renderTeamMembersChips() {
    var container = document.getElementById('teamMembersChips');
    if (!container) return;
    
    var html = '';
    for (var i = 0; i < teamMembersList.length; i++) {
        var m = teamMembersList[i];
        html += '<span class="team-member-chip">';
        html += '<span class="chip-avatar">' + getInitials(m) + '</span>' + escapeHtml(m);
        html += '<button type="button" class="chip-remove" onclick="removeTeamMember(' + i + ')">✕</button>';
        html += '</span>';
    }
    container.innerHTML = html;
    
    var hidden = document.getElementById('teamMembers');
    if (hidden) hidden.value = teamMembersList.join(', ');
}

async function saveProject(event) {
    event.preventDefault();
    
    var hasError = false;
    var keys = Object.keys(selectedProjectComponents);
    for (var i = 0; i < keys.length; i++) {
        var comp = selectedProjectComponents[keys[i]];
        if ((comp.selectedQuantity || 1) > (parseInt(comp.Quantity) || 0)) {
            showNotification(comp.ComponentName + ': exceeds stock!', 'error');
            hasError = true;
        }
    }
    if (hasError) return;
    
    var componentsUsed = keys.map(function(id) {
        return id + ':' + (selectedProjectComponents[id].selectedQuantity || 1);
    }).join(', ');
    
    var data = {
        ProjectName: document.getElementById('projectName').value,
        Overview: document.getElementById('overview').value,
        Code: document.getElementById('code').value,
        ComponentsUsed: componentsUsed,
        TeamMembers: teamMembersList.join(', ')
    };
    
    showLoading();
    try {
        var projectId = document.getElementById('projectId').value;
        if (projectId) {
            await apiCall('updateProject', { id: projectId, data: data });
            showNotification('Project updated!');
        } else {
            await apiCall('addProject', { data: data });
            showNotification('Project created!');
        }
        window.location.href = 'projects.html';
    } catch (e) {
        console.error(e);
    }
    hideLoading();
}

// =====================================================
// COMPETITIONS MODULE
// =====================================================

var allCompetitions = [];
var currentCompFilter = 'all';

async function loadCompetitions() {
    showLoading();
    try {
        var result = await apiCall('getCompetitions');
        allCompetitions = result.data || [];
        updateCompetitionStats();
        renderCompetitionsTable(allCompetitions);
        renderCalendarView(allCompetitions);
    } catch (e) {
        console.error(e);
        var tbody = document.getElementById('competitionsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">Failed to load. <button onclick="loadCompetitions()" class="btn btn-sm btn-primary">Retry</button></td></tr>';
        }
    }
    hideLoading();
}

function updateCompetitionStats() {
    var upcoming = allCompetitions.filter(function(c) { return (c.Status || '').toLowerCase() === 'upcoming'; }).length;
    var ongoing = allCompetitions.filter(function(c) { return (c.Status || '').toLowerCase() === 'ongoing'; }).length;
    var completed = allCompetitions.filter(function(c) { return (c.Status || '').toLowerCase() === 'completed'; }).length;
    
    if (document.getElementById('upcomingCount')) document.getElementById('upcomingCount').textContent = upcoming;
    if (document.getElementById('ongoingCount')) document.getElementById('ongoingCount').textContent = ongoing;
    if (document.getElementById('completedCount')) document.getElementById('completedCount').textContent = completed;
    if (document.getElementById('totalCompetitions')) document.getElementById('totalCompetitions').textContent = allCompetitions.length;
}

function renderCompetitionsTable(competitions) {
    var tbody = document.getElementById('competitionsTableBody');
    if (!tbody) return;
    
    if (!competitions || competitions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No competitions found</td></tr>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < competitions.length; i++) {
        var c = competitions[i];
        var status = (c.Status || 'upcoming').toLowerCase();
        
        html += '<tr>';
        html += '<td><code>' + c.EventID + '</code></td>';
        html += '<td><strong>' + escapeHtml(c.EventName) + '</strong></td>';
        html += '<td>' + formatDate(c.Date) + '</td>';
        html += '<td>' + (escapeHtml(c.Location) || '-') + '</td>';
        html += '<td><span class="status-badge status-' + status + '">' + (c.Status || 'Upcoming') + '</span></td>';
        html += '<td>' + (escapeHtml(c.Position || c.Result) || '-') + '</td>';
        html += '<td class="actions">';
        html += '<button class="btn btn-sm btn-info" onclick="viewCompetition(\'' + c.EventID + '\')">👁️</button>';
        html += '<button class="btn btn-sm btn-warning" onclick="openResultModal(\'' + c.EventID + '\')">🏆</button>';
        html += '<button class="btn btn-sm btn-primary" onclick="editCompetition(\'' + c.EventID + '\')">✏️</button>';
        html += '<button class="btn btn-sm btn-danger" onclick="deleteCompetition(\'' + c.EventID + '\')">🗑️</button>';
        html += '</td></tr>';
    }
    tbody.innerHTML = html;
}

function renderCalendarView(competitions) {
    var container = document.getElementById('calendarView');
    if (!container) return;
    
    if (!competitions || competitions.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No competitions</p></div>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < competitions.length; i++) {
        var c = competitions[i];
        var date = new Date(c.Date);
        var status = (c.Status || 'upcoming').toLowerCase();
        
        html += '<div class="calendar-card ' + status + '" onclick="viewCompetition(\'' + c.EventID + '\')">';
        html += '<div class="calendar-date">';
        html += '<span class="month">' + date.toLocaleDateString('en-US', { month: 'short' }) + '</span>';
        html += '<span class="day">' + (date.getDate() || '?') + '</span>';
        html += '</div>';
        html += '<div class="calendar-details">';
        html += '<span class="status-badge status-' + status + '">' + (c.Status || 'Upcoming') + '</span>';
        html += '<h4>' + escapeHtml(c.EventName) + '</h4>';
        html += '<p>📍 ' + (escapeHtml(c.Location) || 'TBD') + '</p>';
        if (c.Position) html += '<p>🏆 ' + escapeHtml(c.Position) + '</p>';
        html += '</div></div>';
    }
    container.innerHTML = html;
}

function searchCompetitions() {
    var q = (document.getElementById('searchCompetitions') ? document.getElementById('searchCompetitions').value : '').toLowerCase();
    var filtered = allCompetitions.filter(function(c) {
        return (c.EventName || '').toLowerCase().includes(q) || (c.Location || '').toLowerCase().includes(q);
    });
    if (currentCompFilter !== 'all') {
        filtered = filtered.filter(function(c) { return c.Status === currentCompFilter; });
    }
    renderCompetitionsTable(filtered);
    renderCalendarView(filtered);
}

function filterCompetitions(status, btn) {
    currentCompFilter = status;
    var tabs = document.querySelectorAll('.filter-tabs .filter-tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
    }
    if (btn) btn.classList.add('active');
    searchCompetitions();
}

function toggleView(view, btn) {
    var tableView = document.getElementById('tableView');
    var calendarView = document.getElementById('calendarView');
    
    if (view === 'table') {
        if (tableView) tableView.style.display = 'block';
        if (calendarView) calendarView.style.display = 'none';
    } else {
        if (tableView) tableView.style.display = 'none';
        if (calendarView) calendarView.style.display = 'grid';
    }
    
    var btns = document.querySelectorAll('.view-toggle .btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.remove('active');
    }
    if (btn) btn.classList.add('active');
}

function viewCompetition(eventId) {
    var comp = allCompetitions.find(function(c) { return c.EventID === eventId; });
    if (!comp) return;
    
    document.getElementById('modalCompetitionName').textContent = comp.EventName || 'Competition';
    
    var html = '<div class="competition-detail">';
    html += '<div class="detail-grid">';
    html += '<div class="detail-item"><label>📅 Date</label><span>' + formatDate(comp.Date);
    if (comp.EndDate) html += ' - ' + formatDate(comp.EndDate);
    html += '</span></div>';
    html += '<div class="detail-item"><label>📍 Location</label><span>' + (escapeHtml(comp.Location) || 'TBD') + '</span></div>';
    html += '<div class="detail-item"><label>📊 Status</label><span class="status-badge status-' + (comp.Status || 'upcoming').toLowerCase() + '">' + (comp.Status || 'Upcoming') + '</span></div>';
    html += '<div class="detail-item"><label>🏆 Result</label><span>' + (escapeHtml(comp.Position || comp.Result) || 'Pending') + '</span></div>';
    html += '</div>';
    
    if (comp.Details) {
        html += '<div class="detail-section"><h4>📋 Details</h4><p>' + escapeHtml(comp.Details) + '</p></div>';
    }
    if (comp.Participants) {
        html += '<div class="detail-section"><h4>👥 Participants</h4><p>' + escapeHtml(comp.Participants) + '</p></div>';
    }
    if (comp.Notes) {
        html += '<div class="detail-section"><h4>📝 Notes</h4><p>' + escapeHtml(comp.Notes) + '</p></div>';
    }
    html += '</div>';
    
    document.getElementById('modalCompetitionBody').innerHTML = html;
    document.getElementById('modalCompEditBtn').onclick = function() {
        closeCompetitionModal();
        editCompetition(eventId);
    };
    document.getElementById('competitionModal').classList.add('show');
}

function closeCompetitionModal() {
    document.getElementById('competitionModal').classList.remove('show');
}

function editCompetition(id) {
    window.location.href = 'competition_form.html?id=' + id;
}

async function deleteCompetition(id) {
    if (!confirm('Delete this competition?')) return;
    showLoading();
    try {
        await apiCall('deleteCompetition', { id: id });
        showNotification('Competition deleted!');
        loadCompetitions();
    } catch (e) {
        console.error(e);
    }
    hideLoading();
}

function openResultModal(eventId) {
    var comp = allCompetitions.find(function(c) { return c.EventID === eventId; });
    if (!comp) return;
    
    document.getElementById('resultEventId').value = eventId;
    document.getElementById('resultStatus').value = comp.Status || 'Upcoming';
    document.getElementById('resultPosition').value = comp.Position || '';
    document.getElementById('resultNotes').value = comp.Notes || '';
    document.getElementById('resultModal').classList.add('show');
}

function closeResultModal() {
    document.getElementById('resultModal').classList.remove('show');
}

async function saveResult() {
    var eventId = document.getElementById('resultEventId').value;
    if (!eventId) return;
    
    showLoading();
    try {
        await apiCall('updateCompetitionResult', {
            id: eventId,
            data: {
                Status: document.getElementById('resultStatus').value,
                Position: document.getElementById('resultPosition').value,
                Notes: document.getElementById('resultNotes').value
            }
        });
        showNotification('Result updated!');
        closeResultModal();
        loadCompetitions();
    } catch (e) {
        console.error(e);
    }
    hideLoading();
}

async function loadCompetitionForm() {
    var id = getUrlParam('id');
    if (id) {
        document.getElementById('formTitle').textContent = 'Edit Competition';
        showLoading();
        try {
            var result = await apiCall('getCompetition', { id: id });
            if (result.success && result.data) {
                var c = result.data;
                document.getElementById('eventId').value = c.EventID;
                document.getElementById('eventName').value = c.EventName || '';
                document.getElementById('eventDate').value = c.Date || '';
                document.getElementById('endDate').value = c.EndDate || '';
                document.getElementById('location').value = c.Location || '';
                document.getElementById('status').value = c.Status || 'Upcoming';
                document.getElementById('details').value = c.Details || '';
                document.getElementById('participants').value = c.Participants || '';
                document.getElementById('result').value = c.Result || '';
                document.getElementById('position').value = c.Position || '';
                document.getElementById('notes').value = c.Notes || '';
            }
        } catch (e) {
            console.error(e);
        }
        hideLoading();
    }
}

async function saveCompetition(event) {
    event.preventDefault();
    showLoading();
    
    var id = document.getElementById('eventId').value;
    var data = {
        EventName: document.getElementById('eventName').value,
        Date: document.getElementById('eventDate').value,
        EndDate: document.getElementById('endDate').value,
        Location: document.getElementById('location').value,
        Status: document.getElementById('status').value,
        Details: document.getElementById('details').value,
        Participants: document.getElementById('participants').value,
        Result: document.getElementById('result').value,
        Position: document.getElementById('position').value,
        Notes: document.getElementById('notes').value
    };
    
    try {
        if (id) {
            await apiCall('updateCompetition', { id: id, data: data });
            showNotification('Competition updated!');
        } else {
            await apiCall('addCompetition', { data: data });
            showNotification('Competition added!');
        }
        window.location.href = 'competitions.html';
    } catch (e) {
        console.error(e);
    }
    hideLoading();
}

// =====================================================
// ORDERS MODULE
// =====================================================

var allOrders = [];
var orderImportData = [];
var currentOrderFilter = 'all';
var currentCompleteOrderId = null;
var orderItems = [];

async function loadOrders() {
    showLoading();
    try {
        var result = await apiCall('getOrders');
        allOrders = result.data || [];
        updateOrderStats();
        renderOrdersList(allOrders);
    } catch (e) {
        console.error(e);
        var container = document.getElementById('ordersContainer');
        if (container) {
            container.innerHTML = '<div class="empty-state"><h3>Failed to load</h3><button onclick="loadOrders()" class="btn btn-primary">Retry</button></div>';
        }
    }
    hideLoading();
}

function updateOrderStats() {
    var total = allOrders.length;
    var pending = allOrders.filter(function(o) { return o.Status === 'Ordered'; }).length;
    var shipped = allOrders.filter(function(o) { return o.Status === 'Shipped'; }).length;
    var completed = allOrders.filter(function(o) { return o.Status === 'Completed' || o.Status === 'Delivered'; }).length;
    
    if (document.getElementById('totalOrders')) document.getElementById('totalOrders').textContent = total;
    if (document.getElementById('pendingOrders')) document.getElementById('pendingOrders').textContent = pending;
    if (document.getElementById('shippedOrders')) document.getElementById('shippedOrders').textContent = shipped;
    if (document.getElementById('completedOrders')) document.getElementById('completedOrders').textContent = completed;
}

function filterOrders(status, btn) {
    currentOrderFilter = status;
    var tabs = document.querySelectorAll('.filter-tabs .filter-tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('active');
    }
    if (btn) btn.classList.add('active');
    
    var filtered = allOrders;
    if (status !== 'all') {
        if (status === 'Completed') {
            filtered = allOrders.filter(function(o) { return o.Status === 'Completed' || o.Status === 'Delivered'; });
        } else {
            filtered = allOrders.filter(function(o) { return o.Status === status; });
        }
    }
    renderOrdersList(filtered);
}

function searchOrders() {
    var q = (document.getElementById('searchOrders') ? document.getElementById('searchOrders').value : '').toLowerCase();
    var filtered = allOrders.filter(function(o) {
        return (o.OrderID || '').toLowerCase().includes(q) ||
               (o.Vendor || '').toLowerCase().includes(q) ||
               (o.Notes || '').toLowerCase().includes(q);
    });
    if (currentOrderFilter !== 'all') {
        if (currentOrderFilter === 'Completed') {
            filtered = filtered.filter(function(o) { return o.Status === 'Completed' || o.Status === 'Delivered'; });
        } else {
            filtered = filtered.filter(function(o) { return o.Status === currentOrderFilter; });
        }
    }
    renderOrdersList(filtered);
}

function renderOrdersList(orders) {
    var container = document.getElementById('ordersContainer');
    if (!container) return;
    
    if (!orders || orders.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><h3>No Orders Found</h3><div class="empty-actions"><a href="order_form.html" class="btn btn-primary">➕ Create Order</a><button class="btn btn-secondary" onclick="openImportOrderModal()">📥 Import Excel</button></div></div>';
        return;
    }
    
    var html = '<div class="orders-grid">';
    for (var i = 0; i < orders.length; i++) {
        html += createOrderCard(orders[i]);
    }
    html += '</div>';
    container.innerHTML = html;
}

function createOrderCard(order) {
    var items = order.Items || [];
    var totalQty = parseInt(order.TotalQuantity) || 0;
    if (totalQty === 0) {
        for (var i = 0; i < items.length; i++) {
            totalQty += parseInt(items[i].Quantity) || 0;
        }
    }
    
    var statusIcons = {
        'ordered': '🕐',
        'shipped': '🚚',
        'delivered': '✅',
        'completed': '✅',
        'cancelled': '❌'
    };
    var statusClass = (order.Status || 'ordered').toLowerCase();
    var isCompleted = order.Status === 'Completed' || order.Status === 'Delivered';
    
    var html = '<div class="order-card ' + (isCompleted ? 'completed' : '') + '">';
    
    html += '<div class="order-card-header">';
    html += '<div class="order-info">';
    html += '<code class="order-id">' + order.OrderID + '</code>';
    html += '<span class="order-vendor">' + (escapeHtml(order.Vendor) || 'Unknown') + '</span>';
    html += '</div>';
    html += '<span class="status-badge status-' + statusClass + '">' + (statusIcons[statusClass] || '📦') + ' ' + (order.Status || 'Ordered') + '</span>';
    html += '</div>';
    
    html += '<div class="order-card-meta">';
    html += '<div class="meta-item"><span class="meta-label">📅 Ordered</span><span class="meta-value">' + (formatDate(order.OrderDate) || 'N/A') + '</span></div>';
    html += '<div class="meta-item"><span class="meta-label">🚚 Expected</span><span class="meta-value">' + (formatDate(order.ExpectedDelivery) || 'TBD') + '</span></div>';
    html += '<div class="meta-item"><span class="meta-label">📦 Items</span><span class="meta-value">' + items.length + ' types, ' + totalQty + ' units</span></div>';
    html += '</div>';
    
    if (items.length > 0) {
        html += '<div class="order-items-preview"><h5>Items</h5>';
        for (var j = 0; j < Math.min(4, items.length); j++) {
            var item = items[j];
            html += '<div class="order-item-row">';
            html += '<span class="item-sno">' + (j + 1) + '.</span>';
            html += '<span class="item-name">' + escapeHtml(item.ComponentName) + '</span>';
            html += '<span><span class="item-qty">×' + item.Quantity + '</span>';
            if (item.Synced === 'Yes') html += '<span class="synced-badge">✓</span>';
            html += '</span></div>';
        }
        if (items.length > 4) {
            html += '<div class="more-items">+' + (items.length - 4) + ' more</div>';
        }
        html += '</div>';
    }
    
    html += '<div class="order-card-actions">';
    if (!isCompleted) {
        html += '<button class="btn btn-success" onclick="openCompleteOrderModal(\'' + order.OrderID + '\')">✅ Complete & Add</button>';
    } else {
        html += '<span class="completed-badge">✅ Added to Inventory</span>';
    }
    html += '<button class="btn btn-sm btn-info" onclick="viewOrder(\'' + order.OrderID + '\')">👁️</button>';
    if (!isCompleted) {
        html += '<button class="btn btn-sm btn-primary" onclick="editOrder(\'' + order.OrderID + '\')">✏️</button>';
        html += '<button class="btn btn-sm btn-danger" onclick="deleteOrder(\'' + order.OrderID + '\')">🗑️</button>';
    }
    html += '</div></div>';
    
    return html;
}

function viewOrder(orderId) {
    var order = allOrders.find(function(o) { return o.OrderID === orderId; });
    if (!order) return;
    
    var items = order.Items || [];
    var isCompleted = order.Status === 'Completed' || order.Status === 'Delivered';
    
    document.getElementById('viewOrderTitle').textContent = 'Order: ' + order.OrderID;
    
    var html = '<div class="order-details-grid">';
    html += '<div class="detail-item"><label>Vendor</label><span>' + (escapeHtml(order.Vendor) || 'N/A') + '</span></div>';
    html += '<div class="detail-item"><label>Status</label><span class="status-badge status-' + (order.Status || 'ordered').toLowerCase() + '">' + (order.Status || 'Ordered') + '</span></div>';
    html += '<div class="detail-item"><label>Order Date</label><span>' + (formatDate(order.OrderDate) || 'N/A') + '</span></div>';
    html += '<div class="detail-item"><label>Expected</label><span>' + (formatDate(order.ExpectedDelivery) || 'TBD') + '</span></div>';
    html += '</div>';
    
    html += '<h4>📋 Items (' + items.length + ')</h4>';
    if (items.length > 0) {
        html += '<table class="order-items-table"><thead><tr><th>S.No</th><th>Component</th><th>Type</th><th>Qty</th><th>Status</th></tr></thead><tbody>';
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            html += '<tr>';
            html += '<td>' + (i + 1) + '</td>';
            html += '<td><strong>' + escapeHtml(item.ComponentName) + '</strong></td>';
            html += '<td>' + (escapeHtml(item.Type) || '-') + '</td>';
            html += '<td>' + item.Quantity + '</td>';
            html += '<td>' + (item.Synced === 'Yes' ? '<span class="synced-badge">✅ Added</span>' : '<span class="pending-badge">⏳ Pending</span>') + '</td>';
            html += '</tr>';
        }
        html += '</tbody></table>';
    } else {
        html += '<p>No items</p>';
    }
    
    if (order.Notes) {
        html += '<h4>📝 Notes</h4><p>' + escapeHtml(order.Notes) + '</p>';
    }
    
    if (isCompleted) {
        html += '<div class="completed-info"><p>✅ This order is complete. All items added to inventory.</p></div>';
    }
    
    document.getElementById('viewOrderBody').innerHTML = html;
    
    var editBtn = document.getElementById('viewOrderEditBtn');
    if (isCompleted) {
        editBtn.style.display = 'none';
    } else {
        editBtn.style.display = 'inline-flex';
        editBtn.onclick = function() {
            closeViewOrderModal();
            editOrder(orderId);
        };
    }
    
    document.getElementById('viewOrderModal').classList.add('show');
}

function closeViewOrderModal() {
    document.getElementById('viewOrderModal').classList.remove('show');
}

function editOrder(id) {
    window.location.href = 'order_form.html?id=' + id;
}

async function deleteOrder(id) {
    if (!confirm('Delete this order?')) return;
    showLoading();
    try {
        await apiCall('deleteOrder', { id: id });
        showNotification('Order deleted!');
        loadOrders();
    } catch (e) {
        console.error(e);
    }
    hideLoading();
}

function openCompleteOrderModal(orderId) {
    currentCompleteOrderId = orderId;
    var order = allOrders.find(function(o) { return o.OrderID === orderId; });
    if (!order) return;
    
    var items = order.Items || [];
    var totalQty = 0;
    for (var i = 0; i < items.length; i++) {
        totalQty += parseInt(items[i].Quantity) || 0;
    }
    
    var html = '<div class="order-summary-box">';
    html += '<div class="summary-header"><strong>Order:</strong> ' + order.OrderID + '<br><strong>Vendor:</strong> ' + escapeHtml(order.Vendor) + '</div>';
    html += '<h5>📦 Items to add (' + items.length + ' types, ' + totalQty + ' units):</h5>';
    html += '<div class="items-to-add"><table class="mini-table"><thead><tr><th>S.No</th><th>Component</th><th>Type</th><th>Qty</th></tr></thead><tbody>';
    
    for (var j = 0; j < items.length; j++) {
        var item = items[j];
        html += '<tr><td>' + (j + 1) + '</td><td>' + escapeHtml(item.ComponentName) + '</td><td>' + (escapeHtml(item.Type) || '-') + '</td><td><strong>+' + item.Quantity + '</strong></td></tr>';
    }
    
    html += '</tbody></table></div></div>';
    
    document.getElementById('completeOrderSummary').innerHTML = html;
    document.getElementById('completeOrderModal').classList.add('show');
}

function closeCompleteOrderModal() {
    document.getElementById('completeOrderModal').classList.remove('show');
    currentCompleteOrderId = null;
}

async function confirmCompleteOrder() {
    if (!currentCompleteOrderId) return;
    
    showLoading();
    closeCompleteOrderModal();
    
    try {
        var result = await apiCall('completeOrder', { id: currentCompleteOrderId });
        
        if (result.success) {
            showMergeResults(result);
            loadOrders();
        } else {
            showNotification(result.error || 'Failed', 'error');
        }
    } catch (e) {
        console.error(e);
        showNotification('Error completing order', 'error');
    }
    hideLoading();
}

function showMergeResults(result) {
    var syncResults = result.syncResults || [];
    var merged = syncResults.filter(function(r) { return r.action === 'merged'; });
    var created = syncResults.filter(function(r) { return r.action === 'created'; });
    
    var html = '<div class="merge-results">';
    html += '<div class="merge-summary">';
    html += '<div class="summary-item success"><span class="summary-number">' + merged.length + '</span><span class="summary-label">Updated</span></div>';
    html += '<div class="summary-item info"><span class="summary-number">' + created.length + '</span><span class="summary-label">Created</span></div>';
    html += '</div>';
    
    if (merged.length > 0) {
        html += '<div class="result-section"><h5>🔄 Updated Components</h5>';
        html += '<table class="results-table"><thead><tr><th>Component</th><th>Previous</th><th>Added</th><th>New</th></tr></thead><tbody>';
        for (var i = 0; i < merged.length; i++) {
            var r = merged[i];
            html += '<tr><td><strong>' + escapeHtml(r.matchedWith || r.itemName) + '</strong></td>';
            html += '<td>' + r.previousQty + '</td>';
            html += '<td class="added-qty">+' + r.addedQty + '</td>';
            html += '<td class="new-qty"><strong>' + r.newQty + '</strong></td></tr>';
        }
        html += '</tbody></table></div>';
    }
    
    if (created.length > 0) {
        html += '<div class="result-section"><h5>🆕 New Components</h5>';
        html += '<table class="results-table"><thead><tr><th>Component</th><th>Quantity</th></tr></thead><tbody>';
        for (var j = 0; j < created.length; j++) {
            var c = created[j];
            html += '<tr><td><strong>' + escapeHtml(c.itemName || c.componentName) + '</strong></td>';
            html += '<td class="new-qty"><strong>' + (c.addedQty || c.newQty || c.quantity) + '</strong></td></tr>';
        }
        html += '</tbody></table></div>';
    }
    
    html += '<div class="success-message"><p>✅ All items added to inventory!</p></div>';
    html += '</div>';
    
    document.getElementById('mergeResultsContent').innerHTML = html;
    document.getElementById('mergeResultsModal').classList.add('show');
}

function closeMergeResultsModal() {
    document.getElementById('mergeResultsModal').classList.remove('show');
}

function openImportOrderModal() {
    document.getElementById('importOrderModal').classList.add('show');
    orderImportData = [];
    document.getElementById('orderPreviewSection').style.display = 'none';
    document.getElementById('confirmOrderImportBtn').disabled = true;
    document.getElementById('importVendor').value = '';
    document.getElementById('importOrderDate').valueAsDate = new Date();
    document.getElementById('importExpectedDelivery').value = '';
}

function closeImportOrderModal() {
    document.getElementById('importOrderModal').classList.remove('show');
    orderImportData = [];
}

function setupOrderDropZone() {
    var dz = document.getElementById('orderDropZone');
    if (!dz) return;
    
    dz.addEventListener('dragover', function(e) {
        e.preventDefault();
        dz.classList.add('dragover');
    });
    
    dz.addEventListener('dragleave', function() {
        dz.classList.remove('dragover');
    });
    
    dz.addEventListener('drop', function(e) {
        e.preventDefault();
        dz.classList.remove('dragover');
        if (e.dataTransfer.files[0]) handleOrderFile(e.dataTransfer.files[0]);
    });
}

function handleOrderFile(file) {
    if (!file) return;
    
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var wb = XLSX.read(e.target.result, { type: 'binary' });
            orderImportData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            
            if (orderImportData.length === 0) {
                showNotification('No data in file', 'error');
                return;
            }
            
            showOrderPreview(orderImportData);
            showNotification('Found ' + orderImportData.length + ' items');
        } catch (err) {
            console.error(err);
            showNotification('Error reading file', 'error');
        }
    };
    reader.readAsBinaryString(file);
}

function showOrderPreview(data) {
    if (!data || data.length === 0) {
        showNotification('No data', 'error');
        return;
    }
    
    var totalQty = 0;
    for (var i = 0; i < data.length; i++) {
        totalQty += parseInt(data[i].Quantity || data[i].quantity || 0);
    }
    
    var html = '<table class="preview-table"><thead><tr><th>S.No</th><th>Component</th><th>Type</th><th>Qty</th></tr></thead><tbody>';
    
    for (var j = 0; j < Math.min(15, data.length); j++) {
        var item = data[j];
        var sno = item['S.No'] || item['SNo'] || item['sno'] || (j + 1);
        var name = item.ComponentName || item.Name || item.name || '';
        var type = item.Type || item.type || '';
        var qty = item.Quantity || item.quantity || 0;
        
        html += '<tr><td>' + sno + '</td><td><strong>' + escapeHtml(name) + '</strong></td><td>' + escapeHtml(type) + '</td><td>' + qty + '</td></tr>';
    }
    
    if (data.length > 15) {
        html += '<tr><td colspan="4" style="text-align:center;font-style:italic;">...and ' + (data.length - 15) + ' more</td></tr>';
    }
    
    html += '</tbody></table>';
    
    document.getElementById('orderItemsPreview').innerHTML = html;
    document.getElementById('previewTotalItems').textContent = data.length;
    document.getElementById('previewTotalQty').textContent = totalQty;
    document.getElementById('orderPreviewSection').style.display = 'block';
    document.getElementById('confirmOrderImportBtn').disabled = false;
}

function downloadOrderTemplate() {
    var template = [
        { 'S.No': 1, ComponentName: 'Arduino Uno R3', Type: 'Microcontroller', Quantity: 5 },
        { 'S.No': 2, ComponentName: 'ESP32 DevKit', Type: 'Microcontroller', Quantity: 10 },
        { 'S.No': 3, ComponentName: 'HC-SR04 Ultrasonic', Type: 'Sensor', Quantity: 8 },
        { 'S.No': 4, ComponentName: 'SG90 Servo Motor', Type: 'Motor', Quantity: 6 }
    ];
    
    var ws = XLSX.utils.json_to_sheet(template);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Order');
    XLSX.writeFile(wb, 'Order_Template.xlsx');
    showNotification('Template downloaded!');
}

async function confirmOrderImport() {
    if (!orderImportData || orderImportData.length === 0) {
        showNotification('No items', 'warning');
        return;
    }
    
    var vendor = document.getElementById('importVendor') ? document.getElementById('importVendor').value.trim() : '';
    if (!vendor) {
        showNotification('Enter vendor name', 'warning');
        return;
    }
    
    showLoading();
    
    try {
        var items = [];
        for (var i = 0; i < orderImportData.length; i++) {
            var item = orderImportData[i];
            var name = item.ComponentName || item.Name || item.name || '';
            if (name) {
                items.push({
                    ComponentName: name,
                    Type: item.Type || item.type || '',
                    Quantity: parseInt(item.Quantity || item.quantity) || 1
                });
            }
        }
        
        if (items.length === 0) {
            showNotification('No valid items', 'error');
            hideLoading();
            return;
        }
        
        var orderData = {
            Vendor: vendor,
            OrderDate: document.getElementById('importOrderDate') ? document.getElementById('importOrderDate').value : new Date().toISOString().split('T')[0],
            ExpectedDelivery: document.getElementById('importExpectedDelivery') ? document.getElementById('importExpectedDelivery').value :            ''
        };
        
        var result = await apiCall('addOrder', { data: orderData });
        
        if (result.success) {
            showNotification('Order imported successfully!');
            closeImportOrderModal();
            loadOrders();
        } else {
            showNotification(result.error || 'Failed to import order', 'error');
        }
        
    } catch (e) {
        console.error(e);
        showNotification('Error importing order', 'error');
    }
    hideLoading();
}

// =====================================================
// ORDER FORM FUNCTIONS (order_form.html)
// =====================================================

async function loadOrderForm() {
    var orderId = getUrlParam('id');
    orderItems = []; // Reset items
    
    // Set default date to today
    var dateInput = document.getElementById('orderDate');
    if (dateInput) dateInput.valueAsDate = new Date();
    
    if (orderId) {
        document.getElementById('formTitle').textContent = 'Edit Order';
        showLoading();
        try {
            var result = await apiCall('getOrder', { id: orderId });
            if (result.success && result.data) {
                var order = result.data;
                document.getElementById('orderId').value = order.OrderID;
                document.getElementById('vendor').value = order.Vendor || '';
                document.getElementById('orderDate').value = order.OrderDate || '';
                document.getElementById('expectedDelivery').value = order.ExpectedDelivery || '';
                document.getElementById('status').value = order.Status || 'Ordered';
                document.getElementById('notes').value = order.Notes || '';
                
                if (order.Items) {
                    orderItems = order.Items.map(function(item) {
                        return {
                            ComponentName: item.ComponentName,
                            Type: item.Type || '',
                            Quantity: parseInt(item.Quantity) || 1
                        };
                    });
                }
            }
        } catch (e) {
            console.error(e);
        }
        hideLoading();
    }
    
    renderOrderItems();
}

function addOrderItem() {
    var nameInput = document.getElementById('itemName');
    var typeInput = document.getElementById('itemType');
    var qtyInput = document.getElementById('itemQuantity');
    
    var name = nameInput.value.trim();
    var type = typeInput.value;
    var qty = parseInt(qtyInput.value) || 1;
    
    if (!name) {
        showNotification('Please enter a component name', 'warning');
        nameInput.focus();
        return;
    }
    
    orderItems.push({
        ComponentName: name,
        Type: type,
        Quantity: qty
    });
    
    // Reset inputs
    nameInput.value = '';
    typeInput.value = '';
    qtyInput.value = '1';
    nameInput.focus();
    
    renderOrderItems();
}

function removeOrderItem(index) {
    orderItems.splice(index, 1);
    renderOrderItems();
}

function updateItemQty(index, val) {
    var qty = parseInt(val) || 1;
    if (qty < 1) qty = 1;
    orderItems[index].Quantity = qty;
    updateOrderTotals();
}

function renderOrderItems() {
    var container = document.getElementById('orderItemsContainer');
    if (!container) return;
    
    if (orderItems.length === 0) {
        container.innerHTML = '<div class="no-items">No items added yet. Add items above.</div>';
        updateOrderTotals();
        return;
    }
    
    var html = '<table class="order-items-table"><thead><tr><th>S.No</th><th>Component</th><th>Type</th><th>Qty</th><th>Action</th></tr></thead><tbody>';
    
    for (var i = 0; i < orderItems.length; i++) {
        var item = orderItems[i];
        html += '<tr>';
        html += '<td>' + (i + 1) + '</td>';
        html += '<td><strong>' + escapeHtml(item.ComponentName) + '</strong></td>';
        html += '<td>' + escapeHtml(item.Type || '-') + '</td>';
        html += '<td><input type="number" class="qty-input-sm" value="' + item.Quantity + '" min="1" onchange="updateItemQty(' + i + ', this.value)"></td>';
        html += '<td><button type="button" class="btn btn-sm btn-danger" onclick="removeOrderItem(' + i + ')">✕</button></td>';
        html += '</tr>';
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
    
    updateOrderTotals();
}

function updateOrderTotals() {
    var totalItems = orderItems.length;
    var totalQty = 0;
    
    for (var i = 0; i < orderItems.length; i++) {
        totalQty += parseInt(orderItems[i].Quantity) || 0;
    }
    
    if (document.getElementById('totalItemsCount')) 
        document.getElementById('totalItemsCount').textContent = totalItems;
    
    if (document.getElementById('totalQuantityCount')) 
        document.getElementById('totalQuantityCount').textContent = totalQty;
}

async function saveOrder(event) {
    event.preventDefault();
    
    if (orderItems.length === 0) {
        showNotification('Please add at least one item to the order', 'warning');
        return;
    }
    
    var vendor = document.getElementById('vendor').value.trim();
    if (!vendor) {
        showNotification('Please enter a vendor name', 'warning');
        return;
    }
    
    var status = document.getElementById('status').value;
    
    var data = {
        Vendor: vendor,
        OrderDate: document.getElementById('orderDate').value,
        ExpectedDelivery: document.getElementById('expectedDelivery').value,
        Status: status,
        Notes: document.getElementById('notes').value,
        Items: orderItems
    };
    
    showLoading();
    
    try {
        var orderId = document.getElementById('orderId').value;
        var result;
        
        if (orderId) {
            // Update existing order
            result = await apiCall('updateOrder', { id: orderId, data: data });
            
            // If status changed to Completed, we might want to sync immediately
            if (result.success && status === 'Completed') {
                var syncResult = await apiCall('completeOrder', { id: orderId });
                if (syncResult.success) {
                    showNotification('Order updated and inventory synced!');
                } else {
                    showNotification('Order updated, but sync failed: ' + syncResult.error, 'warning');
                }
            } else {
                showNotification('Order updated successfully!');
            }
        } else {
            // Create new order
            result = await apiCall('addOrder', { data: data });
            
            if (result.success && status === 'Completed' && result.id) {
                // If created as Completed, sync immediately
                var syncResult = await apiCall('completeOrder', { id: result.id });
                if (syncResult.success) {
                    showNotification('Order created and inventory synced!');
                } else {
                    showNotification('Order created, but sync failed: ' + syncResult.error, 'warning');
                }
            } else {
                showNotification('Order created successfully!');
            }
        }
        
        window.location.href = 'orders.html';
        
    } catch (e) {
        console.error(e);
    }
    
    hideLoading();
}

console.log('✅ Script.js loaded');
