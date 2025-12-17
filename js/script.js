// =====================================================
// script.js - ATL Dashboard Complete
// With Component Quantity Selection
// =====================================================

// =====================================================
// API HELPER FUNCTIONS
// =====================================================

async function apiCall(action, params = {}) {
    try {
        if (DEBUG_MODE) console.log('📡 API Call:', action, params);
        
        const url = new URL(API_URL);
        url.searchParams.append('action', action);
        
        for (const [key, value] of Object.entries(params)) {
            if (typeof value === 'object') {
                url.searchParams.append(key, JSON.stringify(value));
            } else {
                url.searchParams.append(key, value);
            }
        }
        
        if (DEBUG_MODE) console.log('🔗 URL:', url.toString());
        
        const response = await fetch(url.toString());
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        if (DEBUG_MODE) console.log('📥 Response:', text.substring(0, 200));
        
        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.error('❌ JSON Parse Error:', e);
            throw new Error('Invalid JSON response from server');
        }
        
        if (!result.success && result.error) {
            throw new Error(result.error);
        }
        
        if (DEBUG_MODE) console.log('✅ Result:', result);
        return result;
        
    } catch (error) {
        console.error('❌ API Error:', error);
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
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${type === 'success' ? '✅' : '❌'} ${message}</span>
        <button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;margin-left:10px;">✕</button>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function showError(message) {
    const errorContainer = document.getElementById('errorContainer');
    const errorMessage = document.getElementById('errorMessage');
    
    if (errorContainer && errorMessage) {
        errorMessage.textContent = message;
        errorContainer.style.display = 'block';
    }
}

function hideError() {
    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
        errorContainer.style.display = 'none';
    }
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
    };
    return icons[(type || '').toLowerCase()] || '📦';
}

// =====================================================
// PROJECTS MODULE
// =====================================================

let allProjects = [];
let allProjectComponents = [];
let selectedProjectComponents = {}; // { componentId: { ...componentData, quantity: number } }
let teamMembersList = [];
let currentTypeFilter = 'all';

// Load Projects List
async function loadProjects() {
    showLoading();
    hideError();
    
    try {
        console.log('📥 Loading projects...');
        const result = await apiCall('getProjects');
        allProjects = result.data || [];
        
        console.log(`✅ Loaded ${allProjects.length} projects`);
        
        updateProjectStats();
        renderProjectsList(allProjects);
        
    } catch (error) {
        console.error('❌ Error loading projects:', error);
        showError('Failed to load projects: ' + error.message);
        
        document.getElementById('projectsContainer').innerHTML = `
            <div class="error-state">
                <div class="error-icon">❌</div>
                <h3>Failed to Load Projects</h3>
                <p>${error.message}</p>
                <button onclick="loadProjects()" class="btn btn-primary">🔄 Retry</button>
            </div>
        `;
    }
    
    hideLoading();
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
    
    // Count total component usage
    let totalComponentUsage = 0;
    allProjects.forEach(project => {
        if (project.ComponentsUsed) {
            const parts = project.ComponentsUsed.split(',').filter(p => p.trim());
            parts.forEach(part => {
                const [id, qty] = part.split(':');
                totalComponentUsage += parseInt(qty) || 1;
            });
        }
    });
    
    const totalProjectsEl = document.getElementById('totalProjects');
    const totalStudentsEl = document.getElementById('totalStudents');
    const totalComponentsEl = document.getElementById('totalComponentsUsed');
    
    if (totalProjectsEl) totalProjectsEl.textContent = totalProjects;
    if (totalStudentsEl) totalStudentsEl.textContent = allStudents.size;
    if (totalComponentsEl) totalComponentsEl.textContent = totalComponentUsage;
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
    
    container.innerHTML = `
        <div class="projects-grid">
            ${projects.map(project => createProjectCard(project)).join('')}
        </div>
    `;
}

function createProjectCard(project) {
    const teamMembers = project.TeamMembers ? 
        project.TeamMembers.split(',').map(m => m.trim()).filter(m => m) : [];
    
    // Parse components with quantities
    const componentsData = parseComponentsUsed(project.ComponentsUsed);
    
    const teamMembersHtml = teamMembers.length > 0 ? `
        <div class="project-team">
            <span class="team-label">👥 Team:</span>
            <div class="team-avatars">
                ${teamMembers.slice(0, 4).map(member => `
                    <span class="team-avatar" title="${escapeHtml(member)}">${getInitials(member)}</span>
                `).join('')}
                ${teamMembers.length > 4 ? `<span class="team-more">+${teamMembers.length - 4}</span>` : ''}
            </div>
            <span class="team-names">${teamMembers.join(', ')}</span>
        </div>
    ` : '';
    
    const componentsHtml = componentsData.length > 0 ? `
        <div class="project-components">
            <span class="components-label">⚙️ Components:</span>
            <div class="component-tags">
                ${componentsData.slice(0, 3).map(comp => `
                    <span class="component-tag">${comp.id} <strong>×${comp.quantity}</strong></span>
                `).join('')}
                ${componentsData.length > 3 ? `<span class="component-tag more">+${componentsData.length - 3} more</span>` : ''}
            </div>
        </div>
    ` : '';
    
    return `
        <div class="project-card" onclick="viewProject('${project.ProjectID}')">
            <div class="project-card-header">
                <code class="project-id">${project.ProjectID}</code>
                <span class="project-date">${formatDate(project.LastUpdated)}</span>
            </div>
            
            <h3 class="project-title">${escapeHtml(project.ProjectName) || 'Untitled Project'}</h3>
            
            ${project.Overview ? `
                <p class="project-overview">${escapeHtml(project.Overview).substring(0, 120)}${project.Overview.length > 120 ? '...' : ''}</p>
            ` : ''}
            
            ${teamMembersHtml}
            ${componentsHtml}
            
            <div class="project-card-actions" onclick="event.stopPropagation()">
                <button class="btn btn-sm btn-primary" onclick="editProject('${project.ProjectID}')">✏️ Edit</button>
                <button class="btn btn-sm btn-info" onclick="viewProject('${project.ProjectID}')">👁️ View</button>
                <button class="btn btn-sm btn-danger" onclick="deleteProject('${project.ProjectID}')">🗑️ Delete</button>
            </div>
        </div>
    `;
}

function parseComponentsUsed(componentsStr) {
    if (!componentsStr) return [];
    
    const result = [];
    const parts = componentsStr.split(',').map(p => p.trim()).filter(p => p);
    
    parts.forEach(part => {
        if (part.includes(':')) {
            const [id, qty] = part.split(':');
            result.push({ id: id.trim(), quantity: parseInt(qty) || 1 });
        } else {
            result.push({ id: part.trim(), quantity: 1 });
        }
    });
    
    return result;
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
        const id = (project.ProjectID || '').toLowerCase();
        
        return name.includes(query) || overview.includes(query) || team.includes(query) || id.includes(query);
    });
    
    renderProjectsList(filtered);
}

function viewProject(projectId) {
    const project = allProjects.find(p => p.ProjectID === projectId);
    if (!project) return;
    
    const teamMembers = project.TeamMembers ? 
        project.TeamMembers.split(',').map(m => m.trim()).filter(m => m) : [];
    
    const componentsData = parseComponentsUsed(project.ComponentsUsed);
    
    document.getElementById('modalProjectName').textContent = project.ProjectName || 'Untitled Project';
    
    document.getElementById('modalProjectBody').innerHTML = `
        <div class="project-detail">
            <div class="detail-section">
                <h4>📋 Overview</h4>
                <p>${project.Overview ? escapeHtml(project.Overview) : '<em>No overview provided</em>'}</p>
            </div>
            
            <div class="detail-section">
                <h4>👥 Team Members (${teamMembers.length})</h4>
                ${teamMembers.length > 0 ? `
                    <div class="team-list-detailed">
                        ${teamMembers.map(member => `
                            <div class="team-member-item">
                                <span class="team-avatar">${getInitials(member)}</span>
                                <span>${escapeHtml(member)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p><em>No team members assigned</em></p>'}
            </div>
            
            <div class="detail-section">
                <h4>⚙️ Components Used (${componentsData.length} types)</h4>
                ${componentsData.length > 0 ? `
                    <table class="mini-table">
                        <thead>
                            <tr>
                                <th>Component ID</th>
                                <th>Quantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${componentsData.map(comp => `
                                <tr>
                                    <td><code>${comp.id}</code></td>
                                    <td><strong>${comp.quantity}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
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

function editProject(id) {
    window.location.href = `project_form.html?id=${id}`;
}

async function deleteProject(id) {
    if (!confirm('Are you sure you want to delete this project?')) return;
    
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

// =====================================================
// PROJECT FORM FUNCTIONS
// =====================================================

async function loadProjectForm() {
    const projectId = getUrlParam('id');
    const formTitle = document.getElementById('formTitle');
    
    // Initialize
    selectedProjectComponents = {};
    teamMembersList = [];
    
    // Load components
    await loadComponentsForSelection();
    
    // Load previous students
    await loadPreviousStudents();
    
    // Render empty team members
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
                
                // Load selected components with quantities
                if (result.data.ComponentsUsed) {
                    const componentsData = parseComponentsUsed(result.data.ComponentsUsed);
                    componentsData.forEach(comp => {
                        const fullComponent = allProjectComponents.find(c => c.ComponentID === comp.id);
                        if (fullComponent) {
                            selectedProjectComponents[comp.id] = {
                                ...fullComponent,
                                selectedQuantity: comp.quantity
                            };
                        }
                    });
                    renderSelectedComponents();
                    updateSelectedCount();
                }
            }
        } catch (error) {
            console.error('Error loading project:', error);
            showNotification('Failed to load project', 'error');
        }
        
        hideLoading();
    } else {
        formTitle.textContent = 'Add New Project';
    }
}

async function loadComponentsForSelection() {
    try {
        const result = await apiCall('getComponents');
        allProjectComponents = result.data || [];
        
        renderAvailableComponents(allProjectComponents);
        
    } catch (error) {
        console.error('Error loading components:', error);
        document.getElementById('availableComponentsList').innerHTML = `
            <div class="error-message">Failed to load components</div>
        `;
    }
}

function renderAvailableComponents(components) {
    const container = document.getElementById('availableComponentsList');
    
    if (!components || components.length === 0) {
        container.innerHTML = '<div class="no-data">No components available</div>';
        return;
    }
    
    container.innerHTML = components.map(comp => {
        const isSelected = selectedProjectComponents.hasOwnProperty(comp.ComponentID);
        const quantity = parseInt(comp.Quantity) || 0;
        const qtyClass = quantity === 0 ? 'qty-zero' : quantity <= 5 ? 'qty-low' : 'qty-ok';
        
        return `
            <div class="component-item ${isSelected ? 'selected' : ''}" 
                 data-id="${comp.ComponentID}"
                 data-type="${(comp.Type || '').toLowerCase()}"
                 data-name="${(comp.ComponentName || '').toLowerCase()}"
                 onclick="toggleComponent('${comp.ComponentID}')">
                <div class="component-item-main">
                    <span class="component-icon">${getTypeIcon(comp.Type)}</span>
                    <div class="component-info">
                        <span class="component-name">${comp.ComponentName}</span>
                        <span class="component-meta">
                            <code>${comp.ComponentID}</code>
                            <span class="type-badge">${comp.Type || 'Other'}</span>
                        </span>
                    </div>
                </div>
                <div class="component-stock ${qtyClass}">
                    ${quantity} in stock
                </div>
                <div class="component-add-btn">
                    ${isSelected ? '✓' : '+'}
                </div>
            </div>
        `;
    }).join('');
}

function toggleComponent(componentId) {
    if (selectedProjectComponents.hasOwnProperty(componentId)) {
        // Remove from selection
        delete selectedProjectComponents[componentId];
    } else {
        // Add to selection
        const component = allProjectComponents.find(c => c.ComponentID === componentId);
        if (component) {
            selectedProjectComponents[componentId] = {
                ...component,
                selectedQuantity: 1
            };
        }
    }
    
    // Re-render both lists
    const searchTerm = document.getElementById('componentSearch')?.value || '';
    searchComponentsInForm(searchTerm);
    renderSelectedComponents();
    updateSelectedCount();
}

function renderSelectedComponents() {
    const container = document.getElementById('selectedComponentsList');
    const keys = Object.keys(selectedProjectComponents);
    
    if (keys.length === 0) {
        container.innerHTML = `
            <div class="no-selection-message">
                <span>👈</span> Click components to add them
            </div>
        `;
        document.getElementById('selectedTotal').textContent = '(0 total)';
        return;
    }
    
    let totalQty = 0;
    
    container.innerHTML = keys.map(id => {
        const comp = selectedProjectComponents[id];
        const qty = comp.selectedQuantity || 1;
        totalQty += qty;
        const stockQty = parseInt(comp.Quantity) || 0;
        const isOverStock = qty > stockQty;
        
        return `
            <div class="selected-component-item">
                <div class="selected-component-info">
                    <span class="component-icon">${getTypeIcon(comp.Type)}</span>
                    <div>
                        <div class="component-name">${comp.ComponentName}</div>
                        <code>${comp.ComponentID}</code>
                        <span class="stock-info ${isOverStock ? 'over-stock' : ''}">(${stockQty} available)</span>
                    </div>
                </div>
                <div class="quantity-control">
                    <button type="button" class="qty-btn" onclick="changeComponentQty('${id}', -1)">−</button>
                    <input type="number" class="qty-input" value="${qty}" min="1" 
                           onchange="setComponentQty('${id}', this.value)">
                    <button type="button" class="qty-btn" onclick="changeComponentQty('${id}', 1)">+</button>
                </div>
                <button type="button" class="remove-btn" onclick="removeComponent('${id}')" title="Remove">✕</button>
            </div>
        `;
    }).join('');
    
    document.getElementById('selectedTotal').textContent = `(${totalQty} total)`;
}

function changeComponentQty(componentId, delta) {
    if (!selectedProjectComponents[componentId]) return;
    
    const current = selectedProjectComponents[componentId].selectedQuantity || 1;
    const newQty = Math.max(1, current + delta);
    selectedProjectComponents[componentId].selectedQuantity = newQty;
    
    renderSelectedComponents();
}

function setComponentQty(componentId, value) {
    if (!selectedProjectComponents[componentId]) return;
    
    const qty = Math.max(1, parseInt(value) || 1);
    selectedProjectComponents[componentId].selectedQuantity = qty;
    
    renderSelectedComponents();
}

function removeComponent(componentId) {
    delete selectedProjectComponents[componentId];
    
    const searchTerm = document.getElementById('componentSearch')?.value || '';
    searchComponentsInForm(searchTerm);
    renderSelectedComponents();
    updateSelectedCount();
}

function updateSelectedCount() {
    const count = Object.keys(selectedProjectComponents).length;
    const countEl = document.getElementById('selectedCount');
    if (countEl) {
        countEl.textContent = `(${count} component${count !== 1 ? 's' : ''})`;
        countEl.className = count > 0 ? 'selected-count has-selection' : 'selected-count';
    }
}

function searchComponentsInForm(query) {
    const searchTerm = query.toLowerCase().trim();
    const items = document.querySelectorAll('#availableComponentsList .component-item');
    
    items.forEach(item => {
        const name = item.dataset.name || '';
        const type = item.dataset.type || '';
        const id = item.dataset.id?.toLowerCase() || '';
        
        const matchesSearch = !searchTerm || 
            name.includes(searchTerm) || 
            type.includes(searchTerm) || 
            id.includes(searchTerm);
        
        const matchesType = currentTypeFilter === 'all' || 
            type === currentTypeFilter.toLowerCase();
        
        item.style.display = (matchesSearch && matchesType) ? 'flex' : 'none';
    });
    
    // Show/hide clear button
    const clearBtn = document.querySelector('.clear-search-btn');
    if (clearBtn) {
        clearBtn.style.display = searchTerm ? 'flex' : 'none';
    }
}

function clearComponentSearch() {
    const input = document.getElementById('componentSearch');
    if (input) {
        input.value = '';
        searchComponentsInForm('');
        input.focus();
    }
}

function filterByType(type) {
    currentTypeFilter = type;
    
    document.querySelectorAll('.quick-filters .filter-chip').forEach(chip => {
        chip.classList.remove('active');
    });
    event.target.classList.add('active');
    
    const searchTerm = document.getElementById('componentSearch')?.value || '';
    searchComponentsInForm(searchTerm);
}

// Team Members Functions
async function loadPreviousStudents() {
    try {
        const result = await apiCall('getProjects');
        const projects = result.data || [];
        
        const students = new Set();
        projects.forEach(project => {
            if (project.TeamMembers) {
                project.TeamMembers.split(',').map(m => m.trim()).filter(m => m).forEach(m => students.add(m));
            }
        });
        
        const container = document.getElementById('previousStudents');
        if (container && students.size > 0) {
            container.innerHTML = Array.from(students).sort().slice(0, 12).map(student => `
                <button type="button" class="quick-add-chip" onclick="quickAddTeamMember('${escapeHtml(student)}')">
                    ➕ ${escapeHtml(student)}
                </button>
            `).join('');
        } else if (container) {
            container.innerHTML = '<span class="no-previous">No previous students found</span>';
        }
    } catch (error) {
        console.error('Error loading previous students:', error);
    }
}

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
    const hiddenInput = document.getElementById('teamMembers');
    
    if (teamMembersList.length === 0) {
        container.innerHTML = '';
    } else {
        container.innerHTML = teamMembersList.map((member, index) => `
            <span class="team-member-chip">
                <span class="chip-avatar">${getInitials(member)}</span>
                ${escapeHtml(member)}
                <button type="button" class="chip-remove" onclick="removeTeamMember(${index})">✕</button>
            </span>
        `).join('');
    }
    
    if (hiddenInput) {
        hiddenInput.value = teamMembersList.join(', ');
    }
}

// Save Project
async function saveProject(event) {
    event.preventDefault();
    
    // Build components string with quantities
    const componentsUsed = Object.keys(selectedProjectComponents).map(id => {
        const qty = selectedProjectComponents[id].selectedQuantity || 1;
        return `${id}:${qty}`;
    }).join(', ');
    
    const projectData = {
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
            await apiCall('updateProject', { id: projectId, data: projectData });
            showNotification('Project updated successfully!');
        } else {
            await apiCall('addProject', { data: projectData });
            showNotification('Project created successfully!');
        }
        
        window.location.href = 'projects.html';
        
    } catch (error) {
        console.error('Error saving project:', error);
    }
    
    hideLoading();
}

// =====================================================
// COMPONENTS MODULE
// =====================================================

let allComponents = [];

async function loadComponents() {
    showLoading();
    
    try {
        const result = await apiCall('getComponents');
        allComponents = result.data || [];
        
        updateComponentStats();
        renderComponentsTable(allComponents);
        
    } catch (error) {
        console.error('Error loading components:', error);
        showError('Failed to load components: ' + error.message);
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
    if (!tbody) return;
    
    if (!components || components.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">No components found</td></tr>';
        return;
    }
    
    tbody.innerHTML = components.map(comp => {
        const quantity = parseInt(comp.Quantity) || 0;
        const qtyClass = quantity === 0 ? 'qty-zero' : quantity <= 5 ? 'qty-low' : 'qty-ok';
        
        return `
            <tr>
                <td><code>${comp.ComponentID}</code></td>
                <td><strong>${comp.ComponentName || ''}</strong></td>
                <td><span class="type-badge">${comp.Type || '-'}</span></td>
                <td>${comp.Description ? comp.Description.substring(0, 40) + '...' : '-'}</td>
                <td>
                    <span class="quantity-badge ${qtyClass}" onclick="openQuantityModal('${comp.ComponentID}', '${escapeHtml(comp.ComponentName)}', ${quantity})">
                        ${quantity}
                        <span class="qty-edit-icon">✏️</span>
                    </span>
                </td>
                <td class="actions">
                    <button class="btn btn-sm btn-primary" onclick="editComponent('${comp.ComponentID}')">✏️ Edit</button>
                </td>
            </tr>
        `;
    }).join('');
}

function searchComponents() {
    const query = document.getElementById('searchComponents')?.value.toLowerCase() || '';
    
    const filtered = allComponents.filter(c => 
        (c.ComponentName || '').toLowerCase().includes(query) ||
        (c.ComponentID || '').toLowerCase().includes(query) ||
        (c.Type || '').toLowerCase().includes(query)
    );
    
    renderComponentsTable(filtered);
}

// Quantity Modal
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
        
        showNotification('Quantity updated!');
        closeQuantityModal();
        loadComponents();
        
    } catch (error) {
        console.error('Error updating quantity:', error);
    }
    
    hideLoading();
}

// Component Form
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
            showNotification('Component updated!');
        } else {
            await apiCall('addComponent', { data: componentData });
            showNotification('Component added!');
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
// COMPETITIONS MODULE
// =====================================================

let allCompetitions = [];

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
    const upcoming = allCompetitions.filter(c => (c.Status || '').toLowerCase() === 'upcoming').length;
    const ongoing = allCompetitions.filter(c => (c.Status || '').toLowerCase() === 'ongoing').length;
    const completed = allCompetitions.filter(c => (c.Status || '').toLowerCase() === 'completed').length;
    
    if (document.getElementById('upcomingCount')) document.getElementById('upcomingCount').textContent = upcoming;
    if (document.getElementById('ongoingCount')) document.getElementById('ongoingCount').textContent = ongoing;
    if (document.getElementById('completedCount')) document.getElementById('completedCount').textContent = completed;
}

function renderCompetitionsTable(competitions) {
    const tbody = document.getElementById('competitionsTableBody');
    if (!tbody) return;
    
    if (!competitions || competitions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No competitions found</td></tr>';
        return;
    }
    
    tbody.innerHTML = competitions.map(comp => `
        <tr>
            <td><code>${comp.EventID}</code></td>
            <td><strong>${comp.EventName || ''}</strong></td>
            <td>${formatDate(comp.Date)}</td>
            <td>${comp.Location || '-'}</td>
            <td><span class="status-badge status-${(comp.Status || 'upcoming').toLowerCase()}">${comp.Status || 'Upcoming'}</span></td>
            <td>${comp.Position || comp.Result || '-'}</td>
            <td class="actions">
                <button class="btn btn-sm btn-primary" onclick="editCompetition('${comp.EventID}')">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCompetition('${comp.EventID}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function renderCalendarView(competitions) {
    const container = document.getElementById('calendarView');
    if (!container) return;
    
    if (!competitions || competitions.length === 0) {
        container.innerHTML = '<p class="no-data">No competitions</p>';
        return;
    }
    
    container.innerHTML = competitions.map(comp => {
        const date = new Date(comp.Date);
        const status = (comp.Status || 'upcoming').toLowerCase();
        
        return `
            <div class="calendar-card ${status}">
                <div class="calendar-date">
                    <span class="month">${date.toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span class="day">${date.getDate()}</span>
                </div>
                <div class="calendar-details">
                    <span class="status-badge status-${status}">${comp.Status || 'Upcoming'}</span>
                    <h4>${comp.EventName}</h4>
                    <p>📍 ${comp.Location || 'TBD'}</p>
                </div>
            </div>
        `;
    }).join('');
}

function toggleView(view) {
    const tableView = document.getElementById('tableView');
    const calendarView = document.getElementById('calendarView');
    
    if (view === 'table') {
        if (tableView) tableView.style.display = 'block';
        if (calendarView) calendarView.style.display = 'none';
    } else {
        if (tableView) tableView.style.display = 'none';
        if (calendarView) calendarView.style.display = 'grid';
    }
    
    document.querySelectorAll('.view-toggle .btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function editCompetition(id) {
    window.location.href = `competition_form.html?id=${id}`;
}

async function deleteCompetition(id) {
    if (!confirm('Delete this competition?')) return;
    
    showLoading();
    try {
        await apiCall('deleteCompetition', { id: id });
        showNotification('Competition deleted!');
        loadCompetitions();
    } catch (error) {
        console.error('Error:', error);
    }
    hideLoading();
}

// =====================================================
// ORDERS MODULE
// =====================================================

let allOrders = [];

async function loadOrders() {
    showLoading();
    
    try {
        const result = await apiCall('getOrders');
        allOrders = result.data || [];
        
        updateOrderStats();
        renderOrdersList(allOrders);
        
    } catch (error) {
        console.error('Error loading orders:', error);
    }
    
    hideLoading();
}

function updateOrderStats() {
    const total = allOrders.length;
    const pending = allOrders.filter(o => o.Status === 'Ordered').length;
    const shipped = allOrders.filter(o => o.Status === 'Shipped').length;
    const completed = allOrders.filter(o => o.Status === 'Completed').length;
    
    if (document.getElementById('totalOrders')) document.getElementById('totalOrders').textContent = total;
    if (document.getElementById('pendingOrders')) document.getElementById('pendingOrders').textContent = pending;
    if (document.getElementById('shippedOrders')) document.getElementById('shippedOrders').textContent = shipped;
    if (document.getElementById('completedOrders')) document.getElementById('completedOrders').textContent = completed;
}

function renderOrdersList(orders) {
    const container = document.getElementById('ordersContainer');
    if (!container) return;
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📦</div>
                <h3>No Orders</h3>
                <a href="order_form.html" class="btn btn-primary">Create Order</a>
            </div>
        `;
        return;
    }
    
    container.innerHTML = orders.map(order => `
        <div class="order-card">
            <div class="order-card-header">
                <div>
                    <h3><code>${order.OrderID}</code></h3>
                    <span>${order.Vendor || 'Unknown Vendor'}</span>
                </div>
                <span class="status-badge status-${(order.Status || 'ordered').toLowerCase()}">${order.Status || 'Ordered'}</span>
            </div>
            <div class="order-card-meta">
                <div><span>📅 Ordered:</span> ${formatDate(order.OrderDate)}</div>
                <div><span>🚚 Expected:</span> ${formatDate(order.ExpectedDelivery) || 'TBD'}</div>
                <div><span>📦 Items:</span> ${order.TotalItems || 0}</div>
            </div>
            ${order.Items && order.Items.length > 0 ? `
                <div class="order-items-preview">
                    ${order.Items.slice(0, 3).map(item => `
                        <div class="order-item-row">
                            <span>${item.ComponentName}</span>
                            <span>×${item.Quantity}</span>
                        </div>
                    `).join('')}
                    ${order.Items.length > 3 ? `<div class="more-items">+${order.Items.length - 3} more</div>` : ''}
                </div>
            ` : ''}
            <div class="order-card-actions">
                ${order.Status === 'Delivered' ? `
                    <button class="btn btn-success" onclick="completeOrder('${order.OrderID}')">✅ Complete & Sync</button>
                ` : ''}
                <button class="btn btn-sm btn-primary" onclick="editOrder('${order.OrderID}')">✏️ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteOrder('${order.OrderID}')">🗑️ Delete</button>
            </div>
        </div>
    `).join('');
}

function editOrder(id) {
    window.location.href = `order_form.html?id=${id}`;
}

async function deleteOrder(id) {
    if (!confirm('Delete this order?')) return;
    
    showLoading();
    try {
        await apiCall('deleteOrder', { id: id });
        showNotification('Order deleted!');
        loadOrders();
    } catch (error) {
        console.error('Error:', error);
    }
    hideLoading();
}

async function completeOrder(orderId) {
    if (!confirm('Complete this order and add items to inventory?')) return;
    
    showLoading();
    try {
        const result = await apiCall('completeOrder', { id: orderId });
        showNotification('Order completed! Inventory updated.');
        loadOrders();
    } catch (error) {
        console.error('Error:', error);
    }
    hideLoading();
}

console.log('✅ Script.js loaded');
