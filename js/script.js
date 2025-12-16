// =====================================================
// Code.gs - ATL Dashboard Backend (COMPLETE)
// =====================================================

// ⚠️ REPLACE THIS WITH YOUR ACTUAL SPREADSHEET ID
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

// Sheet names
const SHEETS = {
  PROJECTS: 'Projects',
  COMPONENTS: 'Components',
  COMPETITIONS: 'Competitions',
  ORDERS: 'Orders',
  ORDER_ITEMS: 'OrderItems',
  SETTINGS: 'Settings'
};

// =====================================================
// Web App Entry Points
// =====================================================

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    const params = e.parameter || {};
    const action = params.action || '';
    let result;
    
    switch(action) {
      // ============ AUTHENTICATION ============
      case 'verifyPassword':
        result = verifyPassword(params.password);
        break;
      case 'getAppSettings':
        result = getAppSettings();
        break;
      case 'changePassword':
        result = changePassword(params.currentPassword, params.newPassword);
        break;
      
      // ============ PROJECTS ============
      case 'getProjects':
        result = getProjects();
        break;
      case 'getProject':
        result = getProject(params.id);
        break;
      case 'addProject':
        result = addProject(JSON.parse(params.data));
        break;
      case 'updateProject':
        result = updateProject(params.id, JSON.parse(params.data));
        break;
      case 'deleteProject':
        result = deleteProject(params.id);
        break;
        
      // ============ COMPONENTS ============
      case 'getComponents':
        result = getComponents();
        break;
      case 'getComponent':
        result = getComponent(params.id);
        break;
      case 'addComponent':
        result = addComponent(JSON.parse(params.data));
        break;
      case 'updateComponent':
        result = updateComponent(params.id, JSON.parse(params.data));
        break;
      case 'bulkAddComponents':
        result = bulkAddComponents(JSON.parse(params.data));
        break;
      case 'updateComponentQuantity':
        result = updateComponentQuantity(params.id, parseInt(params.quantity));
        break;
        
      // ============ COMPETITIONS ============
      case 'getCompetitions':
        result = getCompetitions();
        break;
      case 'getCompetition':
        result = getCompetition(params.id);
        break;
      case 'addCompetition':
        result = addCompetition(JSON.parse(params.data));
        break;
      case 'updateCompetition':
        result = updateCompetition(params.id, JSON.parse(params.data));
        break;
      case 'deleteCompetition':
        result = deleteCompetition(params.id);
        break;
      case 'updateCompetitionResult':
        result = updateCompetitionResult(params.id, JSON.parse(params.data));
        break;
        
      // ============ ORDERS ============
      case 'getOrders':
        result = getOrders();
        break;
      case 'getOrder':
        result = getOrder(params.id);
        break;
      case 'addOrder':
        result = addOrder(JSON.parse(params.data));
        break;
      case 'updateOrder':
        result = updateOrder(params.id, JSON.parse(params.data));
        break;
      case 'deleteOrder':
        result = deleteOrder(params.id);
        break;
      case 'completeOrder':
        result = completeOrder(params.id);
        break;
      case 'getOrderItems':
        result = getOrderItems(params.orderId);
        break;
      
      // ============ TEST ============
      case 'test':
        result = { success: true, message: 'API is working!', timestamp: new Date().toString() };
        break;
        
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
    
    output.setContent(JSON.stringify(result));
  } catch(error) {
    output.setContent(JSON.stringify({ 
      success: false, 
      error: error.toString(),
      stack: error.stack 
    }));
  }
  
  return output;
}

// =====================================================
// AUTHENTICATION FUNCTIONS
// =====================================================

function verifyPassword(password) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let settingsSheet = ss.getSheetByName(SHEETS.SETTINGS);
    
    // Create Settings sheet if it doesn't exist
    if (!settingsSheet) {
      settingsSheet = ss.insertSheet(SHEETS.SETTINGS);
      settingsSheet.appendRow(['Key', 'Value']);
      settingsSheet.appendRow(['Password', 'admin123']);
      settingsSheet.appendRow(['AppName', 'ATL Dashboard']);
      Logger.log('Created Settings sheet with default password: admin123');
    }
    
    const data = settingsSheet.getDataRange().getValues();
    let storedPassword = 'admin123'; // Default fallback
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'Password') {
        storedPassword = String(data[i][1]).trim();
        break;
      }
    }
    
    Logger.log('Stored password: ' + storedPassword);
    Logger.log('Provided password: ' + password);
    Logger.log('Match: ' + (password === storedPassword));
    
    if (String(password).trim() === storedPassword) {
      const token = Utilities.getUuid();
      return { 
        success: true, 
        token: token,
        message: 'Login successful'
      };
    } else {
      return { 
        success: false, 
        error: 'Invalid password' 
      };
    }
  } catch (error) {
    Logger.log('Error in verifyPassword: ' + error.toString());
    return { 
      success: false, 
      error: 'Authentication error: ' + error.toString() 
    };
  }
}

function getAppSettings() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let settingsSheet = ss.getSheetByName(SHEETS.SETTINGS);
    
    if (!settingsSheet) {
      return { 
        success: true, 
        data: { AppName: 'ATL Dashboard' } 
      };
    }
    
    const data = settingsSheet.getDataRange().getValues();
    const settings = {};
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0] !== 'Password') {
        settings[data[i][0]] = data[i][1];
      }
    }
    
    return { success: true, data: settings };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function changePassword(currentPassword, newPassword) {
  try {
    // First verify current password
    const verifyResult = verifyPassword(currentPassword);
    if (!verifyResult.success) {
      return { success: false, error: 'Current password is incorrect' };
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const settingsSheet = ss.getSheetByName(SHEETS.SETTINGS);
    
    if (!settingsSheet) {
      return { success: false, error: 'Settings sheet not found' };
    }
    
    const data = settingsSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'Password') {
        settingsSheet.getRange(i + 1, 2).setValue(newPassword);
        return { success: true, message: 'Password changed successfully' };
      }
    }
    
    // If no password row found, add one
    settingsSheet.appendRow(['Password', newPassword]);
    return { success: true, message: 'Password set successfully' };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet && sheetName === SHEETS.ORDER_ITEMS) {
    sheet = ss.insertSheet(SHEETS.ORDER_ITEMS);
    sheet.appendRow(['OrderItemID', 'OrderID', 'ComponentName', 'Type', 'Quantity', 'UnitPrice', 'Synced']);
  }
  
  return sheet;
}

function generateId(prefix, sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return prefix + '001';
  
  const ids = data.slice(1).map(row => row[0]).filter(id => id && id.toString().startsWith(prefix));
  if (ids.length === 0) return prefix + '001';
  
  const maxNum = Math.max(...ids.map(id => parseInt(id.toString().replace(prefix, '')) || 0));
  return prefix + String(maxNum + 1).padStart(3, '0');
}

function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) return i + 1;
  }
  return -1;
}

function getCurrentTimestamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function formatSheetDate(date) {
  if (!date) return '';
  if (date instanceof Date) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return date.toString();
}

// =====================================================
// PROJECTS CRUD
// =====================================================

function getProjects() {
  const sheet = getSheet(SHEETS.PROJECTS);
  if (!sheet) return { success: true, data: [] };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const projects = [];
  
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const project = {};
    headers.forEach((header, index) => {
      project[header] = data[i][index] || '';
    });
    projects.push(project);
  }
  
  projects.sort((a, b) => new Date(b.LastUpdated) - new Date(a.LastUpdated));
  return { success: true, data: projects };
}

function getProject(id) {
  const sheet = getSheet(SHEETS.PROJECTS);
  if (!sheet) return { success: false, error: 'Sheet not found' };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const project = {};
      headers.forEach((header, index) => {
        project[header] = data[i][index] || '';
      });
      return { success: true, data: project };
    }
  }
  
  return { success: false, error: 'Project not found' };
}

function addProject(projectData) {
  const sheet = getSheet(SHEETS.PROJECTS);
  const projectId = generateId('P', sheet);
  const timestamp = getCurrentTimestamp();
  
  const row = [
    projectId,
    projectData.ProjectName || '',
    projectData.Overview || '',
    projectData.Code || '',
    projectData.ComponentsUsed || '',
    projectData.TeamMembers || '',
    timestamp
  ];
  
  sheet.appendRow(row);
  return { success: true, id: projectId };
}

function updateProject(id, projectData) {
  const sheet = getSheet(SHEETS.PROJECTS);
  const rowNum = findRowById(sheet, id);
  
  if (rowNum === -1) return { success: false, error: 'Project not found' };
  
  const timestamp = getCurrentTimestamp();
  const row = [
    id,
    projectData.ProjectName || '',
    projectData.Overview || '',
    projectData.Code || '',
    projectData.ComponentsUsed || '',
    projectData.TeamMembers || '',
    timestamp
  ];
  
  sheet.getRange(rowNum, 1, 1, row.length).setValues([row]);
  return { success: true };
}

function deleteProject(id) {
  const sheet = getSheet(SHEETS.PROJECTS);
  const rowNum = findRowById(sheet, id);
  if (rowNum === -1) return { success: false, error: 'Project not found' };
  sheet.deleteRow(rowNum);
  return { success: true };
}

// =====================================================
// COMPONENTS CRUD
// =====================================================

function getComponents() {
  const sheet = getSheet(SHEETS.COMPONENTS);
  if (!sheet) return { success: true, data: [] };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const components = [];
  
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const component = {};
    headers.forEach((header, index) => {
      let value = data[i][index];
      if (header === 'Quantity') value = parseInt(value) || 0;
      component[header] = value;
    });
    components.push(component);
  }
  
  return { success: true, data: components };
}

function getComponent(id) {
  const sheet = getSheet(SHEETS.COMPONENTS);
  if (!sheet) return { success: false, error: 'Sheet not found' };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const component = {};
      headers.forEach((header, index) => {
        let value = data[i][index];
        if (header === 'Quantity') value = parseInt(value) || 0;
        component[header] = value;
      });
      return { success: true, data: component };
    }
  }
  
  return { success: false, error: 'Component not found' };
}

function addComponent(componentData) {
  const sheet = getSheet(SHEETS.COMPONENTS);
  const componentId = generateId('C', sheet);
  
  const row = [
    componentId,
    componentData.ComponentName || '',
    componentData.Type || '',
    componentData.Description || '',
    parseInt(componentData.Quantity) || 0
  ];
  
  sheet.appendRow(row);
  return { success: true, id: componentId };
}

function updateComponent(id, componentData) {
  const sheet = getSheet(SHEETS.COMPONENTS);
  const rowNum = findRowById(sheet, id);
  
  if (rowNum === -1) return { success: false, error: 'Component not found' };
  
  const row = [
    id,
    componentData.ComponentName || '',
    componentData.Type || '',
    componentData.Description || '',
    parseInt(componentData.Quantity) || 0
  ];
  
  sheet.getRange(rowNum, 1, 1, row.length).setValues([row]);
  return { success: true };
}

function bulkAddComponents(componentsArray) {
  const sheet = getSheet(SHEETS.COMPONENTS);
  let addedCount = 0;
  const addedIds = [];
  
  componentsArray.forEach(componentData => {
    const componentId = generateId('C', sheet);
    const row = [
      componentId,
      componentData.ComponentName || '',
      componentData.Type || '',
      componentData.Description || '',
      parseInt(componentData.Quantity) || 0
    ];
    sheet.appendRow(row);
    addedCount++;
    addedIds.push(componentId);
  });
  
  return { success: true, addedCount: addedCount, ids: addedIds };
}

function updateComponentQuantity(id, newQuantity) {
  const sheet = getSheet(SHEETS.COMPONENTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  let quantityColIndex = headers.indexOf('Quantity');
  if (quantityColIndex === -1) quantityColIndex = 4;
  
  const rowNum = findRowById(sheet, id);
  if (rowNum === -1) return { success: false, error: 'Component not found' };
  
  sheet.getRange(rowNum, quantityColIndex + 1).setValue(parseInt(newQuantity) || 0);
  return { success: true, newQuantity: parseInt(newQuantity) || 0 };
}

function addToComponentQuantity(id, additionalQuantity) {
  const sheet = getSheet(SHEETS.COMPONENTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  let quantityColIndex = headers.indexOf('Quantity');
  if (quantityColIndex === -1) quantityColIndex = 4;
  
  const rowNum = findRowById(sheet, id);
  if (rowNum === -1) return { success: false, error: 'Component not found' };
  
  const currentQty = parseInt(data[rowNum - 1][quantityColIndex]) || 0;
  const newQty = currentQty + (parseInt(additionalQuantity) || 0);
  
  sheet.getRange(rowNum, quantityColIndex + 1).setValue(newQty);
  return { success: true, previousQuantity: currentQty, newQuantity: newQty };
}

// =====================================================
// COMPETITIONS CRUD
// =====================================================

function getCompetitions() {
  const sheet = getSheet(SHEETS.COMPETITIONS);
  if (!sheet) return { success: true, data: [] };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const competitions = [];
  
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const competition = {};
    headers.forEach((header, index) => {
      let value = data[i][index];
      if (header === 'Date' || header === 'EndDate') value = formatSheetDate(value);
      competition[header] = value;
    });
    competitions.push(competition);
  }
  
  competitions.sort((a, b) => new Date(a.Date) - new Date(b.Date));
  return { success: true, data: competitions };
}

function getCompetition(id) {
  const sheet = getSheet(SHEETS.COMPETITIONS);
  if (!sheet) return { success: false, error: 'Sheet not found' };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const competition = {};
      headers.forEach((header, index) => {
        let value = data[i][index];
        if (header === 'Date' || header === 'EndDate') value = formatSheetDate(value);
        competition[header] = value;
      });
      return { success: true, data: competition };
    }
  }
  
  return { success: false, error: 'Competition not found' };
}

function addCompetition(competitionData) {
  const sheet = getSheet(SHEETS.COMPETITIONS);
  const eventId = generateId('E', sheet);
  
  const row = [
    eventId,
    competitionData.EventName || '',
    competitionData.Date || '',
    competitionData.EndDate || '',
    competitionData.Location || '',
    competitionData.Details || '',
    competitionData.Status || 'Upcoming',
    competitionData.Result || '',
    competitionData.Position || '',
    competitionData.Participants || '',
    competitionData.Notes || ''
  ];
  
  sheet.appendRow(row);
  return { success: true, id: eventId };
}

function updateCompetition(id, competitionData) {
  const sheet = getSheet(SHEETS.COMPETITIONS);
  const rowNum = findRowById(sheet, id);
  
  if (rowNum === -1) return { success: false, error: 'Competition not found' };
  
  const row = [
    id,
    competitionData.EventName || '',
    competitionData.Date || '',
    competitionData.EndDate || '',
    competitionData.Location || '',
    competitionData.Details || '',
    competitionData.Status || 'Upcoming',
    competitionData.Result || '',
    competitionData.Position || '',
    competitionData.Participants || '',
    competitionData.Notes || ''
  ];
  
  sheet.getRange(rowNum, 1, 1, row.length).setValues([row]);
  return { success: true };
}

function deleteCompetition(id) {
  const sheet = getSheet(SHEETS.COMPETITIONS);
  const rowNum = findRowById(sheet, id);
  if (rowNum === -1) return { success: false, error: 'Competition not found' };
  sheet.deleteRow(rowNum);
  return { success: true };
}

function updateCompetitionResult(id, resultData) {
  const sheet = getSheet(SHEETS.COMPETITIONS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rowNum = findRowById(sheet, id);
  
  if (rowNum === -1) return { success: false, error: 'Competition not found' };
  
  const statusIndex = headers.indexOf('Status');
  const resultIndex = headers.indexOf('Result');
  const positionIndex = headers.indexOf('Position');
  const notesIndex = headers.indexOf('Notes');
  
  if (statusIndex !== -1) sheet.getRange(rowNum, statusIndex + 1).setValue(resultData.Status || 'Completed');
  if (resultIndex !== -1) sheet.getRange(rowNum, resultIndex + 1).setValue(resultData.Result || '');
  if (positionIndex !== -1) sheet.getRange(rowNum, positionIndex + 1).setValue(resultData.Position || '');
  if (notesIndex !== -1) sheet.getRange(rowNum, notesIndex + 1).setValue(resultData.Notes || '');
  
  return { success: true };
}

// =====================================================
// ORDERS CRUD
// =====================================================

function getOrders() {
  const ordersSheet = getSheet(SHEETS.ORDERS);
  const itemsSheet = getSheet(SHEETS.ORDER_ITEMS);
  
  if (!ordersSheet) return { success: true, data: [] };
  
  const ordersData = ordersSheet.getDataRange().getValues();
  const itemsData = itemsSheet ? itemsSheet.getDataRange().getValues() : [[]];
  
  const ordersHeaders = ordersData[0];
  const itemsHeaders = itemsData[0] || [];
  
  const orders = [];
  
  for (let i = 1; i < ordersData.length; i++) {
    if (!ordersData[i][0]) continue;
    
    const order = {};
    ordersHeaders.forEach((header, index) => {
      let value = ordersData[i][index];
      if (header === 'OrderDate' || header === 'ExpectedDelivery') {
        value = formatSheetDate(value);
      }
      order[header] = value;
    });
    
    order.Items = [];
    for (let j = 1; j < itemsData.length; j++) {
      if (itemsData[j][1] === order.OrderID) {
        const item = {};
        itemsHeaders.forEach((header, index) => {
          item[header] = itemsData[j][index];
        });
        order.Items.push(item);
      }
    }
    
    orders.push(order);
  }
  
  orders.sort((a, b) => new Date(b.OrderDate) - new Date(a.OrderDate));
  return { success: true, data: orders };
}

function getOrder(id) {
  const ordersSheet = getSheet(SHEETS.ORDERS);
  const itemsSheet = getSheet(SHEETS.ORDER_ITEMS);
  
  if (!ordersSheet) return { success: false, error: 'Sheet not found' };
  
  const ordersData = ordersSheet.getDataRange().getValues();
  const itemsData = itemsSheet ? itemsSheet.getDataRange().getValues() : [[]];
  
  const ordersHeaders = ordersData[0];
  const itemsHeaders = itemsData[0] || [];
  
  for (let i = 1; i < ordersData.length; i++) {
    if (ordersData[i][0] === id) {
      const order = {};
      ordersHeaders.forEach((header, index) => {
        let value = ordersData[i][index];
        if (header === 'OrderDate' || header === 'ExpectedDelivery') {
          value = formatSheetDate(value);
        }
        order[header] = value;
      });
      
      order.Items = [];
      for (let j = 1; j < itemsData.length; j++) {
        if (itemsData[j][1] === id) {
          const item = {};
          itemsHeaders.forEach((header, index) => {
            item[header] = itemsData[j][index];
          });
          order.Items.push(item);
        }
      }
      
      return { success: true, data: order };
    }
  }
  
  return { success: false, error: 'Order not found' };
}

function getOrderItems(orderId) {
  const itemsSheet = getSheet(SHEETS.ORDER_ITEMS);
  if (!itemsSheet) return { success: true, data: [] };
  
  const data = itemsSheet.getDataRange().getValues();
  const headers = data[0];
  const items = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === orderId) {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = data[i][index];
      });
      items.push(item);
    }
  }
  
  return { success: true, data: items };
}

function addOrder(orderData) {
  const ordersSheet = getSheet(SHEETS.ORDERS);
  const itemsSheet = getSheet(SHEETS.ORDER_ITEMS);
  
  const orderId = generateId('O', ordersSheet);
  const items = orderData.Items || [];
  
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + (parseInt(item.Quantity) || 0), 0);
  
  const orderRow = [
    orderId,
    orderData.OrderDate || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    orderData.Vendor || '',
    orderData.ExpectedDelivery || '',
    orderData.Status || 'Ordered',
    totalItems,
    totalQuantity,
    orderData.Notes || ''
  ];
  
  ordersSheet.appendRow(orderRow);
  
  items.forEach(item => {
    const itemId = generateId('OI', itemsSheet);
    const itemRow = [
      itemId,
      orderId,
      item.ComponentName || '',
      item.Type || '',
      parseInt(item.Quantity) || 0,
      parseFloat(item.UnitPrice) || 0,
      'No'
    ];
    itemsSheet.appendRow(itemRow);
  });
  
  return { success: true, id: orderId, itemCount: totalItems };
}

function updateOrder(id, orderData) {
  const ordersSheet = getSheet(SHEETS.ORDERS);
  const itemsSheet = getSheet(SHEETS.ORDER_ITEMS);
  
  const rowNum = findRowById(ordersSheet, id);
  if (rowNum === -1) return { success: false, error: 'Order not found' };
  
  const items = orderData.Items || [];
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + (parseInt(item.Quantity) || 0), 0);
  
  const orderRow = [
    id,
    orderData.OrderDate || '',
    orderData.Vendor || '',
    orderData.ExpectedDelivery || '',
    orderData.Status || 'Ordered',
    totalItems,
    totalQuantity,
    orderData.Notes || ''
  ];
  
  ordersSheet.getRange(rowNum, 1, 1, orderRow.length).setValues([orderRow]);
  
  // Delete old items
  const itemsData = itemsSheet.getDataRange().getValues();
  for (let i = itemsData.length - 1; i >= 1; i--) {
    if (itemsData[i][1] === id) {
      itemsSheet.deleteRow(i + 1);
    }
  }
  
  // Add new items
  items.forEach(item => {
    const itemId = generateId('OI', itemsSheet);
    const itemRow = [
      itemId,
      id,
      item.ComponentName || '',
      item.Type || '',
      parseInt(item.Quantity) || 0,
      parseFloat(item.UnitPrice) || 0,
      item.Synced || 'No'
    ];
    itemsSheet.appendRow(itemRow);
  });
  
  return { success: true };
}

function deleteOrder(id) {
  const ordersSheet = getSheet(SHEETS.ORDERS);
  const itemsSheet = getSheet(SHEETS.ORDER_ITEMS);
  
  const rowNum = findRowById(ordersSheet, id);
  if (rowNum === -1) return { success: false, error: 'Order not found' };
  
  // Delete order items first
  if (itemsSheet) {
    const itemsData = itemsSheet.getDataRange().getValues();
    for (let i = itemsData.length - 1; i >= 1; i--) {
      if (itemsData[i][1] === id) {
        itemsSheet.deleteRow(i + 1);
      }
    }
  }
  
  ordersSheet.deleteRow(rowNum);
  return { success: true };
}

function completeOrder(orderId) {
  const ordersSheet = getSheet(SHEETS.ORDERS);
  const itemsSheet = getSheet(SHEETS.ORDER_ITEMS);
  const componentsSheet = getSheet(SHEETS.COMPONENTS);
  
  const orderResult = getOrder(orderId);
  if (!orderResult.success) return orderResult;
  
  const order = orderResult.data;
  
  if (order.Status === 'Completed') {
    return { success: false, error: 'Order is already completed' };
  }
  
  const componentsResult = getComponents();
  const existingComponents = componentsResult.data || [];
  
  const syncResults = [];
  
  for (const item of order.Items) {
    if (item.Synced === 'Yes') continue;
    
    const componentName = item.ComponentName;
    const componentType = item.Type || '';
    const quantity = parseInt(item.Quantity) || 0;
    
    if (!componentName || quantity <= 0) continue;
    
    // Simple matching - find by name
    const matchedComponent = existingComponents.find(c => 
      c.ComponentName.toLowerCase().trim() === componentName.toLowerCase().trim()
    );
    
    if (matchedComponent) {
      const result = addToComponentQuantity(matchedComponent.ComponentID, quantity);
      syncResults.push({
        itemName: componentName,
        action: 'updated',
        matchedWith: matchedComponent.ComponentName,
        previousQty: result.previousQuantity,
        addedQty: quantity,
        newQty: result.newQuantity
      });
      matchedComponent.Quantity = result.newQuantity;
    } else {
      const newComponentId = generateId('C', componentsSheet);
      const row = [newComponentId, componentName, componentType, 'Added from Order ' + orderId, quantity];
      componentsSheet.appendRow(row);
      
      syncResults.push({
        itemName: componentName,
        action: 'created',
        componentId: newComponentId,
        quantity: quantity
      });
      
      existingComponents.push({
        ComponentID: newComponentId,
        ComponentName: componentName,
        Type: componentType,
        Quantity: quantity
      });
    }
    
    // Mark item as synced
    const itemsData = itemsSheet.getDataRange().getValues();
    const itemsHeaders = itemsData[0];
    const syncedColIndex = itemsHeaders.indexOf('Synced');
    
    for (let i = 1; i < itemsData.length; i++) {
      if (itemsData[i][0] === item.OrderItemID) {
        itemsSheet.getRange(i + 1, syncedColIndex + 1).setValue('Yes');
        break;
      }
    }
  }
  
  // Update order status
  const ordersData = ordersSheet.getDataRange().getValues();
  const ordersHeaders = ordersData[0];
  const statusColIndex = ordersHeaders.indexOf('Status');
  const orderRowNum = findRowById(ordersSheet, orderId);
  
  if (orderRowNum !== -1 && statusColIndex !== -1) {
    ordersSheet.getRange(orderRowNum, statusColIndex + 1).setValue('Completed');
  }
  
  return { 
    success: true, 
    message: 'Order completed and inventory updated',
    syncResults: syncResults
  };
}

// =====================================================
// SETUP FUNCTION - Run this once to create all sheets
// =====================================================

function setupAllSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Settings
  let sheet = ss.getSheetByName('Settings');
  if (!sheet) {
    sheet = ss.insertSheet('Settings');
    sheet.appendRow(['Key', 'Value']);
    sheet.appendRow(['Password', 'admin123']);
    sheet.appendRow(['AppName', 'ATL Dashboard']);
    Logger.log('Created Settings sheet');
  }
  
  // Projects
  sheet = ss.getSheetByName('Projects');
  if (!sheet) {
    sheet = ss.insertSheet('Projects');
    sheet.appendRow(['ProjectID', 'ProjectName', 'Overview', 'Code', 'ComponentsUsed', 'TeamMembers', 'LastUpdated']);
    Logger.log('Created Projects sheet');
  }
  
  // Components
  sheet = ss.getSheetByName('Components');
  if (!sheet) {
    sheet = ss.insertSheet('Components');
    sheet.appendRow(['ComponentID', 'ComponentName', 'Type', 'Description', 'Quantity']);
    Logger.log('Created Components sheet');
  }
  
  // Competitions
  sheet = ss.getSheetByName('Competitions');
  if (!sheet) {
    sheet = ss.insertSheet('Competitions');
    sheet.appendRow(['EventID', 'EventName', 'Date', 'EndDate', 'Location', 'Details', 'Status', 'Result', 'Position', 'Participants', 'Notes']);
    Logger.log('Created Competitions sheet');
  }
  
  // Orders
  sheet = ss.getSheetByName('Orders');
  if (!sheet) {
    sheet = ss.insertSheet('Orders');
    sheet.appendRow(['OrderID', 'OrderDate', 'Vendor', 'ExpectedDelivery', 'Status', 'TotalItems', 'TotalQuantity', 'Notes']);
    Logger.log('Created Orders sheet');
  }
  
  // OrderItems
  sheet = ss.getSheetByName('OrderItems');
  if (!sheet) {
    sheet = ss.insertSheet('OrderItems');
    sheet.appendRow(['OrderItemID', 'OrderID', 'ComponentName', 'Type', 'Quantity', 'UnitPrice', 'Synced']);
    Logger.log('Created OrderItems sheet');
  }
  
  Logger.log('All sheets setup complete!');
  return 'Setup complete! Default password is: admin123';
}
