import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Get Spotify Access Token (Client Credentials Flow for public playlists)
  app.get("/api/spotify/token", async (req, res) => {
    try {
      const clientId = process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

      if (!clientId || !clientSecret || clientId === "" || clientSecret === "") {
        console.error("Spotify Error: Credentials not found in environment variables.");
        return res.status(500).json({ error: "Spotify credentials not configured" });
      }

      const response = await axios.post(
        "https://accounts.spotify.com/api/token",
        new URLSearchParams({
          grant_type: "client_credentials",
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          },
        }
      );

      res.json(response.data);
    } catch (error: any) {
      console.error("Spotify Token Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to get Spotify token" });
    }
  });

  // API: Proxy Spotify Playlist Data
  app.get("/api/spotify/playlist/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const tokenHeader = req.headers.authorization;

      if (!tokenHeader) {
        return res.status(401).json({ error: "No token provided" });
      }

      const response = await axios.get(`https://api.spotify.org/v1/playlists/${id}`, {
        headers: { Authorization: tokenHeader as string },
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("Spotify Playlist Fetch Error:", error.response?.data || error.message);
      const status = error.response?.status || 500;
      const message = error.response?.data?.error?.message || "Failed to fetch playlist";
      res.status(status).json({ error: message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DeepTalk Server running on http://localhost:${PORT}`);
  });
}

startServer();
