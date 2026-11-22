# Security Specification — Mini Market RBAC & POS

## 1. Data Invariants
1. **Unique Super Admin**: Only the verified Google account `mecanicadakar@gmail.com` (`email_verified == true`) holds `super_admin` privileges. No staff user can self-assign `super_admin` or `manager`.
2. **Manager Boundaries**: A `manager` with `manageCashiers == true` can create, list, and update `cashier` profiles they manage, but can never create, edit, or deactivate `super_admin` or `manager` accounts.
3. **Cashier Isolation**: A `cashier` can only read their own `/staff/{uid}` document and cannot list other staff members or alter any `role`, `active`, or `permissions` fields.
4. **Immutable Audit & Ownership Fields**: `createdAt`, `uid`, `createdByUid`, `cashierUid`, `openedByUid`, `operatorUid`, and `actorUid` are immutable after creation; `createdAt` and `updatedAt` must match `request.time`.
5. **Terminal State Locking**: Once a `Shift` reaches `status == 'cerrado'` or a `Sale` reaches `status == 'anulada'`, non-admin users cannot revert or alter its terminal state.
6. **Strict Schema Enforcement**: Every write enforces `keys().hasAll(...)` and `keys().hasOnly(...)` plus strict string `.size()` bounds and `isValidId()` path validation.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Self-Elevation to Super Admin**: Cashier writes `/staff/{uid}` with `role: "super_admin"`.
2. **Self-Elevation to Manager**: Cashier writes `/staff/{uid}` with `role: "manager"`.
3. **Manager Creating Manager**: Manager creates `/staff/newId` with `role: "manager"`.
4. **Manager Escalating Cashier Permissions to Manage Managers**: Manager updates cashier with `permissions.manageManagers: true`.
5. **Shadow Ghost Field Injection**: User creates `/products/p1` with extra field `isAdminApproved: true`.
6. **Email Spoofing Without Verification**: Unverified auth token (`email_verified: false`) claims `email: "mecanicadakar@gmail.com"`.
7. **ID Poisoning**: Document created at `/products/../../invalid$id` failing `isValidId()`.
8. **1MB String Exhaustion**: Product created with `name` > 160 characters.
9. **Client Timestamp Forgery**: Sale created with `createdAt` in the past instead of `request.time`.
10. **Cashier Updating Product Price Without Permission**: Cashier without `manageInventory` updates `/products/p1.salePrice`.
11. **Reopening Closed Shift**: Manager or Cashier updates `/shifts/s1` from `status: "cerrado"` back to `status: "abierto"`.
12. **Cross-Owner Sale Spoofing**: Cashier creates `/sales/v1` with `cashierUid` set to another user's UID.
