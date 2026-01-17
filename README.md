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

## Installing as a PWA

To install this app as a Progressive Web App on Chrome/Chromium:

1. Open the app in Chrome/Chromium
2. Look for the install icon in the address bar (or go to the menu → "Install Grooming CRM")
3. Click "Install"
4. The app will open in its own window and can be launched from your app launcher

**Note**: For the File System Access API to work properly, the app should be installed as a PWA or run from `localhost`.

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

### ✅ Milestone 4: Visits & Photo Management (Current)
- [x] Create and manage visits tied to calendar events
- [x] Visit data model with status, duration, price, and notes
- [x] Save photos to selected storage folder using File System Access API
- [x] Associate photos with visits
- [x] Photo gallery view with thumbnails that persist after reload
- [x] Visit editor with autosave
- [x] Open visit from Today page events

### Milestone 5: Backup/Export/Import & Hardening
- Export all data to JSON
- Import data from backup
- Export photos as zip
- Data validation and error handling
- Offline-first optimizations

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

### Visit Features

- **Autosave**: Visit details automatically save 1 second after you stop typing
- **Status**: Track visit status (Planned, Done, No Show)
- **Duration**: Record visit duration in minutes
- **Price**: Record visit price in EUR (stored as cents)
- **Notes**: Add detailed notes about the visit
- **Photos**: Upload multiple photos per visit
- **Thumbnails**: View photos with persistent thumbnails that work after page reload

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
