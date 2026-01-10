# Print Service Installer - Coming Soon

The Print Service installer is currently being prepared.

## To build the installers:

1. Navigate to print-service package:
   ```bash
   cd packages/print-service
   npm install
   npm run build
   ```

2. Copy installers to downloads folder:
   ```bash
   cp dist/*.exe ../backend/public/downloads/print-service-windows.exe
   cp dist/*.dmg ../backend/public/downloads/print-service-mac.dmg
   cp dist/*.AppImage ../backend/public/downloads/print-service-linux.AppImage
   ```

3. Restart backend server

## Alternative: Manual Installation

For now, you can skip the installer and run Print Service manually:

```bash
cd packages/print-service
npm install
npm start
```

This will start the Print Service on your computer at http://localhost:9100

Then refresh the admin web app - it should detect the service automatically!

---

**Note:** The installer files will be available soon. Use manual installation for testing.
