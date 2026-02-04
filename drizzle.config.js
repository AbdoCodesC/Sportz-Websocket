import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// what is drizzle-kit? - a tool to manage database schema migrations for Drizzle ORM
// what is drizzle ORM? - a type-safe ORM for TypeScript and JavaScript

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env file');
}

export default defineConfig({
  schema: './src/db/schema.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
