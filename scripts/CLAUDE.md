# Scripts — scripts/

Utility scripts for testing and maintenance.

## Files

### test-api.ts
End-to-end API test suite covering all REST endpoints.

- **Run**: `npm run test:api` (or `npx tsx scripts/test-api.ts`)
- **Requires**: Dev server running on `http://localhost:3000`
- **Pattern**: Sequential test groups (Auth → Leads → WhatsApp → Google Ads → Automations → Admin)
- **Auth**: Registers/logs in a test user, stores cookie for subsequent requests
- **Output**: Pass/fail results with `console.log` (no test framework dependency)

### Coverage
- Auth: register (validation, success), login (wrong password, success), me, logout
- Leads: CRUD operations, validation, authorization checks
- WhatsApp: status, qrcode, send
- Google Ads: status, auth URL, campaigns, summary
- Automations: CRUD, tick, logs
- Admin: clients, stats (admin-only access)

## Adding Tests for New Endpoints
1. Add a test function following the existing pattern:
```typescript
async function testMyModule() {
  console.log("\n🔧 MY MODULE");
  
  await test("GET /api/my-module — description", async () => {
    const res = await apiFetch("/api/my-module");
    if (res.status !== 200) return fail("test name", `status ${res.status}`);
    pass("test name");
  });
}
```
2. Call the function in the main execution flow at the bottom of the file.
