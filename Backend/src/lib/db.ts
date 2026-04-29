import Database from "better-sqlite3";

import { DB_FILE } from "./config";

export default new Database(DB_FILE);