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

5. Export the existing `meriride` database from MySQL Workbench and import it into the Railway MySQL database. Do not commit the SQL dump to GitHub. Apply the booking location migration and the booking permission grants to the hosted database as needed.
6. Generate a public domain for the app service. The health check is `/api/health`.

The first-admin setup route is intentionally disabled in production. Create or promote an admin account directly in the hosted database, and use a password created through the app so it is stored as a bcrypt hash.
