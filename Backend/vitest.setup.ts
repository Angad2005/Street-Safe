import { config } from "dotenv";

// Load a test env using `.env.test` as the source.
config({
  quiet: true,
  path: "./.env.test"
});