// Test script to check pricing display in modal
// Run this in browser console after opening a product modal

console.log('=== PRICING DISPLAY DIAGNOSTIC ===');

// Check if elements exist
const pricingSection = document.getElementById('productPricingSection');
const priceCurrent = document.getElementById('priceCurrentModal');
const priceOriginal = document.getElementById('priceOriginalModal');
const discountBadge = document.getElementById('discountBadgeModal');
const discountPercent = document.getElementById('discountPercentModal');

console.log('Elements found:');
console.log('- pricingSection:', !!pricingSection);
console.log('- priceCurrent:', !!priceCurrent);
console.log('- priceOriginal:', !!priceOriginal);
console.log('- discountBadge:', !!discountBadge);
console.log('- discountPercent:', !!discountPercent);

if (pricingSection) {
    console.log('\nPricing section styles:');
    const styles = window.getComputedStyle(pricingSection);
    console.log('- display:', styles.display);
    console.log('- visibility:', styles.visibility);
    console.log('- opacity:', styles.opacity);
    console.log('- height:', styles.height);
    
    console.log('\nPricing section content:');
    console.log('- innerHTML:', pricingSection.innerHTML.substring(0, 200));
    
    if (priceCurrent) {
        console.log('\nCurrent price:');
        console.log('- textContent:', priceCurrent.textContent);
        console.log('- display:', window.getComputedStyle(priceCurrent).display);
    }
    
    if (priceOriginal) {
        console.log('\nOriginal price:');
        console.log('- textContent:', priceOriginal.textContent);
        console.log('- display:', window.getComputedStyle(priceOriginal).display);
    }
    
    if (discountBadge) {
        console.log('\nDiscount badge:');
        console.log('- display:', window.getComputedStyle(discountBadge).display);
        if (discountPercent) {
            console.log('- percent text:', discountPercent.textContent);
        }
    }
}

console.log('\n=== END DIAGNOSTIC ===');
