# iPhone PWA QA Checklist

## Installation

1. Open **Safari** on iPhone (iOS 15+)
2. Navigate to the deployed app URL
3. Tap **Share** (square with arrow icon in toolbar)
4. Scroll down and tap **Add to Home Screen**
5. Name the app (default: "Gaz Expenses")
6. Tap **Add**

The app icon appears on the home screen.

## Verification

### PWA Behaviour
- [ ] App opens in standalone mode (no Safari chrome)
- [ ] Status bar respects `black-translucent` setting
- [ ] Safe area insets respected (content not hidden behind notch/home indicator)
- [ ] App name shows "Gaz Expenses"
- [ ] App icon visible on home screen

### Core Functionality
- [ ] Receipt camera opens on tap (not automatically)
- [ ] Photo capture works from home screen app
- [ ] File upload works from Files app
- [ ] Gemini receipt scanning succeeds
- [ ] Manual expense entry works
- [ ] Paid/Unpaid toggle tap target is comfortable
- [ ] Receipt preview opens and scrolls
- [ ] Printable report generates
- [ ] Theme colour picker works with touch

### Data Safety
- [ ] Existing expenses persist across app opens
- [ ] Theme preference persists across app opens
- [ ] Paid/Unpaid status persists across app opens
- [ ] No IndexedDB errors in Safari console
- [ ] No Gemini API key visible in network tab

### Known iPhone Limitations
- PWA does not support push notifications
- IndexedDB may be cleared by iOS after 7 days of inactivity
- Camera `capture="environment"` uses rear camera by default
- HEIC photos from camera may need conversion before Gemini upload
- No background sync — uploads pause when app is backgrounded

### Recovery Steps
1. If app shows blank screen: close and reopen from home screen icon
2. If camera fails: allow camera permission in Settings > Safari > Camera
3. If data is lost: import from JSON backup
4. For a clean install: remove home screen icon, clear Safari data, re-add
