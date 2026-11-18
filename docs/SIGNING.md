# Signing the installers

Today the installers are not signed, so macOS (Gatekeeper) and Windows (SmartScreen) show a
warning the first time. The build is ready to sign: add the secrets below to the repository
(*Settings → Secrets and variables → Actions*) and the next release comes out signed. Without
them, it keeps building unsigned installers exactly as now.

## macOS: Developer ID + notarization

Needs a paid [Apple Developer Program](https://developer.apple.com/programs/) membership
(US$ 99 per year).

1. In Xcode or the Apple Developer site, create a **Developer ID Application** certificate.
2. Export it from Keychain Access as a `.p12` file with a password.
3. Create an [app-specific password](https://support.apple.com/102654) for your Apple ID.
4. Add these secrets:

| Secret | Value |
| --- | --- |
| `MAC_CSC_LINK` | the `.p12` file encoded in base64 (`base64 -i cert.p12 \| pbcopy`) |
| `MAC_CSC_KEY_PASSWORD` | the `.p12` password |
| `APPLE_ID` | your Apple ID e-mail |
| `APPLE_APP_SPECIFIC_PASSWORD` | the app-specific password |
| `APPLE_TEAM_ID` | your 10-character Team ID |

With all five set, the Mac builds are signed and notarized. Signed Mac builds can also
update themselves; that needs the `zip` target added next to `dmg` in `electron-builder.yml`.

## Windows: code signing certificate

Needs a code signing certificate from a certificate authority (OV or EV), or Azure Trusted
Signing. Export it as `.pfx` and add:

| Secret | Value |
| --- | --- |
| `WIN_CSC_LINK` | the `.pfx` file encoded in base64 |
| `WIN_CSC_KEY_PASSWORD` | the `.pfx` password |

SmartScreen builds reputation over time; an EV certificate removes the warning right away.

## Local builds

`npm run dist:mac` looks for a Developer ID certificate in your keychain. To force an unsigned
local build, run it with `CSC_IDENTITY_AUTO_DISCOVERY=false`.
