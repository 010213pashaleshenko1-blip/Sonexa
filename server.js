import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const HF_TOKEN = process.env.HF_TOKEN;
const SPACE_URL = 'https://cartik-sonexa-1-server.hf.space/run/predict';

app.post('/api/tts', async (req, res) => {
  const { text, voice } = req.body;

  try {
    const response = await fetch(SPACE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${HF_TOKEN}`
      },
      body: JSON.stringify({ data: [text, voice] })
    });

    const result = await response.json();
    const audio = result?.data?.[0];

    res.json({ audio_url: audio });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log('Sonexa server running'));
