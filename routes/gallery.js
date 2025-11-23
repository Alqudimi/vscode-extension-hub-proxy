const express = require('express');
const router = express.Router();
const marketplaceService = require('../services/marketplace');
const openvsxService = require('../services/openvsx');
const { normalizeMarketplaceExtension, normalizeOpenVSXExtension, aggregateAndDeduplicate } = require('../utils/normalizer');
const cache = require('../utils/cache');
const axios = require('axios');

// Middleware for caching search results
const cacheMiddleware = (req, res, next) => {
    const key = cache.generateCacheKey(req);
    const cachedBody = cache.get(key);
    if (cachedBody) {
        console.log(`Cache HIT for ${req.path}`);
        return res.json(cachedBody);
    }
    console.log(`Cache MISS for ${req.path}`);
    // Attach the cache key to the request for later use in the response
    req.cacheKey = key;
    next();
};

// Helper to wrap the response in the required Microsoft Marketplace format
const wrapSearchResponse = (extensions) => {
    return {
        results: [{
            extensions: extensions,
            resultMetadata: [{
                metadataType: 'ResultCount',
                metadataValue: extensions.length.toString()
            }]
        }],
        // Add other required fields if necessary, but this is the minimum for VSCode to work
    };
};

/**
 * POST /gallery/search
 * Unified Search Endpoint
 */
router.post('/search', cacheMiddleware, async (req, res) => {
    // Extract search query from the request body (VSCode sends a complex object)
    const criteria = req.body.filters?.[0]?.criteria || [];
    const searchQuery = criteria.find(c => c.filterType === 10)?.value || '';

    if (!searchQuery) {
        return res.status(400).json({ message: 'Missing search query' });
    }

    try {
        // 1. Fetch results in parallel
        const [marketplaceResults, openvsxResults] = await Promise.all([
            marketplaceService.searchExtensions(searchQuery),
            openvsxService.searchExtensions(searchQuery)
        ]);

        // 2. Normalize and flatten results
        const normalizedMarketplace = marketplaceResults
            .map(normalizeMarketplaceExtension)
            .filter(ext => ext !== null);

        const normalizedOpenVSX = openvsxResults
            .map(normalizeOpenVSXExtension)
            .filter(ext => ext !== null);

        // 3. Aggregate, deduplicate, and prioritize
        const allExtensions = [...normalizedMarketplace, ...normalizedOpenVSX];
        const finalExtensions = aggregateAndDeduplicate(allExtensions);

        // 4. Wrap and send response
        const finalResponse = wrapSearchResponse(finalExtensions.map(ext => ext.raw)); // Send back the raw, normalized data for now

        // 5. Cache the result
        if (req.cacheKey) {
            cache.set(req.cacheKey, finalResponse);
        }

        res.json(finalResponse);

    } catch (error) {
        console.error('Error in unified search:', error.message);
        res.status(500).json({ message: 'Internal Server Error during search' });
    }
});

/**
 * POST /gallery/extensionquery
 * Unified Extension Detail Endpoint (often used for search too, but we'll treat it as detail fetch)
 */
router.post('/extensionquery', cacheMiddleware, async (req, res) => {
    // VSCode uses filterType 7 (Extension Name) for specific detail queries
    const criteria = req.body.filters?.[0]?.criteria || [];
    const extensionNameCriteria = criteria.find(c => c.filterType === 7);

    if (!extensionNameCriteria) {
        // Fallback to search if no specific extension name is provided
        return router.handle(req, res, () => {
            // This is a hack to call the search route from within the detail route
            // In a real app, we'd refactor the search logic into a shared function.
            // For now, we'll just return an error or an empty result.
            console.log('Extension query without filterType 7, treating as search fallback is not implemented.');
            return res.json(wrapSearchResponse([]));
        });
    }

    const [publisher, name] = extensionNameCriteria.value.split('.');

    if (!publisher || !name) {
        return res.status(400).json({ message: 'Invalid extension name format' });
    }

    try {
        // 1. Try Microsoft Marketplace first (prioritization)
        let extension = await marketplaceService.getExtensionDetails(publisher, name);

        if (!extension) {
            // 2. Fallback to Open VSX
            const openvsxExt = await openvsxService.getExtensionDetails(publisher, name);
            if (openvsxExt) {
                // Normalize Open VSX result to Marketplace schema for compatibility
                extension = normalizeOpenVSXExtension(openvsxExt).raw; // Use raw for full compatibility
            }
        }

        if (!extension) {
            return res.status(404).json({ message: 'Extension not found' });
        }

        // 3. Wrap and send response
        const finalResponse = wrapSearchResponse([extension]);

        // 4. Cache the result
        if (req.cacheKey) {
            cache.set(req.cacheKey, finalResponse);
        }

        res.json(finalResponse);

    } catch (error) {
        console.error('Error in extension query:', error.message);
        res.status(500).json({ message: 'Internal Server Error during detail fetch' });
    }
});

/**
 * GET /gallery/download/:publisher/:name/:version
 * VSIX Download Handling
 */
router.get('/download/:publisher/:name/:version', async (req, res) => {
    const { publisher, name, version } = req.params;
    const extensionId = `${publisher}.${name}`;

    // VSIX Download Caching (File-based caching is better for large binaries, but we'll use memory cache for simplicity)
    // For production, a file-based or external cache (like Redis) is highly recommended.
    const cacheKey = `vsix:${extensionId}:${version}`;
    // NOTE: We skip memory cache for VSIX streaming to avoid memory pressure.
    // The requirement is to proxy the stream, not store the whole file in memory.

    try {
        // 1. Try Microsoft Marketplace first
        let downloadUrl = marketplaceService.getDownloadUrl(publisher, name, version);
        let response;

        try {
            response = await axios({
                method: 'get',
                url: downloadUrl,
                responseType: 'stream',
                maxRedirects: 0, // Prevent axios from following redirects, we want the VSIX stream
                validateStatus: (status) => status >= 200 && status < 400 // Accept 2xx and 3xx
            });
        } catch (error) {
            // Marketplace failed or returned a non-2xx/3xx status
            console.log(`Marketplace download failed for ${extensionId}. Falling back to Open VSX.`);
            response = null;
        }

        // 2. Fallback to Open VSX if Marketplace failed
        if (!response || response.status >= 400) {
            downloadUrl = openvsxService.getDownloadUrl(publisher, name, version);
            console.log(`Trying Open VSX download for ${extensionId} at ${downloadUrl}`);
            try {
                response = await axios({
                    method: 'get',
                    url: downloadUrl,
                    responseType: 'stream',
                    maxRedirects: 0,
                    validateStatus: (status) => status >= 200 && status < 400
                });
            } catch (error) {
                console.error(`Open VSX download failed for ${extensionId}:`, error.message);
                return res.status(404).json({ message: 'VSIX file not found in any registry' });
            }
        }

        // 3. Proxy the stream
        if (response && response.data) {
            // Set headers for correct VSIX download
            res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${name}-${version}.vsix"`);
            if (response.headers['content-length']) {
                res.setHeader('Content-Length', response.headers['content-length']);
            }

            // Pipe the response stream to the client response
            response.data.pipe(res);
        } else {
            return res.status(404).json({ message: 'VSIX file not found' });
        }

    } catch (error) {
        console.error('Error in VSIX download handling:', error.message);
        res.status(500).json({ message: 'Internal Server Error during VSIX download' });
    }
});

module.exports = router;
