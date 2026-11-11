# PowerPulse deployment

The Netlify site serves the frontend. The Express API and MongoDB must also be
deployed for login and app data to work.

## Deploy the API

1. Create a MongoDB Atlas cluster and database user.
2. In Atlas Network Access, allow connections from `0.0.0.0/0` so Render can
   reach the cluster on the free Render plan. This makes the cluster
   network-accessible from the internet; use a unique, strong database-user
   password with only the required database permissions.
3. In Render, choose **New + → Blueprint**, connect this GitHub repository,
   and deploy the `render.yaml` blueprint. The blueprint creates a free web
   service, generates a `JWT_SECRET`, and prompts for the database connection
   and initial account credentials.
4. Set `MONGO_URI` to the Atlas connection string. Replace the password
   placeholder in the connection string before saving it.
5. Set `FRONTEND_URL` to the full Netlify site origin, such as
   `https://your-site.netlify.app`.
6. Set the `INITIAL_ADMIN_*`, `INITIAL_MANAGER_*`, and `INITIAL_VIEWER_*`
   email/password values to private credentials you choose. Do not reuse the
   sample passwords shown in local development.
7. Wait for the Render service health check to pass. Copy the service's public
   URL, such as `https://powerpulse-api.onrender.com`.

## Connect the Netlify frontend

1. Edit `public/js/api-config.js` and set `window.POWERPULSE_API_BASE` to the
   Render service URL (no trailing slash), for example:

   ```js
   window.POWERPULSE_API_BASE = 'https://powerpulse-api.onrender.com';
   ```

2. Commit and push that change to GitHub so Netlify redeploys the site.
3. Open the Netlify site and check that login requests reach
   `https://<your-render-service>/api`.

The API URL setting is JavaScript configuration only; it does not change the
site's layout or styling. Keep database credentials and JWT secrets in Render
environment variables, never in frontend files or GitHub.
