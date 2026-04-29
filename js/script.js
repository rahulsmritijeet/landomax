// =====================================================
// script.js - ATL Dashboard Complete
// All Modules: Components, Projects, Competitions, Orders
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
        if (DEBUG_MODE) console.log('📡 API Call:', action, url.toString());
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error('HTTP error: ' + response.status);
        const text = await response.text();
        if (DEBUG_MODE) console.log('📥 Raw response:', text.substring(0, 200));
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
// UI HELPERS
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
    notification.innerHTML = '<span>' + icon + ' ' + message + '</span>' +
        '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;margin-left:10px;">✕</button>';
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

function getUrlParam(p) {
    return new URLSearchParams(window.location.search).get(p);
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
    return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.substring(0, 2).toUpperCase();
}

function getTypeIcon(type) {
    const icons = {
        'microcontroller':'🎛️','sensor':'📡','motor':'⚙️','led':'💡',
        'resistor':'🔧','capacitor':'🔋','wire':'🔌','display':'📺',
        'module':'📦','board':'🎚️','battery':'🔋','switch':'🔘'
    };
    return icons[(type || '').toLowerCase()] || '📦';
}

// =====================================================
// COMPONENTS MODULE
// =====================================================

let allComponents = [];
let currentStockFilter = 'all';
let importData = [];
let currentQuantityComponentId = null;

async function loadComponents() {
    showLoading();
    try {
        const r = await apiCall('getComponents');
        allComponents = r.data || [];
        updateComponentStats();
        renderComponentsTable(allComponents);
    } catch (e) {
        console.error('loadComponents error', e);
        showNotification('Failed to load components', 'error');
    }
    hideLoading();
}

function updateComponentStats() {
    const total = allComponents.length;
    const inStock = allComponents.filter(c => (parseInt(c.Quantity) || 0) > 5).length;
    const lowStock = allComponents.filter(c => {
        const q = parseInt(c.Quantity) || 0;
        return q > 0 && q <= 5;
    }).length;
    const outOfStock = allComponents.filter(c => (parseInt(c.Quantity) || 0) === 0).length;

    if (document.getElementById('totalComponents')) document.getElementById('totalComponents').textContent = total;
    if (document.getElementById('inStockCount')) document.getElementById('inStockCount').textContent = inStock;
    if (document.getElementById('lowStockCount')) document.getElementById('lowStockCount').textContent = lowStock;
    if (document.getElementById('outOfStockCount')) document.getElementById('outOfStockCount').textContent = outOfStock;
}

function renderComponentsTable(components) {
    const tbody = document.getElementById('componentsTableBody');
    if (!tbody) return;
    if (!components || !components.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">No components found</td></tr>';
        return;
    }
    let html = '';
    components.forEach(c => {
        const qty = parseInt(c.Quantity) || 0;
        const cls = qty === 0 ? 'qty-zero' : qty <= 5 ? 'qty-low' : 'qty-ok';
        const safeName = escapeHtml(c.ComponentName).replace(/'/g, "\\'");
        html += '<tr>' +
            '<td><code>' + c.ComponentID + '</code></td>' +
            '<td><span class="type-icon">' + getTypeIcon(c.Type) + '</span> <strong>' + escapeHtml(c.ComponentName) + '</strong></td>' +
            '<td><span class="type-badge">' + (c.Type || '-') + '</span></td>' +
            '<td>' + escapeHtml((c.Description || '').substring(0, 40)) + '</td>' +
            '<td><span class="quantity-badge ' + cls + '" onclick="openQuantityModal(\'' + c.ComponentID + '\',\'' + safeName + '\',' + qty + ')">' + qty + ' ✏️</span></td>' +
            '<td><button class="btn btn-sm btn-primary" onclick="editComponent(\'' + c.ComponentID + '\')">✏️</button></td>' +
            '</tr>';
    });
    tbody.innerHTML = html;
}

function searchComponents() {
    const q = (document.getElementById('searchComponents')?.value || '').toLowerCase();
    let filtered = allComponents.filter(c =>
        (c.ComponentName || '').toLowerCase().includes(q) ||
        (c.ComponentID || '').toLowerCase().includes(q) ||
        (c.Type || '').toLowerCase().includes(q)
    );
    if (currentStockFilter !== 'all') filtered = applyStockFilter(filtered, currentStockFilter);
    renderComponentsTable(filtered);
}

function filterComponentsByStock(filter, btn) {
    currentStockFilter = filter;
    document.querySelectorAll('.filter-tabs .filter-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    searchComponents();
}

function applyStockFilter(arr, filter) {
    return arr.filter(c => {
        const q = parseInt(c.Quantity) || 0;
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
    const data = allComponents.map(c => ({
        'Component ID': c.ComponentID,
        'Name': c.ComponentName,
        'Type': c.Type || '',
        'Description': c.Description || '',
        'Quantity': parseInt(c.Quantity) || 0
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Components');
    XLSX.writeFile(wb, 'ATL_Components_' + new Date().toISOString().split('T')[0] + '.xlsx');
    showNotification('Components exported!');
}

function downloadComponentTemplate() {
    const template = [
        { ComponentName: 'Arduino Uno', Type: 'Microcontroller', Quantity: 5, Description: 'ATmega328P board' },
        { ComponentName: 'ESP32', Type: 'Microcontroller', Quantity: 10, Description: 'WiFi+BT module' }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Components_Template.xlsx');
    showNotification('Template downloaded!');
}

// Quantity modal

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
    const input = document.getElementById('quantityInput');
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

// Import components

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
    const dz = document.getElementById('dropZone');
    if (!dz) return;
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => {
        e.preventDefault();
        dz.classList.remove('dragover');
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
}

function handleFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const wb = XLSX.read(e.target.result, { type: 'binary' });
            importData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            showPreview(importData);
        } catch (err) {
            console.error(err);
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
    const headers = Object.keys(data[0]);
    let html = '<table class="preview-table"><thead><tr>';
    headers.forEach(h => html += '<th>' + h + '</th>');
    html += '</tr></thead><tbody>';
    data.slice(0, 5).forEach(row => {
        html += '<tr>';
        headers.forEach(h => html += '<td>' + (row[h] || '') + '</td>');
        html += '</tr>';
    });
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
        const result = await apiCall('importComponentsFromExcel', { data: importData });
        showNotification('Components imported. Added: ' + (result.added || 0) + ', Merged: ' + (result.merged || 0));
        closeImportModal();
        loadComponents();
    } catch (e) {
        console.error(e);
    }
    hideLoading();
}

// Component form

function editComponent(id) {
    window.location.href = 'component_form.html?id=' + id;
}

async function loadComponentForm() {
    const id = getUrlParam('id');
    if (id) {
        document.getElementById('formTitle').textContent = 'Edit Component';
        showLoading();
        try {
            const r = await apiCall('getComponent', { id });
            if (r.success && r.data) {
                document.getElementById('componentId').value = r.data.ComponentID;
                document.getElementById('componentName').value = r.data.ComponentName || '';
                document.getElementById('type').value = r.data.Type || '';
                document.getElementById('description').value = r.data.Description || '';
                document.getElementById('quantity').value = r.data.Quantity || 0;
            }
        } catch (e) { console.error(e); }
        hideLoading();
    }
}

async function saveComponent(event) {
    event.preventDefault();
    showLoading();
    const id = document.getElementById('componentId').value;
    const data = {
        ComponentName: document.getElementById('componentName').value,
        Type: document.getElementById('type').value,
        Description: document.getElementById('description').value,
        Quantity: parseInt(document.getElementById('quantity').value) || 0
    };
    try {
        if (id) await apiCall('updateComponent', { id, data });
        else await apiCall('addComponent', { data });
        showNotification(id ? 'Component updated!' : 'Component added!');
        window.location.href = 'components.html';
    } catch (e) { console.error(e); }
    hideLoading();
}

// =====================================================
// PROJECTS MODULE
// =====================================================

let allProjects = [];
let allProjectComponents = [];
let selectedProjectComponents = {};
let teamMembersList = [];
let currentTypeFilter = 'all';

async function loadProjects() {
    showLoading();
    try {
        const r = await apiCall('getProjects');
        allProjects = r.data || [];
        updateProjectStats();
        renderProjectsList(allProjects);
    } catch (e) {
        console.error(e);
        const c = document.getElementById('projectsContainer');
        if (c) c.innerHTML = '<div class="empty-state"><h3>Failed to load</h3><button onclick="loadProjects()" class="btn btn-primary">Retry</button></div>';
    }
    hideLoading();
}

function updateProjectStats() {
    const students = {};
    let totalUsage = 0;
    allProjects.forEach(p => {
        if (p.TeamMembers) {
            p.TeamMembers.split(',').forEach(m => {
                const t = m.trim().toLowerCase();
                if (t) students[t] = true;
            });
        }
        if (p.ComponentsUsed) {
            p.ComponentsUsed.split(',').forEach(part => {
                part = part.trim();
                if (!part) return;
                if (part.includes(':')) totalUsage += parseInt(part.split(':')[1]) || 1;
                else totalUsage += 1;
            });
        }
    });
    if (document.getElementById('totalProjects')) document.getElementById('totalProjects').textContent = allProjects.length;
    if (document.getElementById('totalStudents')) document.getElementById('totalStudents').textContent = Object.keys(students).length;
    if (document.getElementById('totalComponentsUsed')) document.getElementById('totalComponentsUsed').textContent = totalUsage;
}

function renderProjectsList(projects) {
    const c = document.getElementById('projectsContainer');
    if (!c) return;
    if (!projects || !projects.length) {
        c.innerHTML = '<div class="empty-state"><div class="empty-icon">📁</div><h3>No Projects Found</h3><a href="project_form.html" class="btn btn-primary">➕ Create Project</a></div>';
        return;
    }
    let html = '<div class="projects-grid">';
    projects.forEach(p => html += createProjectCard(p));
    html += '</div>';
    c.innerHTML = html;
}

function createProjectCard(p) {
    const members = p.TeamMembers ? p.TeamMembers.split(',').map(m => m.trim()).filter(m => m) : [];
    const comps = parseComponentsUsed(p.ComponentsUsed);
    let html = '<div class="project-card" onclick="viewProject(\'' + p.ProjectID + '\')">';
    html += '<div class="project-card-header"><code class="project-id">' + p.ProjectID + '</code><span class="project-date">' + formatDate(p.LastUpdated) + '</span></div>';
    html += '<h3 class="project-title">' + (escapeHtml(p.ProjectName) || 'Untitled') + '</h3>';
    if (p.Overview) html += '<p class="project-overview">' + escapeHtml(p.Overview).substring(0, 120) + '</p>';
    if (members.length) {
        html += '<div class="project-team">👥 ' + members.slice(0, 3).join(', ');
        if (members.length > 3) html += ' +' + (members.length - 3);
        html += '</div>';
    }
    if (comps.length) html += '<div class="project-components">⚙️ ' + comps.length + ' components</div>';
    html += '<div class="project-card-actions" onclick="event.stopPropagation()">' +
        '<button class="btn btn-sm btn-primary" onclick="editProject(\'' + p.ProjectID + '\')">✏️</button>' +
        '<button class="btn btn-sm btn-danger" onclick="deleteProject(\'' + p.ProjectID + '\')">🗑️</button>' +
        '</div></div>';
    return html;
}

function parseComponentsUsed(str) {
    if (!str) return [];
    return str.split(',').map(part => {
        part = part.trim();
        if (!part) return null;
        if (part.includes(':')) {
            const [id, q] = part.split(':');
            return { id: id.trim(), quantity: parseInt(q) || 1 };
        }
        return { id: part, quantity: 1 };
    }).filter(Boolean);
}

function searchProjects() {
    const q = (document.getElementById('searchProjects')?.value || '').toLowerCase();
    const filtered = allProjects.filter(p =>
        (p.ProjectName || '').toLowerCase().includes(q) ||
        (p.Overview || '').toLowerCase().includes(q) ||
        (p.TeamMembers || '').toLowerCase().includes(q)
    );
    renderProjectsList(filtered);
}

function viewProject(id) {
    const p = allProjects.find(x => x.ProjectID === id);
    if (!p) return;
    document.getElementById('modalProjectName').textContent = p.ProjectName || 'Untitled';
    let html = '<div class="project-detail">';
    html += '<div class="detail-section"><h4>📋 Overview</h4><p>' + (escapeHtml(p.Overview) || 'No overview') + '</p></div>';
    html += '<div class="detail-section"><h4>👥 Team</h4><p>' + (escapeHtml(p.TeamMembers) || 'No team members') + '</p></div>';
    html += '<div class="detail-section"><h4>⚙️ Components</h4><p>' + (escapeHtml(p.ComponentsUsed) || 'No components') + '</p></div>';
    if (p.Code) html += '<div class="detail-section"><h4>💻 Code</h4><pre class="code-block">' + escapeHtml(p.Code) + '</pre></div>';
    html += '</div>';
    document.getElementById('modalProjectBody').innerHTML = html;
    document.getElementById('modalEditBtn').onclick = () => window.location.href = 'project_form.html?id=' + id;
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
        await apiCall('deleteProject', { id });
        showNotification('Project deleted!');
        loadProjects();
    } catch (e) { console.error(e); }
    hideLoading();
}

async function loadProjectForm() {
    const id = getUrlParam('id');
    selectedProjectComponents = {};
    teamMembersList = [];
    await loadComponentsForSelection();
    await loadPreviousStudents();
    renderTeamMembersChips();
    if (id) {
        document.getElementById('formTitle').textContent = 'Edit Project';
        showLoading();
        try {
            const r = await apiCall('getProject', { id });
            if (r.success && r.data) {
                document.getElementById('projectId').value = r.data.ProjectID;
                document.getElementById('projectName').value = r.data.ProjectName || '';
                document.getElementById('overview').value = r.data.Overview || '';
                document.getElementById('code').value = r.data.Code || '';
                if (r.data.TeamMembers) {
                    teamMembersList = r.data.TeamMembers.split(',').map(m => m.trim()).filter(m => m);
                    renderTeamMembersChips();
                }
                if (r.data.ComponentsUsed) {
                    parseComponentsUsed(r.data.ComponentsUsed).forEach(comp => {
                        const full = allProjectComponents.find(c => c.ComponentID === comp.id);
                        if (full) selectedProjectComponents[comp.id] = Object.assign({}, full, { selectedQuantity: comp.quantity });
                    });
                    renderSelectedComponents();
                    updateSelectedCount();
                }
            }
        } catch (e) { console.error(e); }
        hideLoading();
    } else {
        document.getElementById('formTitle').textContent = 'Add New Project';
    }
}

async function loadComponentsForSelection() {
    try {
        const r = await apiCall('getComponents');
        allProjectComponents = r.data || [];
        renderAvailableComponents(allProjectComponents);
    } catch (e) {
        console.error(e);
        const c = document.getElementById('availableComponentsList');
        if (c) c.innerHTML = '<div class="error-message">Failed to load components</div>';
    }
}

function renderAvailableComponents(list) {
    const c = document.getElementById('availableComponentsList');
    if (!c) return;
    if (!list.length) { c.innerHTML = '<div class="no-data">No components available</div>'; return; }
    let html = '';
    list.forEach(comp => {
        const isSelected = selectedProjectComponents.hasOwnProperty(comp.ComponentID);
        const stock = parseInt(comp.Quantity) || 0;
        const out = stock === 0;
        const cls = out ? 'qty-zero' : stock <= 5 ? 'qty-low' : 'qty-ok';
        html += '<div class="component-item ' + (isSelected ? 'selected' : '') + ' ' + (out ? 'out-of-stock' : '') + '" ' +
            'data-id="' + comp.ComponentID + '" data-type="' + (comp.Type || '').toLowerCase() + '" data-name="' + (comp.ComponentName || '').toLowerCase() + '" data-stock="' + stock + '" ' +
            'onclick="' + (out ? 'showOutOfStockWarning()' : 'toggleComponent(\'' + comp.ComponentID + '\')') + '">' +
            '<div class="component-item-main"><span class="component-icon">' + getTypeIcon(comp.Type) + '</span>' +
            '<div class="component-info"><span class="component-name">' + escapeHtml(comp.ComponentName) + '</span>' +
            '<span class="component-meta"><code>' + comp.ComponentID + '</code></span></div></div>' +
            '<div class="component-stock ' + cls + '">' + (out ? '❌ Out' : stock + ' available') + '</div>' +
            '<div class="component-add-btn ' + (out ? 'disabled' : '') + '">' + (out ? '🚫' : isSelected ? '✓' : '+') + '</div></div>';
    });
    c.innerHTML = html;
}

function showOutOfStockWarning() { showNotification('Component is out of stock!', 'warning'); }

function toggleComponent(id) {
    const comp = allProjectComponents.find(c => c.ComponentID === id);
    if (!comp || (parseInt(comp.Quantity) || 0) === 0) {
        showNotification('Cannot add - out of stock!', 'error');
        return;
    }
    if (selectedProjectComponents[id]) delete selectedProjectComponents[id];
    else selectedProjectComponents[id] = Object.assign({}, comp, { selectedQuantity: 1 });
    renderAvailableComponents(allProjectComponents);
    renderSelectedComponents();
    updateSelectedCount();
}

function renderSelectedComponents() {
    const c = document.getElementById('selectedComponentsList');
    if (!c) return;
    const keys = Object.keys(selectedProjectComponents);
    if (!keys.length) {
        c.innerHTML = '<div class="no-selection-message">👈 Click components to add</div>';
        const t = document.getElementById('selectedTotal'); if (t) t.textContent = '(0)';
        return;
    }
    let total = 0, html = '';
    keys.forEach(id => {
        const comp = selectedProjectComponents[id];
        const qty = comp.selectedQuantity || 1;
        total += qty;
        const stock = parseInt(comp.Quantity) || 0;
        const over = qty > stock;
        html += '<div class="selected-component-item ' + (over ? 'over-stock-warning' : '') + '">' +
            '<div class="selected-component-info"><span class="component-icon">' + getTypeIcon(comp.Type) + '</span>' +
            '<div><div class="component-name">' + escapeHtml(comp.ComponentName) + '</div>' +
            '<code>' + comp.ComponentID + '</code><span class="stock-info ' + (over ? 'over-stock' : '') + '">(' + stock + ' available)</span>' +
            (over ? '<span class="warning-badge">⚠️ Exceeds!</span>' : '') +
            '</div></div>' +
            '<div class="quantity-control">' +
            '<button type="button" class="qty-btn" onclick="changeComponentQty(\'' + id + '\',-1)">−</button>' +
            '<input type="number" class="qty-input" value="' + qty + '" min="1" max="' + stock + '" onchange="setComponentQty(\'' + id + '\',this.value)">' +
            '<button type="button" class="qty-btn" onclick="changeComponentQty(\'' + id + '\',1)">+</button>' +
            '</div>' +
            '<button type="button" class="remove-btn" onclick="removeComponent(\'' + id + '\')">✕</button>' +
            '</div>';
    });
    c.innerHTML = html;
    const t = document.getElementById('selectedTotal'); if (t) t.textContent = '(' + total + ' total)';
}

function changeComponentQty(id, delta) {
    if (!selectedProjectComponents[id]) return;
    const comp = selectedProjectComponents[id];
    const stock = parseInt(comp.Quantity) || 0;
    let newQty = (comp.selectedQuantity || 1) + delta;
    if (newQty < 1) newQty = 1;
    if (newQty > stock) { showNotification('Only ' + stock + ' available!', 'warning'); newQty = stock; }
    comp.selectedQuantity = newQty;
    renderSelectedComponents();
}

function setComponentQty(id, val) {
    if (!selectedProjectComponents[id]) return;
    const stock = parseInt(selectedProjectComponents[id].Quantity) || 0;
    let qty = parseInt(val) || 1;
    if (qty < 1) qty = 1;
    if (qty > stock) { showNotification('Only ' + stock + ' available!', 'warning'); qty = stock; }
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
    const count = Object.keys(selectedProjectComponents).length;
    const el = document.getElementById('selectedCount');
    if (el) el.textContent = '(' + count + ' component' + (count !== 1 ? 's' : '') + ')';
}

function searchComponentsInForm(query) {
    const term = (query || '').toLowerCase();
    document.querySelectorAll('#availableComponentsList .component-item').forEach(item => {
        const n = (item.dataset.name || '');
        const t = (item.dataset.type || '');
        const id = (item.dataset.id || '').toLowerCase();
        const matchSearch = !term || n.includes(term) || t.includes(term) || id.includes(term);
        const matchType = currentTypeFilter === 'all' || t === currentTypeFilter.toLowerCase();
        item.style.display = (matchSearch && matchType) ? 'flex' : 'none';
    });
}

function clearComponentSearch() {
    const input = document.getElementById('componentSearch');
    if (input) {
        input.value = '';
        searchComponentsInForm('');
    }
}

function filterByType(type) {
    currentTypeFilter = type;
    document.querySelectorAll('.quick-filters .filter-chip').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    const v = document.getElementById('componentSearch')?.value || '';
    searchComponentsInForm(v);
}

async function loadPreviousStudents() {
    try {
        const r = await apiCall('getProjects');
        const students = {};
        (r.data || []).forEach(p => {
            if (p.TeamMembers) p.TeamMembers.split(',').forEach(m => {
                const t = m.trim();
                if (t) students[t] = true;
            });
        });
        const c = document.getElementById('previousStudents');
        const list = Object.keys(students).sort().slice(0, 10);
        if (c && list.length) {
            let html = '';
            list.forEach(s => {
                html += '<button type="button" class="quick-add-chip" onclick="quickAddTeamMember(\'' + escapeHtml(s).replace(/'/g, "\\'") + '\')">➕ ' + escapeHtml(s) + '</button>';
            });
            c.innerHTML = html;
        } else if (c) c.innerHTML = '<span class="no-previous">No previous students</span>';
    } catch (e) { console.error(e); }
}

function handleTeamMemberKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        addTeamMember();
    }
}

function addTeamMember() {
    const input = document.getElementById('teamMemberInput');
    const name = input.value.trim();
    if (name && !teamMembersList.includes(name)) {
        teamMembersList.push(name);
        renderTeamMembersChips();
        input.value = '';
    }
}

function quickAddTeamMember(name) {
    if (!teamMembersList.includes(name)) {
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
    const c = document.getElementById('teamMembersChips');
    if (!c) return;
    let html = '';
    teamMembersList.forEach((m, i) => {
        html += '<span class="team-member-chip"><span class="chip-avatar">' + getInitials(m) + '</span>' + escapeHtml(m) +
            '<button type="button" class="chip-remove" onclick="removeTeamMember(' + i + ')">✕</button></span>';
    });
    c.innerHTML = html;
    const hidden = document.getElementById('teamMembers');
    if (hidden) hidden.value = teamMembersList.join(', ');
}

async function saveProject(event) {
    event.preventDefault();
    // Validate stock
    let error = false;
    Object.values(selectedProjectComponents).forEach(comp => {
        const stock = parseInt(comp.Quantity) || 0;
        const q = comp.selectedQuantity || 1;
        if (q > stock) {
            showNotification(comp.ComponentName + ': exceeds stock!', 'error');
            error = true;
        }
    });
    if (error) return;

    const compsStr = Object.entries(selectedProjectComponents)
        .map(([id, comp]) => id + ':' + (comp.selectedQuantity || 1))
        .join(', ');

    const data = {
        ProjectName: document.getElementById('projectName').value,
        Overview: document.getElementById('overview').value,
        Code: document.getElementById('code').value,
        ComponentsUsed: compsStr,
        TeamMembers: teamMembersList.join(', ')
    };

    showLoading();
    try {
        const id = document.getElementById('projectId').value;
        if (id) await apiCall('updateProject', { id, data });
        else await apiCall('addProject', { data });
        showNotification(id ? 'Project updated!' : 'Project created!');
        window.location.href = 'projects.html';
    } catch (e) { console.error(e); }
    hideLoading();
}

// =====================================================
// COMPETITIONS MODULE
// =====================================================

let allCompetitions = [];
let currentCompFilter = 'all';

async function loadCompetitions() {
    showLoading();
    try {
        const r = await apiCall('getCompetitions');
        allCompetitions = r.data || [];
        updateCompetitionStats();
        renderCompetitionsTable(allCompetitions);
        renderCalendarView(allCompetitions);
    } catch (e) {
        console.error(e);
        const t = document.getElementById('competitionsTableBody');
        if (t) t.innerHTML = '<tr><td colspan="7" class="no-data">Failed to load</td></tr>';
    }
    hideLoading();
}

function updateCompetitionStats() {
    const up = allCompetitions.filter(c => (c.Status || '').toLowerCase() === 'upcoming').length;
    const on = allCompetitions.filter(c => (c.Status || '').toLowerCase() === 'ongoing').length;
    const co = allCompetitions.filter(c => (c.Status || '').toLowerCase() === 'completed').length;
    if (document.getElementById('upcomingCount')) document.getElementById('upcomingCount').textContent = up;
    if (document.getElementById('ongoingCount')) document.getElementById('ongoingCount').textContent = on;
    if (document.getElementById('completedCount')) document.getElementById('completedCount').textContent = co;
    if (document.getElementById('totalCompetitions')) document.getElementById('totalCompetitions').textContent = allCompetitions.length;
}

function renderCompetitionsTable(list) {
    const tbody = document.getElementById('competitionsTableBody');
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No competitions found</td></tr>';
        return;
    }
    let html = '';
    list.forEach(c => {
        const status = (c.Status || 'upcoming').toLowerCase();
        html += '<tr>' +
            '<td><code>' + c.EventID + '</code></td>' +
            '<td><strong>' + escapeHtml(c.EventName) + '</strong></td>' +
            '<td>' + formatDate(c.Date) + '</td>' +
            '<td>' + (escapeHtml(c.Location) || '-') + '</td>' +
            '<td><span class="status-badge status-' + status + '">' + (c.Status || 'Upcoming') + '</span></td>' +
            '<td>' + (escapeHtml(c.Position || c.Result) || '-') + '</td>' +
            '<td class="actions">' +
            '<button class="btn btn-sm btn-info" onclick="viewCompetition(\'' + c.EventID + '\')">👁️</button>' +
            '<button class="btn btn-sm btn-warning" onclick="openResultModal(\'' + c.EventID + '\')">🏆</button>' +
            '<button class="btn btn-sm btn-primary" onclick="editCompetition(\'' + c.EventID + '\')">✏️</button>' +
            '<button class="btn btn-sm btn-danger" onclick="deleteCompetition(\'' + c.EventID + '\')">🗑️</button>' +
            '</td></tr>';
    });
    tbody.innerHTML = html;
}

function renderCalendarView(list) {
    const c = document.getElementById('calendarView');
    if (!c) return;
    if (!list.length) { c.innerHTML = '<div class="empty-state"><p>No competitions</p></div>'; return; }
    let html = '';
    list.forEach(comp => {
        const d = new Date(comp.Date);
        const status = (comp.Status || 'upcoming').toLowerCase();
        html += '<div class="calendar-card ' + status + '" onclick="viewCompetition(\'' + comp.EventID + '\')">' +
            '<div class="calendar-date"><span class="month">' + d.toLocaleDateString('en-US', { month: 'short' }) + '</span>' +
            '<span class="day">' + (d.getDate() || '?') + '</span></div>' +
            '<div class="calendar-details"><span class="status-badge status-' + status + '">' + (comp.Status || 'Upcoming') + '</span>' +
            '<h4>' + escapeHtml(comp.EventName) + '</h4>' +
            '<p>📍 ' + (escapeHtml(comp.Location) || 'TBD') + '</p>' +
            (comp.Position ? '<p>🏆 ' + escapeHtml(comp.Position) + '</p>' : '') +
            '</div></div>';
    });
    c.innerHTML = html;
}

function searchCompetitions() {
    const q = (document.getElementById('searchCompetitions')?.value || '').toLowerCase();
    let filtered = allCompetitions.filter(c =>
        (c.EventName || '').toLowerCase().includes(q) ||
        (c.Location || '').toLowerCase().includes(q)
    );
    if (currentCompFilter !== 'all') filtered = filtered.filter(c => c.Status === currentCompFilter);
    renderCompetitionsTable(filtered);
    renderCalendarView(filtered);
}

function filterCompetitions(status, btn) {
    currentCompFilter = status;
    document.querySelectorAll('.filter-tabs .filter-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    searchCompetitions();
}

function toggleView(view, btn) {
    const tv = document.getElementById('tableView');
    const cv = document.getElementById('calendarView');
    if (view === 'table') { if (tv) tv.style.display = 'block'; if (cv) cv.style.display = 'none'; }
    else { if (tv) tv.style.display = 'none'; if (cv) cv.style.display = 'grid'; }
    document.querySelectorAll('.view-toggle .btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

function viewCompetition(id) {
    const c = allCompetitions.find(x => x.EventID === id);
    if (!c) return;
    document.getElementById('modalCompetitionName').textContent = c.EventName || 'Competition';
    let html = '<div class="competition-detail"><div class="detail-grid">' +
        '<div class="detail-item"><label>📅 Date</label><span>' + formatDate(c.Date) + (c.EndDate ? ' - ' + formatDate(c.EndDate) : '') + '</span></div>' +
        '<div class="detail-item"><label>📍 Location</label><span>' + (escapeHtml(c.Location) || 'TBD') + '</span></div>' +
        '<div class="detail-item"><label>📊 Status</label><span class="status-badge status-' + (c.Status || 'upcoming').toLowerCase() + '">' + (c.Status || 'Upcoming') + '</span></div>' +
        '<div class="detail-item"><label>🏆 Result</label><span>' + (escapeHtml(c.Position || c.Result) || 'Pending') + '</span></div>' +
        '</div>';
    if (c.Details) html += '<div class="detail-section"><h4>📋 Details</h4><p>' + escapeHtml(c.Details) + '</p></div>';
    if (c.Participants) html += '<div class="detail-section"><h4>👥 Participants</h4><p>' + escapeHtml(c.Participants) + '</p></div>';
    if (c.Notes) html += '<div class="detail-section"><h4>📝 Notes</h4><p>' + escapeHtml(c.Notes) + '</p></div>';
    html += '</div>';
    document.getElementById('modalCompetitionBody').innerHTML = html;
    document.getElementById('modalCompEditBtn').onclick = () => { closeCompetitionModal(); editCompetition(id); };
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
        await apiCall('deleteCompetition', { id });
        showNotification('Competition deleted');
        loadCompetitions();
    } catch (e) { console.error(e); }
    hideLoading();
}

function openResultModal(id) {
    const c = allCompetitions.find(x => x.EventID === id);
    if (!c) return;
    document.getElementById('resultEventId').value = id;
    document.getElementById('resultStatus').value = c.Status || 'Upcoming';
    document.getElementById('resultPosition').value = c.Position || '';
    document.getElementById('resultNotes').value = c.Notes || '';
    document.getElementById('resultModal').classList.add('show');
}

function closeResultModal() {
    document.getElementById('resultModal').classList.remove('show');
}

async function saveResult() {
    const id = document.getElementById('resultEventId').value;
    if (!id) return;
    showLoading();
    try {
        await apiCall('updateCompetitionResult', {
            id,
            data: {
                Status: document.getElementById('resultStatus').value,
                Position: document.getElementById('resultPosition').value,
                Notes: document.getElementById('resultNotes').value
            }
        });
        showNotification('Result updated');
        closeResultModal();
        loadCompetitions();
    } catch (e) { console.error(e); }
    hideLoading();
}

async function loadCompetitionForm() {
    const id = getUrlParam('id');
    if (id) {
        document.getElementById('formTitle').textContent = 'Edit Competition';
        showLoading();
        try {
            const r = await apiCall('getCompetition', { id });
            if (r.success && r.data) {
                const c = r.data;
                document.getElementById('eventId').value = c.EventID || '';
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
        } catch (e) { console.error(e); }
        hideLoading();
    }
}

async function saveCompetition(event) {
    event.preventDefault();
    showLoading();
    const id = document.getElementById('eventId').value;
    const data = {
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
        if (id) await apiCall('updateCompetition', { id, data });
        else await apiCall('addCompetition', { data });
        showNotification(id ? 'Competition updated' : 'Competition added');
        window.location.href = 'competitions.html';
    } catch (e) { console.error(e); }
    hideLoading();
}

// =====================================================
// ORDERS MODULE
// =====================================================

let allOrders = [];
let orderImportData = [];
let currentOrderFilter = 'all';
let currentCompleteOrderId = null;
let orderItems = [];

async function loadOrders() {
    showLoading();
    try {
        const r = await apiCall('getOrders');
        allOrders = r.data || [];
        updateOrderStats();
        renderOrdersList(allOrders);
    } catch (e) {
        console.error(e);
        const c = document.getElementById('ordersContainer');
        if (c) c.innerHTML = '<div class="empty-state"><h3>Failed to load</h3><button onclick="loadOrders()" class="btn btn-primary">Retry</button></div>';
    }
    hideLoading();
}

function updateOrderStats() {
    const total = allOrders.length;
    const pending = allOrders.filter(o => o.Status === 'Ordered').length;
    const shipped = allOrders.filter(o => o.Status === 'Shipped').length;
    const completed = allOrders.filter(o => o.Status === 'Completed' || o.Status === 'Delivered').length;
    if (document.getElementById('totalOrders')) document.getElementById('totalOrders').textContent = total;
    if (document.getElementById('pendingOrders')) document.getElementById('pendingOrders').textContent = pending;
    if (document.getElementById('shippedOrders')) document.getElementById('shippedOrders').textContent = shipped;
    if (document.getElementById('completedOrders')) document.getElementById('completedOrders').textContent = completed;
}

function filterOrders(status, btn) {
    currentOrderFilter = status;
    document.querySelectorAll('.filter-tabs .filter-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    let filtered = allOrders;
    if (status !== 'all') {
        if (status === 'Completed') filtered = allOrders.filter(o => o.Status === 'Completed' || o.Status === 'Delivered');
        else filtered = allOrders.filter(o => o.Status === status);
    }
    renderOrdersList(filtered);
}

function searchOrders() {
    const q = (document.getElementById('searchOrders')?.value || '').toLowerCase();
    let filtered = allOrders.filter(o =>
        (o.OrderID || '').toLowerCase().includes(q) ||
        (o.Vendor  || '').toLowerCase().includes(q) ||
        (o.Notes   || '').toLowerCase().includes(q)
    );
    if (currentOrderFilter !== 'all') {
        if (currentOrderFilter === 'Completed') filtered = filtered.filter(o => o.Status === 'Completed' || o.Status === 'Delivered');
        else filtered = filtered.filter(o => o.Status === currentOrderFilter);
    }
    renderOrdersList(filtered);
}

function renderOrdersList(list) {
    const c = document.getElementById('ordersContainer');
    if (!c) return;
    if (!list.length) {
        c.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><h3>No Orders Found</h3><div class="empty-actions"><a href="order_form.html" class="btn btn-primary">➕ Create Order</a><button class="btn btn-secondary" onclick="openImportOrderModal()">📥 Import Excel</button></div></div>';
        return;
    }
    let html = '<div class="orders-grid">';
    list.forEach(o => html += createOrderCard(o));
    html += '</div>';
    c.innerHTML = html;
}

function createOrderCard(o) {
    const items = o.Items || [];
    let totalQty = parseInt(o.TotalQuantity) || 0;
    if (!totalQty) items.forEach(i => totalQty += parseInt(i.Quantity) || 0);
    const icons = { ordered:'🕐', shipped:'🚚', delivered:'✅', completed:'✅', cancelled:'❌' };
    const status = (o.Status || 'ordered').toLowerCase();
    const isCompleted = o.Status === 'Completed' || o.Status === 'Delivered';
    let html = '<div class="order-card ' + (isCompleted ? 'completed' : '') + '">' +
        '<div class="order-card-header"><div class="order-info">' +
        '<code class="order-id">' + o.OrderID + '</code><span class="order-vendor">' + (escapeHtml(o.Vendor) || 'Unknown') + '</span></div>' +
        '<span class="status-badge status-' + status + '">' + (icons[status] || '📦') + ' ' + (o.Status || 'Ordered') + '</span></div>' +
        '<div class="order-card-meta">' +
        '<div class="meta-item"><span class="meta-label">📅 Ordered</span><span class="meta-value">' + (formatDate(o.OrderDate) || 'N/A') + '</span></div>' +
        '<div class="meta-item"><span class="meta-label">🚚 Expected</span><span class="meta-value">' + (formatDate(o.ExpectedDelivery) || 'TBD') + '</span></div>' +
        '<div class="meta-item"><span class="meta-label">📦 Items</span><span class="meta-value">' + items.length + ' types, ' + totalQty + ' units</span></div>' +
        '</div>';
    if (items.length) {
        html += '<div class="order-items-preview"><h5>Items</h5>';
        items.slice(0, 4).forEach((it, i) => {
            html += '<div class="order-item-row"><span class="item-sno">' + (i + 1) + '.</span>' +
                '<span class="item-name">' + escapeHtml(it.ComponentName) + '</span>' +
                '<span><span class="item-qty">×' + it.Quantity + '</span>' + (it.Synced === 'Yes' ? '<span class="synced-badge">✓</span>' : '') + '</span></div>';
        });
        if (items.length > 4) html += '<div class="more-items">+' + (items.length - 4) + ' more</div>';
        html += '</div>';
    }
    html += '<div class="order-card-actions">';
    if (!isCompleted) {
        html += '<button class="btn btn-success" onclick="openCompleteOrderModal(\'' + o.OrderID + '\')">✅ Complete & Add</button>';
    } else {
        html += '<span class="completed-badge">✅ Added to Inventory</span>';
    }
    html += '<button class="btn btn-sm btn-info" onclick="viewOrder(\'' + o.OrderID + '\')">👁️</button>';
    if (!isCompleted) {
        html += '<button class="btn btn-sm btn-primary" onclick="editOrder(\'' + o.OrderID + '\')">✏️</button>' +
            '<button class="btn btn-sm btn-danger" onclick="deleteOrder(\'' + o.OrderID + '\')">🗑️</button>';
    }
    html += '</div></div>';
    return html;
}

function viewOrder(id) {
    const o = allOrders.find(x => x.OrderID === id);
    if (!o) return;
    const items = o.Items || [];
    const isCompleted = o.Status === 'Completed' || o.Status === 'Delivered';
    document.getElementById('viewOrderTitle').textContent = 'Order: ' + o.OrderID;
    let html = '<div class="order-details-grid">' +
        '<div class="detail-item"><label>Vendor</label><span>' + (escapeHtml(o.Vendor) || 'N/A') + '</span></div>' +
        '<div class="detail-item"><label>Status</label><span class="status-badge status-' + (o.Status || 'ordered').toLowerCase() + '">' + (o.Status || 'Ordered') + '</span></div>' +
        '<div class="detail-item"><label>Order Date</label><span>' + (formatDate(o.OrderDate) || 'N/A') + '</span></div>' +
        '<div class="detail-item"><label>Expected</label><span>' + (formatDate(o.ExpectedDelivery) || 'TBD') + '</span></div>' +
        '</div><h4>📋 Items (' + items.length + ')</h4>';
    if (items.length) {
        html += '<table class="order-items-table"><thead><tr><th>S.No</th><th>Component</th><th>Type</th><th>Qty</th><th>Status</th></tr></thead><tbody>';
        items.forEach((it, i) => {
            html += '<tr><td>' + (i + 1) + '</td><td><strong>' + escapeHtml(it.ComponentName) + '</strong></td>' +
                '<td>' + (escapeHtml(it.Type) || '-') + '</td><td>' + it.Quantity + '</td>' +
                '<td>' + (it.Synced === 'Yes' ? '<span class="synced-badge">✅ Added</span>' : '<span class="pending-badge">⏳ Pending</span>') + '</td></tr>';
        });
        html += '</tbody></table>';
    } else html += '<p>No items</p>';
    if (o.Notes) html += '<h4>📝 Notes</h4><p>' + escapeHtml(o.Notes) + '</p>';
    if (isCompleted) html += '<div class="completed-info"><p>✅ This order is complete. All items added to inventory.</p></div>';
    document.getElementById('viewOrderBody').innerHTML = html;
    const editBtn = document.getElementById('viewOrderEditBtn');
    if (isCompleted) editBtn.style.display = 'none';
    else {
        editBtn.style.display = 'inline-flex';
        editBtn.onclick = () => { closeViewOrderModal(); editOrder(id); };
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
        await apiCall('deleteOrder', { id });
        showNotification('Order deleted');
        loadOrders();
    } catch (e) { console.error(e); }
    hideLoading();
}

function openCompleteOrderModal(orderId) {
    // Save the id globally so confirmCompleteOrder can use it
    currentCompleteOrderId = orderId;

    const order = allOrders.find(o => o.OrderID === orderId);
    if (!order) {
        showNotification('Order not found in current list', 'error');
        return;
    }

    const items = order.Items || [];
    let totalQty = 0;
    items.forEach(i => totalQty += parseInt(i.Quantity) || 0);

    // Build the summary HTML (this matches your modal body)
    const summaryHtml = `
        <div class="order-summary-box">
            <div class="summary-header">
                <strong>Order:</strong> ${order.OrderID}<br>
                <strong>Vendor:</strong> ${escapeHtml(order.Vendor) || 'Unknown'}
            </div>
            <h5>📦 Items to be added to inventory (${items.length} types, ${totalQty} units):</h5>
            <div class="items-to-add">
                <table class="mini-table">
                    <thead>
                        <tr>
                            <th>S.No</th>
                            <th>Component</th>
                            <th>Type</th>
                            <th>Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${escapeHtml(item.ComponentName)}</td>
                                <td>${escapeHtml(item.Type) || '-'}</td>
                                <td><strong>+${item.Quantity}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const summaryDiv = document.getElementById('completeOrderSummary');
    if (summaryDiv) summaryDiv.innerHTML = summaryHtml;

    // Show the modal
    document.getElementById('completeOrderModal').classList.add('show');
}
function closeCompleteOrderModal() {
    document.getElementById('completeOrderModal').classList.remove('show');
    currentCompleteOrderId = null;
}

// This replaces your old confirmCompleteOrder
async function confirmCompleteOrder() {
    // Use the global currentCompleteOrderId set by openCompleteOrderModal
    const orderId = currentCompleteOrderId;

    if (!orderId) {
        console.error('confirmCompleteOrder called but currentCompleteOrderId is null/undefined');
        showNotification('No order selected to complete', 'error');
        return;
    }

    showLoading();

    try {
        if (DEBUG_MODE) console.log('Completing order:', orderId);
        const result = await apiCall('completeOrder', { id: orderId });

        if (result.success) {
            showNotification('Order completed! Inventory updated.');
            // If you want merge details, you can use:
            if (typeof showMergeResults === 'function') {
                showMergeResults(result);
            }
            // Refresh orders list
            loadOrders();
        } else {
            showNotification(result.error || 'Failed to complete order', 'error');
        }
    } catch (error) {
        console.error('Error completing order:', error);
        showNotification('Error completing order: ' + error.message, 'error');
    }

    hideLoading();

    // Close modal and reset global
    document.getElementById('completeOrderModal').classList.remove('show');
    currentCompleteOrderId = null;
}

function showMergeResults(r) {
    const res = r.syncResults || [];
    const merged = res.filter(x => x.action === 'merged');
    const created = res.filter(x => x.action === 'created');
    let html = '<div class="merge-results"><div class="merge-summary">' +
        '<div class="summary-item success"><span class="summary-number">' + merged.length + '</span><span class="summary-label">Updated</span></div>' +
        '<div class="summary-item info"><span class="summary-number">' + created.length + '</span><span class="summary-label">Created</span></div>' +
        '</div>';
    if (merged.length) {
        html += '<div class="result-section"><h5>🔄 Updated Components</h5><table class="results-table"><thead><tr><th>Component</th><th>Previous</th><th>Added</th><th>New</th></tr></thead><tbody>';
        merged.forEach(m => {
            html += '<tr><td><strong>' + escapeHtml(m.matchedWith || m.itemName) + '</strong></td>' +
                '<td>' + m.previousQty + '</td><td class="added-qty">+' + m.addedQty + '</td>' +
                '<td class="new-qty"><strong>' + m.newQty + '</strong></td></tr>';
        });
        html += '</tbody></table></div>';
    }
    if (created.length) {
        html += '<div class="result-section"><h5>🆕 New Components</h5><table class="results-table"><thead><tr><th>Component</th><th>Quantity</th></tr></thead><tbody>';
        created.forEach(c => {
            html += '<tr><td><strong>' + escapeHtml(c.itemName || c.componentName) + '</strong></td>' +
                '<td class="new-qty"><strong>' + (c.addedQty || c.newQty || c.quantity) + '</strong></td></tr>';
        });
        html += '</tbody></table></div>';
    }
    html += '<div class="success-message"><p>✅ All items added to inventory!</p></div></div>';
    document.getElementById('mergeResultsContent').innerHTML = html;
    document.getElementById('mergeResultsModal').classList.add('show');
}

function closeMergeResultsModal() {
    document.getElementById('mergeResultsModal').classList.remove('show');
}

// Import orders from Excel

function openImportOrderModal() {
    document.getElementById('importOrderModal').classList.add('show');
    orderImportData = [];
    document.getElementById('orderPreviewSection').style.display = 'none';
    document.getElementById('confirmOrderImportBtn').disabled = true;
    document.getElementById('importVendor').value = '';
    const d = document.getElementById('importOrderDate'); if (d) d.valueAsDate = new Date();
    document.getElementById('importExpectedDelivery').value = '';
}

function closeImportOrderModal() {
    document.getElementById('importOrderModal').classList.remove('show');
    orderImportData = [];
}

function setupOrderDropZone() {
    const dz = document.getElementById('orderDropZone');
    if (!dz) return;
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => {
        e.preventDefault(); dz.classList.remove('dragover');
        if (e.dataTransfer.files[0]) handleOrderFile(e.dataTransfer.files[0]);
    });
}

function handleOrderFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const wb = XLSX.read(e.target.result, { type: 'binary' });
            orderImportData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            if (!orderImportData.length) { showNotification('No data in file', 'error'); return; }
            showOrderPreview(orderImportData);
            showNotification('Found ' + orderImportData.length + ' items');
        } catch (err) { console.error(err); showNotification('Error reading file', 'error'); }
    };
    reader.readAsBinaryString(file);
}

function showOrderPreview(data) {
    if (!data.length) { showNotification('No data', 'error'); return; }
    let totalQty = 0;
    data.forEach(i => totalQty += parseInt(i.Quantity || i.quantity || 0));
    let html = '<table class="preview-table"><thead><tr><th>S.No</th><th>Component</th><th>Type</th><th>Qty</th></tr></thead><tbody>';
    data.slice(0, 15).forEach((item, idx) => {
        const sno = item['S.No'] || item['SNo'] || item['sno'] || idx + 1;
        const name = item.ComponentName || item.Name || item.name || '';
        const type = item.Type || item.type || '';
        const qty = item.Quantity || item.quantity || 0;
        html += '<tr><td>' + sno + '</td><td><strong>' + escapeHtml(name) + '</strong></td><td>' + escapeHtml(type) + '</td><td>' + qty + '</td></tr>';
    });
    if (data.length > 15) html += '<tr><td colspan="4" style="text-align:center;font-style:italic;">...and ' + (data.length - 15) + ' more</td></tr>';
    html += '</tbody></table>';
    document.getElementById('orderItemsPreview').innerHTML = html;
    document.getElementById('previewTotalItems').textContent = data.length;
    document.getElementById('previewTotalQty').textContent = totalQty;
    document.getElementById('orderPreviewSection').style.display = 'block';
    document.getElementById('confirmOrderImportBtn').disabled = false;
}

function downloadOrderTemplate() {
    const t = [
        { 'S.No': 1, ComponentName: 'Arduino Uno R3', Type: 'Microcontroller', Quantity: 5 },
        { 'S.No': 2, ComponentName: 'ESP32 DevKit', Type: 'Microcontroller', Quantity: 10 },
        { 'S.No': 3, ComponentName: 'HC-SR04 Ultrasonic', Type: 'Sensor', Quantity: 8 },
        { 'S.No': 4, ComponentName: 'SG90 Servo Motor', Type: 'Motor', Quantity: 6 }
    ];
    const ws = XLSX.utils.json_to_sheet(t);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Order');
    XLSX.writeFile(wb, 'Order_Template.xlsx');
    showNotification('Template downloaded!');
}

async function confirmOrderImport() {
    if (!orderImportData || !orderImportData.length) {
        showNotification('No items', 'warning');
        return;
    }
    const vendor = document.getElementById('importVendor')?.value.trim() || '';
    if (!vendor) {
        showNotification('Enter vendor name', 'warning');
        return;
    }
    showLoading();
    try {
        const items = [];
        orderImportData.forEach(row => {
            const name = row.ComponentName || row.Name || row.name || '';
            if (!name) return;
            items.push({
                ComponentName: name,
                Type: row.Type || row.type || '',
                Quantity: parseInt(row.Quantity || row.quantity) || 1
            });
        });
        if (!items.length) { showNotification('No valid items', 'error'); hideLoading(); return; }
        const orderData = {
            Vendor: vendor,
            OrderDate: document.getElementById('importOrderDate')?.value || new Date().toISOString().split('T')[0],
            ExpectedDelivery: document.getElementById('importExpectedDelivery')?.value || '',
            Status: 'Ordered',
            Notes: 'Imported from Excel (' + items.length + ' items)',
            Items: items
        };
        const r = await apiCall('addOrder', { data: orderData });
        if (r.success) { showNotification('Order imported!'); closeImportOrderModal(); loadOrders(); }
        else showNotification(r.error || 'Failed to import', 'error');
    } catch (e) { console.error(e); showNotification('Error importing order', 'error'); }
    hideLoading();
}

// Order form

async function loadOrderForm() {
    const id = getUrlParam('id');
    orderItems = [];
    const d = document.getElementById('orderDate');
    if (d && !d.value) d.valueAsDate = new Date();
    if (id) {
        document.getElementById('formTitle').textContent = 'Edit Order';
        showLoading();
        try {
            const r = await apiCall('getOrder', { id });
            if (r.success && r.data) {
                const o = r.data;
                document.getElementById('orderId').value = o.OrderID;
                document.getElementById('vendor').value = o.Vendor || '';
                document.getElementById('orderDate').value = o.OrderDate || '';
                document.getElementById('expectedDelivery').value = o.ExpectedDelivery || '';
                document.getElementById('status').value = o.Status || 'Ordered';
                document.getElementById('notes').value = o.Notes || '';
                orderItems = (o.Items || []).map(i => ({
                    ComponentName: i.ComponentName,
                    Type: i.Type || '',
                    Quantity: parseInt(i.Quantity) || 1
                }));
            }
        } catch (e) { console.error(e); }
        hideLoading();
    }
    renderOrderItems();
}

function addOrderItem() {
    const nameInput = document.getElementById('itemName');
    const typeInput = document.getElementById('itemType');
    const qtyInput = document.getElementById('itemQuantity');
    const name = nameInput.value.trim();
    const type = typeInput.value || '';
    const qty = parseInt(qtyInput.value) || 1;
    if (!name) { showNotification('Enter component name', 'warning'); nameInput.focus(); return; }
    orderItems.push({ ComponentName: name, Type: type, Quantity: qty });
    nameInput.value = ''; typeInput.value = ''; qtyInput.value = '1'; nameInput.focus();
    renderOrderItems();
}

function removeOrderItem(idx) { orderItems.splice(idx, 1); renderOrderItems(); }

function updateItemQty(idx, val) {
    let q = parseInt(val) || 1;
    if (q < 1) q = 1;
    orderItems[idx].Quantity = q;
    updateOrderTotals();
}

function renderOrderItems() {
    const c = document.getElementById('orderItemsContainer');
    if (!c) return;
    if (!orderItems.length) {
        c.innerHTML = '<div class="no-items">No items added yet. Add items above.</div>';
        updateOrderTotals();
        return;
    }
    let html = '<table class="order-items-table"><thead><tr><th>S.No</th><th>Component</th><th>Type</th><th>Qty</th><th></th></tr></thead><tbody>';
    orderItems.forEach((it, i) => {
        html += '<tr><td>' + (i + 1) + '</td><td><strong>' + escapeHtml(it.ComponentName) + '</strong></td>' +
            '<td>' + (escapeHtml(it.Type) || '-') + '</td>' +
            '<td><input type="number" class="qty-input-sm" value="' + it.Quantity + '" min="1" onchange="updateItemQty(' + i + ',this.value)"></td>' +
            '<td><button type="button" class="btn btn-sm btn-danger" onclick="removeOrderItem(' + i + ')">✕</button></td></tr>';
    });
    html += '</tbody></table>';
    c.innerHTML = html;
    updateOrderTotals();
}

function updateOrderTotals() {
    const totalItems = orderItems.length;
    let totalQty = 0;
    orderItems.forEach(i => totalQty += parseInt(i.Quantity) || 0);
    if (document.getElementById('totalItemsCount')) document.getElementById('totalItemsCount').textContent = totalItems;
    if (document.getElementById('totalQuantityCount')) document.getElementById('totalQuantityCount').textContent = totalQty;
}

async function saveOrder(event) {
    event.preventDefault();
    if (!orderItems.length) { showNotification('Add at least one item', 'warning'); return; }
    const vendor = (document.getElementById('vendor').value || '').trim();
    if (!vendor) { showNotification('Enter vendor', 'warning'); document.getElementById('vendor').focus(); return; }
    const status = document.getElementById('status').value;
    const data = {
        Vendor: vendor,
        OrderDate: document.getElementById('orderDate').value,
        ExpectedDelivery: document.getElementById('expectedDelivery').value,
        Status: status,
        Notes: document.getElementById('notes').value,
        Items: orderItems
    };
    showLoading();
    try {
        const id = document.getElementById('orderId').value;
        if (id) {
            await apiCall('updateOrder', { id, data });
            if (status === 'Completed') {
                const sync = await apiCall('completeOrder', { id });
                if (sync.success) showNotification('Order updated & inventory synced!');
                else showNotification('Order updated; sync failed: ' + sync.error, 'warning');
            } else showNotification('Order updated!');
        } else {
            const r = await apiCall('addOrder', { data });
            if (r.success && status === 'Completed' && r.id) {
                const sync = await apiCall('completeOrder', { id: r.id });
                if (sync.success) showNotification('Order created & inventory synced!');
                else showNotification('Order created; sync failed: ' + sync.error, 'warning');
            } else showNotification('Order created!');
        }
        window.location.href = 'orders.html';
    } catch (e) { console.error(e); showNotification('Error saving order', 'error'); }
    hideLoading();
}


// =====================================================
// ISSUANCES MODULE
// =====================================================

let allIssuances = [];
let allIssuanceComponents = [];

// -------------------------------------------------------
// DATA LOADING
// -------------------------------------------------------

async function loadIssuances() {
    showLoading();
    try {
        const [issuanceRes, componentRes] = await Promise.all([
            apiCall('getIssuances'),
            apiCall('getComponents')
        ]);

        allIssuances = issuanceRes.data || [];
        allIssuanceComponents = componentRes.data || [];

        updateIssuanceSummary(allIssuances);
        populateIssuanceComponentDropdown(allIssuanceComponents);
        populateFilterComponentDropdown(allIssuanceComponents);
        applyIssuanceFilters();

    } catch (e) {
        console.error('loadIssuances error', e);
        showNotification('Failed to load issuances', 'error');
    }
    hideLoading();
}

// -------------------------------------------------------
// SUMMARY CARDS
// -------------------------------------------------------

function updateIssuanceSummary(issuances) {
    const issued    = issuances.filter(function(i) { return i.Status === 'Issued'; });
    const returned  = issuances.filter(function(i) { return i.Status === 'Returned'; });
    const studentIds = [...new Set(issuances.map(function(i) { return i.StudentID; }).filter(Boolean))];

    const totalEl    = document.getElementById('issuanceTotalRecords');
    const issuedEl   = document.getElementById('issuanceCurrentlyIssued');
    const returnedEl = document.getElementById('issuanceReturned');
    const studentsEl = document.getElementById('issuanceUniqueStudents');

    if (totalEl)    totalEl.textContent    = issuances.length;
    if (issuedEl)   issuedEl.textContent   = issued.length;
    if (returnedEl) returnedEl.textContent = returned.length;
    if (studentsEl) studentsEl.textContent = studentIds.length;
}

// -------------------------------------------------------
// DROPDOWNS
// -------------------------------------------------------

function populateIssuanceComponentDropdown(components) {
    const select = document.getElementById('issueComponentSelect');
    if (!select) return;

    const current = select.value;
    select.innerHTML = '<option value="">Select component...</option>';

    components.forEach(function(c) {
        const qty = parseInt(c.Quantity) || 0;
        const option = document.createElement('option');
        option.value = c.ComponentID;
        option.textContent = c.ComponentName + ' (' + c.Type + ') — ' + qty + ' available';
        option.dataset.qty = qty;
        option.dataset.name = c.ComponentName;
        if (qty === 0) option.disabled = true;
        select.appendChild(option);
    });

    if (current) select.value = current;
}

function populateFilterComponentDropdown(components) {
    const select = document.getElementById('issuanceFilterComponent');
    if (!select) return;

    const current = select.value;
    select.innerHTML = '<option value="">All Components</option>';

    components.forEach(function(c) {
        const option = document.createElement('option');
        option.value = c.ComponentID;
        option.textContent = c.ComponentName;
        select.appendChild(option);
    });

    if (current) select.value = current;
}

// -------------------------------------------------------
// QUICK ISSUE (called from inventory tab)
// -------------------------------------------------------

function quickIssueComponent(componentId, componentName) {
    // Switch to issuances tab
    switchIssuanceTab('issuances');

    // Pre-select the component
    const select = document.getElementById('issueComponentSelect');
    if (select) {
        select.value = componentId;
        updateMaxQty();
    }

    // Focus student name
    const studentInput = document.getElementById('issueStudentName');
    if (studentInput) studentInput.focus();

    showNotification('Component selected: ' + componentName + '. Fill in student details.');
}

// -------------------------------------------------------
// ISSUE FORM — MAX QTY UPDATE
// -------------------------------------------------------

function updateMaxQty() {
    const select = document.getElementById('issueComponentSelect');
    const qtyInput = document.getElementById('issueQty');
    const maxLabel = document.getElementById('maxQtyLabel');

    if (!select || !qtyInput) return;

    const selectedOption = select.options[select.selectedIndex];
    const maxQty = parseInt(selectedOption?.dataset?.qty) || 0;

    qtyInput.max = maxQty;
    if (parseInt(qtyInput.value) > maxQty) qtyInput.value = maxQty;
    if (maxLabel) maxLabel.textContent = maxQty > 0 ? 'Max available: ' + maxQty : 'Out of stock';
}

// -------------------------------------------------------
// ISSUE FORM — SUBMIT
// -------------------------------------------------------

async function submitIssueForm(event) {
    event.preventDefault();

    const studentName  = (document.getElementById('issueStudentName')?.value || '').trim();
    const studentId    = (document.getElementById('issueStudentId')?.value || '').trim();
    const select       = document.getElementById('issueComponentSelect');
    const componentId  = select?.value || '';
    const componentName = select?.options[select.selectedIndex]?.dataset?.name || '';
    const qty          = parseInt(document.getElementById('issueQty')?.value) || 1;

    // Validation
    if (!studentName) { showNotification('Enter student name', 'warning'); return; }
    if (!studentId)   { showNotification('Enter student ID', 'warning'); return; }
    if (!componentId) { showNotification('Select a component', 'warning'); return; }
    if (qty < 1)      { showNotification('Quantity must be at least 1', 'warning'); return; }

    const maxQty = parseInt(select.options[select.selectedIndex]?.dataset?.qty) || 0;
    if (qty > maxQty) {
        showNotification('Only ' + maxQty + ' units available', 'error');
        return;
    }

    showLoading();
    try {
        const result = await apiCall('addIssuance', {
            data: {
                studentName:   studentName,
                studentId:     studentId,
                componentId:   componentId,
                componentName: componentName,
                qtyIssued:     qty
            }
        });

        if (result.success) {
            showNotification('Component issued successfully. ID: ' + result.id);
            resetIssueForm();
            loadIssuances();
        } else {
            showNotification(result.error || 'Failed to issue component', 'error');
        }
    } catch (e) {
        console.error('submitIssueForm error', e);
        showNotification('Error issuing component', 'error');
    }
    hideLoading();
}

function resetIssueForm() {
    const form = document.getElementById('issueComponentForm');
    if (form) form.reset();

    const maxLabel = document.getElementById('maxQtyLabel');
    if (maxLabel) maxLabel.textContent = '';
}

// -------------------------------------------------------
// FILTERS & SEARCH
// -------------------------------------------------------

function applyIssuanceFilters() {
    const searchVal   = (document.getElementById('issuanceSearch')?.value || '').toLowerCase();
    const statusVal   = document.getElementById('issuanceFilterStatus')?.value || '';
    const componentVal = document.getElementById('issuanceFilterComponent')?.value || '';

    const filtered = allIssuances.filter(function(i) {
        const matchSearch = !searchVal ||
            (i.StudentName  || '').toLowerCase().includes(searchVal) ||
            (i.StudentID    || '').toLowerCase().includes(searchVal) ||
            (i.ComponentName|| '').toLowerCase().includes(searchVal) ||
            (i.IssuanceID   || '').toLowerCase().includes(searchVal);

        const matchStatus    = !statusVal    || i.Status      === statusVal;
        const matchComponent = !componentVal || i.ComponentID === componentVal;

        return matchSearch && matchStatus && matchComponent;
    });

    renderIssuancesTable(filtered);
}

// -------------------------------------------------------
// RENDER TABLE
// -------------------------------------------------------

function renderIssuancesTable(issuances) {
    const tbody = document.getElementById('issuancesTableBody');
    if (!tbody) return;

    if (!issuances || !issuances.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">No issuance records found</td></tr>';
        return;
    }

    let html = '';

    issuances.forEach(function(i) {
        const isIssued      = i.Status === 'Issued';
        const statusClass   = isIssued ? 'status-issued' : 'status-returned';
        const statusLabel   = isIssued ? 'Issued' : 'Returned';

        // Escape single quotes for inline onclick
        const safeComponent = (i.ComponentName || '').replace(/'/g, "\\'");
        const safeStudent   = (i.StudentName   || '').replace(/'/g, "\\'");

        html += '<tr>' +
            '<td><code>' + escapeHtml(i.IssuanceID) + '</code></td>' +
            '<td>' +
                '<div class="student-info">' +
                    '<span class="student-name">' + escapeHtml(i.StudentName) + '</span>' +
                    '<span class="student-id">' + escapeHtml(i.StudentID) + '</span>' +
                '</div>' +
            '</td>' +
            '<td>' +
                '<div class="student-info">' +
                    '<span class="student-name">' + escapeHtml(i.ComponentName) + '</span>' +
                    '<span class="student-id">' + escapeHtml(i.ComponentID) + '</span>' +
                '</div>' +
            '</td>' +
            '<td><strong>' + escapeHtml(String(i.QtyIssued || '')) + '</strong></td>' +
            '<td>' + formatDate(i.DateIssued) + '</td>' +
            '<td>' + (i.DateReturned ? formatDate(i.DateReturned) : '-') + '</td>' +
            '<td><span class="status-badge ' + statusClass + '">' + statusLabel + '</span></td>' +
            '<td class="actions">' +
                (isIssued
                    ? '<button class="btn btn-sm btn-success" onclick="confirmReturn(\'' + i.IssuanceID + '\',\'' + safeComponent + '\',\'' + safeStudent + '\')">Mark Returned</button>'
                    : '') +
                '<button class="btn btn-sm btn-danger" onclick="confirmDeleteIssuance(\'' + i.IssuanceID + '\')">Delete</button>' +
            '</td>' +
        '</tr>';
    });

    tbody.innerHTML = html;
}

// -------------------------------------------------------
// RETURN
// -------------------------------------------------------

function confirmReturn(issuanceId, componentName, studentName) {
    if (confirm('Mark "' + componentName + '" as returned by ' + studentName + '?')) {
        markReturned(issuanceId);
    }
}

async function markReturned(issuanceId) {
    showLoading();
    try {
        const result = await apiCall('returnIssuance', { id: issuanceId });

        if (result.success) {
            showNotification('Component marked as returned');
            loadIssuances();
        } else {
            showNotification(result.error || 'Failed to mark as returned', 'error');
        }
    } catch (e) {
        console.error('markReturned error', e);
        showNotification('Error marking as returned', 'error');
    }
    hideLoading();
}

// -------------------------------------------------------
// DELETE ISSUANCE
// -------------------------------------------------------

function confirmDeleteIssuance(issuanceId) {
    if (confirm('Are you sure you want to delete this issuance record?\n\nThis cannot be undone.')) {
        deleteIssuance(issuanceId);
    }
}

async function deleteIssuance(issuanceId) {
    showLoading();
    try {
        const result = await apiCall('deleteIssuance', { id: issuanceId });

        if (result.success) {
            showNotification('Issuance record deleted');
            loadIssuances();
        } else {
            showNotification(result.error || 'Failed to delete record', 'error');
        }
    } catch (e) {
        console.error('deleteIssuance error', e);
        showNotification('Error deleting record', 'error');
    }
    hideLoading();
}

// -------------------------------------------------------
// TAB SWITCHING (for components page with inventory + issuances tabs)
// -------------------------------------------------------

function switchIssuanceTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.issuance-tab-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector('.issuance-tab-btn[data-tab="' + tabName + '"]');
    if (activeBtn) activeBtn.classList.add('active');

    // Update tab panels
    document.querySelectorAll('.issuance-tab-panel').forEach(function(panel) {
        panel.classList.remove('active');
    });
    const activePanel = document.getElementById('issuanceTab-' + tabName);
    if (activePanel) activePanel.classList.add('active');

    // Load data when switching to issuances tab
    if (tabName === 'issuances' && allIssuances.length === 0) {
        loadIssuances();
    }
}

// -------------------------------------------------------
// STUDENT HISTORY MODAL
// -------------------------------------------------------

async function viewStudentHistory(studentId) {
    showLoading();
    try {
        const result = await apiCall('getIssuancesByStudent', { id: studentId });
        const records = result.data || [];

        const student = allIssuances.find(function(i) { return i.StudentID === studentId; });
        const studentName = student ? student.StudentName : studentId;

        let html = '<div class="student-history">';
        html += '<div class="history-header">';
        html += '<h4>' + escapeHtml(studentName) + '</h4>';
        html += '<span class="student-id-badge">' + escapeHtml(studentId) + '</span>';
        html += '</div>';
        html += '<div class="history-stats">';
        html += '<span>Total: <strong>' + records.length + '</strong></span>';
        html += '<span>Active: <strong>' + records.filter(function(r) { return r.Status === 'Issued'; }).length + '</strong></span>';
        html += '<span>Returned: <strong>' + records.filter(function(r) { return r.Status === 'Returned'; }).length + '</strong></span>';
        html += '</div>';

        if (records.length) {
            html += '<table class="history-table"><thead><tr>';
            html += '<th>ID</th><th>Component</th><th>Qty</th><th>Issued</th><th>Returned</th><th>Status</th>';
            html += '</tr></thead><tbody>';

            records.forEach(function(r) {
                const statusClass = r.Status === 'Issued' ? 'status-issued' : 'status-returned';
                html += '<tr>' +
                    '<td><code>' + escapeHtml(r.IssuanceID) + '</code></td>' +
                    '<td>' + escapeHtml(r.ComponentName) + '</td>' +
                    '<td>' + escapeHtml(String(r.QtyIssued || '')) + '</td>' +
                    '<td>' + formatDate(r.DateIssued) + '</td>' +
                    '<td>' + (r.DateReturned ? formatDate(r.DateReturned) : '-') + '</td>' +
                    '<td><span class="status-badge ' + statusClass + '">' + escapeHtml(r.Status) + '</span></td>' +
                    '</tr>';
            });

            html += '</tbody></table>';
        } else {
            html += '<p class="no-data">No records found for this student</p>';
        }

        html += '</div>';

        document.getElementById('studentHistoryBody').innerHTML = html;
        document.getElementById('studentHistoryModal').classList.add('show');

    } catch (e) {
        console.error('viewStudentHistory error', e);
        showNotification('Failed to load student history', 'error');
    }
    hideLoading();
}

function closeStudentHistoryModal() {
    document.getElementById('studentHistoryModal').classList.remove('show');
}

// -------------------------------------------------------
// EXPORT ISSUANCES
// -------------------------------------------------------

function exportIssuances() {
    if (!allIssuances.length) {
        showNotification('No issuance records to export', 'warning');
        return;
    }

    const data = allIssuances.map(function(i) {
        return {
            'Issuance ID':     i.IssuanceID,
            'Student Name':    i.StudentName,
            'Student ID':      i.StudentID,
            'Component':       i.ComponentName,
            'Component ID':    i.ComponentID,
            'Qty Issued':      i.QtyIssued,
            'Date Issued':     formatDate(i.DateIssued),
            'Date Returned':   i.DateReturned ? formatDate(i.DateReturned) : '',
            'Status':          i.Status
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Issuances');
    XLSX.writeFile(wb, 'ATL_Issuances_' + new Date().toISOString().split('T')[0] + '.xlsx');
    showNotification('Issuances exported!');
}

console.log('✅ Script.js loaded');
