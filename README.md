# MeriRide

**Visit the live website: [MeriRide](https://meriride-app-production.up.railway.app/)**

MeriRide is a car rental booking application built with React, Express, and MySQL. Browse available vehicles, create an account, and request a rental. Admins can manage bookings, customers, and the vehicle fleet.

## Run locally

1. Install Node.js (LTS) and MySQL.
2. Clone this repository and open its folder in a terminal.
3. Install dependencies:

   ```sh
   npm install
   ```

4. Create a `.env` file in the project root using `.env.example` as a guide. Add your local MySQL connection settings and a unique JWT secret of at least 32 characters. Do not commit `.env` or database passwords.
5. Create the database tables using the SQL instructions in [`DEPLOY.md`](DEPLOY.md) and [`database/cloud-schema.sql`](database/cloud-schema.sql), adjusting the selected schema for your local MySQL database.
6. Start the app:

   ```sh
   npm run server
   ```

   In another terminal, run the React development server:

   ```sh
   npm run dev
   ```

   Open the local URL printed by Vite, usually `http://localhost:5173`.

## Deployment

The live app is hosted on Railway, with the React site and Express API served from the same HTTPS domain. Deployment and database setup notes are in [`DEPLOY.md`](DEPLOY.md).

The hosted database has its own schema and data. Local MySQL users, bookings, and vehicle records are not automatically copied to it.
