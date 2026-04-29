// =====================================================
// config.js - Configuration
// =====================================================

// Your Google Apps Script Web App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbyyMRMhScKHR3AquwYNdefnSsRuCb81f7nGbs2zJAM3pU08vsL041VK9mtYOcqA606e_Q/exec';

// Order status options
const ORDER_STATUS_OPTIONS = ['Ordered', 'Shipped', 'Delivered', 'Completed', 'Cancelled'];

// Debug mode - set to true to see console logs
const DEBUG_MODE = true;

// Log config loaded
console.log('✅ Config loaded');
console.log('📡 API URL:', API_URL);
