# Authentication System

## Overview

The GVNApp uses Firebase Authentication with Google Sign-In for user authentication. The system is designed to work seamlessly across both desktop and mobile devices with proper state persistence.

## Key Features

### 1. Persistent Login State
- Uses `browserLocalPersistence` to maintain login state across browser sessions
- Users remain logged in even after closing the browser
- Fixes issues where login only worked in incognito mode

### 2. Device-Adaptive Authentication

#### Desktop (Popup-based)
- Uses `signInWithPopup` for a seamless in-app experience
- No page redirection required
- Better UX for desktop users

#### Mobile (Redirect-based)
- Automatically uses `signInWithRedirect` on mobile devices
- Avoids popup blocking issues common on mobile browsers
- Better compatibility with mobile Safari, Chrome Mobile, etc.
- Handles iOS Safari and Android Chrome properly

### 3. Mobile Device Detection

The system automatically detects mobile devices using multiple factors:
- User agent string patterns (iOS, Android, etc.)
- Touch support detection
- Screen size (< 768px)
- PWA standalone mode

## How It Works

### Authentication Flow

1. **User clicks "Continue with Google"**
   - System detects device type
   - Desktop: Opens Google login popup
   - Mobile: Redirects to Google login page

2. **User completes authentication**
   - Desktop: Returns to app immediately with credentials
   - Mobile: Redirects back to app with authentication token

3. **AuthContext processes authentication**
   - Checks for redirect results (mobile)
   - Monitors auth state changes
   - Creates or updates user document in Firestore
   - Sets user in global state

4. **Persistent session**
   - Auth state stored in browser's localStorage
   - Survives browser restarts
   - Automatically restores on app load

### Error Handling

The system provides user-friendly error messages for common issues:
- Popup blocked: Asks user to allow popups
- Network errors: Suggests checking internet connection
- Unauthorized domain: Directs to contact admin
- User cancelled: Simple cancellation message

## Implementation Details

### Firebase Config (`src/firebase/config.ts`)
```typescript
// Explicit persistence configuration
setPersistence(auth, browserLocalPersistence)
```

### Device Detection (`src/utils/deviceDetection.ts`)
```typescript
// Detects mobile devices reliably
export function isMobileDevice(): boolean {
  // Checks user agent, touch support, and screen size
}
```

### Auth Context (`src/contexts/AuthContext.tsx`)
```typescript
// Handles redirect results for mobile
useEffect(() => {
  const checkRedirectResult = async () => {
    const result = await getRedirectResult(auth)
    // Process result if exists
  }
  checkRedirectResult()
}, [])

// Adaptive sign-in method
const signInWithGoogle = async () => {
  if (isMobileDevice()) {
    await signInWithRedirect(auth, provider)
  } else {
    await signInWithPopup(auth, provider)
  }
}
```

## Testing

### Desktop Testing
1. Open app in desktop browser
2. Click "Continue with Google"
3. Popup should appear
4. Complete authentication
5. Should remain logged in after browser restart

### Mobile Testing
1. Open app on mobile device (or mobile emulator)
2. Click "Continue with Google"
3. Page should redirect to Google login
4. Complete authentication
5. Should redirect back to app
6. Should remain logged in after closing browser

### Incognito/Private Mode
- Should work in both normal and incognito modes
- Incognito mode won't persist login (expected behavior)

## Common Issues

### Issue: Login only works in incognito mode
**Solution**: Fixed by adding explicit `browserLocalPersistence` configuration

### Issue: Popup blocked on mobile
**Solution**: Fixed by using redirect-based auth on mobile devices

### Issue: Auth state not persisting
**Solution**: Ensure `setPersistence` is called before any sign-in operations

### Issue: Redirect loop on mobile
**Solution**: Check that `getRedirectResult` is called only once on mount

## Security Considerations

1. **Account Selection**: Forces account selection to avoid cached account issues
2. **HTTPS Only**: Firebase Auth requires HTTPS in production
3. **Domain Whitelist**: Only authorized domains can use authentication
4. **Token Refresh**: Firebase automatically refreshes tokens
5. **Logout**: Properly clears all auth state and user data

## Future Improvements

Potential enhancements:
- Add email/password authentication
- Implement phone number authentication
- Add multi-factor authentication
- Support additional OAuth providers (Facebook, Apple, etc.)
- Add biometric authentication for mobile PWA

## References

- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Google Sign-In Best Practices](https://developers.google.com/identity/sign-in/web/sign-in)
- [PWA Authentication Patterns](https://web.dev/sign-in-form-best-practices/)
