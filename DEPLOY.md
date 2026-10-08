# Deploy MeriRide

MeriRide is configured as a single Node service: Railway builds the React app, and Express serves both `dist/` and `/api` from one HTTPS domain. GitHub Pages alone cannot run the API or connect to MySQL.

## Railway setup

1. Push this repository to a **private GitHub repository**. Do not upload `.env`, database exports, or credentials.
2. In Railway, create a project and deploy from that GitHub repository.
3. Add a Railway MySQL service to the same project.
4. In the app service, set these variables using Railway's service references:

   ```text
   NODE_ENV=production
   DB_HOST=${{MySQL.MYSQLHOST}}
   DB_PORT=${{MySQL.MYSQLPORT}}
   DB_USER=${{MySQL.MYSQLUSER}}
   DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
   DB_NAME=${{MySQL.MYSQLDATABASE}}
   JWT_SECRET=<a new random secret of at least 32 characters>
   CLIENT_ORIGIN=<the HTTPS domain generated for the app>
   ```

   If your Railway database service has a different name, replace `MySQL` in each reference with that service name. Set `CLIENT_ORIGIN` after generating the app's public domain.

5. Initialize a **blank** hosted database without moving local customer or booking records. With the Railway CLI signed in and the project linked, open a private MySQL tunnel and run the schema initializer from PowerShell:

   ```powershell
   railway connect MySQL --tunnel-only
   ```

   In a second terminal, set the tunnel port printed by the first command, then run:

   ```powershell
   $env:MERIRIDE_BOOTSTRAP_PORT = 'PASTE_TUNNEL_PORT_HERE'
   railway run --service MySQL -- node database/initialize-cloud-db.js
   Remove-Item Env:MERIRIDE_BOOTSTRAP_PORT
   ```

   This creates the three empty tables using `database/cloud-schema.sql`. It does not copy users, bookings, or vehicles. Existing data should only be migrated after explicitly deciding which records to move.

6. Generate a public domain for the app service. The health check is `/api/health`.

7. To create the first hosted admin, register a normal account in the live app, then promote only that account in the hosted MySQL database:

   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your-admin-email@example.com';
   ```

   The production app intentionally disables one-time local admin setup. The local `admin-booking-permissions.sql` grant is for the local-only MySQL user and should not be applied to Railway.

The first-admin setup route is intentionally disabled in production. Create or promote an admin account directly in the hosted database, and use a password created through the app so it is stored as a bcrypt hash.
