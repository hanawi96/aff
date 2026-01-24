// ============================================
// PARTIALS LOADER - Load HTML partials
// ============================================

/**
 * Load HTML partial into a container
 * @param {string} partialPath - Path to the partial HTML file
 * @param {string} containerId - ID of the container element
 * @returns {Promise<void>}
 */
export async function loadPartial(partialPath, containerId) {
    try {
        const response = await fetch(partialPath);
        if (!response.ok) {
            throw new Error(`Failed to load partial: ${partialPath}`);
        }
        
        const html = await response.text();
        const container = document.getElementById(containerId);
        
        if (!container) {
            console.warn(`Container not found: ${containerId}`);
            return;
        }
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading partial:', error);
    }
}

/**
 * Load multiple partials
 * @param {Array<{path: string, containerId: string}>} partials
 * @returns {Promise<void>}
 */
export async function loadPartials(partials) {
    const promises = partials.map(({ path, containerId }) => 
        loadPartial(path, containerId)
    );
    
    await Promise.all(promises);
}

/**
 * Append HTML partial to a container (doesn't replace existing content)
 * @param {string} partialPath - Path to the partial HTML file
 * @param {string} containerId - ID of the container element
 * @returns {Promise<void>}
 */
export async function appendPartial(partialPath, containerId) {
    try {
        const response = await fetch(partialPath);
        if (!response.ok) {
            throw new Error(`Failed to load partial: ${partialPath}`);
        }
        
        const html = await response.text();
        const container = document.getElementById(containerId);
        
        if (!container) {
            console.warn(`Container not found: ${containerId}`);
            return;
        }
        
        container.insertAdjacentHTML('beforeend', html);
    } catch (error) {
        console.error('Error appending partial:', error);
    }
}

/**
 * Load common partials (header, footer, modals)
 * @returns {Promise<void>}
 */
export async function loadCommonPartials() {
    await loadPartials([
        { path: '/shop/partials/header.html', containerId: 'header-placeholder' },
        { path: '/shop/partials/footer.html', containerId: 'footer-placeholder' },
        { path: '/shop/partials/modals/cart-sidebar.html', containerId: 'modals-placeholder' },
        { path: '/shop/partials/modals/quick-checkout.html', containerId: 'modals-placeholder' },
        { path: '/shop/partials/modals/discount-selector.html', containerId: 'modals-placeholder' }
    ]);
    
    console.log('✅ Common partials loaded');
}
