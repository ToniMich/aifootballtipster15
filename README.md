# AI Football Tipster ⚽️🔮

**AI Football Tipster** is a sophisticated, AI-powered web application that provides detailed predictions and analyses for football matches. It leverages the power of Google's Gemini Pro model to deliver insights far beyond simple win/loss predictions, including key stats, tactical breakdowns, and data-driven betting tips.

![AI Football Tipster Screenshot](https://storage.googleapis.com/aistudio-hosting/readme-assets/ai-football-tipster/screenshot.png)

## Architecture Note: Supabase vs. Netlify

**This project is built to use Supabase for all backend services**, including the database and serverless Edge Functions, as described in the setup guides below.

You may notice a `netlify` folder in the project structure. This contains legacy files from a previous architectural iteration and is **not used** in the current version of the application. Please disregard the contents of the `netlify` folder and follow the Supabase instructions for development and deployment.

## ✨ Core Features

-   **🤖 AI-Powered Predictions**: Utilizes Google's Gemini Pro model to generate nuanced match predictions.
-   **📊 Detailed Breakdowns**: Each prediction includes a full analysis, confidence levels, recent form (W/D/L), and head-to-head statistics.
-   **📈 Analyst's Picks**: Suggests "Best Bets" for various markets like Match Winner and Over/Under Goals, complete with confidence percentages.
-   **⚡️ Live Scores**: Features a real-time sidebar with live scores from major matches around the world, powered by TheSportsDB API.
-   **🗂️ Prediction History**: All predictions are saved to a Supabase database, allowing users to track a history of the AI's performance.
-   **🎯 Accuracy Tracking**: Automatically calculates and displays the historical accuracy of winning predictions.
-   ** Tally System**: Avoids duplicate predictions by tallying requests for the same match, saving API costs and showing popular predictions.
-   ** toggler Dark & Light Mode**: A sleek, user-friendly theme toggle for comfortable viewing in any lighting.
-   ** autocomplete Team Autocomplete**: An intuitive search that suggests team names as you type.
-   **🔒 Secure & Scalable**: Built with a serverless architecture using Supabase Edge Functions, ensuring API keys and sensitive logic are never exposed on the frontend.

## 🛠️ Tech Stack & Architecture

-   **Frontend**: React, TypeScript, Vite, Tailwind CSS
-   **Backend**: Supabase Edge Functions (Serverless Deno)
-   **AI Model**: Google Gemini Pro
-   **Database**: Supabase (PostgreSQL)
-   **Live Scores API**: TheSportsDB

## 🚀 Getting Started (For Developers)

**IMPORTANT**: All `supabase` CLI commands in this guide **must be run from the project's root directory** (the `aifootballtipster` folder), not from inside the `supabase` sub-directory.

Follow these instructions to set up and run the project locally. This project requires two separate processes: the Vite server for the frontend and the Supabase server for the backend functions.

### 1. Prerequisites

-   Install [Node.js](https://nodejs.org/) (which includes npm).
-   Install the [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started).
-   Install and run [Docker Desktop](https://www.docker.com/products/docker-desktop/).

### 2. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/your-username/ai-football-tipster.git
cd ai-football-tipster

# Install frontend dependencies
npm install

# (First time only) Log in to the Supabase CLI
supabase login
```

### 3. Set Up Environment Variables

This project requires two separate environment files for local development:
-   `.env.local` for the frontend (Vite).
-   `supabase/functions/.env` for the backend (Supabase Edge Functions).

**First, start Supabase to get your local keys:**
```bash
# This command starts the local Supabase database and functions.
# It will print your local API URL and keys in the terminal.
supabase start
```
After running the command, look for the following output in your terminal:
```
API URL: http://127.0.0.1:54321
anon key: your_local_anon_key_...
service_role key: your_local_service_role_key_...
```
You will need these values for the next step. Keep the `supabase start` process running.

**Next, create the environment files:**

**A) Create Frontend Environment File (`.env.local`)**
In a new terminal, create a file named `.env.local` in the project root directory and add the following, using the `API URL` and `anon key` from the terminal output:

```
# .env.local

# Supabase credentials for the frontend (from `supabase start` output)
VITE_SUPABASE_URL="http://127.0.0.1:54321"
VITE_SUPABASE_ANON_KEY="your_local_anon_key_from_the_terminal"
```

**B) Create Backend Environment File (`supabase/functions/.env`)**
Create a file named `.env` inside the `supabase/functions/` directory. Add your secret API keys and the Supabase credentials here. This file is automatically loaded when you run `supabase start` or `supabase functions serve`.

```
# supabase/functions/.env

# These are automatically used by the Supabase CLI for local development
SUPABASE_URL="http://127.0.0.1:54321"
SUPABASE_ANON_KEY="your_local_anon_key_from_the_terminal"
SUPABASE_SERVICE_ROLE_KEY="your_local_service_role_key_from_the_terminal"

# Google Gemini API Key for AI Predictions
# Get it from Google AI Studio: https://aistudio.google.com/app/apikey
API_KEY="your_google_gemini_api_key"

# TheSportsDB API Key for Live Scores
# Get it from: https://www.thesportsdb.com/user_reg.php
THESPORTSDB_API_KEY="your_thesportsdb_api_key"
```

### 4. Set Up the Database

With the Supabase server still running, run this command in your second terminal to set up the database schema:

```bash
# This command resets the local database and runs all migration scripts
# located in the `supabase/migrations` folder to create your tables.
supabase db reset
```
Your local backend is now fully configured!

### 5. Run the Project Locally

With the Supabase backend still running, start the frontend development server in your second terminal:

```bash
# Starts the React development server
npm run dev
```

Your application will be available at `http://localhost:5173`.

---

## ☁️ Deploying to Production

To deploy your application, you need a live Supabase project and a hosting provider (e.g., Netlify, Vercel) for the frontend.

### 1. Link Your Supabase Project

Connect your local setup to your live Supabase project:
```bash
# Find your project reference ID in your Supabase Dashboard URL
# (e.g., https://app.supabase.com/project/your-project-ref)
supabase link --project-ref <your-project-ref>
```

### 2. Push Database Schema to Production

This command applies the migration scripts from `supabase/migrations` to your live Supabase database.
**Warning**: This can be a destructive operation on existing tables. Be careful.
```bash
supabase db push
```
Alternatively, you can copy the contents of `supabase/migrations/20240101000000_initial_schema.sql` and run it in the **SQL Editor** in your Supabase dashboard.

### 3. Set Production Secrets (for Functions)

Your live functions need the API keys. These are stored securely as secrets.
```bash
# Set secrets for the deployed Supabase project
supabase secrets set API_KEY=your_production_google_gemini_api_key
supabase secrets set THESPORTSDB_API_KEY=your_production_thesportsdb_api_key
```

### 4. Set Production Environment Variables (for Frontend)

In your frontend hosting provider's settings (e.g., Netlify, Vercel), set the following environment variables. You can find these values in your live Supabase project's dashboard under `Project Settings > API`.
-   `VITE_SUPABASE_URL`: Your project's public URL.
-   `VITE_SUPABASE_ANON_KEY`: Your project's public `anon` key.

### 5. Deploy Edge Functions

Finally, deploy your function code to your live project.
```bash
supabase functions deploy
```
Your backend is now live! For the frontend, follow the deployment instructions for your chosen hosting provider.

## 🔍 Troubleshooting

**Rule #1**: Ensure all `supabase` CLI commands are run from the project's **root directory**.

### Issue: Docker Container Conflict on `supabase start`

If `supabase start` fails with an error like `Error response from daemon: Conflict. The container name "/supabase_vector..." is already in use...`, it means Docker containers from a previous session were not shut down correctly.

**Solution: Force Stop and Restart**
1.  **Force stop all related containers**: This command is designed to clean up any lingering services.
    ```bash
    supabase stop --no-backup
    ```
2.  **Start again**: Now you can safely start the services.
    ```bash
    supabase start
    ```

### Issue: CLI tries to deploy a deleted function

If `supabase functions deploy` or `supabase start` fails with an error like `Bundling Function: <deleted-function-name>` or `failed to load import map`, it means the CLI's local configuration is out of sync. You need to perform a hard reset.

**Solution: Hard Reset Local Supabase Environment**
1.  **Make sure you are in the project root directory.**
2.  **Stop Supabase**:
    ```bash
    supabase stop --no-backup
    ```
3.  **Delete Local Configuration**: This removes the cached state.
    ```powershell
    # PowerShell (Windows)
    Remove-Item -Path ".supabase" -Recurse -Force
    ```
    ```bash
    # Bash (macOS/Linux)
    rm -rf .supabase
    ```
4.  **Restart and Deploy**: This rebuilds the configuration from scratch.
    ```bash
    supabase start
    supabase functions deploy
    ```

### Issue: Remote functions are out of sync

If an old function still appears in your Supabase Dashboard after you've deleted it locally, you must delete it from the server manually.

1.  **Update the Supabase CLI**: An outdated CLI can cause issues.
    - **macOS/Linux**: `brew upgrade supabase`
    - **Windows**: `scoop update supabase`
2.  **Delete Unwanted Remote Function**: Run the following command, replacing `function-name-to-delete` with the actual name:
    ```bash
    supabase functions delete function-name-to-delete
    ```
3.  **Deploy Again**: Run `supabase functions deploy` and verify that the output lists only the correct project functions.

## 📜 Disclaimer

This application is for entertainment purposes only. The predictions provided are in no way financial advice. Please gamble responsibly and only wager what you can afford to lose.