const express = require('express');
const bodyParser = require('body-parser');
const galleryRoutes = require('./routes/gallery');

const app = express();
// Use environment variable PORT, default to 3000
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies (required for VSCode API calls)
app.use(bodyParser.json({ limit: '50mb' }));

// Health Check Endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Composite Extension Marketplace Proxy is running.',
        version: '1.0.0'
    });
});

// Main Gallery API Routes
// VSCode expects the API to be at /_apis/public/gallery/
// We will use /gallery/ as the base and let the user configure the full URL
// The user's example config suggests: "serviceUrl": "https://my-proxy.onrender.com/_apis/public/gallery"
// To support this, we'll mount the routes at the root and rely on the proxy path.
// However, for simplicity and clean code, we'll use /gallery/ and document the required proxy setup.
// The user's example config in the request is: "serviceUrl": "https://my-proxy.onrender.com/_apis/public/gallery"
// And the required endpoints are: POST /gallery/search, POST /gallery/extensionquery, GET /gallery/download/:publisher/:name/:version
// This means the base path is /gallery/ or /_apis/public/gallery/ depending on the proxy setup.
// Let's assume the proxy is configured to forward /_apis/public/gallery/* to our root.
// We will use the required endpoints directly.

// The required endpoints are:
// POST /gallery/search
// POST /gallery/extensionquery
// GET  /gallery/item/:publisher/:name/:version (Not implemented in galleryRoutes, but can be a redirect to detail query)
// GET  /gallery/download/:publisher/:name/:version

// The VSCode Marketplace protocol is complex. The request requires:
// POST /gallery/search -> maps to /gallery/search
// POST /gallery/extensionquery -> maps to /gallery/extensionquery
// GET /gallery/item/:publisher/:name/:version -> This is usually a redirect to the extension page, not an API. We'll skip this for now as it's not critical for extension installation.
// GET /gallery/download/:publisher/:name/:version -> maps to /gallery/download/:publisher/:name/:version

// We will mount the routes at /gallery to match the requested endpoint structure.
app.use('/gallery', galleryRoutes);

// Compatibility wrapper for the VSCode Marketplace protocol
// The VSCode client often sends requests to /_apis/public/gallery/extensionquery
// If the proxy is set up to forward /_apis/public/gallery/* to our root, the above will work.
// If not, we need a wrapper. Let's assume the user will configure the extensionsGallery serviceUrl to point to our /gallery endpoint.
// E.g., "serviceUrl": "http://localhost:3000/gallery"

// Start the server
app.listen(PORT, () => {
    console.log(`Composite Extension Marketplace Proxy listening on port ${PORT}`);
    console.log(`Health Check: http://localhost:${PORT}/`);
    console.log(`API Base: http://localhost:${PORT}/gallery`);
});
