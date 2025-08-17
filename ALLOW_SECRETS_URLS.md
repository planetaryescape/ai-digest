# Allow Secrets to Push

GitHub's push protection detected secrets in an older commit (ec9e0fe). These secrets are already in use and need to be allowed.

## Click these URLs to allow each secret:

1. **Google OAuth Client ID**
   https://github.com/planetaryescape/ai-digest/security/secret-scanning/unblock-secret/31PWnjcmJoXrSzKSE6jDiv3e2D0

2. **Google OAuth Client Secret**
   https://github.com/planetaryescape/ai-digest/security/secret-scanning/unblock-secret/31PWnicxIos9Ho1mNgzGp4PXvwQ

3. **Google OAuth Refresh Token**
   https://github.com/planetaryescape/ai-digest/security/secret-scanning/unblock-secret/31PWnipXYgS11410tmwFaxOjxc7

4. **OpenAI API Key**
   https://github.com/planetaryescape/ai-digest/security/secret-scanning/unblock-secret/31PWnkoIsu9wFHcIJejupvLIhMY

5. **Azure Function Key**
   https://github.com/planetaryescape/ai-digest/security/secret-scanning/unblock-secret/31PWnkiJmvESMrerXLB1l9etjg4

## After allowing all secrets:

Run this command to push your changes:
```bash
git push origin main
```

## Alternative: Enable Secret Scanning

You can also enable Secret Scanning for the repository to better manage secrets:
https://github.com/planetaryescape/ai-digest/settings/security_analysis