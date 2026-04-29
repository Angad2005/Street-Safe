# Comprehensive Unit Test Plan

You will need to install jest using npm install jest-expo.
The test plan is based on the guidlines provided here: https://reactnative.dev/docs/testing-overview and https://jestjs.io/docs/getting-started . The unit tests should be placed in the `tests` directory, and aims to extensively cover each "Task" detailed in the project requirements.

## 1. Frontend Tests (`StreetSafe/app/tests`)

For the frontend tests, you will need to install:
npm install --legacy-peer-deps

### 1.1 Frontend Authentication & SSO Integration

#### TC-FE-AUTH-01 - User Login

- **Given** the login screen in `app/auth/login.tsx`.
- **When** the SSO "Login" button is pressed.
- **Then** `WebBrowser.openAuthSessionAsync` is initiated and the system redirects to the OAuth provider.

#### TC-FE-AUTH-02 - SSO Redirect

- **Given** a Google SSO login attempt.
- **When** the redirect completes in `app/auth/login.tsx`.
- **Then** the application captures the external token and authenticates the session locally.

### 1.2 Frontend Tracking & Haptic Feedback

#### TC-FE-TRK-01 - Location State Updates

- **Given** the user grants foreground location permissions in `app/tracking.tsx`.
- **When** `Location.watchPositionAsync` fires a callback with new coordinates.
- **Then** the local `location` state matches the precise coordinates and `lastLocationRef` is updated securely.

#### TC-FE-HAP-01 - Tracking Haptics

- **Given** the user navigates the tracking modal in `app/tracking.tsx`.
- **When** the user toggles tracking on or off.
- **Then** `Haptics.notificationAsync` is executed with the `Success` feedback type.

### 1.3 Deviation Alarm & Utility Functions

#### TC-UTIL-01 - [getDistance](file://wsl.localhost/parrot/home/kwame/projects/SoftwareCoursework/KernelKings/StreetSafe/app/tracking.tsx)

- **Given** two coordinate objects (e.g., London and Paris).
- **When** `getDistance` in `app/tracking.tsx` is called.
- **Then** it should return the correct distance in meters mathematically.

#### TC-UTIL-02 - [isUserOffRoute](file://wsl.localhost/parrot/home/kwame/projects/SoftwareCoursework/KernelKings/StreetSafe/app/tracking.tsx)

- **Given** a user location and an array of mapped route points (`app/tracking.tsx`).
- **When** the location strictly exceeds 50 meters from the nearest snap point.
- **Then** it should definitively return `true` to flag deviation.

#### TC-UTIL-03 - [checkInactivity](file://wsl.localhost/parrot/home/kwame/projects/SoftwareCoursework/KernelKings/StreetSafe/app/tracking.tsx)

- **Given** continuous location updates within a tiny radius (< 5m).
- **When** the time limit tracking interval (2 mins) is surpassed.
- **Then** it should return `true` indicating the user may be unsafe.

#### TC-FE-HAP-02 - Alarm Haptics

- **Given** the user is flagged off route or inactive in `app/tracking.tsx`.
- **When** [triggerAlarm](file://wsl.localhost/parrot/home/kwame/projects/SoftwareCoursework/KernelKings/StreetSafe/app/tracking.tsx) executes.
- **Then** `Haptics.notificationAsync` fires the `Error` feedback vibration alongside the alert.

### 1.4 Frontend Location Sharing

#### TC-FE-LOC-01 - Push Location Status

- **Given** the `isSharing` switch is actively true in `app/tracking.tsx`.
- **When** the pushing interval executes (`POLL_INTERVAL_MS`).
- **Then** a `POST /api/locations` payload is securely dispatched with `userId`, `lat`, and `lng`.

#### TC-FE-LOC-02 - Load Friend Lists

- **Given** valid tokens and an active internet connection.
- **When** `app/tracking.tsx` mounts or requests updates.
- **Then** `GET /api/getFriends` yields friend dictionaries successfully mapping into the toggleable chip UI.

#### TC-FE-LOC-03 - Manage Friends

- **Given** an active friends UI component in `app/friends.tsx`.
- **When** the user opens the "Add Friend" modal and interacts with a friend/search request.
- **Then** the local friend dictionaries correctly splice the relationships via internal store updates.

### 1.5 Frontend Map Visualisation

#### TC-FE-MAP-01 - Leaflet Component Rendering

- **Given** fetched `otherUsers` active locations in `app/tracking.tsx`.
- **When** `components/LeafletMap.tsx` mounts its WebView.
- **Then** circle markers corresponding precisely to the mapped coordinates securely populate the graphical map UI.

#### TC-FE-MAP-02 - Hazard Coloring

- **Given** specific hazard types like "harassment" or "theft" in `app/tracking.tsx`.
- **When** transformed into `Marker` inputs for `LeafletMap`.
- **Then** colors appropriately translate (e.g., orange, red).

### 1.6 Hazard Reporting

#### TC-FE-HAZ-01 - Report Hazard

- **Given** an active coordinate submission payload.
- **When** a user files a report in `app/hazardReporting.tsx`.
- **Then** `POST /api/hazards` pushes the hazard to the database.

### 1.7 Settings Page / Accessibility Features

For the accesibility features, it may be more suitable to use screenshots; therefore check the screenshots in the screenshots folder.

#### TC-FE-ACC-01 - High Contrast Mode

- **Given** the user enables high contrast mode in `app/settings.tsx`.
- **When** the user navigates to `app/settings.tsx`.
- **Then** the map markers and UI elements should display in high contrast colors.

#### TC-FE-ACC-02 - Bold Font Mode

- **Given** the user enables bold font mode in `app/settings.tsx`.
- **When** the user navigates to `app/settings.tsx`.
- **Then** all text elements should display in a bolder font.

#### TC-FE-ACC-03 - Dark Mode

- **Given** the user enables dark mode in `app/settings.tsx`.
- **When** the user navigates to `app/settings.tsx`.
- **Then** the map markers and UI elements should display in dark mode colors.

#### TC-FE-ACC-04 - Dyslexic Font mode

- **Given** the user enables dyslexic font mode in `app/settings.tsx`.
- **When** the user navigates to `app/settings.tsx`.
- **Then** all text elements should display in a dyslexic-friendly font.

---

## 2. Backend Unit Tests (`Backend/tests/unit`)

Tests in this category focus on core logic and database schema management without full API orchestration.

### 2.1 Test Database & Schema Management (`Backend/tests/unit/db.test.ts`)

#### TC-BE-DB-01 - Migrations Initialization

- **Given** the test environment connects to the in-memory SQLite DB.
- **When** backend routers prepare.
- **Then** all essential schemas (users, locations, friends) dynamically orchestrate securely without locking conditions.
- **Mock targets:** Mock authentication middleware `verifyToken` to bypass actual token verification and inject a mock `req.user`.

---

## 3. Backend Integration Tests (`Backend/tests/integration`)

Integration tests verify that the different modules work together, ensuring the flow of data from the API endpoints down to the database is correct.

### 3.1 Backend Authentication & SSO Integration (`Backend/tests/integration/auth_backend.test.ts`)

#### TC-BE-SSO-01 - Secure Token Verification

- **Given** an API route executing the token check.
- **When** a malformed, expired, or missing JWT reaches the middleware.
- **Then** it immediately returns HTTP 401.
- **When** a valid mock token (e.g., `mock-user-a`) is provided in test mode.
- **Then** it allows the request to proceed.

#### TC-BE-SSO-02 - IDP Parsing

- **Given** a request for a supported OAuth provider (e.g., Google).
- **When** `GET /oauth2/providers/google` is called.
- **Then** it returns a valid Google Authorization URL and a signed exchange context ID.

#### TC-BE-SSO-03 - Session Management

- **Given** a user ID.
- **When** `sessionService.createSession` is called.
- **Then** a persistent session record is created in the database and a signed token is returned.
- **When** `sessionService.getSession` is called with a valid token.
- **Then** the corresponding user ID is retrieved.
- **When** `sessionService.deleteSession` is called.
- **Then** the session is purged from the database.

#### TC-BE-SSO-04 - Exchange Context Management

- **Given** a generated OAuth state.
- **When** `context.create` is called.
- **Then** a signed exchange context ID is generated.
- **When** `context.updateTokenUsingState` associates a user ID with that state.
- **Then** fetching the account ID for the context yields the correct user ID.

#### TC-BE-SSO-05 - OAuth Routes Integration

- **Given** the OAuth callback flow.
- **When** `GET /oauth2/providers/:provider` is requested.
- **Then** the system orchestrates the redirect URL with correct `client_id` and `scope`.
- **When** `POST /oauth2/exchange` is called with a context ID.
- **Then** it returns the final session credentials if the exchange is valid.

#### TC-BE-SSO-06 - Protected API Routes

- **Given** protected endpoints like `/api/locations` or `/api/getFriends`.
- **When** accessed without a valid token.
- **Then** they consistently return HTTP 401.
- **When** accessed with a valid mock token.
- **Then** they return the expected data (e.g., 200/204 status).

### 2.2 OSM Data Parsing

#### TC-BE-OSM-01 - Graph Node Generation

- **Given** an imported chunk of physical Map Data mapping locally.
- **When** the relevant logic in `src/services/` executes its spatial functions.
- **Then** coordinates transform linearly into logical nodes without duplications.

#### TC-BE-OSM-02 - Hazard Data Edge Bias

- **Given** an explicit hazard location loaded from `src/Hazards.ts`.
- **When** the pathing weights inject graph modifications.
- **Then** edges neighboring the hazardous bounds amplify their calculated distances efficiently.

### 2.3 Backend Pathfinding

#### TC-BE-PATH-01 - A* Path Generation

- **Given** specific distinct entry and exit nodes on the virtual graph.
- **When** `src/routing/Pathfinding.ts` initiates Dijkstra/A* execution globally.
- **Then** a precise node-array sequence avoiding dangerous edges effectively emerges rapidly.

#### TC-BE-PATH-02 - Node Snapping

- **Given** coordinate selections slightly misaligned with public edges.
- **When** `src/routing/snapToNearestEdge.ts` runs logically against the mesh index.
- **Then** identical spatial resolutions output safely.

### 3.2 Backend Location Sharing (`Backend/tests/integration/locations.test.ts`)

#### TC-BE-LOC-01 - Location Pushing

- **Given** a valid payload `{ userId: 1, lat: 52.4, lng: -1.9 }`.
- **When** the controller handling `POST` in `src/Locations.ts` receives it.
- **Then** the location should be successfully upserted into the test database, and a `200 OK` (or `201 Created`) is returned securely.

#### TC-BE-LOC-02 - Location Polling

- **Given** multiple location entries pre-seeded in the test database memory.
- **When** `GET /api/locations` invokes `src/Locations.ts`.
- **Then** the test database evaluates accurately mapping to recent timestamps cleanly.

### 3.3 Friends API & Hazard Submission (`Backend/tests/integration/friends_backend.test.ts` & `hazards.test.ts`)

#### TC-BE-FRI-01 - Connections Loading

- **Given** an authenticated user with ID 1 alongside seeded relationships locally.
- **When** logical GET fetches in `src/friends.ts`.
- **Then** output mathematically matches the expected sender/accepter definitions.

#### TC-BE-HAZ-01 - Fetch Hazards

- **Given** the test database is explicitly seeded with a diverse list of hazards.
- **When** `GET /api/hazards` (linked via `src/Hazards.ts`) is requested.
- **Then** the endpoint directly querying the database accurately returns the complete safety-centric payloads matching original formats.

---

## 4. End-to-End (E2E) Verification

These tests (defined below) verify the complete system functionality from the User's perspective.

### 3.1 Location Sharing & Real-time Updates

#### TC-INT-LOC-01 - End-to-End Location Flow

- **Given** two authenticated users (User A and User B) who are friends.
- **When** User A enables "Share My Location" in `app/tracking.tsx`.
- **Then** User A's location is pushed to the backend (`src/Locations.ts`), and User B's map in `app/tracking.tsx` (via `components/LeafletMap.tsx`) successfully polls and displays User A's marker.

### 3.2 Social & Friends Management

#### TC-INT-FRI-01 - Friend Request & Approval Flow

- **Given** User A searches for User B in `app/friends.tsx`.
- **When** User A sends a friend request and User B accepts it.
- **Then** the backend (`src/friends.ts`) updates the relationship status, and both users see each other in their respective friends lists in `app/tracking.tsx`.

### 3.3 Safety & Hazards Integration

#### TC-INT-HAZ-01 - Hazard Alerting Flow

- **Given** a new hazard is reported via `app/hazardReporting.tsx`.
- **When** the hazard is stored in the backend (`src/Hazards.ts`) and broadcasted.
- **Then** all active users in the vicinity receive an update in `app/tracking.tsx`, and the hazard marker appears on their map.

#### TC-INT-HAZ-02 - Hazard-Aware Routing

- **Given** multiple hazards are active in a specific area (`src/Hazards.ts`).
- **When** a user requests a route through that area in `app/tracking.tsx`.
- **Then** the backend pathfinding (`src/routing/Pathfinding.ts`) generates a route that avoids those dangerous edges, which then renders correctly on the user's map.

### 3.4 Authentication & Session Persistence

#### TC-INT-AUTH-01 - Persistent Session Flow

- **Given** a user successfully logs in via `app/auth/login.tsx`.
- **When** the app is restarted or the user navigates away and back.
- **Then** the auth token is retrieved from SecureStore, and the user remains authenticated in `app/tracking.tsx` without needing to re-login.
