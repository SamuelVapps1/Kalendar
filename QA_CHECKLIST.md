# QA Checklist

## Milestone 5 Hardening v1.1

### P0: Storage Folder Handle Invalidation

- [ ] **Test: Revoke site permissions**
  1. Select a storage folder in Settings
  2. Upload a photo to a visit
  3. Go to Chrome settings → Site settings → Storage → Clear data (or revoke permissions)
  4. Return to app → Settings page
  5. **Expected**: Validation status shows "Invalid" with reason "handle_invalid"
  6. **Expected**: Warning banner appears with "Re-select Folder" button
  7. Click "Re-select Folder" and select the same folder
  8. **Expected**: Validation status changes to "Valid"
  9. Navigate to visit page with photos
  10. **Expected**: Photos load successfully

- [ ] **Test: Permission denied**
  1. Select a storage folder
  2. Deny permission when prompted
  3. **Expected**: Settings shows "Invalid" with reason "permission_denied"
  4. **Expected**: Warning banner appears
  5. Click "Re-select Folder"
  6. Grant permission
  7. **Expected**: Status changes to "Valid"

- [ ] **Test: Invalid handle error handling**
  1. With invalid folder handle, try to upload photo
  2. **Expected**: User-friendly error message appears: "Storage folder handle is invalid. Please re-select the folder in Settings."
  3. **Expected**: App does not crash

### P1: Autosave Write Queue

- [ ] **Test: Rapid edits**
  1. Open a visit page
  2. Rapidly change status, duration, price, and notes in quick succession
  3. Wait for save indicator to disappear
  4. Refresh the page
  5. **Expected**: All values match the last edit (no rollback to intermediate state)
  6. **Expected**: No console errors about overlapping saves

- [ ] **Test: Concurrent field updates**
  1. Type quickly in notes field
  2. While typing, also change status dropdown
  3. Wait for autosave to complete
  4. **Expected**: Both notes and status are saved correctly
  5. **Expected**: No data loss or corruption

### P1: Photo Delete with Filesystem Cleanup

- [ ] **Test: Delete photo from UI**
  1. Upload a photo to a visit
  2. Click the ✕ button on the photo thumbnail
  3. Confirm deletion
  4. **Expected**: Photo disappears from UI immediately
  5. **Expected**: Photo blob URL is revoked (check browser memory)
  6. Navigate away and back
  7. **Expected**: Photo does not reappear

- [ ] **Test: Delete photo from filesystem**
  1. Upload a photo
  2. Note the file path from Settings → Verify Photos
  3. Delete the photo from UI
  4. Run "Verify Photos" in Settings
  5. **Expected**: Photo is not listed in missing files
  6. **Expected**: File is actually deleted from filesystem (check folder manually if possible)

- [ ] **Test: Delete with filesystem error (best-effort)**
  1. Upload a photo
  2. Manually delete the file from filesystem (or revoke permissions)
  3. Delete photo from UI
  4. **Expected**: Photo is removed from database
  5. **Expected**: Non-blocking warning shown if filesystem delete fails
  6. **Expected**: App continues to work normally

- [ ] **Test: Memory leak prevention**
  1. Upload multiple photos
  2. Delete one photo
  3. Upload another photo
  4. **Expected**: Old blob URLs are revoked before new ones are created
  5. **Expected**: No memory leak (check browser DevTools → Memory)

### P2: Dexie Upgrade Hook

- [ ] **Test: Version 2 upgrade**
  1. Check browser DevTools → Application → IndexedDB → GroomingCRM
  2. **Expected**: Database version is 2
  3. **Expected**: Tables exist: clients, dogs, visits, eventLinks, kv, visitPhotos
  4. **Expected**: No console errors about upgrade failures

### General Functionality

- [ ] **Test: Build passes**
  1. Run `npm run build`
  2. **Expected**: Build completes without errors
  3. **Expected**: No TypeScript errors

- [ ] **Test: Error messages are user-friendly**
  1. Test various error scenarios (invalid folder, permission denied, etc.)
  2. **Expected**: All error messages are clear and actionable
  3. **Expected**: Error messages include steps to resolve the issue

- [ ] **Test: Loading states**
  1. Test folder validation, photo upload, photo delete
  2. **Expected**: Loading indicators appear for long operations
  3. **Expected**: UI is disabled during operations to prevent double-submit

## Regression Tests

- [ ] **Test: All previous milestones still work**
  1. Milestone 1: Settings, folder selection
  2. Milestone 2: Google Calendar integration
  3. Milestone 3: Dog linking
  4. Milestone 4: Visit creation and photo upload
  5. Milestone 5: Backup/restore
  6. **Expected**: All features work as before
