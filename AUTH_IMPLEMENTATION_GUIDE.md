# Authentication Implementation Guide for Next.js Apps

This guide documents how to add session-based authentication with Master PIN protection to a Next.js 15 application with Prisma and Docker.

**Reference Implementation:** BacPipes (app-edge3) on Edge-3
**Target Application:** Data Storage Dashboard (app-db3) on Db-3

---

## Overview

The authentication system provides:
- Single admin account with username/password
- Session-based auth using encrypted cookies (iron-session)
- Master PIN to protect password changes (only admin can change password)
- CLI recovery scripts for forgotten credentials
- Middleware-based route protection

---

## Files to Copy

Copy these files from `app-edge3/frontend/` to `app-db3/frontend/`:

### 1. Core Libraries (create `src/lib/` if needed)

| Source | Destination | Purpose |
|--------|-------------|---------|
| `src/lib/auth.ts` | `src/lib/auth.ts` | Password hashing (bcryptjs) |
| `src/lib/session.ts` | `src/lib/session.ts` | Session config (iron-session) |

### 2. API Routes (create folders as needed)

| Source | Destination | Purpose |
|--------|-------------|---------|
| `src/app/api/auth/login/route.ts` | `src/app/api/auth/login/route.ts` | Login endpoint |
| `src/app/api/auth/logout/route.ts` | `src/app/api/auth/logout/route.ts` | Logout endpoint |
| `src/app/api/auth/password/route.ts` | `src/app/api/auth/password/route.ts` | Change password |
| `src/app/api/auth/pin/route.ts` | `src/app/api/auth/pin/route.ts` | Set/change Master PIN |

### 3. Login Page

| Source | Destination | Purpose |
|--------|-------------|---------|
| `src/app/login/page.tsx` | `src/app/login/page.tsx` | Login form UI |
| `src/app/login/layout.tsx` | `src/app/login/layout.tsx` | Login layout |

### 4. Middleware

| Source | Destination | Purpose |
|--------|-------------|---------|
| `src/middleware.ts` | `src/middleware.ts` | Route protection |

### 5. CLI Recovery Scripts (create `scripts/` folder)

| Source | Destination | Purpose |
|--------|-------------|---------|
| `scripts/reset-password.js` | `scripts/reset-password.js` | Reset to "admin" |
| `scripts/reset-pin.js` | `scripts/reset-pin.js` | Remove Master PIN |
| `scripts/set-pin.js` | `scripts/set-pin.js` | Set PIN directly |

---

## Files to Modify

### 1. package.json - Add Dependencies

```json
{
  "dependencies": {
    "iron-session": "^8.0.4",
    "bcryptjs": "^3.0.3"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6"
  }
}
```

Run: `npm install iron-session bcryptjs && npm install -D @types/bcryptjs`

### 2. prisma/schema.prisma - Add Auth Fields

Add these fields to the `SystemSettings` model (or create it):

```prisma
model SystemSettings {
  id                Int      @id @default(autoincrement())

  // Authentication fields - ADD THESE
  adminUsername     String   @default("admin")
  adminPasswordHash String   @default("")  // Empty = use "admin"
  masterPinHash     String?  // Optional, protects password changes

  // ... other existing fields ...

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

Create migration: `npx prisma migrate dev --name add_auth_fields`

### 3. Dockerfile - Copy Scripts Folder

Add this line to copy scripts into the container:

```dockerfile
# In the runner/production stage, after copying node_modules:
COPY --from=builder /src/scripts ./scripts
```

### 4. .gitignore - Allow lib/ Folder

If `.gitignore` has `lib/` pattern (common for Python), change to `/lib/` to only match root:

```gitignore
# Change this:
lib/

# To this (only matches root-level lib):
/lib/
```

Also add exception for Prisma migrations if `*.sql` is ignored:

```gitignore
# Allow Prisma migration SQL files
!frontend/prisma/migrations/**/migration.sql
```

### 5. Navigation Component - Add Logout Button

Add logout functionality to your navigation/header:

```tsx
const handleLogout = async () => {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}
```

### 6. Settings Page - Add PIN/Password Management

Add sections to Settings page for:
- Set/Change Master PIN (4-6 digits)
- Change Password (requires current password + PIN if set)

---

## Critical Pitfalls to Avoid

### 1. Session Cookie Not Working in API Routes

**WRONG** - Using `cookies()` from next/headers:
```typescript
import { cookies } from 'next/headers'
const session = await getIronSession(cookies(), sessionOptions)
```

**CORRECT** - Using request/response pattern:
```typescript
import { NextRequest, NextResponse } from 'next/server'
const response = NextResponse.json({ success: true })
const session = await getIronSession<SessionData>(request, response, sessionOptions)
session.destroy()
return response  // Must return this response!
```

### 2. Session Options Must Be `secure: false` for HTTP

For internal/edge deployments without HTTPS:
```typescript
cookieOptions: {
  secure: false,  // NOT process.env.NODE_ENV === 'production'
  httpOnly: true,
  sameSite: 'lax' as const,
}
```

### 3. Session Options Must Be in ONE Place

Define `sessionOptions` in `src/lib/session.ts` ONLY. Import it everywhere else.
Having different configs in different files caused logout to fail silently.

### 4. Default Password Hash

The DEFAULT_PASSWORD_HASH in auth.ts must actually match "admin":
```typescript
// Generate with: bcrypt.hashSync('admin', 10)
export const DEFAULT_PASSWORD_HASH = '$2b$10$fkbfQ7KDpWjdlRYKCXuvh.2TSxvblJCkakqU2esBHHZ1y7W3zQyxW'
```

### 5. Middleware Matcher Must Exclude Auth Routes

```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|api/auth).*)',
  ],
}
```

### 6. Docker Healthcheck Endpoint Blocked by Auth

If your docker-compose uses a healthcheck that calls an API endpoint, that endpoint will now return 401 Unauthorized. Add it to publicPaths in middleware.ts:

```typescript
const publicPaths = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/dashboard/summary',  // Required for Docker healthcheck
]
```

### 7. Next.js 15 Binds to Container Hostname (Not localhost)

Next.js 15 standalone mode binds to the container's hostname by default, not `0.0.0.0`. This causes healthchecks using `localhost` to fail with ECONNREFUSED.

**Fix:** Add `HOSTNAME: 0.0.0.0` to your frontend service in docker-compose.yml:

```yaml
frontend:
  environment:
    HOSTNAME: 0.0.0.0  # Required for Next.js 15 to listen on all interfaces
    # ... other env vars
```

### 8. Fresh Deployment - Login Returns 500 "System not configured"

On fresh deployments, the `SystemSettings` table is empty (seed doesn't run automatically). Login fails with 500 error.

**Fix:** Modify login route to auto-create default settings:

```typescript
// In src/app/api/auth/login/route.ts
let settings = await prisma.systemSettings.findFirst()

if (!settings) {
  settings = await prisma.systemSettings.create({
    data: {
      adminUsername: 'admin',
      adminPasswordHash: '', // Empty = use default "admin" password
    }
  })
}
```

---

## Integration Steps (Order Matters)

1. **Install dependencies** (package.json)
2. **Update Prisma schema** and run migration
3. **Copy lib files** (auth.ts, session.ts)
4. **Copy API routes** (all 4 auth routes)
5. **Copy login page** (page.tsx, layout.tsx)
6. **Copy middleware.ts** to src/
7. **Copy scripts/** folder
8. **Update Dockerfile** to copy scripts
9. **Update .gitignore** if needed
10. **Add logout button** to Navigation
11. **Add PIN/password UI** to Settings page
12. **Rebuild container**: `docker compose build && docker compose up -d`
13. **Test**: Login with admin/admin, set PIN, change password, logout, re-login

---

## CLI Commands for Recovery

```bash
# Reset password to "admin"
docker exec <container-name> node scripts/reset-password.js

# Reset Master PIN (removes it)
docker exec <container-name> node scripts/reset-pin.js

# Set Master PIN directly
docker exec <container-name> node scripts/set-pin.js 1234
```

---

## Testing Checklist

- [ ] Login with admin/admin works
- [ ] Invalid credentials shows error
- [ ] Protected routes redirect to /login when not authenticated
- [ ] Logout clears session (can't access protected routes after)
- [ ] Set Master PIN works
- [ ] Password change requires PIN (if PIN is set)
- [ ] Password change works with correct PIN
- [ ] CLI reset-password.js works
- [ ] CLI reset-pin.js works
- [ ] CLI set-pin.js works
- [ ] Session expires after 3 hours

---

## File Contents Reference

The agent should read these files from app-edge3 to copy:

```
app-edge3/frontend/
├── src/
│   ├── lib/
│   │   ├── auth.ts
│   │   └── session.ts
│   ├── app/
│   │   ├── api/auth/
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   ├── password/route.ts
│   │   │   └── pin/route.ts
│   │   └── login/
│   │       ├── page.tsx
│   │       └── layout.tsx
│   └── middleware.ts
└── scripts/
    ├── reset-password.js
    ├── reset-pin.js
    └── set-pin.js
```
