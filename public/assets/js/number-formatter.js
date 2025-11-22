// Number Formatting Utilities
// Shared utility functions for formatting numbers with thousand separators

/**
 * Format number with thousand separators (dots)
 * @param {number|string} num - Number to format
 * @returns {string} Formatted number (e.g., "10.000")
 */
function formatNumber(num) {
    if (!num && num !== 0) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Parse formatted number back to integer
 * @param {string} str - Formatted number string
 * @returns {number} Parsed integer
 */
function parseFormattedNumber(str) {
    if (!str && str !== 0) return 0;
    return parseInt(str.toString().replace(/\./g, '')) || 0;
}

/**
 * Auto-format number input on keyup/paste
 * Maintains cursor position after formatting
 * @param {HTMLInputElement} inputElement - Input element to format
 */
function autoFormatNumberInput(inputElement) {
    if (!inputElement) return;
    
    const cursorPosition = inputElement.selectionStart;
    const oldValue = inputElement.value;
    const oldLength = oldValue.length;
    
    // Remove all dots and parse
    const numericValue = parseFormattedNumber(oldValue);
    
    // Format with dots
    const formattedValue = formatNumber(numericValue);
    
    // Update input value
    inputElement.value = formattedValue;
    
    // Restore cursor position (adjust for added/removed dots)
    const newLength = formattedValue.length;
    const lengthDiff = newLength - oldLength;
    const newCursorPosition = cursorPosition + lengthDiff;
    inputElement.setSelectionRange(newCursorPosition, newCursorPosition);
}

/**
 * Setup auto-format for an input element
 * @param {string|HTMLInputElement} inputSelector - CSS selector or input element
 */
function setupNumberFormatting(inputSelector) {
    const input = typeof inputSelector === 'string' 
        ? document.querySelector(inputSelector) 
        : inputSelector;
    
    if (!input) return;
    
    input.addEventListener('input', () => autoFormatNumberInput(input));
    input.addEventListener('paste', () => {
        setTimeout(() => autoFormatNumberInput(input), 0);
    });
}

/**
 * Setup auto-format for multiple input elements
 * @param {string} selector - CSS selector for inputs
 */
function setupMultipleNumberFormatting(selector) {
    const inputs = document.querySelectorAll(selector);
    inputs.forEach(input => setupNumberFormatting(input));
}
