// =====================================================
// config.js - Configuration
// =====================================================

// Your Google Apps Script Web App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbxMCRkgMPxhn2ErBdXszakYgV3XmXyq74HA5yb4__P1bW3J0v3CQceo6i1Qjsw0phd_3w/exec';

// Order status options
const ORDER_STATUS_OPTIONS = ['Ordered', 'Shipped', 'Delivered', 'Completed', 'Cancelled'];

// Debug mode - set to true to see console logs
const DEBUG_MODE = true;

// Log config loaded
console.log('✅ Config loaded');
console.log('📡 API URL:', API_URL);
