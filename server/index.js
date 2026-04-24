require('dotenv').config();
const express = require('express');
const cors = require('cors');
const gplay = require('google-play-scraper');
const appStore = require('app-store-scraper');
const axios = require('axios');
const { jsonrepair } = require('jsonrepair');

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

const app = express();
app.use(cors());
app.use(express.json());

// Fetch Reddit posts
async function fetchReddit(appName, days) {
  try {
    const t = days <= 7 ? 'week' : days <= 30 ? 'month' : 'year';
    const { data } = await axios.get(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(appName + ' app')}&sort=new&limit=50&t=${t}`,
      { headers: { 'User-Agent': 'FeedbackAgent/1.0' } }
    );
    return (data?.data?.children || []).map(c => ({
      text: `${c.data.title} ${c.data.selftext || ''}`.slice(0, 300),
      rating: null, source: 'Reddit', score: c.data.score,
    }));
  } catch { return []; }
}

// Fetch Google Play reviews
async function fetchPlayStore(appName) {
  try {
    const results = await gplay.search({ term: appName, num: 1 });
    if (!results.length) return [];
    const appId = results[0].appId;
    const reviews = await gplay.reviews({ appId, num: 100, sort: gplay.sort.NEWEST });
    return reviews.data.map(r => ({ text: r.text, rating: r.score, source: 'Google Play' }));
  } catch { return []; }
}

// Fetch App Store reviews
async function fetchAppStore(appName) {
  try {
    const results = await appStore.search({ term: appName, num: 1 });
    if (!results.length) return [];
    const appId = results[0].id;
    const reviews = await appStore.reviews({ id: appId, sort: appStore.sort.RECENT, page: 1 });
    return reviews.map(r => ({ text: r.text, rating: r.score, source: 'App Store' }));
  } catch { return []; }
}

// Analyze with OpenRouter
async function analyzeWithOpenRouter(reviews, appName, apiKey) {
  const sample = reviews.slice(0, 80).map(r =>
    `[${r.source}${r.rating ? ` ★${r.rating}` : ''}] ${r.text}`
  ).join('\n');

  const prompt = `You are a product intelligence AI. Analyze these ${reviews.length} user reviews for the app "${appName}" and return ONLY valid JSON (no markdown):

REVIEWS:
${sample}

Return this exact JSON structure:
{
  "overallSentiment": "Positive|Mixed|Negative",
  "sentimentPercent": <number 0-100>,
  "executiveSummary": "<2-3 sentence summary>",
  "topIssues": [
    {
      "title": "<issue title>",
      "description": "<description>",
      "category": "Bug/Crash|UI/UX|Performance|Feature Request|Payment/Account",
      "frequencyScore": <0-10>,
      "severityScore": <0-10>,
      "recencyScore": <0-10>,
      "sentimentScore": <0-10>,
      "impactScore": <0-10>,
      "priorityScore": <0-10>,
      "affectedPlatforms": ["Google Play"|"App Store"|"Reddit"],
      "quotes": ["<quote1>", "<quote2>"]
    }
  ],
  "categoryBreakdown": {
    "Bugs/Crashes": <count>,
    "UI/UX": <count>,
    "Performance": <count>,
    "Feature Requests": <count>,
    "Payment/Account": <count>
  },
  "trends": {
    "worsening": ["<issue>"],
    "improving": ["<issue>"],
    "emerging": ["<issue>"]
  },
  "recommendations": {
    "immediate": ["<fix1>", "<fix2>"],
    "midTerm": ["<fix1>", "<fix2>"],
    "lowPriority": ["<fix1>"]
  }
}`;

  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'openrouter/free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5174',
        'X-Title': 'FeedbackAgent'
      }
    });

    let text = response.data.choices[0]?.message?.content || '{}';
    
    // Extract everything between the first { and the last } in case the model added conversational filler
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      text = match[0];
    }
    
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.log('Initial JSON parse failed, attempting repair...');
      const repaired = jsonrepair(text);
      return JSON.parse(repaired);
    }
  } catch (err) {
    if (err.response && err.response.data && err.response.data.error) {
      throw new Error(`OpenRouter API Error: ${err.response.data.error.message || JSON.stringify(err.response.data.error)}`);
    }
    throw err;
  }
}

app.post('/api/analyze', async (req, res) => {
  const { appName, days = 30 } = req.body;
  if (!appName) return res.status(400).json({ error: 'appName is required' });
  if (!OPENROUTER_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set in server .env' });

  try {
    const [playReviews, appleReviews, redditPosts] = await Promise.all([
      fetchPlayStore(appName),
      fetchAppStore(appName),
      fetchReddit(appName, days),
    ]);

    const all = [...playReviews, ...appleReviews, ...redditPosts];
    if (all.length === 0) return res.status(404).json({ error: 'No reviews found. Try a different app name.' });

    const analysis = await analyzeWithOpenRouter(all, appName, OPENROUTER_KEY);
    res.json({
      ...analysis,
      totalReviews: all.length,
      sources: {
        playStore: playReviews.length,
        appStore: appleReviews.length,
        reddit: redditPosts.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

app.get('/api/suggest', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const results = await gplay.search({ term: q, num: 5 });
    res.json(results.map(r => ({ title: r.title, icon: r.icon })));
  } catch (err) {
    res.json([]);
  }
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(3001, () => console.log('✅ Server running on http://localhost:3001'));
}

module.exports = app;
