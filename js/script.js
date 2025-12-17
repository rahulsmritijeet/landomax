// =====================================================
// script.js - ATL Dashboard Complete
// ALL MODULES INCLUDED
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
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
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
    notification.className = `notification ${type}`;
    const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '❌';
    notification.innerHTML = `<span>${icon} ${message}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;margin-left:10px;">✕</button>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => { notification.classList.remove('show'); setTimeout(() => notification.remove(), 300); }, 5000);
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
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : name.substring(0,2).toUpperCase();
}

function getTypeIcon(type) {
    const icons = { 
        'microcontroller':'🎛️', 'sensor':'📡', 'motor':'⚙️', 'led':'💡',
        'resistor':'🔧', 'capacitor':'🔋', 'wire':'🔌', 'display':'📺',
        'module':'📦', 'board':'🎚️', 'battery':'🔋', 'switch':'🔘'
    };
    return icons[(type||'').toLowerCase()] || '📦';
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
        const result = await apiCall('getProjects');
        allProjects = result.data || [];
        updateProjectStats();
        renderProjectsList(allProjects);
    } catch (e) { 
        console.error(e);
        const container = document.getElementById('projectsContainer');
        if (container) {
            container.innerHTML = `<div class="empty-state"><h3>Failed to load projects</h3><button onclick="loadProjects()" class="btn btn-primary">🔄 Retry</button></div>`;
        }
    }
    hideLoading();
}

function updateProjectStats() {
    const allStudents = new Set();
    let totalComponentUsage = 0;
    
    allProjects.forEach(project => {
        if (project.TeamMembers) {
            project.TeamMembers.split(',').map(m => m.trim()).filter(m => m).forEach(m => allStudents.add(m.toLowerCase()));
        }
        if (project.ComponentsUsed) {
            project.ComponentsUsed.split(',').forEach(part => {
                const qty = part.includes(':') ? parseInt(part.split(':')[1]) || 1 : 1;
                totalComponentUsage += qty;
            });
        }
    });
    
    if (document.getElementById('totalProjects')) document.getElementById('totalProjects').textContent = allProjects.length;
    if (document.getElementById('totalStudents')) document.getElementById('totalStudents').textContent = allStudents.size;
    if (document.getElementById('totalComponentsUsed')) document.getElementById('totalComponentsUsed').textContent = totalComponentUsage;
}

function renderProjectsList(projects) {
    const container = document.getElementById('projectsContainer');
    if (!container) return;
    
    if (!projects || projects.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📁</div>
            <h3>No Projects Found</h3><a href="project_form.html" class="btn btn-primary">➕ Create Project</a></div>`;
        return;
    }
    
    container.innerHTML = `<div class="projects-grid">${projects.map(p => createProjectCard(p)).join('')}</div>`;
}

function createProjectCard(project) {
    const teamMembers = project.TeamMembers ? project.TeamMembers.split(',').map(m => m.trim()).filter(m => m) : [];
    const componentsData = parseComponentsUsed(project.ComponentsUsed);
    
    return `
        <div class="project-card" onclick="viewProject('${project.ProjectID}')">
            <div class="project-card-header">
                <code class="project-id">${project.ProjectID}</code>
                <span class="project-date">${formatDate(project.LastUpdated)}</span>
            </div>
            <h3 class="project-title">${escapeHtml(project.ProjectName) || 'Untitled'}</h3>
            ${project.Overview ? `<p class="project-overview">${escapeHtml(project.Overview).substring(0, 100)}...</p>` : ''}
            ${teamMembers.length > 0 ? `<div class="project-team">👥 ${teamMembers.slice(0, 3).join(', ')}${teamMembers.length > 3 ? ` +${teamMembers.length - 3}` : ''}</div>` : ''}
            ${componentsData.length > 0 ? `<div class="project-components">⚙️ ${componentsData.length} components</div>` : ''}
            <div class="project-card-actions" onclick="event.stopPropagation()">
                <button class="btn btn-sm btn-primary" onclick="editProject('${project.ProjectID}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteProject('${project.ProjectID}')">🗑️</button>
            </div>
        </div>`;
}

function parseComponentsUsed(str) {
    if (!str) return [];
    return str.split(',').map(p => p.trim()).filter(p => p).map(part => {
        const [id, qty] = part.includes(':') ? part.split(':') : [part, '1'];
        return { id: id.trim(), quantity: parseInt(qty) || 1 };
    });
}

function searchProjects() {
    const query = (document.getElementById('searchProjects')?.value || '').toLowerCase();
    const filtered = allProjects.filter(p => 
        (p.ProjectName || '').toLowerCase().includes(query) ||
        (p.Overview || '').toLowerCase().includes(query) ||
        (p.TeamMembers || '').toLowerCase().includes(query)
    );
    renderProjectsList(filtered);
}

function viewProject(projectId) {
    const project = allProjects.find(p => p.ProjectID === projectId);
    if (!project) return;
    
    document.getElementById('modalProjectName').textContent = project.ProjectName || 'Untitled';
    document.getElementById('modalProjectBody').innerHTML = `
        <div class="project-detail">
            <div class="detail-section"><h4>📋 Overview</h4><p>${escapeHtml(project.Overview) || 'No overview'}</p></div>
            <div class="detail-section"><h4>👥 Team</h4><p>${escapeHtml(project.TeamMembers) || 'No team members'}</p></div>
            <div class="detail-section"><h4>⚙️ Components</h4><p>${escapeHtml(project.ComponentsUsed) || 'No components'}</p></div>
            ${project.Code ? `<div class="detail-section"><h4>💻 Code</h4><pre class="code-block">${escapeHtml(project.Code)}</pre></div>` : ''}
        </div>`;
    document.getElementById('modalEditBtn').onclick = () => window.location.href = `project_form.html?id=${projectId}`;
    document.getElementById('projectModal').classList.add('show');
}

function closeProjectModal() { 
    document.getElementById('projectModal').classList.remove('show'); 
}

function editProject(id) { 
    window.location.href = `project_form.html?id=${id}`; 
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

// =====================================================
// PROJECT FORM - WITH STOCK VALIDATION
// =====================================================

async function loadProjectForm() {
    const projectId = getUrlParam('id');
    selectedProjectComponents = {};
    teamMembersList = [];
    
    await loadComponentsForSelection();
    await loadPreviousStudents();
    renderTeamMembersChips();
    
    if (projectId) {
        document.getElementById('formTitle').textContent = 'Edit Project';
        showLoading();
        try {
            const result = await apiCall('getProject', { id: projectId });
            if (result.success && result.data) {
                document.getElementById('projectId').value = result.data.ProjectID;
                document.getElementById('projectName').value = result.data.ProjectName || '';
                document.getElementById('overview').value = result.data.Overview || '';
                document.getElementById('code').value = result.data.Code || '';
                
                if (result.data.TeamMembers) {
                    teamMembersList = result.data.TeamMembers.split(',').map(m => m.trim()).filter(m => m);
                    renderTeamMembersChips();
                }
                
                if (result.data.ComponentsUsed) {
                    parseComponentsUsed(result.data.ComponentsUsed).forEach(comp => {
                        const full = allProjectComponents.find(c => c.ComponentID === comp.id);
                        if (full) selectedProjectComponents[comp.id] = { ...full, selectedQuantity: comp.quantity };
                    });
                    renderSelectedComponents();
                    updateSelectedCount();
                }
            }
        } catch (e) { console.error(e); }
        hideLoading();
    }
}

async function loadComponentsForSelection() {
    try {
        const result = await apiCall('getComponents');
        allProjectComponents = result.data || [];
        renderAvailableComponents(allProjectComponents);
    } catch (e) {
        const container = document.getElementById('availableComponentsList');
        if (container) container.innerHTML = '<div class="error-message">Failed to load components</div>';
    }
}

function renderAvailableComponents(components) {
    const container = document.getElementById('availableComponentsList');
    if (!container) return;
    
    if (!components?.length) {
        container.innerHTML = '<div class="no-data">No components available</div>';
        return;
    }
    
    container.innerHTML = components.map(comp => {
        const isSelected = selectedProjectComponents.hasOwnProperty(comp.ComponentID);
        const stock = parseInt(comp.Quantity) || 0;
        const outOfStock = stock === 0;
        const qtyClass = stock === 0 ? 'qty-zero' : stock <= 5 ? 'qty-low' : 'qty-ok';
        
        return `
            <div class="component-item ${isSelected ? 'selected' : ''} ${outOfStock ? 'out-of-stock' : ''}"
                 data-id="${comp.ComponentID}" data-type="${(comp.Type||'').toLowerCase()}" 
                 data-name="${(comp.ComponentName||'').toLowerCase()}" data-stock="${stock}"
                 onclick="${outOfStock ? 'showOutOfStockWarning()' : `toggleComponent('${comp.ComponentID}')`}">
                <div class="component-item-main">
                    <span class="component-icon">${getTypeIcon(comp.Type)}</span>
                    <div class="component-info">
                        <span class="component-name">${escapeHtml(comp.ComponentName)}</span>
                        <span class="component-meta"><code>${comp.ComponentID}</code> <span class="type-badge">${comp.Type || 'Other'}</span></span>
                    </div>
                </div>
                <div class="component-stock ${qtyClass}">${outOfStock ? '❌ Out' : stock + ' available'}</div>
                <div class="component-add-btn ${outOfStock ? 'disabled' : ''}">${outOfStock ? '🚫' : isSelected ? '✓' : '+'}</div>
            </div>`;
    }).join('');
}

function showOutOfStockWarning() { 
    showNotification('Component is out of stock!', 'warning'); 
}

function toggleComponent(componentId) {
    const comp = allProjectComponents.find(c => c.ComponentID === componentId);
    if (!comp || (parseInt(comp.Quantity) || 0) === 0) {
        showNotification('Cannot add - out of stock!', 'error');
        return;
    }
    
    if (selectedProjectComponents[componentId]) {
        delete selectedProjectComponents[componentId];
    } else {
        selectedProjectComponents[componentId] = { ...comp, selectedQuantity: 1 };
    }
    
    renderAvailableComponents(allProjectComponents);
    renderSelectedComponents();
    updateSelectedCount();
}

function renderSelectedComponents() {
    const container = document.getElementById('selectedComponentsList');
    if (!container) return;
    
    const keys = Object.keys(selectedProjectComponents);
    if (!keys.length) {
        container.innerHTML = '<div class="no-selection-message">👈 Click components to add</div>';
        const totalEl = document.getElementById('selectedTotal');
        if (totalEl) totalEl.textContent = '(0)';
        return;
    }
    
    let total = 0;
    container.innerHTML = keys.map(id => {
        const comp = selectedProjectComponents[id];
        const qty = comp.selectedQuantity || 1;
        total += qty;
        const stock = parseInt(comp.Quantity) || 0;
        const over = qty > stock;
        
        return `
            <div class="selected-component-item ${over ? 'over-stock-warning' : ''}">
                <div class="selected-component-info">
                    <span class="component-icon">${getTypeIcon(comp.Type)}</span>
                    <div>
                        <div class="component-name">${escapeHtml(comp.ComponentName)}</div>
                        <code>${comp.ComponentID}</code>
                        <span class="stock-info ${over ? 'over-stock' : ''}">(${stock} available)</span>
                        ${over ? '<span class="warning-badge">⚠️ Exceeds!</span>' : ''}
                    </div>
                </div>
                <div class="quantity-control">
                    <button type="button" class="qty-btn" onclick="changeComponentQty('${id}', -1)">−</button>
                    <input type="number" class="qty-input" value="${qty}" min="1" max="${stock}" onchange="setComponentQty('${id}', this.value)">
                    <button type="button" class="qty-btn" onclick="changeComponentQty('${id}', 1)">+</button>
                </div>
                <button type="button" class="remove-btn" onclick="removeComponent('${id}')">✕</button>
            </div>`;
    }).join('');
    
    const totalEl = document.getElementById('selectedTotal');
    if (totalEl) totalEl.textContent = `(${total} total)`;
}

function changeComponentQty(id, delta) {
    if (!selectedProjectComponents[id]) return;
    const comp = selectedProjectComponents[id];
    const stock = parseInt(comp.Quantity) || 0;
    let newQty = (comp.selectedQuantity || 1) + delta;
    
    if (newQty < 1) newQty = 1;
    if (newQty > stock) {
        showNotification(`Only ${stock} available!`, 'warning');
        newQty = stock;
    }
    
    selectedProjectComponents[id].selectedQuantity = newQty;
    renderSelectedComponents();
}

function setComponentQty(id, value) {
    if (!selectedProjectComponents[id]) return;
    const stock = parseInt(selectedProjectComponents[id].Quantity) || 0;
    let qty = parseInt(value) || 1;
    if (qty < 1) qty = 1;
    if (qty > stock) { 
        showNotification(`Only ${stock} available!`, 'warning'); 
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
    const count = Object.keys(selectedProjectComponents).length;
    const el = document.getElementById('selectedCount');
    if (el) el.textContent = `(${count} component${count !== 1 ? 's' : ''})`;
}

function searchComponentsInForm(query) {
    const term = (query || '').toLowerCase();
    document.querySelectorAll('#availableComponentsList .component-item').forEach(item => {
        const match = !term || 
            (item.dataset.name || '').includes(term) || 
            (item.dataset.type || '').includes(term) ||
            (item.dataset.id || '').toLowerCase().includes(term);
        const typeMatch = currentTypeFilter === 'all' || (item.dataset.type || '') === currentTypeFilter.toLowerCase();
        item.style.display = (match && typeMatch) ? 'flex' : 'none';
    });
}

function clearComponentSearch() {
    const input = document.getElementById('componentSearch');
    if (input) { input.value = ''; searchComponentsInForm(''); }
}

function filterByType(type) {
    currentTypeFilter = type;
    document.querySelectorAll('.quick-filters .filter-chip').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    searchComponentsInForm(document.getElementById('componentSearch')?.value || '');
}

// Team Members
async function loadPreviousStudents() {
    try {
        const result = await apiCall('getProjects');
        const students = new Set();
        (result.data || []).forEach(p => {
            if (p.TeamMembers) p.TeamMembers.split(',').map(m => m.trim()).filter(m => m).forEach(m => students.add(m));
        });
        
        const container = document.getElementById('previousStudents');
        if (container && students.size) {
            container.innerHTML = Array.from(students).sort().slice(0, 10).map(s => 
                `<button type="button" class="quick-add-chip" onclick="quickAddTeamMember('${escapeHtml(s).replace(/'/g, "\\'")}')"}>➕ ${escapeHtml(s)}</button>`
            ).join('');
        } else if (container) {
            container.innerHTML = '<span class="no-previous">No previous students</span>';
        }
    } catch (e) { console.error(e); }
}

function handleTeamMemberKeydown(e) { 
    if (e.key === 'Enter') { e.preventDefault(); addTeamMember(); } 
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
        showNotification(`Added ${name}`);
    }
}

function removeTeamMember(index) { 
    teamMembersList.splice(index, 1); 
    renderTeamMembersChips(); 
}

function renderTeamMembersChips() {
    const container = document.getElementById('teamMembersChips');
    if (!container) return;
    
    container.innerHTML = teamMembersList.map((m, i) => `
        <span class="team-member-chip">
            <span class="chip-avatar">${getInitials(m)}</span>${escapeHtml(m)}
            <button type="button" class="chip-remove" onclick="removeTeamMember(${i})">✕</button>
        </span>
    `).join('');
    
    const hidden = document.getElementById('teamMembers');
    if (hidden) hidden.value = teamMembersList.join(', ');
}

async function saveProject(event) {
    event.preventDefault();
    
    // Validate stock
    let hasError = false;
    Object.values(selectedProjectComponents).forEach(comp => {
        if ((comp.selectedQuantity || 1) > (parseInt(comp.Quantity) || 0)) {
            showNotification(`${comp.ComponentName}: exceeds stock!`, 'error');
            hasError = true;
        }
    });
    if (hasError) return;
    
    const componentsUsed = Object.entries(selectedProjectComponents)
        .map(([id, comp]) => `${id}:${comp.selectedQuantity || 1}`).join(', ');
    
    const data = {
        ProjectName: document.getElementById('projectName').value,
        Overview: document.getElementById('overview').value,
        Code: document.getElementById('code').value,
        ComponentsUsed: componentsUsed,
        TeamMembers: teamMembersList.join(', ')
    };
    
    showLoading();
    try {
        const projectId = document.getElementById('projectId').value;
        if (projectId) {
            await apiCall('updateProject', { id: projectId, data });
            showNotification('Project updated!');
        } else {
            await apiCall('addProject', { data });
            showNotification('Project created!');
        }
        window.location.href = 'projects.html';
    } catch (e) { console.error(e); }
    hideLoading();
}

// =====================================================
// COMPONENTS MODULE - WITH EXCEL EXPORT/IMPORT
// =====================================================

let allComponents = [];
let currentStockFilter = 'all';
let importData = [];
let currentQuantityComponentId = null;

async function loadComponents() {
    showLoading();
    try {
        const result = await apiCall('getComponents');
        allComponents = result.data || [];
        updateComponentStats();
        renderComponentsTable(allComponents);
    } catch (e) { console.error(e); }
    hideLoading();
}

function updateComponentStats() {
    const total = allComponents.length;
    const inStock = allComponents.filter(c => (parseInt(c.Quantity)||0) > 5).length;
    const lowStock = allComponents.filter(c => { const q = parseInt(c.Quantity)||0; return q > 0 && q <= 5; }).length;
    const outOfStock = allComponents.filter(c => (parseInt(c.Quantity)||0) === 0).length;
    
    if (document.getElementById('totalComponents')) document.getElementById('totalComponents').textContent = total;
    if (document.getElementById('inStockCount')) document.getElementById('inStockCount').textContent = inStock;
    if (document.getElementById('lowStockCount')) document.getElementById('lowStockCount').textContent = lowStock;
    if (document.getElementById('outOfStockCount')) document.getElementById('outOfStockCount').textContent = outOfStock;
}

function renderComponentsTable(components) {
    const tbody = document.getElementById('componentsTableBody');
    if (!tbody) return;
    
    if (!components?.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">No components found</td></tr>';
        return;
    }
    
    tbody.innerHTML = components.map(c => {
        const qty = parseInt(c.Quantity) || 0;
        const cls = qty === 0 ? 'qty-zero' : qty <= 5 ? 'qty-low' : 'qty-ok';
        const safeName = escapeHtml(c.ComponentName).replace(/'/g, "\\'");
        return `<tr>
            <td><code>${c.ComponentID}</code></td>
            <td><span class="type-icon">${getTypeIcon(c.Type)}</span> <strong>${escapeHtml(c.ComponentName)}</strong></td>
            <td><span class="type-badge">${c.Type || '-'}</span></td>
            <td>${escapeHtml((c.Description||'').substring(0,40))}${(c.Description||'').length > 40 ? '...' : ''}</td>
            <td><span class="quantity-badge ${cls}" onclick="openQuantityModal('${c.ComponentID}','${safeName}',${qty})">${qty} ✏️</span></td>
            <td><button class="btn btn-sm btn-primary" onclick="editComponent('${c.ComponentID}')">✏️</button></td>
        </tr>`;
    }).join('');
}

function searchComponents() {
    const q = (document.getElementById('searchComponents')?.value || '').toLowerCase();
    let filtered = allComponents.filter(c => 
        (c.ComponentName||'').toLowerCase().includes(q) || 
        (c.ComponentID||'').toLowerCase().includes(q) || 
        (c.Type||'').toLowerCase().includes(q)
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
        const q = parseInt(c.Quantity)||0;
        if (filter === 'instock') return q > 5;
        if (filter === 'low') return q > 0 && q <= 5;
        if (filter === 'out') return q === 0;
        return true;
    });
}

// Export Components to Excel
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
    ws['!cols'] = [{wch:12},{wch:30},{wch:15},{wch:40},{wch:10}];
    XLSX.writeFile(wb, `ATL_Components_${new Date().toISOString().split('T')[0]}.xlsx`);
    showNotification('Components exported to Excel!');
}

function downloadComponentTemplate() {
    const template = [
        { ComponentName: 'Arduino Uno', Type: 'Microcontroller', Quantity: 5, Description: 'ATmega328P board' },
        { ComponentName: 'ESP32', Type: 'Microcontroller', Quantity: 10, Description: 'WiFi+BT module' },
        { ComponentName: 'Ultrasonic Sensor', Type: 'Sensor', Quantity: 8, Description: 'HC-SR04' }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Components_Template.xlsx');
    showNotification('Template downloaded!');
}

// Quantity Modal
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
    input.value = Math.max(0, (parseInt(input.value)||0) + amt);
}

async function saveQuantity() {
    if (!currentQuantityComponentId) return;
    showLoading();
    try {
        await apiCall('updateComponentQuantity', { 
            id: currentQuantityComponentId, 
            quantity: parseInt(document.getElementById('quantityInput').value)||0 
        });
        showNotification('Quantity updated!');
        closeQuantityModal();
        loadComponents();
    } catch (e) { console.error(e); }
    hideLoading();
}

// Import Modal
function openImportModal() {
    document.getElementById('importModal').classList.add('show');
    importData = [];
    document.getElementById('previewSection').style.display = 'none';
    document.getElementById('confirmImportBtn').disabled = true;
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('show');
    document.getElementById('previewSection').style.display = 'none';
    document.getElementById('confirmImportBtn').disabled = true;
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
            const wb = XLSX.read(e.target.result, {type:'binary'});
            importData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            showPreview(importData);
        } catch (err) { showNotification('Error reading file', 'error'); }
    };
    reader.readAsBinaryString(file);
}

function showPreview(data) {
    if (!data.length) { showNotification('No data found', 'error'); return; }
    const headers = Object.keys(data[0]);
    document.getElementById('previewTable').innerHTML = `
        <table class="preview-table">
            <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${data.slice(0,5).map(r=>`<tr>${headers.map(h=>`<td>${r[h]||''}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>`;
    document.getElementById('previewNote').textContent = `${data.length} rows total`;
    document.getElementById('previewSection').style.display = 'block';
    document.getElementById('confirmImportBtn').disabled = false;
}

async function confirmImport() {
    if (!importData.length) return;
    showLoading();
    try {
        const result = await apiCall('bulkAddComponents', { 
            data: importData.map(i => ({
                ComponentName: i.ComponentName || i.Name || '',
                Type: i.Type || '',
                Quantity: parseInt(i.Quantity) || 0,
                Description: i.Description || ''
            }))
        });
        showNotification(`Imported ${result.addedCount || importData.length} components!`);
        closeImportModal();
        loadComponents();
    } catch (e) { console.error(e); }
    hideLoading();
}

function editComponent(id) { 
    window.location.href = `component_form.html?id=${id}`; 
}

async function loadComponentForm() {
    const id = getUrlParam('id');
    if (id) {
        document.getElementById('formTitle').textContent = 'Edit Component';
        showLoading();
        try {
            const result = await apiCall('getComponent', { id });
            if (result.success && result.data) {
                document.getElementById('componentId').value = result.data.ComponentID;
                document.getElementById('componentName').value = result.data.ComponentName || '';
                document.getElementById('type').value = result.data.Type || '';
                document.getElementById('description').value = result.data.Description || '';
                document.getElementById('quantity').value = result.data.Quantity || 0;
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
// COMPETITIONS MODULE
// =====================================================

let allCompetitions = [];
let currentCompFilter = 'all';

async function loadCompetitions() {
    showLoading();
    try {
        const result = await apiCall('getCompetitions');
        allCompetitions = result.data || [];
        updateCompetitionStats();
        renderCompetitionsTable(allCompetitions);
        renderCalendarView(allCompetitions);
    } catch (e) { 
        console.error(e);
        const tbody = document.getElementById('competitionsTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="no-data">Failed to load. <button onclick="loadCompetitions()" class="btn btn-sm btn-primary">Retry</button></td></tr>`;
        }
    }
    hideLoading();
}

function updateCompetitionStats() {
    const upcoming = allCompetitions.filter(c => (c.Status||'').toLowerCase() === 'upcoming').length;
    const ongoing = allCompetitions.filter(c => (c.Status||'').toLowerCase() === 'ongoing').length;
    const completed = allCompetitions.filter(c => (c.Status||'').toLowerCase() === 'completed').length;
    
    if (document.getElementById('upcomingCount')) document.getElementById('upcomingCount').textContent = upcoming;
    if (document.getElementById('ongoingCount')) document.getElementById('ongoingCount').textContent = ongoing;
    if (document.getElementById('completedCount')) document.getElementById('completedCount').textContent = completed;
    if (document.getElementById('totalCompetitions')) document.getElementById('totalCompetitions').textContent = allCompetitions.length;
}

function renderCompetitionsTable(competitions) {
    const tbody = document.getElementById('competitionsTableBody');
    if (!tbody) return;
    
    if (!competitions?.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No competitions found. <a href="competition_form.html" class="btn btn-sm btn-primary">Add one</a></td></tr>';
        return;
    }
    
    tbody.innerHTML = competitions.map(c => `
        <tr>
            <td><code>${c.EventID}</code></td>
            <td><strong>${escapeHtml(c.EventName)}</strong></td>
            <td>${formatDate(c.Date)}</td>
            <td>${escapeHtml(c.Location) || '-'}</td>
            <td><span class="status-badge status-${(c.Status||'upcoming').toLowerCase()}">${c.Status || 'Upcoming'}</span></td>
            <td>${escapeHtml(c.Position || c.Result) || '-'}</td>
            <td class="actions">
                <button class="btn btn-sm btn-info" onclick="viewCompetition('${c.EventID}')">👁️</button>
                <button class="btn btn-sm btn-warning" onclick="openResultModal('${c.EventID}')">🏆</button>
                <button class="btn btn-sm btn-primary" onclick="editCompetition('${c.EventID}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCompetition('${c.EventID}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function renderCalendarView(competitions) {
    const container = document.getElementById('calendarView');
    if (!container) return;
    
    if (!competitions?.length) {
        container.innerHTML = '<div class="empty-state"><p>No competitions</p></div>';
        return;
    }
    
    container.innerHTML = competitions.map(c => {
        const date = new Date(c.Date);
        const status = (c.Status||'upcoming').toLowerCase();
        return `
            <div class="calendar-card ${status}" onclick="viewCompetition('${c.EventID}')">
                <div class="calendar-date">
                    <span class="month">${date.toLocaleDateString('en-US',{month:'short'})}</span>
                    <span class="day">${date.getDate()||'?'}</span>
                </div>
                <div class="calendar-details">
                    <span class="status-badge status-${status}">${c.Status||'Upcoming'}</span>
                    <h4>${escapeHtml(c.EventName)}</h4>
                    <p>📍 ${escapeHtml(c.Location) || 'TBD'}</p>
                    ${c.Position ? `<p>🏆 ${escapeHtml(c.Position)}</p>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function searchCompetitions() {
    const q = (document.getElementById('searchCompetitions')?.value || '').toLowerCase();
    let filtered = allCompetitions.filter(c => 
        (c.EventName||'').toLowerCase().includes(q) || (c.Location||'').toLowerCase().includes(q)
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
    const tableView = document.getElementById('tableView');
    const calendarView = document.getElementById('calendarView');
    
    if (view === 'table') {
        if (tableView) tableView.style.display = 'block';
        if (calendarView) calendarView.style.display = 'none';
    } else {
        if (tableView) tableView.style.display = 'none';
        if (calendarView) calendarView.style.display = 'grid';
    }
    
    document.querySelectorAll('.view-toggle .btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

function viewCompetition(eventId) {
    const comp = allCompetitions.find(c => c.EventID === eventId);
    if (!comp) return;
    
    document.getElementById('modalCompetitionName').textContent = comp.EventName || 'Competition';
    document.getElementById('modalCompetitionBody').innerHTML = `
        <div class="competition-detail">
            <div class="detail-grid">
                <div class="detail-item"><label>📅 Date</label><span>${formatDate(comp.Date)}${comp.EndDate ? ' - ' + formatDate(comp.EndDate) : ''}</span></div>
                <div class="detail-item"><label>📍 Location</label><span>${escapeHtml(comp.Location) || 'TBD'}</span></div>
                <div class="detail-item"><label>📊 Status</label><span class="status-badge status-${(comp.Status||'upcoming').toLowerCase()}">${comp.Status||'Upcoming'}</span></div>
                <div class="detail-item"><label>🏆 Result</label><span>${escapeHtml(comp.Position || comp.Result) || 'Pending'}</span></div>
            </div>
            ${comp.Details ? `<div class="detail-section"><h4>📋 Details</h4><p>${escapeHtml(comp.Details)}</p></div>` : ''}
            ${comp.Participants ? `<div class="detail-section"><h4>👥 Participants</h4><p>${escapeHtml(comp.Participants)}</p></div>` : ''}
            ${comp.Notes ? `<div class="detail-section"><h4>📝 Notes</h4><p>${escapeHtml(comp.Notes)}</p></div>` : ''}
        </div>
    `;
    document.getElementById('modalCompEditBtn').onclick = () => { closeCompetitionModal(); editCompetition(eventId); };
    document.getElementById('competitionModal').classList.add('show');
}

function closeCompetitionModal() { 
    document.getElementById('competitionModal').classList.remove('show'); 
}

function editCompetition(id) { 
    window.location.href = `competition_form.html?id=${id}`; 
}

async function deleteCompetition(id) {
    if (!confirm('Delete this competition?')) return;
    showLoading();
    try {
        await apiCall('deleteCompetition', { id });
        showNotification('Competition deleted!');
        loadCompetitions();
    } catch (e) { console.error(e); }
    hideLoading();
}

// Result Modal
function openResultModal(eventId) {
    const comp = allCompetitions.find(c => c.EventID === eventId);
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
    const eventId = document.getElementById('resultEventId').value;
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
    } catch (e) { console.error(e); }
    hideLoading();
}

// Competition Form
async function loadCompetitionForm() {
    const id = getUrlParam('id');
    if (id) {
        document.getElementById('formTitle').textContent = 'Edit Competition';
        showLoading();
        try {
            const result = await apiCall('getCompetition', { id });
            if (result.success && result.data) {
                const c = result.data;
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
        showNotification(id ? 'Competition updated!' : 'Competition added!');
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
        const result = await apiCall('getOrders');
        allOrders = result.data || [];
        updateOrderStats();
        renderOrdersList(allOrders);
    } catch (e) { console.error(e); }
    hideLoading();
}

function updateOrderStats() {
    if (document.getElementById('totalOrders')) document.getElementById('totalOrders').textContent = allOrders.length;
    if (document.getElementById('pendingOrders')) document.getElementById('pendingOrders').textContent = allOrders.filter(o => o.Status === 'Ordered').length;
    if (document.getElementById('shippedOrders')) document.getElementById('shippedOrders').textContent = allOrders.filter(o => o.Status === 'Shipped').length;
    if (document.getElementById('deliveredOrders')) document.getElementById('deliveredOrders').textContent = allOrders.filter(o => o.Status === 'Delivered').length;
    if (document.getElementById('completedOrders')) document.getElementById('completedOrders').textContent = allOrders.filter(o => o.Status === 'Completed').length;
}

function filterOrders(status, btn) {
    currentOrderFilter = status;
    document.querySelectorAll('.filter-tabs .filter-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderOrdersList(status === 'all' ? allOrders : allOrders.filter(o => o.Status === status));
}

function searchOrders() {
    const q = (document.getElementById('searchOrders')?.value || '').toLowerCase();
    let filtered = allOrders.filter(o => 
        (o.OrderID||'').toLowerCase().includes(q) || (o.Vendor||'').toLowerCase().includes(q)
    );
    if (currentOrderFilter !== 'all') filtered = filtered.filter(o => o.Status === currentOrderFilter);
    renderOrdersList(filtered);
}

function renderOrdersList(orders) {
    const container = document.getElementById('ordersContainer');
    if (!container) return;
    
    if (!orders?.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><h3>No Orders</h3>
            <div class="empty-actions"><a href="order_form.html" class="btn btn-primary">➕ Create Order</a>
            <button class="btn btn-secondary" onclick="openImportOrderModal()">📥 Import</button></div></div>`;
        return;
    }
    
    container.innerHTML = `<div class="orders-grid">${orders.map(o => createOrderCard(o)).join('')}</div>`;
}

function createOrderCard(order) {
    const items = order.Items || [];
    const totalQty = parseInt(order.TotalQuantity) || items.reduce((s,i) => s + (parseInt(i.Quantity)||0), 0);
    const statusIcons = { 'ordered':'🕐', 'shipped':'🚚', 'delivered':'📬', 'completed':'✅', 'cancelled':'❌' };
    const statusClass = (order.Status||'ordered').toLowerCase();
    
    return `
        <div class="order-card ${order.Status === 'Completed' ? 'completed' : ''}">
            <div class="order-card-header">
                <div class="order-info">
                    <code class="order-id">${order.OrderID}</code>
                    <span class="order-vendor">${escapeHtml(order.Vendor)||'Unknown'}</span>
                </div>
                <span class="status-badge status-${statusClass}">${statusIcons[statusClass]||'📦'} ${order.Status||'Ordered'}</span>
            </div>
            <div class="order-card-meta">
                <div class="meta-item"><span class="meta-label">📅 Ordered</span><span class="meta-value">${formatDate(order.OrderDate)||'N/A'}</span></div>
                <div class="meta-item"><span class="meta-label">🚚 Expected</span><span class="meta-value">${formatDate(order.ExpectedDelivery)||'TBD'}</span></div>
                <div class="meta-item"><span class="meta-label">📦 Items</span><span class="meta-value">${items.length} types, ${totalQty} units</span></div>
            </div>
            ${items.length ? `<div class="order-items-preview"><h5>Items</h5>${items.slice(0,3).map(i => 
                `<div class="order-item-row"><span class="item-name">${escapeHtml(i.ComponentName)}</span><span><span class="item-qty">×${i.Quantity}</span>${i.Synced==='Yes'?'<span class="synced-badge">✓</span>':''}</span></div>`
            ).join('')}${items.length > 3 ? `<div class="more-items">+${items.length-3} more</div>` : ''}</div>` : ''}
            <div class="order-card-actions">
                ${order.Status === 'Delivered' ? `<button class="btn btn-success" onclick="openCompleteOrderModal('${order.OrderID}')">✅ Complete & Merge</button>` : ''}
                <button class="btn btn-sm btn-info" onclick="viewOrder('${order.OrderID}')">👁️</button>
                ${order.Status !== 'Completed' ? `<button class="btn btn-sm btn-primary" onclick="editOrder('${order.OrderID}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteOrder('${order.OrderID}')">🗑️</button>` : ''}
            </div>
        </div>`;
}

function viewOrder(orderId) {
    const order = allOrders.find(o => o.OrderID === orderId);
    if (!order) return;
    const items = order.Items || [];
    
    document.getElementById('viewOrderTitle').textContent = `Order: ${order.OrderID}`;
    document.getElementById('viewOrderBody').innerHTML = `
        <div class="order-details-grid">
            <div class="detail-item"><label>Vendor</label><span>${escapeHtml(order.Vendor)||'N/A'}</span></div>
            <div class="detail-item"><label>Status</label><span class="status-badge status-${(order.Status||'ordered').toLowerCase()}">${order.Status||'Ordered'}</span></div>
            <div class="detail-item"><label>Order Date</label><span>${formatDate(order.OrderDate)||'N/A'}</span></div>
            <div class="detail-item"><label>Expected</label><span>${formatDate(order.ExpectedDelivery)||'TBD'}</span></div>
        </div>
        <h4>📋 Items (${items.length})</h4>
        ${items.length ? `<table class="order-items-table"><thead><tr><th>Component</th><th>Type</th><th>Qty</th><th>Synced</th></tr></thead>
        <tbody>${items.map(i => `<tr><td>${escapeHtml(i.ComponentName)}</td><td>${escapeHtml(i.Type)||'-'}</td><td>${i.Quantity}</td><td>${i.Synced==='Yes'?'✅':'❌'}</td></tr>`).join('')}</tbody></table>` : '<p>No items</p>'}
        ${order.Notes ? `<h4>📝 Notes</h4><p>${escapeHtml(order.Notes)}</p>` : ''}
    `;
    document.getElementById('viewOrderEditBtn').onclick = () => { closeViewOrderModal(); editOrder(orderId); };
    document.getElementById('viewOrderModal').classList.add('show');
}

function closeViewOrderModal() { 
    document.getElementById('viewOrderModal').classList.remove('show'); 
}

function editOrder(id) { 
    window.location.href = `order_form.html?id=${id}`; 
}

async function deleteOrder(id) {
    if (!confirm('Delete this order?')) return;
    showLoading();
    try { 
        await apiCall('deleteOrder', { id }); 
        showNotification('Order deleted!'); 
        loadOrders(); 
    } catch (e) { console.error(e); }
    hideLoading();
}

// Complete Order Modal
function openCompleteOrderModal(orderId) {
    currentCompleteOrderId = orderId;
    const order = allOrders.find(o => o.OrderID === orderId);
    if (!order) return;
    const items = order.Items || [];
    
    document.getElementById('completeOrderSummary').innerHTML = `
        <p><strong>Order:</strong> ${order.OrderID} | <strong>Vendor:</strong> ${escapeHtml(order.Vendor)}</p>
        <h5>Items to merge into inventory:</h5>
        <ul>${items.map(i => `<li>${escapeHtml(i.ComponentName)} <strong>+${i.Quantity}</strong></li>`).join('')}</ul>
    `;
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
        const result = await apiCall('completeOrder', { id: currentCompleteOrderId });
        if (result.success) {
            showMergeResults(result);
        }
        loadOrders();
    } catch (e) { console.error(e); }
    hideLoading();
}

function showMergeResults(result) {
    const syncResults = result.syncResults || [];
    const merged = syncResults.filter(r => r.action === 'updated' || r.action === 'merged');
    const created = syncResults.filter(r => r.action === 'created');
    
    document.getElementById('mergeResultsContent').innerHTML = `
        <div class="merge-results">
            <div class="merge-summary">
                <div class="summary-item success"><span class="summary-number">${merged.length}</span><span class="summary-label">Updated</span></div>
                <div class="summary-item info"><span class="summary-number">${created.length}</span><span class="summary-label">Created</span></div>
            </div>
            ${merged.length ? `<div class="result-section"><h5>🔄 Updated Components</h5><ul>${merged.map(r => 
                `<li><span>${escapeHtml(r.matchedWith || r.name || r.itemName)}</span> <span>${r.previousQty || 0} → <strong>${r.newQty}</strong> (+${r.addedQty || r.added || r.quantity})</span></li>`
            ).join('')}</ul></div>` : ''}
            ${created.length ? `<div class="result-section"><h5>➕ New Components</h5><ul>${created.map(r => 
                `<li><span>${escapeHtml(r.itemName || r.name)}</span> <strong>+${r.quantity}</strong></li>`
            ).join('')}</ul></div>` : ''}
        </div>
    `;
    document.getElementById('mergeResultsModal').classList.add('show');
}

function closeMergeResultsModal() { 
    document.getElementById('mergeResultsModal').classList.remove('show'); 
}

// Import Order Modal
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
    const dz = document.getElementById('orderDropZone');
    if (!dz) return;
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => { 
        e.preventDefault(); 
        dz.classList.remove('dragover'); 
        if (e.dataTransfer.files[0]) handleOrderFile(e.dataTransfer.files[0]); 
    });
}

function handleOrderFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const wb = XLSX.read(e.target.result, {type:'binary'});
            orderImportData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            showOrderPreview(orderImportData);
        } catch (err) { showNotification('Error reading file', 'error'); }
    };
    reader.readAsBinaryString(file);
}

function showOrderPreview(data) {
    if (!data?.length) { showNotification('No data found', 'error'); return; }
    
    const totalQty = data.reduce((s, i) => s + (parseInt(i.Quantity || i.quantity) || 0), 0);
    
    document.getElementById('orderItemsPreview').innerHTML = `
        <table class="preview-table">
            <thead><tr><th>Component</th><th>Type</th><th>Qty</th></tr></thead>
            <tbody>${data.slice(0, 10).map(i => `<tr>
                <td>${escapeHtml(i.ComponentName || i.Name || i.name || '')}</td>
                <td>${escapeHtml(i.Type || i.type || '')}</td>
                <td>${i.Quantity || i.quantity || 0}</td>
            </tr>`).join('')}${data.length > 10 ? `<tr><td colspan="3" style="text-align:center;font-style:italic;">...and ${data.length - 10} more</td></tr>` : ''}</tbody>
        </table>`;
    
    document.getElementById('previewTotalItems').textContent = data.length;
    document.getElementById('previewTotalQty').textContent = totalQty;
    document.getElementById('orderPreviewSection').style.display = 'block';
    document.getElementById('confirmOrderImportBtn').disabled = false;
}

function downloadOrderTemplate() {
    const template = [
        { ComponentName: 'Arduino Uno', Type: 'Microcontroller', Quantity: 5 },
        { ComponentName: 'ESP32', Type: 'Microcontroller', Quantity: 10 },
        { ComponentName: 'Ultrasonic Sensor', Type: 'Sensor', Quantity: 8 }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Order');
    XLSX.writeFile(wb, 'Order_Template.xlsx');
    showNotification('Template downloaded!');
}

async function confirmOrderImport() {
    if (!orderImportData?.length) return;
    
    showLoading();
    try {
        const orderData = {
            Vendor: document.getElementById('importVendor')?.value || 'Imported Order',
            OrderDate: document.getElementById('importOrderDate')?.value || new Date().toISOString().split('T')[0],
            ExpectedDelivery: document.getElementById('importExpectedDelivery')?.value || '',
            Status: 'Ordered',
            Notes: 'Imported from Excel',
            Items: orderImportData.map(i => ({
                ComponentName: i.ComponentName || i.Name || i.name || '',
                Type: i.Type || i.type || '',
                Quantity: parseInt(i.Quantity || i.quantity) || 0
            }))
        };
        
        await apiCall('addOrder', { data: orderData });
        showNotification('Order imported successfully!');
        closeImportOrderModal();
        loadOrders();
    } catch (e) { console.error(e); }
    hideLoading();
}

// Order Form
async function loadOrderForm() {
    const orderId = getUrlParam('id');
    orderItems = [];
    
    document.getElementById('orderDate').valueAsDate = new Date();
    
    if (orderId) {
        document.getElementById('formTitle').textContent = 'Edit Order';
        showLoading();
        try {
            const result = await apiCall('getOrder', { id: orderId });
            if (result.success && result.data) {
                const order = result.data;
                document.getElementById('orderId').value = order.OrderID;
                document.getElementById('vendor').value = order.Vendor || '';
                document.getElementById('orderDate').value = order.OrderDate || '';
                document.getElementById('expectedDelivery').value = order.ExpectedDelivery || '';
                document.getElementById('status').value = order.Status || 'Ordered';
                document.getElementById('notes').value = order.Notes || '';
                
                orderItems = (order.Items || []).map(i => ({
                    ComponentName: i.ComponentName,
                    Type: i.Type || '',
                    Quantity: parseInt(i.Quantity) || 0
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
    
    const name = nameInput?.value.trim();
    const type = typeInput?.value.trim() || '';
    const qty = parseInt(qtyInput?.value) || 1;
    
    if (!name) { 
        showNotification('Enter component name', 'warning'); 
        return; 
    }
    
    orderItems.push({ ComponentName: name, Type: type, Quantity: qty });
    renderOrderItems();
    
    if (nameInput) nameInput.value = '';
    if (typeInput) typeInput.value = '';
    if (qtyInput) qtyInput.value = '1';
    nameInput?.focus();
}

function removeOrderItem(index) {
    orderItems.splice(index, 1);
    renderOrderItems();
}

function updateItemQty(index, value) {
    orderItems[index].Quantity = parseInt(value) || 1;
    updateOrderTotals();
}

function renderOrderItems() {
    const container = document.getElementById('orderItemsContainer');
    if (!container) return;
    
    if (!orderItems.length) {
        container.innerHTML = '<div class="no-items">No items added yet. Add items above.</div>';
        updateOrderTotals();
        return;
    }
    
    container.innerHTML = `
        <table class="order-items-table">
            <thead><tr><th>Component</th><th>Type</th><th>Qty</th><th></th></tr></thead>
            <tbody>${orderItems.map((item, i) => `
                <tr>
                    <td><strong>${escapeHtml(item.ComponentName)}</strong></td>
                    <td>${escapeHtml(item.Type) || '-'}</td>
                    <td><input type="number" class="qty-input-sm" value="${item.Quantity}" min="1" onchange="updateItemQty(${i}, this.value)"></td>
                    <td><button type="button" class="btn btn-sm btn-danger" onclick="removeOrderItem(${i})">✕</button></td>
                </tr>
            `).join('')}</tbody>
        </table>`;
    
    updateOrderTotals();
}

function updateOrderTotals() {
    const totalItems = orderItems.length;
    const totalQty = orderItems.reduce((s, i) => s + (parseInt(i.Quantity) || 0), 0);
    if (document.getElementById('totalItemsCount')) document.getElementById('totalItemsCount').textContent = totalItems;
    if (document.getElementById('totalQuantityCount')) document.getElementById('totalQuantityCount').textContent = totalQty;
}

async function saveOrder(event) {
    event.preventDefault();
    
    if (!orderItems.length) { 
        showNotification('Add at least one item', 'warning'); 
        return; 
    }
    
    const data = {
        Vendor: document.getElementById('vendor').value,
        OrderDate: document.getElementById('orderDate').value,
        ExpectedDelivery: document.getElementById('expectedDelivery').value,
        Status: document.getElementById('status').value,
        Notes: document.getElementById('notes').value,
        Items: orderItems
    };
    
    showLoading();
    try {
        const orderId = document.getElementById('orderId').value;
        if (orderId) {
            await apiCall('updateOrder', { id: orderId, data });
            showNotification('Order updated!');
        } else {
            await apiCall('addOrder', { data });
            showNotification('Order created!');
        }
        window.location.href = 'orders.html';
    } catch (e) { console.error(e); }
    hideLoading();
}

// =====================================================
// INITIALIZATION
// =====================================================

console.log('✅ Script.js loaded successfully');
