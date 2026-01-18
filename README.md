# Grooming CRM

A Chromebook-first Progressive Web App (PWA) for managing a dog grooming business. This app runs entirely locally with no backend, using IndexedDB for structured data and the File System Access API for photo storage.

## Features

- **Local-only storage**: All data stays on your device
- **No backend required**: Runs entirely in the browser
- **File System Access**: Store photos in a folder you choose
- **IndexedDB**: Fast, structured data storage for clients, dogs, and visits
- **Google Calendar Integration**: Read and write calendar events, link events to dog profiles

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- Chrome/Chromium browser (for File System Access API support)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to the URL shown (typically `http://localhost:5173`)

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Installing as a PWA on Chromebook

This app is a Progressive Web App (PWA) that can be installed on your Chromebook:

### Installation Steps

1. **Build the app** (if not already built):
   ```bash
   npm run build
   ```

2. **Serve the built app** (choose one method):
   - **Development**: Run `npm run dev` and navigate to `http://localhost:5173`
   - **Production**: Deploy the `dist` folder to a web server with HTTPS

3. **Install in Chrome**:
   - Open the app in Chrome/Chromium browser
   - Look for the install icon (⊕) in the address bar
   - Or go to Chrome menu → "Install Grooming CRM..."
   - Click "Install"
   - The app will open in its own window

4. **Launch the installed app**:
   - Find "Grooming CRM" in your Chromebook app launcher
   - Click to launch (opens in standalone window, no browser UI)

### Important Notes

- **HTTPS Required**: For best PWA behavior, serve the app over HTTPS (required for service worker in production). `localhost` works for development.
- **Google OAuth Origins**: After deploying, update your Google OAuth Client ID's "Authorized JavaScript origins" in Google Cloud Console to include your production domain (e.g., `https://yourdomain.com`).
- **Offline Support**: The app shell is cached for offline use. Calendar sync requires an internet connection.
- **File System Access**: For the File System Access API to work properly, the app should be installed as a PWA or run from `localhost`.

## Google Calendar Setup

To connect the app to your Google Calendar, you need to create a Google OAuth Client ID:

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" (unless you have a Google Workspace)
   - Fill in the required fields (App name, User support email, Developer contact)
   - Add scopes: `https://www.googleapis.com/auth/calendar.events`
   - Save and continue through the steps
4. Create the OAuth client:
   - Application type: **Web application**
   - Name: "Grooming CRM" (or any name you prefer)
   - **Authorized JavaScript origins**: 
     - `http://localhost:5173` (for development)
     - Add your production URL if deploying
   - **Authorized redirect URIs**: Not needed for this app (we use the token flow)
   - Click "Create"
5. Copy the **Client ID** (not the Client Secret - you don't need it)

### Step 3: Connect in the App

1. Open the app and go to **Settings**
2. Paste your Google OAuth Client ID into the input field
3. Click **"Connect Google"**
4. Authorize the app when prompted
5. Select a calendar from the dropdown
6. Go to **Today** page to view your events

**Required Scope**: `https://www.googleapis.com/auth/calendar.events` (read and write access to events)

**Important**: If you previously connected with the read-only scope, you'll need to disconnect and reconnect to grant the new write permissions.

**Security Note**: The OAuth Client ID is not a secret and can be safely stored locally. It's designed to be public and is used to identify your app to Google.

## Milestone Roadmap

### ✅ Milestone 1
- [x] Vite + React + TypeScript setup
- [x] Routing and navigation
- [x] IndexedDB schema with Dexie
- [x] Settings page with folder selection
- [x] File System Access API integration
- [x] Permission handling

### ✅ Milestone 2
- [x] Google OAuth integration (Google Identity Services)
- [x] Read Google Calendar events
- [x] Display today's and this week's events
- [x] Calendar selection in Settings
- [x] Event display with time, location, description

### ✅ Milestone 3
- [x] Link calendar events to dog profiles
- [x] Write durable token (`#GROOMDOG:<dogId>`) into event descriptions
- [x] Auto-detect existing links from event descriptions
- [x] Dogs CRUD (Create, Read, Delete)
- [x] Dog picker modal for assigning dogs to events
- [x] Display linked dogs on event cards
- [x] Unlink dogs from events (removes token from description)

### ✅ Milestone 4: Visits & Photo Management
- [x] Create and manage visits tied to calendar events
- [x] Visit data model with status, duration, price, and notes
- [x] Save photos to selected storage folder using File System Access API
- [x] Associate photos with visits
- [x] Photo gallery view with thumbnails that persist after reload
- [x] Visit editor with autosave
- [x] Open visit from Today page events

### ✅ Milestone 5: Backup/Export/Import & Hardening (Current)
- [x] Export all data to JSON with schema versioning
- [x] Import data from backup with validation and confirmation
- [x] Export manifest to storage folder (includes photo file list)
- [x] Verify photo integrity (check if files exist in filesystem)
- [x] Safe KV keys filtering (excludes sensitive data)
- [x] Database wipe and restore with transactions
- [x] Error handling and user feedback

## Linking Events to Dogs

The app allows you to link Google Calendar events to dog profiles. When you assign a dog to an event:

1. **Local Mapping**: The link is stored in IndexedDB (`eventLinks` table)
2. **Durable Token**: A token `#GROOMDOG:<dogId>` is written into the event's description in Google Calendar
3. **Auto-Detection**: When loading events, the app automatically detects existing tokens in descriptions and creates local mappings
4. **Persistent**: Even if you clear local data, the token remains in the calendar event description, so links can be restored

**Token Format**: `#GROOMDOG:<dogId>` - This token is appended to the event description (or replaces an existing token if present). The rest of the description is preserved.

**Unlinking**: When you unlink a dog from an event, both the local mapping and the token in the description are removed.

## Visits & Photo Storage

### Creating Visits

Visits are automatically created when you open a visit page from a calendar event:

1. From the **Today** page, find an event that has a dog assigned
2. Click **"Open Visit"** button
3. A visit record is created (or loaded if it already exists) for that event+dog combination
4. Edit visit details: status, duration, price, notes
5. Upload photos associated with the visit

### Photo Storage Structure

Photos are stored in the folder structure you selected in Settings:

```
<Your Selected Folder>/
  GroomingDB/
    visits/
      <visitId>/
        after_<timestamp>_<n>.jpg
        after_<timestamp>_<n>.jpg
        ...
```

- Photos are organized by visit ID
- Filenames follow the pattern: `after_<timestamp>_<index>.<extension>`
- Each photo is stored with its original file extension
- Photo metadata is stored in IndexedDB for fast lookup

### Setting Up Photo Storage on ChromeOS

1. Go to **Settings** in the app
2. Click **"Select Storage Folder"**
3. Navigate to your desired folder (e.g., `Downloads/GroomingPhotos` or `My Files/Photos`)
4. Select the folder and grant permission
5. The folder handle is stored securely in IndexedDB

**Important Notes**:
- You must grant read/write permission when prompted
- If permission is denied, the app will show a banner with a link to Settings
- You can re-request permission at any time from the visit page
- Photos can only be accessed when the folder permission is granted

**ChromeOS Specific**:
- File System Access API works best in installed PWA mode
- Ensure the app has persistent storage permissions
- Photos are stored in your ChromeOS Downloads or selected folder location

### If Folder Permission is Revoked

If you revoke site permissions or clear site data, the stored folder handle may become invalid:

1. The app will automatically detect the invalid handle
2. **Settings** page will show a warning: "Folder handle is invalid"
3. Click **"Re-select Folder"** button
4. Choose the same folder you used before
5. Grant permission again
6. Your photos will be accessible again

**Note**: The photos themselves are not lost - they remain in your selected folder. You just need to re-select the folder so the app can access them again.

### Visit Features

- **Autosave**: Visit details automatically save 1 second after you stop typing (writes are queued to prevent conflicts)
- **Status**: Track visit status (Planned, Done, No Show)
- **Duration**: Record visit duration in minutes
- **Price**: Record visit price in EUR (stored as cents)
- **Notes**: Add detailed notes about the visit
- **Photos**: Upload multiple photos per visit
- **Delete Photos**: Click the ✕ button on any photo thumbnail to delete it (removes from both database and filesystem)
- **Thumbnails**: View photos with persistent thumbnails that work after page reload

## Backup & Restore

The app includes a robust backup system to ensure your data is safe when moving to a new device or after a reset.

### Backup Options

#### 1. Export Data (JSON)
- **Location**: Settings → Backup & Restore
- **Function**: Exports all structured data to a JSON file
- **Includes**:
  - Clients
  - Dogs
  - Visits
  - Event Links
  - Visit Photos metadata
  - Safe settings (calendar selection, Google Client ID)
- **Excludes**:
  - Storage folder handle (cannot be serialized)
  - Google access tokens (session-specific)
- **Filename**: `groom-crm_backup_YYYY-MM-DD_HH-mm.json`
- **Use case**: Moving to a new Chromebook or creating a backup

#### 2. Export + Photos Manifest
- **Location**: Settings → Backup & Restore
- **Function**: Writes a manifest JSON to your selected storage folder
- **Location**: `GroomingDB/backup/manifest_<timestamp>.json`
- **Includes**: All exported data plus photo file list with relative paths
- **Use case**: Full backup with photo index (photos remain in original location)

#### 3. Verify Photos
- **Location**: Settings → Backup & Restore
- **Function**: Checks if all photo files referenced in the database exist in the filesystem
- **Shows**:
  - Total photos count
  - Missing files count and list
- **Use case**: Verify data integrity after restore or folder changes

### Restore Steps

To restore your data on a new device or after reset:

1. **Select Storage Folder**:
   - Go to Settings → Storage Folder
   - Click "Select Storage Folder"
   - Choose the same folder you used before (if restoring from manifest)

2. **Import Data**:
   - Go to Settings → Backup & Restore
   - Click "Import Data (JSON)"
   - Select your backup JSON file
   - Confirm the import (⚠️ **Warning**: This will replace all existing data)

3. **Verify Photos**:
   - Click "Verify Photos"
   - Check the results
   - If photos are missing, ensure your storage folder contains the original photo files

### Backup File Structure

```json
{
  "schemaVersion": 1,
  "exportedAt": "2024-01-01T12:00:00.000Z",
  "app": {
    "name": "groom-crm",
    "version": "1.0.0"
  },
  "data": {
    "clients": [...],
    "dogs": [...],
    "visits": [...],
    "eventLinks": [...],
    "visitPhotos": [...],
    "kv": {
      "selectedCalendarId": "...",
      "googleClientId": "..."
    }
  }
}
```

### Important Notes

- **Schema Version**: Backups are versioned. If the backup version doesn't match the app version, import will fail with an error.
- **Photo Files**: The backup includes photo metadata but NOT the actual photo files. To restore photos:
  - Copy the entire `GroomingDB/visits/` folder structure from your old device
  - Or use the manifest backup which includes file paths for verification
- **Sensitive Data**: The backup never includes:
  - Google access tokens
  - Storage folder handles (browser-specific)
  - Session information
- **Import Safety**: Import requires explicit confirmation and shows a warning that all existing data will be replaced.

## Technology Stack

- **Vite**: Build tool and dev server
- **React**: UI framework
- **TypeScript**: Type safety
- **React Router**: Client-side routing
- **Dexie**: IndexedDB wrapper
- **File System Access API**: Local file system access
- **Google Identity Services**: OAuth authentication
- **Google Calendar API v3**: Calendar event reading and writing

## Browser Compatibility

- **Chrome/Chromium**: Full support (recommended)
- **Edge**: Full support
- **Firefox**: Limited (no File System Access API)
- **Safari**: Limited (no File System Access API)

The app will gracefully degrade on browsers without File System Access API support, but folder selection will not be available.

## License

ISC
