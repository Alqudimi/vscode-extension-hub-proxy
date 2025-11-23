const axios = require('axios');
const MARKETPLACE_URL = 'https://marketplace.visualstudio.com/_apis/public/gallery';

/**
 * Fetches extensions from the Microsoft Marketplace based on a search query.
 * @param {string} query The search query.
 * @returns {Promise<Array>} A promise that resolves to an array of extensions.
 */
async function searchExtensions(query) {
    const searchUrl = `${MARKETPLACE_URL}/extensionquery`;
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json; api-version=3.0-preview.1',
        'X-Market-Client-Id': 'VSCode'
    };

    const data = {
        filters: [{
            criteria: [{
                filterType: 10, // Search text
                value: query
            }, {
                filterType: 8, // Target: VS Code
                value: 'Microsoft.VisualStudio.Code'
            }],
            pageNumber: 1,
            pageSize: 50,
            sortBy: 1, // Relevance
            sortOrder: 0 // Descending
        }],
        flags: 914 // Include all necessary metadata (details, versions, files, etc.)
    };

    try {
        const response = await axios.post(searchUrl, data, { headers });
        // The response structure is complex, we need to extract the extensions array
        if (response.data && response.data.results && response.data.results.length > 0) {
            return response.data.results[0].extensions || [];
        }
        return [];
    } catch (error) {
        console.error('Error fetching from Microsoft Marketplace:', error.message);
        return [];
    }
}

/**
 * Fetches details for a specific extension from the Microsoft Marketplace.
 * This is often the same as the search query with specific criteria, but we'll use a simplified version
 * assuming the search results already contain most of the details.
 * For a specific detail endpoint, we'd use the same extensionquery with filterType 7 (Extension Name).
 * @param {string} publisher The extension publisher.
 * @param {string} name The extension name.
 * @returns {Promise<Object|null>} A promise that resolves to the extension object or null.
 */
async function getExtensionDetails(publisher, name) {
    const searchUrl = `${MARKETPLACE_URL}/extensionquery`;
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json; api-version=3.0-preview.1',
        'X-Market-Client-Id': 'VSCode'
    };

    const data = {
        filters: [{
            criteria: [{
                filterType: 7, // Extension Name
                value: `${publisher}.${name}`
            }, {
                filterType: 8, // Target: VS Code
                value: 'Microsoft.VisualStudio.Code'
            }],
            pageNumber: 1,
            pageSize: 1,
            sortBy: 0,
            sortOrder: 0
        }],
        flags: 914 // Include all necessary metadata
    };

    try {
        const response = await axios.post(searchUrl, data, { headers });
        if (response.data && response.data.results && response.data.results.length > 0 && response.data.results[0].extensions.length > 0) {
            return response.data.results[0].extensions[0];
        }
        return null;
    } catch (error) {
        console.error(`Error fetching details for ${publisher}.${name} from Microsoft Marketplace:`, error.message);
        return null;
    }
}

/**
 * Gets the download URL for a specific VSIX file.
 * @param {string} publisher The extension publisher.
 * @param {string} name The extension name.
 * @param {string} version The extension version.
 * @returns {string} The direct download URL.
 */
function getDownloadUrl(publisher, name, version) {
    // The download URL is a direct link to the VSIX file.
    // The path is: /_apis/public/gallery/publishers/{publisherName}/vsextensions/{extensionName}/{version}/vspackage
    // For Fallback testing, we will force a failure for a specific extension (e.g., 'test.fallback')
    // For Fallback testing, we will force a failure for a specific extension (e.g., 'test.fallback')
    // if (publisher === 'test' && name === 'fallback') {
    //     // Return a URL that is guaranteed to fail (e.g., a non-existent endpoint)
    //     return 'http://localhost:3000/guaranteed-to-fail-404';
    // }
    return `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${publisher}/vsextensions/${name}/${version}/vspackage`;
}

module.exports = {
    searchExtensions,
    getExtensionDetails,
    getDownloadUrl
};
