# Security Guide

This project now includes:

- CSRF protection for state-changing authenticated requests
- salted PBKDF2 password hashing
- auth rate limiting and temporary lockout on repeated failures
- manager security alerts for repeated auth abuse
- stricter upload validation for profile photos and resume PDFs
- basic hardening headers on API responses

## Production Checklist

1. Run the app only behind HTTPS.
2. Set `SESSION_COOKIE_SECURE=true` in production.
3. Set `CORS_ORIGINS` to your exact frontend origin list. Do not use `*`.
4. Keep `RECAPTCHA_SECRET_KEY`, database credentials, AI keys, and SMTP credentials only in server-side environment variables.
5. Use a managed secret store in production.
6. Rotate secrets on a schedule and immediately after any suspected leak.

## Required Environment Practices

- `SUPABASE_DB_URL` or `DATABASE_URL`
  Use a least-privilege database account.
- `RECAPTCHA_SECRET_KEY`
  Required for login and registration abuse controls.
- `SESSION_COOKIE_SECURE=true`
  Required when the app is served over HTTPS.
- `CORS_ORIGINS=https://your-frontend.example.com`
  Comma-separate only trusted origins.

## Secret Rotation

Rotate these regularly:

- database credentials
- SMTP credentials
- OpenAI and Gemini API keys
- resume parser API keys
- reCAPTCHA secrets

Recommended process:

1. Create the new secret in your provider console.
2. Update production environment variables.
3. Redeploy backend instances.
4. Verify health and login flow.
5. Revoke the old secret.
6. Record the rotation date and owner.

## HTTPS-Only Deployment

- Terminate TLS at your reverse proxy or load balancer.
- Redirect all HTTP traffic to HTTPS.
- Enable HSTS at the edge.
- Keep cookies `Secure` and `SameSite=Lax`.
- Never expose the backend directly on a public insecure port.

## Upload Security

- Resume uploads are restricted to PDF only.
- Resume max size is 5 MB.
- Profile photos are restricted to JPEG, PNG, or WEBP.
- Profile photo max size is 2 MB.

If you raise these limits, update both frontend and backend validation together.

## CSRF Model

Authenticated browser sessions use:

- `session_token` cookie
- `csrf_token` cookie
- `X-CSRF-Token` request header

The frontend API client automatically sends the CSRF header for `POST`, `PUT`, `PATCH`, and `DELETE`.

## Incident Response

If suspicious auth activity is detected:

1. Review audit logs for repeated failed auth attempts.
2. Check manager security alerts and notification history.
3. Rotate exposed secrets if compromise is suspected.
4. Revoke active sessions for affected accounts.
5. Force password resets for impacted users.

## Residual Risk

No web app is "impossible to hack." This guide reduces common risk, but you should still add:

- centralized session storage like Redis
- real monitoring and alerting
- dependency scanning in CI
- vulnerability patching cadence
- backup and restore drills
- external penetration testing before production launch
