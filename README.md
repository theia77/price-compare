# PriceScout — Multi-Platform Price Comparison

Compare product prices across Amazon, Flipkart, eBay (and more) using RapidAPI.

---

## Structure

```
price-compare/
├── .env                   ← your secrets (never push this)
├── .env.example           ← safe template to push
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── middleware/auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── search.js
│   │   └── wishlist.js
│   └── services/
│       ├── rapidapi.js    ← fill this in with your API calls
│       └── supabase.js
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── auth.js
└── supabase/
    └── schema.sql
```

---

## Quick Start

### 1. Install backend dependencies
```bash
cd backend
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, RAPIDAPI_KEY
```

### 3. Set up database
Run `supabase/schema.sql` in your Supabase SQL Editor.

### 4. Start the backend
```bash
npm run dev
```

### 5. Open the frontend
Open `frontend/index.html` in your browser.

---

## RapidAPI Setup

1. Create a free account at rapidapi.com
2. Subscribe to APIs for Amazon, Flipkart, eBay (all have free tiers)
3. Paste your single RapidAPI key into `.env` as `RAPIDAPI_KEY`
4. Complete `backend/services/rapidapi.js` with your chosen API calls

---

## Adding a New Platform

1. Add a search function in `backend/services/rapidapi.js`
2. Register it in the `PLATFORMS` object and `availablePlatforms` export
3. Add display metadata in `frontend/app.js` → `PLATFORM_META`
