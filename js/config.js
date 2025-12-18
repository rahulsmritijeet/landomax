// =====================================================
// config.js - Configuration
// =====================================================

// Your Google Apps Script Web App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbxFp5LrNy2dpLI6BR7AL1FN2W-PQVtQOgJk9bDxdlO_LfLxNxEr6BPr9YSM2bXEk1DUFg/exec';

// Order status options
const ORDER_STATUS_OPTIONS = ['Ordered', 'Shipped', 'Delivered', 'Completed', 'Cancelled'];

// Debug mode - set to true to see console logs
const DEBUG_MODE = true;

// Log config loaded
console.log('✅ Config loaded');
console.log('📡 API URL:', API_URL);
