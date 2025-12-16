// =====================================================
// script.js - ATL Dashboard (Complete Updated)
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
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
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

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// =====================================================
// PROJECTS MODULE (Complete with Team Members)
// =====================================================

let allProjects = [];
let allProjectComponents = [];
let currentTypeFilter = 'all';
let teamMembersList = [];
let allPreviousStudents = new Set();

// Load Projects List
async function loadProjects() {
    showLoading();
    try {
        const result = await apiCall('getProjects');
        allProjects = result.data || [];
        
        updateProjectStats();
        renderProjectsList(allProjects);
        collectPreviousStudents();
    } catch (error) {
        console.error('Error loading projects:', error);
        document.getElementById('projectsContainer').innerHTML = `
            <div class="error-state">
                <p>❌ Failed to load projects. Please refresh the page.</p>
            </div>
        `;
    }
    hideLoading();
}

function collectPreviousStudents() {
    allPreviousStudents.clear();
    allProjects.forEach(project => {
        if (project.TeamMembers) {
            const members = project.TeamMembers.split(',').map(m => m.trim()).filter(m => m);
            members.forEach(m => allPreviousStudents.add(m));
        }
    });
}

function updateProjectStats() {
    const totalProjects = allProjects.length;
    
    // Count unique students
    const allStudents = new Set();
    allProjects.forEach(project => {
        if (project.TeamMembers) {
            const members = project.TeamMembers.split(',').map(m => m.trim()).filter(m => m);
            members.forEach(m => allStudents.add(m.toLowerCase()));
        }
    });
    
    // Count unique components
    const allComponents = new Set();
    allProjects.forEach(project => {
        if (project.ComponentsUsed) {
            const components = project.ComponentsUsed.split(',').map(c => c.trim()).filter(c => c);
            components.forEach(c => allComponents.add(c));
        }
    });
    
    const totalProjectsEl = document.getElementById('totalProjects');
    const totalStudentsEl = document.getElementById('totalStudents');
    const totalComponentsEl = document.getElementById('totalComponentsUsed');
    
    if (totalProjectsEl) totalProjectsEl.textContent = totalProjects;
    if (totalStudentsEl) totalStudentsEl.textContent = allStudents.size;
    if (totalComponentsEl) totalComponentsEl.textContent = allComponents.size;
}

function renderProjectsList(projects) {
    const container = document.getElementById('projectsContainer');
    
    if (!projects || projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📁</div>
                <h3>No Projects Found</h3>
                <p>Create your first project to get started!</p>
                <a href="project_form.html" class="btn btn-primary">➕ Create Project</a>
            </div>
        `;
        return;
    }
    
    container.innerHTML = projects.map(project => createProjectCard(project)).join('');
}

function createProjectCard(project) {
    const teamMembers = project.TeamMembers ? 
        project.TeamMembers.split(',').map(m => m.trim()).filter(m => m) : [];
    
    const components = project.ComponentsUsed ? 
        project.ComponentsUsed.split(',').map(c => c.trim()).filter(c => c) : [];
    
    const teamMembersHtml = teamMembers.length > 0 ? `
        <div class="project-team">
            <span class="team-label">👥 Team:</span>
            <div class="team-avatars">
                ${teamMembers.slice(0, 5).map(member => `
                    <span class="team-avatar" title="${escapeHtml(member)}">${getInitials(member)}</span>
                `).join('')}
                ${teamMembers.length > 5 ? `<span class="team-more">+${teamMembers.length - 5}</span>` : ''}
            </div>
            <span class="team-names">${teamMembers.join(', ')}</span>
        </div>
    ` : `
        <div class="project-team no-team">
            <span class="team-label">👥 Team:</span>
            <span class="no-team-text">No team members assigned</span>
        </div>
    `;
    
    const componentsHtml = components.length > 0 ? `
        <div class="project-components">
            <span class="components-label">⚙️ Components:</span>
            <div class="component-tags">
                ${components.slice(0, 4).map(comp => `
                    <span class="component-tag">${comp}</span>
                `).join('')}
                ${components.length > 4 ? `<span class="component-tag more">+${components.length - 4} more</span>` : ''}
            </div>
        </div>
    ` : '';
    
    return `
        <div class="project-card" onclick="viewProject('${project.ProjectID}')">
            <div class="project-card-header">
                <div class="project-id"><code>${project.ProjectID}</code></div>
                <div class="project-date">${formatDate(project.LastUpdated)}</div>
            </div>
            
            <h3 class="project-title">${escapeHtml(project.ProjectName) || 'Untitled Project'}</h3>
            
            ${project.Overview ? `
                <p class="project-overview">${escapeHtml(project.Overview).substring(0, 150)}${project.Overview.length > 150 ? '...' : ''}</p>
            ` : ''}
            
            ${teamMembersHtml}
            
            ${componentsHtml}
            
            <div class="project-card-actions" onclick="event.stopPropagation()">
                <button class="btn btn-sm btn-primary" onclick="editProject('${project.ProjectID}')">
                    ✏️ Edit
                </button>
                <button class="btn btn-sm btn-info" onclick="viewProject('${project.ProjectID}')">
                    👁️ View
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteProject('${project.ProjectID}')">
                    🗑️ Delete
                </button>
            </div>
        </div>
    `;
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function searchProjects() {
    const query = document.getElementById('searchProjects').value.toLowerCase().trim();
    
    if (!query) {
        renderProjectsList(allProjects);
        return;
    }
    
    const filtered = allProjects.filter(project => {
        const name = (project.ProjectName || '').toLowerCase();
        const overview = (project.Overview || '').toLowerCase();
        const team = (project.TeamMembers || '').toLowerCase();
        const components = (project.ComponentsUsed || '').toLowerCase();
        const id = (project.ProjectID || '').toLowerCase();
        
        return name.includes(query) || 
               overview.includes(query) || 
               team.includes(query) || 
               components.includes(query) ||
               id.includes(query);
    });
    
    renderProjectsList(filtered);
}

function viewProject(projectId) {
    const project = allProjects.find(p => p.ProjectID === projectId);
    if (!project) return;
    
    const teamMembers = project.TeamMembers ? 
        project.TeamMembers.split(',').map(m => m.trim()).filter(m => m) : [];
    
    const components = project.ComponentsUsed ? 
        project.ComponentsUsed.split(',').map(c => c.trim()).filter(c => c) : [];
    
    document.getElementById('modalProjectName').textContent = project.ProjectName || 'Untitled Project';
    
    document.getElementById('modalProjectBody').innerHTML = `
        <div class="project-detail">
            <div class="detail-section">
                <h4>📋 Overview</h4>
                <p>${project.Overview ? escapeHtml(project.Overview) : '<em>No overview provided</em>'}</p>
            </div>
            
            <div class="detail-section">
                <h4>👥 Team Members</h4>
                ${teamMembers.length > 0 ? `
                    <div class="team-list-detailed">
                        ${teamMembers.map(member => `
                            <div class="team-member-item">
                                <span class="team-avatar large">${getInitials(member)}</span>
                                <span class="team-member-name">${escapeHtml(member)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p><em>No team members assigned</em></p>'}
            </div>
            
            <div class="detail-section">
                <h4>⚙️ Components Used</h4>
                ${components.length > 0 ? `
                    <div class="components-list-detailed">
                        ${components.map(comp => `
                            <span class="component-tag">${comp}</span>
                        `).join('')}
                    </div>
                ` : '<p><em>No components listed</em></p>'}
            </div>
            
            ${project.Code ? `
                <div class="detail-section">
                    <h4>💻 Code / Notes</h4>
                    <pre class="code-block">${escapeHtml(project.Code)}</pre>
                </div>
            ` : ''}
            
            <div class="detail-section">
                <h4>📅 Last Updated</h4>
                <p>${formatDate(project.LastUpdated)}</p>
            </div>
        </div>
    `;
    
    document.getElementById('modalEditBtn').onclick = function() {
        window.location.href = `project_form.html?id=${projectId}`;
    };
    
    document.getElementById('projectModal').classList.add('show');
}

function closeProjectModal() {
    document.getElementById('projectModal').classList.remove('show');
}

// =====================================================
// Project Form Functions
// =====================================================

async function loadProjectForm() {
    const projectId = getUrlParam('id');
    const formTitle = document.getElementById('formTitle');
    
    // Load previous students for quick add
    await loadPreviousStudents();
    
    // Load components with enhanced UI
    await loadComponentsMultiSelect();
    
    // Initialize team members list
    teamMembersList = [];
    renderTeamMembersChips();
    
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
                
                // Load team members
                if (result.data.TeamMembers) {
                    teamMembersList = result.data.TeamMembers.split(',').map(m => m.trim()).filter(m => m);
                    renderTeamMembersChips();
                }
                
                // Set selected components
                if (result.data.ComponentsUsed) {
                    const selectedComponents = result.data.ComponentsUsed.split(',').map(c => c.trim());
                    document.querySelectorAll('#componentsUsed input[type="checkbox"]').forEach(cb => {
                        if (selectedComponents.includes(cb.value)) {
                            cb.checked = true;
                        }
                    });
                    updateSelectedCount();
                    updateSelectedPreview();
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

async function loadPreviousStudents() {
    try {
        const result = await apiCall('getProjects');
        const projects = result.data || [];
        
        const students = new Set();
        projects.forEach(project => {
            if (project.TeamMembers) {
                const members = project.TeamMembers.split(',').map(m => m.trim()).filter(m => m);
                members.forEach(m => students.add(m));
            }
        });
        
        const container = document.getElementById('previousStudents');
        if (container && students.size > 0) {
            const studentsArray = Array.from(students).sort();
            container.innerHTML = studentsArray.slice(0, 15).map(student => `
                <button type="button" class="quick-add-chip" onclick="quickAddTeamMember('${escapeHtml(student)}')">
                    ➕ ${escapeHtml(student)}
                </button>
            `).join('');
            
            if (studentsArray.length > 15) {
                container.innerHTML += `<span class="more-items">+${studentsArray.length - 15} more</span>`;
            }
        } else if (container) {
            container.innerHTML = '<span class="no-previous">No previous students found</span>';
        }
    } catch (error) {
        console.error('Error loading previous students:', error);
    }
}

// Team Members Functions
function handleTeamMemberKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
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
        input.focus();
    } else if (teamMembersList.includes(name)) {
        showNotification('This team member is already added', 'error');
    }
}

function quickAddTeamMember(name) {
    if (!teamMembersList.includes(name)) {
        teamMembersList.push(name);
        renderTeamMembersChips();
        showNotification(`Added ${name} to team`);
    } else {
        showNotification(`${name} is already in the team`, 'error');
    }
}

function removeTeamMember(index) {
    const removed = teamMembersList.splice(index, 1)[0];
    renderTeamMembersChips();
    showNotification(`Removed ${removed} from team`);
}

function renderTeamMembersChips() {
    const container = document.getElementById('teamMembersChips');
    const hiddenInput = document.getElementById('teamMembers');
    
    if (teamMembersList.length === 0) {
        container.innerHTML = '';
    } else {
        container.innerHTML = teamMembersList.map((member, index) => `
            <span class="team-member-chip">
                <span class="chip-avatar">${getInitials(member)}</span>
                ${escapeHtml(member)}
                <button type="button" class="chip-remove" onclick="removeTeamMember(${index})" title="Remove">✕</button>
            </span>
        `).join('');
    }
    
    // Update hidden input
    hiddenInput.value = teamMembersList.join(', ');
}

// Components Multi-Select Functions (same as before)
async function loadComponentsMultiSelect() {
    try {
        const result = await apiCall('getComponents');
        const container = document.getElementById('componentsUsed');
        allProjectComponents = result.data || [];
        
        renderComponentsList(allProjectComponents);
        updateResultsCount(allProjectComponents.length, allProjectComponents.length);
        
    } catch (error) {
        console.error('Error loading components:', error);
        document.getElementById('componentsUsed').innerHTML = 
            '<p class="error-message">Failed to load components. Please refresh.</p>';
    }
}

function renderComponentsList(components, preserveSelections = true) {
    const container = document.getElementById('componentsUsed');
    
    let selectedIds = [];
    if (preserveSelections) {
        document.querySelectorAll('#componentsUsed input[type="checkbox"]:checked').forEach(cb => {
            selectedIds.push(cb.value);
        });
    }
    
    if (components && components.length > 0) {
        container.innerHTML = components.map(comp => {
            const isChecked = selectedIds.includes(comp.ComponentID) ? 'checked' : '';
            const quantity = parseInt(comp.Quantity) || 0;
            const qtyClass = quantity === 0 ? 'qty-zero' : quantity <= 5 ? 'qty-low' : 'qty-ok';
            const typeIcon = getTypeIcon(comp.Type);
            
            return `
                <label class="checkbox-label-enhanced" data-type="${(comp.Type || 'other').toLowerCase()}" data-name="${(comp.ComponentName || '').toLowerCase()}" data-id="${comp.ComponentID.toLowerCase()}">
                    <input type="checkbox" name="components" value="${comp.ComponentID}" ${isChecked} onchange="updateSelectedCount(); updateSelectedPreview();">
                    <span class="component-checkbox-content">
                        <span class="component-main">
                            <span class="component-icon">${typeIcon}</span>
                            <span class="component-details">
                                <span class="component-name">${comp.ComponentName}</span>
                                <span class="component-meta">
                                    <code>${comp.ComponentID}</code>
                                    <span class="component-type-badge">${comp.Type || 'Other'}</span>
                                </span>
                            </span>
                        </span>
                        <span class="component-qty ${qtyClass}">${quantity} in stock</span>
                    </span>
                </label>
            `;
        }).join('');
    } else {
        container.innerHTML = '<p class="no-data">No components found matching your search.</p>';
    }
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
        'connector': '🔗',
        'display': '📺',
        'power supply': '🔌',
        'battery': '🔋',
        'module': '📦',
        'board': '🎚️',
        'tool': '🛠️'
    };
    return icons[(type || '').toLowerCase()] || '📦';
}

function searchComponentsInForm(query) {
    const searchTerm = query.toLowerCase().trim();
    const labels = document.querySelectorAll('#componentsUsed .checkbox-label-enhanced');
    let visibleCount = 0;
    
    labels.forEach(label => {
        const name = label.dataset.name || '';
        const type = label.dataset.type || '';
        const id = label.dataset.id || '';
        
        const matchesSearch = !searchTerm || 
            name.includes(searchTerm) || 
            type.includes(searchTerm) || 
            id.includes(searchTerm);
        
        const matchesType = currentTypeFilter === 'all' || 
            (currentTypeFilter === 'other' && !['microcontroller', 'sensor', 'motor', 'led', 'module', 'wire'].includes(type)) ||
            type === currentTypeFilter.toLowerCase();
        
        if (matchesSearch && matchesType) {
            label.style.display = 'flex';
            visibleCount++;
        } else {
            label.style.display = 'none';
        }
    });
    
    updateResultsCount(visibleCount, allProjectComponents.length);
    
    const clearBtn = document.querySelector('.clear-search-btn');
    if (clearBtn) {
        clearBtn.style.display = searchTerm ? 'flex' : 'none';
    }
}

function clearComponentSearch() {
    const searchInput = document.getElementById('componentSearch');
    searchInput.value = '';
    searchComponentsInForm('');
    searchInput.focus();
}

function filterByType(type) {
    currentTypeFilter = type;
    
    document.querySelectorAll('.quick-filters .filter-chip').forEach(chip => {
        chip.classList.remove('active');
    });
    event.target.classList.add('active');
    
    const searchTerm = document.getElementById('componentSearch').value;
    searchComponentsInForm(searchTerm);
}

function selectAllVisible() {
    const visibleLabels = document.querySelectorAll('#componentsUsed .checkbox-label-enhanced');
    let count = 0;
    
    visibleLabels.forEach(label => {
        if (label.style.display !== 'none') {
            const checkbox = label.querySelector('input[type="checkbox"]');
            if (checkbox && !checkbox.checked) {
                checkbox.checked = true;
                count++;
            }
        }
    });
    
    updateSelectedCount();
    updateSelectedPreview();
    showNotification(`Selected ${count} components`);
}

function deselectAll() {
    document.querySelectorAll('#componentsUsed input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    updateSelectedCount();
    updateSelectedPreview();
    showNotification('All components deselected');
}

function updateSelectedCount() {
    const selected = document.querySelectorAll('#componentsUsed input[type="checkbox"]:checked').length;
    const countEl = document.getElementById('selectedCount');
    if (countEl) {
        countEl.textContent = `(${selected} selected)`;
        countEl.className = selected > 0 ? 'selected-count has-selection' : 'selected-count';
    }
}

function updateResultsCount(visible, total) {
    const countEl = document.getElementById('resultsCount');
    if (countEl) {
        if (visible === total) {
            countEl.textContent = `${total} components`;
        } else {
            countEl.textContent = `${visible} of ${total} components`;
        }
    }
}

function updateSelectedPreview() {
    const selectedCheckboxes = document.querySelectorAll('#componentsUsed input[type="checkbox"]:checked');
    const previewContainer = document.getElementById('selectedChips');
    
    if (selectedCheckboxes.length === 0) {
        previewContainer.innerHTML = '<span class="no-selection">No components selected</span>';
        return;
    }
    
    let chipsHtml = '';
    selectedCheckboxes.forEach(cb => {
        const label = cb.closest('.checkbox-label-enhanced');
        const name = label.querySelector('.component-name').textContent;
        const id = cb.value;
        
        chipsHtml += `
            <span class="selected-chip">
                ${name}
                <button type="button" class="chip-remove" onclick="removeComponent('${id}')" title="Remove">✕</button>
            </span>
        `;
    });
    
    previewContainer.innerHTML = chipsHtml;
}

function removeComponent(componentId) {
    const checkbox = document.querySelector(`#componentsUsed input[value="${componentId}"]`);
    if (checkbox) {
        checkbox.checked = false;
        updateSelectedCount();
        updateSelectedPreview();
    }
}

// Save Project
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
        ComponentsUsed: selectedComponents,
        TeamMembers: teamMembersList.join(', ')
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
// COMPONENTS MODULE (Fixed)
// =====================================================

let allComponents = [];
let parsedExcelData = [];
let columnMapping = {};
let excelHeaders = [];
let currentQuantityComponentId = null;

async function loadComponents() {
    showLoading();
    try {
        const result = await apiCall('getComponents');
        allComponents = result.data || [];
        
        updateComponentStats();
        renderComponentsTable(allComponents);
    } catch (error) {
        console.error('Error loading components:', error);
    }
    hideLoading();
}

function updateComponentStats() {
    const total = allComponents.length;
    const inStock = allComponents.filter(c => (parseInt(c.Quantity) || 0) > 5).length;
    const lowStock = allComponents.filter(c => {
        const qty = parseInt(c.Quantity) || 0;
        return qty > 0 && qty <= 5;
    }).length;
    const outOfStock = allComponents.filter(c => (parseInt(c.Quantity) || 0) === 0).length;
    
    const totalEl = document.getElementById('totalComponents');
    const inStockEl = document.getElementById('inStockCount');
    const lowStockEl = document.getElementById('lowStockCount');
    const outOfStockEl = document.getElementById('outOfStockCount');
    
    if (totalEl) totalEl.textContent = total;
    if (inStockEl) inStockEl.textContent = inStock;
    if (lowStockEl) lowStockEl.textContent = lowStock;
    if (outOfStockEl) outOfStockEl.textContent = outOfStock;
}

function renderComponentsTable(components) {
    const tbody = document.getElementById('componentsTableBody');
    tbody.innerHTML = '';
    
    if (components && components.length > 0) {
        components.forEach(component => {
            const quantity = parseInt(component.Quantity) || 0;
            let quantityClass = 'qty-ok';
            if (quantity === 0) quantityClass = 'qty-zero';
            else if (quantity <= 5) quantityClass = 'qty-low';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><code>${component.ComponentID}</code></td>
                <td><strong>${component.ComponentName || ''}</strong></td>
                <td><span class="type-badge">${component.Type || '-'}</span></td>
                <td>${component.Description ? component.Description.substring(0, 40) + '...' : '-'}</td>
                <td>
                    <span class="quantity-badge ${quantityClass}" onclick="openQuantityModal('${component.ComponentID}', '${escapeHtml(component.ComponentName)}', ${quantity})">
                        ${quantity}
                        <span class="qty-edit-icon">✏️</span>
                    </span>
                </td>
                <td class="actions">
                    <button class="btn btn-sm btn-primary" onclick="editComponent('${component.ComponentID}')">✏️ Edit</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">No components found</td></tr>';
    }
}

function searchComponents() {
    const query = document.getElementById('searchComponents').value.toLowerCase();
    const filtered = allComponents.filter(c => 
        (c.ComponentName || '').toLowerCase().includes(query) ||
        (c.ComponentID || '').toLowerCase().includes(query) ||
        (c.Type || '').toLowerCase().includes(query) ||
        (c.Description || '').toLowerCase().includes(query)
    );
    renderComponentsTable(filtered);
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
                document.getElementById('quantity').value = parseInt(result.data.Quantity) || 0;
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

// Quantity Modal
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
        const result = await apiCall('updateComponentQuantity', { 
            id: currentQuantityComponentId, 
            quantity: newQuantity 
        });
        
        if (result.success) {
            showNotification('Quantity updated successfully!');
            closeQuantityModal();
            
            // Update local data and re-render
            const component = allComponents.find(c => c.ComponentID === currentQuantityComponentId);
            if (component) {
                component.Quantity = newQuantity;
            }
            updateComponentStats();
            renderComponentsTable(allComponents);
        }
    } catch (error) {
        console.error('Error updating quantity:', error);
    }
    hideLoading();
}

// Excel Import Functions
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
    if (file) handleExcelFile(file);
}

function handleExcelFile(file) {
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
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            if (jsonData.length < 2) {
                showNotification('Excel file is empty or has no data rows', 'error');
                hideLoading();
                return;
            }
            
            processExcelData(jsonData);
            hideLoading();
        } catch (error) {
            console.error('Error parsing Excel:', error);
            showNotification('Error parsing Excel file', 'error');
            hideLoading();
        }
    };
    
    reader.readAsArrayBuffer(file);
}

function processExcelData(jsonData) {
    excelHeaders = jsonData[0].map(h => (h || '').toString().trim());
    const dataRows = jsonData.slice(1).filter(row => row.some(cell => cell !== null && cell !== ''));
    
    columnMapping = autoDetectColumns(excelHeaders);
    
    parsedExcelData = dataRows.map(row => {
        const obj = {};
        excelHeaders.forEach((header, index) => {
            obj[header] = row[index] !== undefined ? row[index] : '';
        });
        return obj;
    });
    
    showPreview();
}

function autoDetectColumns(headers) {
    const mapping = { ComponentName: null, Type: null, Description: null, Quantity: null };
    
    const patterns = {
        ComponentName: [/^name$/i, /component\s*name/i, /^item$/i, /item\s*name/i, /product/i, /^component$/i, /^part$/i, /material/i],
        Type: [/^type$/i, /^category$/i, /^kind$/i, /^class$/i, /^group$/i],
        Description: [/^description$/i, /^details$/i, /^info$/i, /^notes$/i, /^spec/i],
        Quantity: [/^qty$/i, /^quantity$/i, /^count$/i, /^stock$/i, /^amount$/i, /^number$/i, /^units$/i]
    };
    
    headers.forEach((header, index) => {
        for (const [field, fieldPatterns] of Object.entries(patterns)) {
            if (mapping[field] === null) {
                for (const pattern of fieldPatterns) {
                    if (pattern.test(header)) {
                        mapping[field] = index;
                        break;
                    }
                }
            }
        }
    });
    
    if (mapping.ComponentName === null) mapping.ComponentName = 0;
    
    return mapping;
}

function showPreview() {
    document.getElementById('previewSection').style.display = 'block';
    document.getElementById('rowCount').textContent = `${parsedExcelData.length} rows`;
    document.getElementById('importCount').textContent = parsedExcelData.length;
    
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
                ${excelHeaders.map((h, i) => `<option value="${i}" ${columnMapping[field] === i ? 'selected' : ''}>${h || `Column ${i+1}`}</option>`).join('')}
            </select>
        `;
        mappingGrid.appendChild(div);
    });
    
    updatePreview();
}

function updatePreview() {
    columnMapping.ComponentName = parseInt(document.getElementById('map_ComponentName').value);
    columnMapping.Type = parseInt(document.getElementById('map_Type').value);
    columnMapping.Description = parseInt(document.getElementById('map_Description').value);
    columnMapping.Quantity = parseInt(document.getElementById('map_Quantity').value);
    
    const thead = document.getElementById('previewHead');
    const tbody = document.getElementById('previewBody');
    
    thead.innerHTML = '<tr><th>#</th><th>Component Name</th><th>Type</th><th>Description</th><th>Quantity</th></tr>';
    tbody.innerHTML = '';
    
    parsedExcelData.slice(0, 10).forEach((row, index) => {
        const name = getMappedValue(row, 'ComponentName');
        const type = getMappedValue(row, 'Type');
        const desc = getMappedValue(row, 'Description');
        const qty = getMappedValue(row, 'Quantity');
        
        const tr = document.createElement('tr');
        if (!name) tr.classList.add('row-warning');
        
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${name || '<em class="text-muted">Empty</em>'}</td>
            <td>${type || '-'}</td>
            <td>${desc ? (desc.length > 30 ? desc.substring(0, 30) + '...' : desc) : '-'}</td>
            <td>${qty || 0}</td>
        `;
        tbody.appendChild(tr);
    });
    
    if (parsedExcelData.length > 10) {
        tbody.innerHTML += `<tr class="more-rows"><td colspan="5">... and ${parsedExcelData.length - 10} more rows</td></tr>`;
    }
}

function getMappedValue(row, field) {
    const colIndex = columnMapping[field];
    if (colIndex === -1 || colIndex === null) return '';
    const header = excelHeaders[colIndex];
    const value = row[header];
    return value !== undefined && value !== null ? String(value).trim() : '';
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
    
    const components = parsedExcelData.map(row => ({
        ComponentName: getMappedValue(row, 'ComponentName'),
        Type: getMappedValue(row, 'Type'),
        Description: getMappedValue(row, 'Description'),
        Quantity: parseInt(getMappedValue(row, 'Quantity')) || 0
    })).filter(c => c.ComponentName);
    
    if (components.length === 0) {
        showNotification('No valid components found', 'error');
        return;
    }
    
    if (!confirm(`Import ${components.length} components?`)) return;
    
    showLoading();
    try {
        const result = await apiCall('bulkAddComponents', { data: components });
        showNotification(`Successfully imported ${result.addedCount} components!`);
        closeExcelUpload();
        loadComponents();
    } catch (error) {
        console.error('Error importing:', error);
    }
    hideLoading();
}

// =====================================================
// COMPETITIONS MODULE (Updated with Results & Calendar)
// =====================================================

let allCompetitions = [];
let currentResultEventId = null;

async function loadCompetitions() {
    showLoading();
    try {
        const result = await apiCall('getCompetitions');
        allCompetitions = result.data || [];
        
        updateCompetitionStats();
        renderCompetitionsTable(allCompetitions);
        renderCalendarView(allCompetitions);
    } catch (error) {
        console.error('Error loading competitions:', error);
    }
    hideLoading();
}

function updateCompetitionStats() {
    const now = new Date();
    
    const upcoming = allCompetitions.filter(c => {
        const status = (c.Status || '').toLowerCase();
        return status === 'upcoming' || (new Date(c.Date) > now && status !== 'completed' && status !== 'cancelled');
    }).length;
    
    const ongoing = allCompetitions.filter(c => (c.Status || '').toLowerCase() === 'ongoing').length;
    const completed = allCompetitions.filter(c => (c.Status || '').toLowerCase() === 'completed').length;
    
    const wins = allCompetitions.filter(c => {
        const pos = (c.Position || '').toLowerCase();
        return pos.includes('1st') || pos.includes('2nd') || pos.includes('3rd') || pos.includes('first') || pos.includes('second') || pos.includes('third');
    }).length;
    
    const upcomingEl = document.getElementById('upcomingCount');
    const ongoingEl = document.getElementById('ongoingCount');
    const completedEl = document.getElementById('completedCount');
    const winsEl = document.getElementById('winsCount');
    
    if (upcomingEl) upcomingEl.textContent = upcoming;
    if (ongoingEl) ongoingEl.textContent = ongoing;
    if (completedEl) completedEl.textContent = completed;
    if (winsEl) winsEl.textContent = wins;
}

function renderCompetitionsTable(competitions) {
    const tbody = document.getElementById('competitionsTableBody');
    tbody.innerHTML = '';
    
    if (competitions && competitions.length > 0) {
        competitions.forEach(comp => {
            const status = comp.Status || 'Upcoming';
            const statusClass = status.toLowerCase();
            const position = comp.Position || '';
            
            let positionBadge = '';
            if (position) {
                let posClass = 'position-other';
                if (position.includes('1st')) posClass = 'position-gold';
                else if (position.includes('2nd')) posClass = 'position-silver';
                else if (position.includes('3rd')) posClass = 'position-bronze';
                positionBadge = `<span class="position-badge ${posClass}">${position}</span>`;
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><code>${comp.EventID}</code></td>
                <td><strong>${comp.EventName}</strong></td>
                <td>${formatDate(comp.Date)}${comp.EndDate ? ' - ' + formatDate(comp.EndDate) : ''}</td>
                <td>${comp.Location || '-'}</td>
                <td><span class="status-badge status-${statusClass}">${status}</span></td>
                <td>${positionBadge || (comp.Result ? comp.Result.substring(0, 20) + '...' : '-')}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-info" onclick="openResultModal('${comp.EventID}')" title="Update Result">🏆</button>
                    <button class="btn btn-sm btn-success" onclick="addToCalendar('${comp.EventID}')" title="Add to Calendar">📅</button>
                    <button class="btn btn-sm btn-primary" onclick="editCompetition('${comp.EventID}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCompetition('${comp.EventID}')">🗑️</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No competitions found</td></tr>';
    }
}

function renderCalendarView(competitions) {
    const calendarView = document.getElementById('calendarView');
    if (!calendarView) return;
    
    calendarView.innerHTML = '';
    
    if (competitions && competitions.length > 0) {
        competitions.forEach(comp => {
            const eventDate = new Date(comp.Date);
            const now = new Date();
            const isPast = eventDate < now;
            const status = (comp.Status || 'Upcoming').toLowerCase();
            
            let cardClass = 'upcoming';
            if (status === 'completed') cardClass = 'completed';
            else if (status === 'ongoing') cardClass = 'ongoing';
            else if (isPast) cardClass = 'past';
            
            const card = document.createElement('div');
            card.className = `calendar-card ${cardClass}`;
            card.innerHTML = `
                <div class="calendar-date">
                    <span class="month">${eventDate.toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span class="day">${eventDate.getDate()}</span>
                    <span class="year">${eventDate.getFullYear()}</span>
                </div>
                <div class="calendar-details">
                    <div class="calendar-status">
                        <span class="status-badge status-${status}">${comp.Status || 'Upcoming'}</span>
                        ${comp.Position ? `<span class="position-badge">${comp.Position}</span>` : ''}
                    </div>
                    <h4>${comp.EventName}</h4>
                    <p><span class="icon">📍</span> ${comp.Location || 'TBD'}</p>
                    ${comp.Participants ? `<p><span class="icon">👥</span> ${comp.Participants}</p>` : ''}
                    <div class="calendar-actions">
                        <button class="btn btn-sm btn-success" onclick="addToCalendar('${comp.EventID}')">📅 Add to Calendar</button>
                        <button class="btn btn-sm btn-info" onclick="openResultModal('${comp.EventID}')">🏆 Result</button>
                    </div>
                </div>
            `;
            calendarView.appendChild(card);
        });
    } else {
        calendarView.innerHTML = '<p class="no-data">No competitions scheduled</p>';
    }
}

function filterCompetitions(filter) {
    document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    
    let filtered = allCompetitions;
    
    if (filter !== 'all') {
        filtered = allCompetitions.filter(c => {
            const status = (c.Status || 'upcoming').toLowerCase();
            return status === filter;
        });
    }
    
    renderCompetitionsTable(filtered);
    renderCalendarView(filtered);
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
                document.getElementById('endDate').value = result.data.EndDate || '';
                document.getElementById('location').value = result.data.Location || '';
                document.getElementById('details').value = result.data.Details || '';
                document.getElementById('status').value = result.data.Status || 'Upcoming';
                document.getElementById('result').value = result.data.Result || '';
                document.getElementById('position').value = result.data.Position || '';
                document.getElementById('participants').value = result.data.Participants || '';
                document.getElementById('notes').value = result.data.Notes || '';
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
        EndDate: document.getElementById('endDate').value,
        Location: document.getElementById('location').value,
        Details: document.getElementById('details').value,
        Status: document.getElementById('status').value,
        Result: document.getElementById('result').value,
        Position: document.getElementById('position').value,
        Participants: document.getElementById('participants').value,
        Notes: document.getElementById('notes').value
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
    if (confirm('Are you sure you want to delete this competition?')) {
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

// Result Modal
function openResultModal(eventId) {
    currentResultEventId = eventId;
    const competition = allCompetitions.find(c => c.EventID === eventId);
    
    if (competition) {
        document.getElementById('resultEventName').textContent = competition.EventName;
        document.getElementById('resultStatus').value = competition.Status || 'Upcoming';
        document.getElementById('resultPosition').value = competition.Position || '';
        document.getElementById('resultDetails').value = competition.Result || '';
        document.getElementById('resultNotes').value = competition.Notes || '';
    }
    
    document.getElementById('resultModal').classList.add('show');
}

function closeResultModal() {
    document.getElementById('resultModal').classList.remove('show');
    currentResultEventId = null;
}

async function saveResult() {
    if (!currentResultEventId) return;
    
    const resultData = {
        Status: document.getElementById('resultStatus').value,
        Position: document.getElementById('resultPosition').value,
        Result: document.getElementById('resultDetails').value,
        Notes: document.getElementById('resultNotes').value
    };
    
    showLoading();
    try {
        await apiCall('updateCompetitionResult', { id: currentResultEventId, data: resultData });
        showNotification('Result updated successfully!');
        closeResultModal();
        loadCompetitions();
    } catch (error) {
        console.error('Error updating result:', error);
    }
    hideLoading();
}

// Google Calendar Integration
function addToCalendar(eventId) {
    const competition = allCompetitions.find(c => c.EventID === eventId);
    if (!competition) return;
    
    const title = encodeURIComponent(competition.EventName);
    const startDate = competition.Date.replace(/-/g, '');
    const endDate = competition.EndDate ? competition.EndDate.replace(/-/g, '') : startDate;
    const location = encodeURIComponent(competition.Location || '');
    const details = encodeURIComponent(
        `${competition.Details || ''}\n\nParticipants: ${competition.Participants || 'TBD'}\n\nManaged via ATL Dashboard`
    );
    
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&location=${location}&details=${details}`;
    
    window.open(calendarUrl, '_blank');
    showNotification('Opening Google Calendar...');
}

function addToGoogleCalendar() {
    const eventName = document.getElementById('eventName').value;
    const startDate = document.getElementById('eventDate').value;
    const endDate = document.getElementById('endDate').value || startDate;
    const location = document.getElementById('location').value;
    const details = document.getElementById('details').value;
    
    if (!eventName || !startDate) {
        showNotification('Please fill in Event Name and Date first', 'error');
        return;
    }
    
    const title = encodeURIComponent(eventName);
    const start = startDate.replace(/-/g, '');
    const end = endDate.replace(/-/g, '');
    const loc = encodeURIComponent(location || '');
    const desc = encodeURIComponent(details || 'Added from ATL Dashboard');
    
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&location=${loc}&details=${desc}`;
    
    window.open(calendarUrl, '_blank');
    showNotification('Opening Google Calendar...');
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
                const statusClass = (order.Status || 'ordered').toLowerCase();
                row.innerHTML = `
                    <td><code>${order.OrderID}</code></td>
                    <td>${order.ComponentID}</td>
                    <td><strong>${order.ComponentName}</strong></td>
                    <td>${order.Quantity}</td>
                    <td>${order.Vendor || '-'}</td>
                    <td>${formatDate(order.OrderDate)}</td>
                    <td>${formatDate(order.ExpectedDelivery)}</td>
                    <td><span class="status-badge status-${statusClass}">${order.Status || 'Ordered'}</span></td>
                    <td class="actions">
                        <button class="btn btn-sm btn-primary" onclick="editOrder('${order.OrderID}')">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteOrder('${order.OrderID}')">🗑️</button>
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
    
    if (!orderId) {
        document.getElementById('orderDate').value = new Date().toISOString().split('T')[0];
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
        console.error('Error loading components:', error);
    }
}

function loadStatusDropdown() {
    const select = document.getElementById('status');
    select.innerHTML = ORDER_STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('');
}

function onComponentChange() {
    const select = document.getElementById('componentId');
    const nameInput = document.getElementById('componentName');
    const selectedOption = select.options[select.selectedIndex];
    nameInput.value = selectedOption && selectedOption.dataset.name ? selectedOption.dataset.name : '';
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
    if (confirm('Are you sure you want to delete this order?')) {
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
