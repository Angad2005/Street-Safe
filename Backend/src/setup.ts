import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load existing .env if it exists to avoid overwriting with empties
dotenv.config();

async function downloadFile(url: string, filePath: string) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));
}

(async () => {
    // 1. Handle OSM Download
    const osmFileUrl = 'https://download.geofabrik.de/europe/united-kingdom/england/west-midlands-latest.osm.pbf';
    const dataDir = path.join(process.cwd(), 'data');
    const osmFilePath = path.join(dataDir, 'main.osm.pbf');

    if (process.argv.includes('--osm')) {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        console.log('Downloading OSM file...');
        await downloadFile(osmFileUrl, osmFilePath);
        console.log('OSM file downloaded.');
    }

    // 2. Handle Environment Setup
    // Use environment variables if they exist, otherwise use placeholders.
    // DO NOT hardcode real secrets here.
    const envVars = {
        OAUTH_GOOGLE_CLIENT_ID: process.env.OAUTH_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE",
        OAUTH_GOOGLE_CLIENT_SECRET: process.env.OAUTH_GOOGLE_CLIENT_SECRET || "YOUR_GOOGLE_CLIENT_SECRET_HERE",
        OAUTH_BASE_URL: "http://localhost:8080",
        HMAC_SIGNATURE_SECRET: process.env.HMAC_SIGNATURE_SECRET || "development_secret_only"
    };

    if (process.argv.includes('--auth')) {
        console.log('Setting up .env file from template...');
        const envContent = Object.entries(envVars)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
        
        fs.writeFileSync(path.join(process.cwd(), '.env'), envContent);
        console.log('.env file created. Please update it with your actual secrets.');
    }
})();