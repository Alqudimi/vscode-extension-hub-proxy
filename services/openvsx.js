const axios = require('axios');
const OPENVSX_URL = 'https://open-vsx.org/api';

/**
 * Fetches extensions from the Open VSX Registry based on a search query.
 * @param {string} query The search query.
 * @returns {Promise<Array>} A promise that resolves to an array of extensions.
 */
async function searchExtensions(query) {
    // Open VSX uses a simpler search API: /search?query={query}
    const searchUrl = `${OPENVSX_URL}/search?query=${encodeURIComponent(query)}`;

    try {
        const response = await axios.get(searchUrl);
        // Open VSX returns a 'results' object with 'extensions' array
        return response.data.extensions || [];
    } catch (error) {
        console.error('Error fetching from Open VSX Registry:', error.message);
        return [];
    }
}

/**
 * Fetches details for a specific extension from the Open VSX Registry.
 * @param {string} publisher The extension publisher.
 * @param {string} name The extension name.
 * @returns {Promise<Object|null>} A promise that resolves to the extension object or null.
 */
async function getExtensionDetails(publisher, name) {
    // Open VSX details API: /{publisher}/{extensionName}
    const detailsUrl = `${OPENVSX_URL}/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}`;

    try {
        const response = await axios.get(detailsUrl);
        return response.data;
    } catch (error) {
        // Open VSX returns 404 for not found, which axios throws as an error
        if (error.response && error.response.status === 404) {
            return null;
        }
        console.error(`Error fetching details for ${publisher}/${name} from Open VSX Registry:`, error.message);
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
    // Open VSX download URL: /{publisher}/{extensionName}/{version}/file/{extensionName}-{version}.vsix
    // Note: The file name format might vary slightly, but this is the standard.
    // For Fallback testing, we will force a success for a specific extension (e.g., 'test.fallback')
    // if (publisher === 'test' && name === 'fallback') {
    //     // Use a known good VSIX from Open VSX for the fallback test
    //     return `https://open-vsx.org/api/redhat/java/1.26.0/file/redhat.java-1.26.0.vsix`;
    // }
    return `${OPENVSX_URL}/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}/file/${encodeURIComponent(name)}-${encodeURIComponent(version)}.vsix`;
}

module.exports = {
    searchExtensions,
    getExtensionDetails,
    getDownloadUrl
};
