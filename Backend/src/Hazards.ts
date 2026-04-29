import db from "~/lib/db";

// Initialize the table
db.exec(`
    CREATE TABLE IF NOT EXISTS Hazards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        Category TEXT,
        Latitude TEXT,
        Longitude TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

export interface Hazard {
    id: number;
    Category: string;
    Latitude: string;
    Longitude: string;
    timestamp: string;
}

/**
 * Fetches all hazards from the database.
 * Use this in your Express routes.
 */
export function getAllHazards(): Hazard[] {
    const stmt = db.prepare('SELECT * FROM Hazards ORDER BY id DESC');
    return stmt.all() as Hazard[];
};

/**
 * Adds a new hazard to the database.
 */
export const addHazard = (category: string, lat: string, lon: string) => {
    const stmt = db.prepare(
        'INSERT INTO Hazards (Category, Latitude, Longitude) VALUES (?, ?, ?)'
    );
    return stmt.run(category, lat, lon);
};

export default db;