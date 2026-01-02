# Game Recommender AI Coding Guidelines

## Architecture Overview
This is a game recommendation system with a React frontend and Python Flask backend. The backend implements a hybrid recommender using content-based filtering (user preferences vs game features) and collaborative filtering (game similarities from user ratings).

**Key Components:**
- `server/app.py`: Flask API with `/recommend` (POST preferences → return top 5 games) and `/rate` (POST user ratings)
- `game-recommender/src/App.jsx`: Main React app managing user flow: PseudoLogin → Survey → Recommendations
- Data: CSV files in `server/dataset/` (games.csv, users.csv, ratings.csv) with 1-5 scale features

**Data Flow:**
1. User enters username → Survey with 9 feature sliders (singleplayer, multiplayer, etc.)
2. POST to `/recommend` with preferences → Backend computes hybrid scores → Returns games with normalized scores
3. Display GameCard components with like/dislike buttons (confirmation required)
4. Ratings saved via POST to `/rate` (appends to ratings.csv)

## Development Workflows
- **Start Backend:** `cd server && python app.py` (runs on http://127.0.0.1:5000 with debug=True)
- **Start Frontend:** `cd game-recommender && npm run dev` (Vite dev server, typically http://localhost:5173)
- **Build Frontend:** `cd game-recommender && npm run build` (outputs to dist/)
- **Lint Frontend:** `cd game-recommender && npm run lint` (ESLint with React rules)

## Code Patterns & Conventions
- **Feature Ratings:** All game/user features use 1-5 integer scale (1=dislike, 5=love)
- **Hybrid Scoring:** Content weight α=0.6, collaborative weight 0.4 in `hybrid_scores()` function
- **Rating Confirmation:** GameCard uses two-step like/dislike: click → confirm/cancel → update state & send to backend
- **CORS:** Backend enables CORS for frontend requests
- **State Management:** React uses useState for user, recommendations, feedback; no external state libs
- **Styling:** Tailwind CSS classes (e.g., `bg-blue-600`, `rounded`, `shadow-md`)
- **Error Handling:** Backend catches FileNotFoundError for CSVs; frontend assumes successful fetches

## Dependencies & Environment
- **Backend:** Flask, flask-cors, pandas, scikit-learn (cosine_similarity)
- **Frontend:** React 19, Vite, Tailwind CSS 4, ESLint
- **Data Processing:** Cosine similarity on feature vectors; pivot tables for user-game matrix
- **APIs:** JSON payloads; game images from Steam CDN URLs

## Common Tasks
- **Add New Feature:** Update `features` array in Survey.jsx, add column to games.csv/users.csv, adjust hybrid_scores if needed
- **Modify Scoring:** Edit `hybrid_scores()` in app.py (alpha parameter, similarity calculations)
- **New Component:** Place in `game-recommender/src/components/`, import in App.jsx
- **Backend Endpoint:** Add route in app.py, handle JSON request/response

Reference: `server/app.py` for recommendation logic, `game-recommender/src/components/Survey.jsx` for UI patterns.