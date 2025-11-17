# Spotify History Dashboard

A Next.js web application for visualizing your Spotify listening history, built with React, TypeScript, and Supabase.

## Prerequisites

- Node.js 18+ and npm (or yarn/pnpm)
- A Supabase project with the analytics schema set up (see main [README.md](../README.md) for database setup)
- Environment variables configured (see below)

## Setup

### 1. Install Dependencies

```bash
cd web
npm install
# or
yarn install
# or
pnpm install
```

### 2. Environment Variables

Create a `.env.local` file in the `web/` directory with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Getting your Supabase credentials:**
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the "Project URL" for `NEXT_PUBLIC_SUPABASE_URL`
4. Copy the "anon public" key for `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Database Setup

Before running the website, ensure you've completed the database setup:

1. **Run the required SQL scripts** (from the `docs/` directory):
   - `grant_analytics_access.sql` - Grants API access to the analytics schema
   - `create_artists_table.sql` - Creates the artists table (if using artist/genre features)

2. **Run dbt models** to create the analytics views:
   ```bash
   cd ../spotify_history
   dbt run
   ```

   This creates views in the `analytics` schema that the website queries:
   - `analytics.recent_tracks`
   - `analytics.daily_listening_totals`
   - `analytics.listening_totals_windows`
   - `analytics.top_tracks_rolling`
   - `analytics.top_artists_rolling`
   - `analytics.top_genres_rolling`
   - And more...

### 4. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the dashboard.

## Features

The dashboard displays:

- **Recent Tracks** - Your 50 most recently played tracks
- **Daily Minutes Chart** - Bar chart showing listening minutes per day (7d/30d/90d views)
- **Total Minutes** - All-time listening minutes
- **Top Tracks** - Most played tracks across different time windows
- **Top Artists** - Most played artists across different time windows
- **Top Genres** - Most listened genres across different time windows

## Project Structure

```
web/
├── app/              # Next.js app directory
│   ├── page.tsx     # Main dashboard page
│   └── layout.tsx   # Root layout
├── components/      # React components
│   ├── DailyMinutesChart.tsx
│   ├── RecentTracksCard.tsx
│   ├── TopTracksCard.tsx
│   ├── TopArtistsCard.tsx
│   ├── TopGenresCard.tsx
│   └── ui/          # shadcn/ui components
├── lib/
│   ├── queries.ts   # Supabase query functions
│   └── supabase.ts  # Supabase client setup
└── package.json
```

## Building for Production

```bash
npm run build
npm start
```

## Deployment

The easiest way to deploy is using [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add your environment variables in Vercel's project settings
4. Deploy!

Make sure to set the same environment variables in your Vercel project settings.

## Troubleshooting

### "Failed to fetch" errors

- Verify your Supabase URL and anon key are correct
- Ensure you've run `grant_analytics_access.sql` to grant API access
- Check that dbt models have been run and views exist in the `analytics` schema

### No data showing

- Verify data has been ingested via the Python scripts
- Check that dbt models have been run successfully
- Verify the analytics schema views exist and have data

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Recharts Documentation](https://recharts.org/)
