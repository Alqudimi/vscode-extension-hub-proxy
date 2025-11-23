# Composite Extension Marketplace Proxy

A Node.js proxy for aggregating Microsoft Marketplace and Open VSX registry for VSCode OSS (Void Editor).

## 🌟 Features

*   **Unified Search:** Aggregates search results from both the official Visual Studio Code Marketplace and the Open VSX Registry.
*   **Prioritized Results:** Automatically deduplicates and prioritizes extensions, ensuring the best source is used.
*   **VSIX Download Proxy:** Proxies VSIX file downloads, with a fallback mechanism to Open VSX if the Microsoft Marketplace download fails.
*   **Caching:** Implements caching for search results to improve performance and reduce external API calls.
*   **VSCode Compatibility:** Designed to be compatible with the VSCode extension API protocol.

## 🚀 Getting Started

### Prerequisites

*   Node.js (LTS recommended)
*   pnpm (or npm/yarn)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/Alqudimi/vscode-extension-hub-proxy.git
    cd vscode-extension-hub-proxy
    ```
2.  Install dependencies:
    ```bash
    pnpm install
    ```

### Running the Server

Start the proxy server:

```bash
pnpm start
```

The server will run on `http://localhost:3000` by default.

### Configuration for VSCode OSS (e.g., VSCodium, Void Editor)

To use this proxy, you need to configure your editor's settings to point to the proxy server.

Add the following configuration to your settings file (e.g., `settings.json`):

```json
"extensionsGallery": {
    "serviceUrl": "http://localhost:3000/gallery",
    "itemUrl": "http://localhost:3000/gallery"
}
```

Replace `http://localhost:3000` with the actual URL of your deployed proxy server.

## 🧪 Testing

A comprehensive end-to-end test script is included to validate the core functionalities, including search, detail query, and VSIX download with fallback.

To run the tests:

```bash
chmod +x test_script.sh
./test_script.sh
```

## 🤝 Contributing

We welcome contributions! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for details on how to get started.

## 📄 License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.

## 📧 Contact

For questions or support, please contact the developer:

*   **Developer:** Abdulaziz Alqudimi
*   **Email:** eng7mi@gmail.com
*   **GitHub Repository:** [Alqudimi/vscode-extension-hub-proxy](https://github.com/Alqudimi/vscode-extension-hub-proxy.git)
