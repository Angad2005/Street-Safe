# OSM Context
- England: https://download.geofabrik.de/europe/united-kingdom/england.html
- Birmingham: https://download.geofabrik.de/europe/united-kingdom/england/west-midlands.html


# DB Usage Example
```ts
const db = new Database(DB_FILE);

interface User {
  id: number;
  username: string;
}

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT
    );
    
    CREATE TABLE IF NOT EXISTS friends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        friend_id INTEGER
    );
`);

const person: User = {
  id: 1,
  username: 'Test'
};


const insert = db.prepare('INSERT INTO users (username) VALUES (?)');
insert.run(person.username);

const user = db.prepare('SELECT * FROM users WHERE username = ?').get('Test') as User;
console.log(`Found user: ${user.id} (${user.username})`);
```


# APi fetch frontend
const fetchData = async () => {
  try {
    const response = await fetch('http://localhost:8080/api/data');
    const data = await response.json();
    console.log(data.message); // Should log "Hello from the Backend!"
  } catch (error) {
    console.error("Connection failed:", error);
  }
};