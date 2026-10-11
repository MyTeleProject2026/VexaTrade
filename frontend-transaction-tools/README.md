# VexaTrade Transaction Tools: Web + Android + iOS

## Web static site
- Render Static Site root: `frontend-transaction-tools`
- Build command: `npm install && npm run build`
- Publish directory: `dist`

## Android APK
GitHub Actions builds a debug APK for installation/testing and uploads it as an artifact. Download `vexatrade-android-debug-apk` from the workflow run and install the APK on an Android device. Android may ask you to permit installs from your browser/file manager. This is a debug-signed testing package, not a production release.

## iOS
GitHub Actions builds an iOS Simulator `.app` bundle and uploads it as a ZIP artifact. This is for Simulator testing and **is not an installable iPhone IPA**. A signed physical-device IPA / App Store build requires an Apple Developer account, signing certificate, provisioning profile, and protected CI secrets. Those credentials must be configured by the repository owner; never commit them.

## Run builds
Push changes to `frontend-transaction-tools/**` or manually run the **Transaction Tools Mobile Packages** workflow from GitHub Actions.

## Local development
```bash
npm install
npm run dev
npm run build
npx cap add android
npx cap add ios
npx cap sync
```

## Security and balance integrity
The mobile apps bundle the same static frontend. They do not create on-chain transactions, custody keys, verify exchange-account balances, or credit a VexaTrade account. An internal VXT reference is not a blockchain TXID. Real deposit settlement must be implemented and enforced by the authenticated backend.
