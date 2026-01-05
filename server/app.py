from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import os
import random

app = Flask(__name__)
CORS(app)
bcrypt = Bcrypt(app)

# ---------------------------------------------------------
# HELPER: Safe CSV Reading (Prevents EmptyDataError)
# ---------------------------------------------------------
def safe_read_csv(filepath, default_columns):
    """
    Reads a CSV safely. If file is missing OR EMPTY, returns an empty DataFrame with default_columns.
    """
    if not os.path.exists(filepath):
        return pd.DataFrame(columns=default_columns)
    
    try:
        # Check if file is empty (0 bytes)
        if os.path.getsize(filepath) == 0:
             return pd.DataFrame(columns=default_columns)
             
        return pd.read_csv(filepath)
    except pd.errors.EmptyDataError:
        return pd.DataFrame(columns=default_columns)
    except Exception as e:
        print(f"Warning: Could not read {filepath}: {e}")
        return pd.DataFrame(columns=default_columns)

# ---------------------------------------------------------
# 1. LOAD DATASETS
# ---------------------------------------------------------
def load_data():
    """Helper to load data with safe fallbacks"""
    data = {}
    try:
        # Core Data
        data["games"] = pd.read_csv("dataset/games.csv")
        data["features"] = pd.read_csv("dataset/game_features.csv")
        data["text"] = pd.read_csv("dataset/game_text.csv")
        data["metadata"] = pd.read_csv("dataset/game_metadata.csv")
        
        # User Interactions
        if os.path.exists("dataset/user_interactions.csv"):
            data["interactions"] = pd.read_csv("dataset/user_interactions.csv")
        elif os.path.exists("dataset/ratings.csv"):
            # Fallback for older dataset versions
            df = pd.read_csv("dataset/ratings.csv")
            df["playtime"] = 0
            data["interactions"] = df
        else:
             data["interactions"] = pd.DataFrame(columns=["user_id", "game_id", "rating", "playtime"])

        # Accounts
        if os.path.exists("dataset/users_accounts.csv"):
            data["accounts"] = pd.read_csv("dataset/users_accounts.csv")
        else:
            data["accounts"] = pd.DataFrame(columns=["username", "password_hash"])

        # User Preferences (Saved Survey Answers)
        if os.path.exists("dataset/users.csv"):
            data["users"] = pd.read_csv("dataset/users.csv")
        else:
            cols = ["user_id"] + list(data["features"].columns.drop("game_id", errors='ignore'))
            data["users"] = pd.DataFrame(columns=cols)

    except Exception as e:
        print(f"CRITICAL DATA LOAD ERROR: {e}")
        # Initialize empties to prevent crash
        data["games"] = pd.DataFrame(columns=["game_id", "title"])
        data["features"] = pd.DataFrame()
        data["text"] = pd.DataFrame()
        data["metadata"] = pd.DataFrame()
        data["interactions"] = pd.DataFrame(columns=["user_id", "game_id", "rating", "playtime"])
        data["accounts"] = pd.DataFrame(columns=["username", "password_hash"])
        data["users"] = pd.DataFrame(columns=["user_id"])
    
    return data

DB = load_data()

# ---------------------------------------------------------
# 2. PRE-COMPUTE MATRICES
# ---------------------------------------------------------
def compute_matrices(db):
    matrices = {}
    
    # Feature Matrix
    if not db["features"].empty:
        feat_mat = db["features"].set_index("game_id").sort_index()
        matrices["feature_matrix"] = feat_mat
        matrices["content_sim"] = pd.DataFrame(
            cosine_similarity(feat_mat), index=feat_mat.index, columns=feat_mat.index
        )
    
    # Text Matrix
    if not db["text"].empty:
        tfidf = TfidfVectorizer(stop_words='english')
        text_sorted = db["text"].set_index("game_id").reindex(db["features"].set_index("game_id").index).fillna('')
        tfidf_matrix = tfidf.fit_transform(text_sorted['description'])
        matrices["text_sim"] = pd.DataFrame(
            cosine_similarity(tfidf_matrix), index=text_sorted.index, columns=text_sorted.index
        )
    return matrices

MATRICES = compute_matrices(DB)

# ---------------------------------------------------------
# 3. LOGIC
# ---------------------------------------------------------
def get_hybrid_scores(prefs, alpha=0.4, beta=0.4, gamma=0.2):
    if "feature_matrix" not in MATRICES: return pd.Series()
    feat_mat = MATRICES["feature_matrix"]
    
    # User Profile
    user_profile = [float(prefs.get(col, 0)) for col in feat_mat.columns]
    content_scores = cosine_similarity([user_profile], feat_mat)[0]
    content_series = pd.Series(content_scores, index=feat_mat.index)

    # Collaborative
    collab_series = pd.Series(0, index=feat_mat.index)
    if not DB["interactions"].empty:
        avg = DB["interactions"].groupby("game_id")["rating"].mean()
        if avg.max() > 0: avg = avg / 5.0
        collab_series = avg.reindex(feat_mat.index).fillna(0)

    # Text
    text_series = pd.Series(0, index=feat_mat.index)
    if "text_sim" in MATRICES:
        best_id = content_series.idxmax()
        if best_id in MATRICES["text_sim"].index:
            text_series = MATRICES["text_sim"][best_id]

    final_scores = (alpha * content_series) + (beta * collab_series) + (gamma * text_series)
    
    # Normalize
    if final_scores.max() != final_scores.min():
        final_scores = (final_scores - final_scores.min()) / (final_scores.max() - final_scores.min())
    
    # Round to stabilize sorting
    final_scores = final_scores.round(6)
        
    return final_scores.sort_values(ascending=False).head(10)

# ---------------------------------------------------------
# 4. ROUTES
# ---------------------------------------------------------

@app.route("/user/has_preferences/<user_id>", methods=["GET"])
def check_preferences(user_id):
    if DB["users"].empty: return jsonify({"has_preferences": False})
    exists = str(user_id) in DB["users"]["user_id"].astype(str).values
    return jsonify({"has_preferences": bool(exists)})

@app.route("/recommend", methods=["POST"])
def recommend():
    try:
        data = request.json
        user_id = data.get("user_id")
        
        # Guest Data
        guest_genres = data.get("genres", [])
        guest_platforms = data.get("platforms", [])
        guest_modes = data.get("modes", [])

        prefs = {}
        has_history = False
        
        # Active Filters
        filter_genres = guest_genres
        filter_platforms = guest_platforms
        filter_modes = guest_modes

        # --- CASE A: LOGGED IN USER ---
        if user_id:
            # 1. Load History SAFELY
            interactions = safe_read_csv("dataset/user_interactions.csv", ["user_id", "game_id", "rating", "implicit"])
            
            user_history = interactions[interactions["user_id"].astype(str) == str(user_id)]
            if not user_history.empty:
                has_history = True
                liked_game_ids = user_history[user_history["rating"] >= 4]["game_id"].tolist()
                if liked_game_ids and not DB["features"].empty:
                    liked_features = DB["features"][DB["features"]["game_id"].isin(liked_game_ids)]
                    numeric_cols = liked_features.drop(columns=["game_id"], errors="ignore")
                    prefs = numeric_cols.mean().to_dict()

            # 2. Load Filters from Preferences SAFELY
            prefs_df = safe_read_csv("dataset/user_preferences.csv", ["user_id", "genres", "platforms", "modes"])
            
            user_pref = prefs_df[prefs_df["user_id"].astype(str) == str(user_id)]
            if not user_pref.empty:
                # Parse CSV strings back to lists
                g_str = str(user_pref.iloc[0]['genres'])
                p_str = str(user_pref.iloc[0]['platforms'])
                m_str = str(user_pref.iloc[0]['modes'])
                
                if g_str and g_str != "nan": filter_genres = g_str.split(";")
                if p_str and p_str != "nan": filter_platforms = p_str.split(";")
                if m_str and m_str != "nan": filter_modes = m_str.split(";")

        # --- CASE B: GUEST PROFILE BUILDING ---
        if not has_history and guest_genres:
            genre_feature_map = {
                "RPG": "rpg", "Shooter": "shooter", "Survival": "survival",
                "Action": "competitive", "Adventure": "open_world", "Strategy": "rpg",
                "Simulation": "casual", "Puzzle": "casual", "Racing": "competitive",
                "Sports": "competitive", "Horror": "survival", "Stealth": "singleplayer",
                "Fighting": "competitive", "Platformer": "casual"
            }
            for g in guest_genres:
                feat = genre_feature_map.get(g)
                if feat: prefs[feat] = 1.0 

        if user_id and not has_history and not guest_genres:
             return jsonify({"user": user_id, "recommendations": [], "status": "cold_start"})

        # --- RUN ALGORITHM ---
        scores = get_hybrid_scores(prefs)
        
        recommended_games = []
        feature_list = DB["features"].columns.tolist() if not DB["features"].empty else []
        
        genre_feature_map = {
            "RPG": "rpg", "Shooter": "shooter", "Survival": "survival",
            "Action": "competitive", "Adventure": "open_world", "Strategy": "rpg",
            "Simulation": "casual", "Puzzle": "casual", "Racing": "competitive",
            "Sports": "competitive", "Horror": "survival", "Stealth": "singleplayer",
            "Fighting": "competitive", "Platformer": "casual"
        }

        for game_id in scores.index:
            game_feats = DB["features"][DB["features"]["game_id"] == game_id]
            if game_feats.empty: continue

            # --- 1. GENRE FILTER ---
            if filter_genres:
                required_feats = [genre_feature_map.get(g) for g in filter_genres if genre_feature_map.get(g)]
                match_genre = False
                for f in required_feats:
                    if f in game_feats.columns and game_feats[f].values[0] >= 1:
                        match_genre = True
                        break
                if not match_genre: continue

            # --- 2. Platform Filter ---
            if filter_platforms:
                meta = DB["metadata"][DB["metadata"]["game_id"] == game_id]
                if meta.empty: continue
                gp = str(meta.iloc[0]['platform'])
                if not any(p in gp for p in filter_platforms): continue

            # --- 3. Mode Filter ---
            if filter_modes:
                is_single = game_feats.iloc[0].get('singleplayer', 0) >= 1
                is_multi = game_feats.iloc[0].get('multiplayer', 0) >= 1
                match = False
                if "Singleplayer" in filter_modes and is_single: match = True
                if "Multiplayer" in filter_modes and is_multi: match = True
                if not match: continue

            # --- Build Response ---
            core = DB["games"][DB["games"]["game_id"] == game_id]
            if core.empty: continue
            meta = DB["metadata"][DB["metadata"]["game_id"] == game_id]
            txt = DB["text"][DB["text"]["game_id"] == game_id]

            explanations = []
            for feat in feature_list:
                if feat in prefs and prefs[feat] >= 0.5 and game_feats[feat].values[0] >= 1:
                    explanations.append(feat.replace("_", " ").title())
            
            expl_text = f"Because you like {', '.join(explanations[:3])} games." if explanations else "Recommended based on your choices."

            recommended_games.append({
                "game_id": int(game_id),
                "title": core["title"].values[0],
                "score": float(scores[game_id]),
                "image": meta["image_url"].values[0] if not meta.empty else "",
                "description": txt["description"].values[0] if not txt.empty else "",
                "explanation": expl_text,
                "rating": None 
            })

        # Attach Ratings (SAFELY)
        if user_id and has_history:
             # Use the interactions dataframe we already safely loaded
             user_ratings = interactions[interactions["user_id"].astype(str) == str(user_id)]
             if "implicit" in user_ratings.columns:
                 user_ratings = user_ratings[user_ratings["implicit"] != True]
             for rec in recommended_games:
                r = user_ratings[user_ratings["game_id"] == rec["game_id"]]
                if not r.empty:
                    rec["rating"] = int(r["rating"].values[0])

        return jsonify({"user": user_id, "recommendations": recommended_games, "status": "success"})

    except Exception as e:
        print(f"ERROR in /recommend: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/rate", methods=["POST"])
def rate_game():
    data = request.json
    user_id = data.get("user_id")
    game_id = data.get("game_id")
    rating = data.get("rating")

    if not all([user_id, game_id, rating]):
        return jsonify({"error": "Missing data"}), 400

    interactions_path = "dataset/user_interactions.csv"
    if os.path.exists(interactions_path):
        df = pd.read_csv(interactions_path)
    else:
        df = pd.DataFrame(columns=["user_id", "game_id", "rating", "implicit"])

    # Update or Append
    mask = (df["user_id"].astype(str) == str(user_id)) & (df["game_id"] == game_id)
    if mask.any():
        df.loc[mask, "rating"] = rating
        df.loc[mask, "implicit"] = False # <--- Ensure it becomes visible if I edit it
    else:
        new_row = pd.DataFrame([{
            "user_id": user_id, 
            "game_id": game_id, 
            "rating": rating, 
            "implicit": False # <--- Manual ratings are always visible
        }])
        df = pd.concat([df, new_row], ignore_index=True)

    df.to_csv(interactions_path, index=False)
    DB["interactions"] = df
    
    return jsonify({"message": "Rating saved"})

@app.route("/games")
def get_games():
    merged = DB["games"].merge(DB["metadata"], on="game_id", how="left")
    games_list = merged.to_dict('records')

    genre_cols = ["rpg", "shooter", "survival", "casual", "open_world", "competitive"]
    
    for game in games_list:
        gid = game["game_id"]
        feats = DB["features"][DB["features"]["game_id"] == gid]
        
        if not feats.empty:
            valid_cols = [c for c in genre_cols if c in feats.columns]
            if valid_cols:
                row_values = feats.iloc[0][valid_cols]
                best_genre = row_values.idxmax()
                if best_genre == "rpg":
                    game["genre"] = "RPG"
                else:
                    game["genre"] = best_genre.replace("_", " ").title()
            else:
                game["genre"] = "Action"
        else:
            game["genre"] = "Uncategorized"

    return jsonify(games_list)

@app.route("/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        return jsonify({"error": "Required fields missing"}), 400
    
    try: users = pd.read_csv("dataset/users_accounts.csv")
    except: users = pd.DataFrame(columns=["username", "password_hash"])
    
    if username in users["username"].values: return jsonify({"error": "Username exists"}), 400
    
    pw_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = pd.DataFrame([{"username": username, "password_hash": pw_hash}])
    users = pd.concat([users, new_user], ignore_index=True)
    users.to_csv("dataset/users_accounts.csv", index=False)
    DB["accounts"] = users
    return jsonify({"message": "Success"})

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")
    
    try: users = pd.read_csv("dataset/users_accounts.csv")
    except: return jsonify({"error": "No users"}), 401
    
    user = users[users["username"] == username]
    if user.empty or not bcrypt.check_password_hash(user["password_hash"].values[0], password):
        return jsonify({"error": "Invalid credentials"}), 401
        
    return jsonify({"message": "Login successful", "username": username})

@app.route("/reset_profile", methods=["POST"])
def reset_profile():
    data = request.json
    user_id = data.get("user_id")
    
    if not user_id: return jsonify({"error": "Missing user ID"}), 400
    
    # 1. Delete from Survey Preferences (users.csv)
    if os.path.exists("dataset/users.csv"):
        df = pd.read_csv("dataset/users.csv")
        # Keep rows that are NOT this user
        df = df[df["user_id"].astype(str) != str(user_id)]
        df.to_csv("dataset/users.csv", index=False)
        DB["users"] = df # Update memory

    # 2. Delete from Ratings History (user_interactions.csv)
    if os.path.exists("dataset/user_interactions.csv"):
        df = pd.read_csv("dataset/user_interactions.csv")
        # Keep rows that are NOT this user
        df = df[df["user_id"].astype(str) != str(user_id)]
        df.to_csv("dataset/user_interactions.csv", index=False)
        DB["interactions"] = df # Update memory

    return jsonify({"message": "Profile reset successfully"})

@app.route("/user/history/<user_id>")
def get_user_history(user_id):
    if "interactions" not in DB or DB["interactions"].empty:
        return jsonify([])
    
    # 1. Get All Interactions
    df = DB["interactions"]
    user_df = df[df["user_id"].astype(str) == str(user_id)].copy()
    
    # 2. FILTER: Remove 'Implicit' (Survey) ratings
    if "implicit" in user_df.columns:
        # Keep rows where implicit is False OR NaN (older rows)
        user_df = user_df[user_df["implicit"] != True]

    if user_df.empty:
        return jsonify([])

    # 3. Merge with Metadata for Images/Titles
    merged = user_df.merge(DB["metadata"], on="game_id", how="left")
    merged = merged.merge(DB["games"], on="game_id", how="left")
    
    # Fill missing images
    merged["image_url"] = merged["image_url"].fillna("https://placehold.co/400x225/333/fff?text=No+Image")
    
    # Format for Frontend
    history_list = []
    for _, row in merged.iterrows():
        history_list.append({
            "game_id": int(row["game_id"]),
            "title": row["title"],
            "image": row["image_url"],
            "rating": int(row["rating"])
        })
        
    return jsonify(history_list)

@app.route("/games/similar/<game_id>")
def get_similar_games(game_id):
    # 1. Check if matrix exists
    if "content_sim" not in MATRICES:
        return jsonify({"error": "Similarity matrix not ready"}), 503
        
    try:
        # 2. Get the row for this game
        # Ensure ID is an integer
        gid = int(game_id)
        if gid not in MATRICES["content_sim"].index:
            return jsonify({"error": "Game not found in matrix"}), 404
            
        # 3. Get similarity scores
        sim_scores = MATRICES["content_sim"].loc[gid]
        
        # 4. Sort by score (descending), drop the game itself (score=1.0)
        # We take top 5
        top_similar = sim_scores.sort_values(ascending=False).drop(gid).head(5)
        
        # 5. Fetch details for these 5 games
        results = []
        for sim_gid in top_similar.index:
            core = DB["games"][DB["games"]["game_id"] == sim_gid]
            if core.empty: continue
            
            meta = DB["metadata"][DB["metadata"]["game_id"] == sim_gid]
            
            results.append({
                "game_id": int(sim_gid),
                "title": core["title"].values[0],
                "score": float(top_similar[sim_gid]), # How similar is it? (0 to 1)
                "image": meta["image_url"].values[0] if not meta.empty else ""
            })
            
        return jsonify(results)

    except ValueError:
        return jsonify({"error": "Invalid game ID"}), 400

@app.route("/rate/delete", methods=["POST"])
def delete_rating():
    data = request.json
    user_id = data.get("user_id")
    game_id = data.get("game_id")

    if not user_id or not game_id:
        return jsonify({"error": "Missing data"}), 400

    # Load fresh data
    if os.path.exists("dataset/user_interactions.csv"):
        df = pd.read_csv("dataset/user_interactions.csv")
        
        # Create a mask to find the specific row
        # We ensure types match (str for user_id, int for game_id) just in case
        mask = (df["user_id"].astype(str) == str(user_id)) & (df["game_id"].astype(str) == str(game_id))
        
        # Keep everything that does NOT match the mask
        df = df[~mask]
        
        df.to_csv("dataset/user_interactions.csv", index=False)
        DB["interactions"] = df # Update memory
        
    return jsonify({"message": "Rating removed"})

@app.route("/survey", methods=["POST"])
def save_survey():
    try:
        data = request.json
        user_id = data.get("user_id")
        genres_selected = data.get("genres", [])       # We will now save this
        platforms_selected = data.get("platforms", []) 
        modes_selected = data.get("modes", [])         

        if not user_id:
            return jsonify({"error": "Missing user_id"}), 400

        # 1. SAVE ALL PREFERENCES (Genres, Platform, Mode)
        prefs_path = "dataset/user_preferences.csv"
        if os.path.exists(prefs_path):
            prefs_df = pd.read_csv(prefs_path)
        else:
            # Added 'genres' column
            prefs_df = pd.DataFrame(columns=["user_id", "genres", "platforms", "modes"])
        
        # Remove old prefs
        prefs_df = prefs_df[prefs_df["user_id"].astype(str) != str(user_id)]
        
        # Add new prefs
        new_pref = {
            "user_id": user_id,
            "genres": ";".join(genres_selected),       # Save as "RPG;Action"
            "platforms": ";".join(platforms_selected), 
            "modes": ";".join(modes_selected)          
        }
        prefs_df = pd.concat([prefs_df, pd.DataFrame([new_pref])], ignore_index=True)
        prefs_df.to_csv(prefs_path, index=False)
        DB["preferences"] = prefs_df 

        # 2. GENERATE SEED RATINGS (Implicit Likes)
        features_df = pd.read_csv("dataset/game_features.csv")
        text_df = pd.read_csv("dataset/game_text.csv")
        metadata_df = pd.read_csv("dataset/game_metadata.csv")

        genre_feature_map = {
            "RPG": "rpg", "Shooter": "shooter", "Survival": "survival",
            "Action": "competitive", "Adventure": "open_world", "Strategy": "rpg",
            "Simulation": "casual", "Puzzle": "casual", "Racing": "competitive",
            "Sports": "competitive", "Horror": "survival", "Stealth": "singleplayer",
            "Fighting": "competitive", "Platformer": "casual"
        }

        interactions_path = "dataset/user_interactions.csv"
        if os.path.exists(interactions_path):
            interactions_df = pd.read_csv(interactions_path)
        else:
            interactions_df = pd.DataFrame(columns=["user_id", "game_id", "rating", "implicit"])

        interactions_df = interactions_df[interactions_df["user_id"].astype(str) != str(user_id)]

        new_rows = []
        
        for genre in genres_selected:
            found_games = pd.DataFrame()
            
            # Text Search
            text_matches = text_df[text_df['description'].str.contains(genre, case=False, na=False)]
            if not text_matches.empty:
                found_games = text_matches
            
            # Feature Fallback
            if len(found_games) < 3:
                feature_col = genre_feature_map.get(genre)
                if feature_col and feature_col in features_df.columns:
                    feature_matches = features_df[features_df[feature_col] >= 4]
                    found_games = pd.concat([found_games, feature_matches]).drop_duplicates(subset='game_id')

            # --- APPLY FILTERS TO SEED GAMES TOO ---
            valid_games = []
            if not found_games.empty:
                for _, game in found_games.iterrows():
                    gid = game['game_id']
                    
                    # Platform Check
                    if platforms_selected:
                        meta = metadata_df[metadata_df['game_id'] == gid]
                        if not meta.empty:
                            gp = str(meta.iloc[0]['platform'])
                            if not any(p in gp for p in platforms_selected): continue 

                    # Mode Check
                    if modes_selected:
                        feats = features_df[features_df['game_id'] == gid]
                        if not feats.empty:
                            is_single = feats.iloc[0].get('singleplayer', 0) >= 1
                            is_multi = feats.iloc[0].get('multiplayer', 0) >= 1
                            match = False
                            if "Singleplayer" in modes_selected and is_single: match = True
                            if "Multiplayer" in modes_selected and is_multi: match = True
                            if not match: continue

                    valid_games.append(game)

            if valid_games:
                import random
                selected = random.sample(valid_games, min(len(valid_games), 3))
                for game in selected:
                    new_rows.append({
                        "user_id": user_id,
                        "game_id": game['game_id'],
                        "rating": 5.0,
                        "implicit": True
                    })

        if new_rows:
            new_df = pd.DataFrame(new_rows)
            interactions_df = pd.concat([interactions_df, new_df], ignore_index=True)
            interactions_df.to_csv(interactions_path, index=False)
            DB["interactions"] = interactions_df 

        return jsonify({"message": "Survey saved", "count": len(new_rows)})

    except Exception as e:
        print(f"ERROR in /survey: {e}")
        return jsonify({"error": str(e)}), 500
    
# ---------------------------------------------------------
# NEW: Get Full Game Details (Metadata + Text)
# ---------------------------------------------------------
@app.route("/game/<int:game_id>", methods=["GET"])
def get_game_details(game_id):
    # 1. Get Core Data (Title)
    core = DB["games"][DB["games"]["game_id"] == game_id]
    if core.empty: return jsonify({"error": "Game not found"}), 404
    
    game_data = core.iloc[0].to_dict()

    # 2. Merge Metadata (Release, Publisher, Platform, Image)
    if not DB["metadata"].empty:
        meta = DB["metadata"][DB["metadata"]["game_id"] == game_id]
        if not meta.empty:
            game_data.update(meta.iloc[0].to_dict())

    # 3. Merge Text (Description)
    if not DB["text"].empty:
        txt = DB["text"][DB["text"]["game_id"] == game_id]
        if not txt.empty:
            game_data.update(txt.iloc[0].to_dict())

    # 4. Cleanup (Handle NaN values for JSON)
    clean_data = {k: (v if pd.notna(v) else None) for k, v in game_data.items()}
    
    return jsonify(clean_data)


# ---------------------------------------------------------
# NEW: Item-to-Item Recommendation (More Like This)
# ---------------------------------------------------------
@app.route("/recommend/game", methods=["POST"])
def recommend_similar_games():
    try:
        data = request.json
        game_id = data.get("game_id")
        
        if not game_id: return jsonify({"error": "Missing game_id"}), 400

        # 1. Find features of target game
        if "features" not in DB or DB["features"].empty:
             return jsonify({"recommendations": []})

        target = DB["features"][DB["features"]["game_id"] == game_id]
        if target.empty: return jsonify({"recommendations": []})

        # 2. Build profile from this game
        # Drop game_id to get just the feature vector
        profile = target.drop(columns=["game_id"], errors="ignore").iloc[0].to_dict()

        # 3. Run Algorithm
        scores = get_hybrid_scores(profile)
        
        similar = []
        for sim_id in scores.index[:7]: # Top 7
            if int(sim_id) == int(game_id): continue # Skip self
            
            core = DB["games"][DB["games"]["game_id"] == sim_id]
            meta = DB["metadata"][DB["metadata"]["game_id"] == sim_id]
            
            if not core.empty:
                similar.append({
                    "game_id": int(sim_id),
                    "title": core["title"].values[0],
                    "image": meta["image_url"].values[0] if not meta.empty else "",
                    "score": float(scores[sim_id])
                })

        return jsonify({"recommendations": similar})

    except Exception as e:
        print(f"ERROR: {e}")
        return jsonify({"error": str(e)}), 500
    
# ---------------------------------------------------------
# NEW: LIBRARY MANAGEMENT (MyAnimeList Style)
# ---------------------------------------------------------

@app.route("/library/update", methods=["POST"])
def update_library_status():
    try:
        data = request.json
        user_id = data.get("user_id")
        game_id = data.get("game_id")
        status = data.get("status") # "Playing", "Completed", "Dropped", "Plan to Play", "Remove"

        if not all([user_id, game_id, status]):
            return jsonify({"error": "Missing fields"}), 400

        # Load Library DB
        library_path = "dataset/user_library.csv"
        if os.path.exists(library_path):
            lib_df = pd.read_csv(library_path)
        else:
            lib_df = pd.DataFrame(columns=["user_id", "game_id", "status", "date_added"])

        # Create timestamp
        from datetime import datetime
        now = datetime.now().strftime("%Y-%m-%d")

        # Check if entry exists
        mask = (lib_df["user_id"].astype(str) == str(user_id)) & (lib_df["game_id"] == game_id)
        
        if status == "Remove":
            # Delete Row
            lib_df = lib_df[~mask]
        elif mask.any():
            # Update Existing
            lib_df.loc[mask, "status"] = status
            lib_df.loc[mask, "date_added"] = now # Update timestamp
        else:
            # Add New
            new_row = pd.DataFrame([{
                "user_id": user_id,
                "game_id": game_id,
                "status": status,
                "date_added": now
            }])
            lib_df = pd.concat([lib_df, new_row], ignore_index=True)

        lib_df.to_csv(library_path, index=False)
        DB["library"] = lib_df # Update Memory

        # OPTIONAL: If they mark as "Completed" or "Playing", implicitly "Like" it (Rating 5)
        # This feeds the recommendation engine automatically!
        if status in ["Completed", "Playing"]:
            # Call internal rate logic (simplified duplication for safety)
            # You can also just call the /rate endpoint via internal request if preferred
            pass 

        return jsonify({"message": f"Game moved to {status}"})

    except Exception as e:
        print(f"ERROR: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/library/<user_id>", methods=["GET"])
def get_user_library(user_id):
    try:
        # Check if library loaded
        library_path = "dataset/user_library.csv"
        if not os.path.exists(library_path):
            return jsonify([])

        lib_df = pd.read_csv(library_path)
        user_lib = lib_df[lib_df["user_id"].astype(str) == str(user_id)]

        if user_lib.empty:
            return jsonify([])

        # Merge with Game Data to get Titles/Images
        # We assume DB["games"] and DB["metadata"] are loaded globally
        merged = user_lib.merge(DB["games"], on="game_id", how="left")
        merged = merged.merge(DB["metadata"], on="game_id", how="left")

        # Fill NaNs
        merged["image_url"] = merged["image_url"].fillna("https://placehold.co/400x225/333/fff?text=No+Image")
        
        # Convert to list
        library_list = []
        for _, row in merged.iterrows():
            library_list.append({
                "game_id": int(row["game_id"]),
                "title": row["title"],
                "image": row["image_url"],
                "status": row["status"],
                "date": row["date_added"]
            })

        return jsonify(library_list)

    except Exception as e:
        print(f"ERROR: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)