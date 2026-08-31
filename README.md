# StreetSafe

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)\
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![OAuth 2.0](https://img.shields.io/badge/OAuth_2.0-333333?style=for-the-badge)
![Google SSO](https://img.shields.io/badge/Google_SSO-4285F4?style=for-the-badge&logo=google&logoColor=white)

# Deployment
https://street-safe-wine.vercel.app/

Short Description

<img src="Docs/Screenshot%202026-03-24%20132555.png" height=400 width="200" alt="KernelKings Screenshot" style="margin-right: 15px;">  
<img src="Docs/Screenshot 2026-03-25 222557.png" height=400 width="200" alt="KernelKing">

# Setup
## Repository
Clone the repository with the following command\
`git clone https://git.cs.bham.ac.uk/software-engineering-2025-26/KernelKings.git`

## Dependencies
Node 24 (Earlier versions may work but only above Node 20) - [Download Node](https://nodejs.org/en/download)

# Backend
`cd Backend` - Set working directory into the `Backend` folder.

`npm i` Setup node project

`npm run setup -- --osm --auth` Download OSM map data and set default authentication keys\
The `--osm` and `--auth` flags can be removed to only perform one operation

One of the environment variables used which is set by `--auth` is a url to the backend. This defaults to `http://localhost:8080`, so ensure that this is accessible from the testing client, if not, change this value in the `.env` file in the base directory of the `Backend`

## Frontend
`cd StreetSafe` - Set working directory into the `StreetSafe` folder.

`npm i --legacy-peer-deps` Setup node project


# Running
Open 2 teminals, one for the frontend and one for backend\
Set your working directories to the respective ones (`cd StreetSafe`, `cd Backend`)

## Backend
`npm start`

## Frontend
Run the expo app with a url for the backend

`npm start:dev` for the default `http://localhost:8080` backend

`npm start:streetsafe` to use the server on `https://streetsafe.828101.xyz`

If you want to set your own url, replacing `[URL]`\
`EXPO_PUBLIC_API_URL="[URL]" npm run start` - For bash (linux)\
`$env:EXPO_PUBLIC_API_URL="[URL]"; npm run start` - For powershell (windows)\
`set EXPO_PUBLIC_API_URL=[URL] && npm run start` - For cmd (windows)\

Press `w` in the console to open it as a website

Install the Expo Go app on Android or iOS and scan the QR code shown in the console


# User Authentication

For our project we are using Google SSO(Single-Sign On) via OAuth2 through Google Cloud Console. \
For more information: [Auth Docs](Backend/docs/AUTH.md)

# Path Finding Algorithms

- [Path Finding Docs](Backend/docs/AUTH.md)

# Location Sharing Backend

- [Location Sharing Docs](Backend/docs/AUTH.md)

# Testing

### Backend Tests (`Backend/tests`)

- **Unit Tests**: [Backend/tests/unit](Backend/tests/unit) (Database, Auth Middleware, OSM Parsing)
- **Integration Tests**: [Backend/tests/integration](Backend/tests/integration) (API Endpoints, Location Flow, Hazards)

### Frontend Tests (`StreetSafe`)

- **App Screens**: [StreetSafe/app/tests](StreetSafe/app/__tests__) (Auth, Tracking, Friends, Settings)
- **Components**: [StreetSafe/components/**tests**](StreetSafe/components/__tests__) (Leaflet Map, Main Button)
- **Utilities**: [StreetSafe/utils/**tests**](StreetSafe/utils/__tests__) (Distance, Inactivity, Off-route detection)

To run tests:

1. `npm test` in the `Backend` folder.
2. `npm test` in the `StreetSafe` folder.

You may need to run `npm rebuild` in the `Backend` folder if you encounter any issues.

For detailed test definitions and expected outcomes, see the [Test Plan](Testing/test_plan.md).

# Developer notes

- Run the below command to make sure all map data is available in the backend

- Added Webview for every page Created so that developpers can quickly test the feature and build and improve upon them. Also UI might be different on mobile.

