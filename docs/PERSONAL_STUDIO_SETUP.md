# Personal Clip Studio setup

The dashboard is a static website. Rendering stays in your own Colab or Kaggle GPU runtime, so no Gemini key, database, or hosted application server is needed.

## 1. Configure the notebook

Open `notebooks/kaggle-studio-server.ipynb` (or run the API from a local/Colab checkout). Add these values to the notebook environment before starting Uvicorn:

```python
import os, secrets

os.environ["GOOGLE_API_KEY"] = "your Gemini key"
os.environ["CLIP_STUDIO_TOKEN"] = secrets.token_urlsafe(32)  # copy this once to the website
os.environ["CLIP_STUDIO_ORIGINS"] = "https://YOUR-GITHUB-USERNAME.github.io"
```

Keep the generated token private. It permits creation of jobs and download of rendered files from your temporary notebook session.

Start the server as the notebook already documents, expose port 8000 through its HTTPS tunnel, and copy the public tunnel URL. The public URL changes whenever the notebook restarts.

## 2. Publish the dashboard

The `Deploy Clip Studio` GitHub Actions workflow publishes `web/dashboard` to GitHub Pages when changes are pushed to `main`. In the repository settings, set Pages to **GitHub Actions** as its source.

The workflow builds with the repository-name base path, so it works for a fork without hand-editing Vite configuration. Your published site URL should be the value used in `CLIP_STUDIO_ORIGINS` above.

## 3. Use the studio

1. Open the published site and select **Connect notebook**.
2. Paste the HTTPS tunnel and `CLIP_STUDIO_TOKEN`.
3. Select 3, 4, or 5 clips, paste a YouTube link you own or are authorized to repurpose, then select **Create clips**.
4. The site polls the notebook until it finishes. Use **Load preview** and **Download MP4** for each result.

## Optional: fast private R2 delivery

Add `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, and `R2_BUCKET` as Kaggle secrets. The notebook uploads each finished MP4 and thumbnail to the private bucket, then returns one-hour presigned preview and download URLs. Do not add these values to the website.

The browser retains connection information and recent job metadata only in `localStorage`. The actual video files remain in the temporary notebook runtime, so download them before that session ends.

## Defaults chosen to control cost

- Five 1080×1920, 9:16 clips with MediaPipe framing and karaoke captions.
- One Gemini Flash analysis call per source.
- YouTube subtitles are preferred, with Whisper used only as a fallback.
- B-roll, music, hooks, uploads, split-screen, and camera-switch processing are disabled.

Facebook is not supported in this first personal release. The dashboard intentionally accepts only YouTube URLs; add and test platform support separately before widening that boundary.
