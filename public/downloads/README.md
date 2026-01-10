# Print Service Installers

This folder contains the Print Service installers for automatic order printing.

## Building Installers

From the `print-service` package, run:

```bash
cd packages/print-service
npm install
npm run build
```

This will generate installers in `packages/print-service/dist/`:

- `print-service-setup.exe` - Windows installer
- `print-service.dmg` - macOS installer
- `print-service.AppImage` - Linux installer

## Deploying Installers

Copy the generated installers to this folder:

```bash
cp packages/print-service/dist/*.exe packages/backend/public/downloads/
cp packages/print-service/dist/*.dmg packages/backend/public/downloads/
cp packages/print-service/dist/*.AppImage packages/backend/public/downloads/
```

## Download URLs

Once deployed, installers will be available at:

- Windows: `http://your-backend.com/downloads/print-service-setup.exe`
- macOS: `http://your-backend.com/downloads/print-service.dmg`
- Linux: `http://your-backend.com/downloads/print-service.AppImage`

## Installation Guide

1. Restaurant downloads appropriate installer
2. Runs installer
3. Print Service auto-starts and runs in system tray
4. Configure printer in settings
5. Orders auto-print when they arrive in admin web app

## Size

Each installer is approximately 15-20MB.
