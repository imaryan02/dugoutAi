# Deploy DugoutAi to Google Cloud Run

This project is ready for Cloud Run as a single container:

- `apps/server` starts the Node/Socket.IO backend.
- `apps/web` is built into static files.
- The server serves `apps/web/dist`, so one Cloud Run URL hosts both frontend and backend.
- Cloud Run injects `PORT`; `apps/server/src/server.ts` already reads `process.env.PORT`.
- The Dockerfile builds all workspaces and starts `npm run start --workspace apps/server`.

## Current Local Status

- `npm run build` passes.
- `Dockerfile` exists.
- `.dockerignore` exists.
- `.gcloudignore` exists.
- `gcloud` is not installed or not on PATH on this machine.
- Docker is installed, but Docker Desktop's Linux engine was not running during the check.

## Recommended Beginner Path

Use Cloud Shell in the Google Cloud Console. It already has `gcloud` installed and can build the Dockerfile in Google Cloud.

1. Create or select a Google Cloud project and make sure billing is enabled.

2. Enable the required APIs:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

3. Get this repo into Cloud Shell. The cleanest path is to push the repo to GitHub, then clone it:

```bash
git clone YOUR_REPO_URL
cd crickRoomAi
```

4. Create the Cloud Run environment file:

```bash
cp cloudrun.env.yaml.example cloudrun.env.yaml
nano cloudrun.env.yaml
```

For the first deploy, keep `CRICKET_PROVIDER: "demo"`. Add `GEMINI_API_KEY` if you want live Gemini agent output; demo mode still has local fallback commentary without it.

5. Deploy to Cloud Run:

```bash
gcloud run deploy crickroomai \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --env-vars-file cloudrun.env.yaml \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2 \
  --timeout 3600
```

When prompted, allow Cloud Run to create/use the needed Artifact Registry repository.

6. Check the deployment:

```bash
SERVICE_URL="$(gcloud run services describe crickroomai --region asia-south1 --format='value(status.url)')"
curl "$SERVICE_URL/health"
```

Then open `SERVICE_URL` in your browser.

## After The First Demo Deploy

To use live cricket data, update the deployed env vars:

```bash
gcloud run services update crickroomai \
  --region asia-south1 \
  --env-vars-file cloudrun.env.yaml
```

Use these settings in `cloudrun.env.yaml`:

```yaml
CRICKET_PROVIDER: "free_rapidapi_cricbuzz"
RAPIDAPI_KEY: "your_key"
RAPIDAPI_HOST: "free-cricbuzz-cricket-api.p.rapidapi.com"
```

For optional Google Text-to-Speech, set:

```yaml
ENABLE_TTS: "true"
GOOGLE_TTS_API_KEY: "your_key"
```

and enable the Text-to-Speech API:

```bash
gcloud services enable texttospeech.googleapis.com
```

## Useful Commands

View service logs:

```bash
gcloud run services logs read crickroomai --region asia-south1 --limit 100
```

Redeploy after code changes:

```bash
gcloud run deploy crickroomai --source . --region asia-south1 --env-vars-file cloudrun.env.yaml
```

Delete the service:

```bash
gcloud run services delete crickroomai --region asia-south1
```
