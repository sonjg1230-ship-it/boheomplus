# Security Specification — 단기납 자산케어 상담 DB

## 1. Data Invariants
1. **PII Isolation**: `/consultations/{consultationId}` contains customer phone numbers, full names, and birthdates. Only verified administrators (`request.auth.token.email_verified == true && request.auth.token.email == 'sonjg1230@gmail.com'`) can `get`, `list`, `update`, or `delete` consultation records. Unauthenticated or non-admin users can NEVER read consultation PII.
2. **Controlled Public Lead Creation**: Unauthenticated visitors may `create` a consultation document ONLY if:
   - Document ID matches `^[a-zA-Z0-9_\\-]+$` and `<= 128` chars.
   - Exact allowlisted keys (`hasOnly`) and required keys (`hasAll`) are satisfied.
   - Initial `status` is strictly `'접수대기'` (no forged `'상담완료'` status).
   - `createdAt == request.time` and `updatedAt == request.time`.
   - Every string length and numeric enum matches `firebase-blueprint.json`.
3. **Non-PII Public Feed**: `/public_feed/{feedId}` contains ONLY masked names (`홍*동`), region labels, plan period, monthly amount, and 10-year value. No phone numbers or birthdates are permitted (`hasOnly` enforced).
4. **Immutable Audit Fields on Update**: When an admin updates a consultation (`status` or `memo`), `createdAt`, `regCode`, `name`, `phone`, `birthDate`, `gender`, `region`, `period`, `monthlyAmount`, and `tenYearValue` MUST remain unchanged, and `updatedAt == request.time`.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated `get` or `list` on `/consultations` → DENIED
2. Authenticated non-admin (`other@gmail.com`) `get` or `list` on `/consultations` → DENIED
3. Spoofed admin email with `email_verified == false` → DENIED
4. Create `/consultations/{id}` with extra shadow field `isAdmin: true` → DENIED (`hasOnly`)
5. Create `/consultations/{id}` with forged `status: '상담완료'` → DENIED
6. Create `/consultations/{id}` with client-forged past `createdAt` (`!= request.time`) → DENIED
7. Create `/consultations/{id}` with oversized `name` (> 40 chars) → DENIED
8. Create `/consultations/{id}` with invalid `birthDate` (`"abcdef"`) → DENIED
9. Create `/consultations/{id}` with invalid document ID (`"../admin"` or >128 chars) → DENIED
10. Create `/public_feed/{id}` including PII field `phone: "010-1234-5678"` → DENIED (`hasOnly`)
11. Admin `update` on `/consultations/{id}` trying to alter `createdAt` or `phone` → DENIED
12. Unauthenticated `delete` or `update` on `/public_feed/{id}` → DENIED
