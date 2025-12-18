// =====================================================
// config.js - Configuration
// =====================================================

// Your Google Apps Script Web App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbxOi-oU0sXujW9THn0HEF9IHqiasWgd7g8MODbQM4YzxOxYZ0rc2f0aiLS9OMOm5-OMog/exec';

// Order status options
const ORDER_STATUS_OPTIONS = ['Ordered', 'Shipped', 'Delivered', 'Completed', 'Cancelled'];

// Debug mode - set to true to see console logs
const DEBUG_MODE = true;

// Log config loaded
console.log('✅ Config loaded');
console.log('📡 API URL:', API_URL);
