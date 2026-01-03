from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import os

app = Flask(__name__)
CORS(app)
bcrypt = Bcrypt(app)

# ---------------------------------------------------------
# 1. LOAD DATASETS
# ---------------------------------------------------------
def load_data():
    """Helper to load data with safe fallbacks"""
    data = {}
    try:
        # Core Identity
        data["games"] = pd.read_csv("dataset/games.csv")
        
        # Content Features (Numeric)
        data["features"] = pd.read_csv("dataset/game_features.csv")
        
        # Textual Content (Unstructured)
        data["text"] = pd.read_csv("dataset/game_text.csv")
        
        # Metadata (Display Info)
        data["metadata"] = pd.read_csv("dataset/game_metadata.csv")
        
        # User Interactions (Collaborative)
        # Check for 'user_interactions.csv', fallback to 'ratings.csv' if needed, or empty
        if os.path.exists("dataset/user_interactions.csv"):
            data["interactions"] = pd.read_csv("dataset/user_interactions.csv")
        elif os.path.exists("dataset/ratings.csv"):
             # Migration fallback: read ratings and add playtime col
            print("Migrating ratings.csv to user_interactions format...")
            df = pd.read_csv("dataset/ratings.csv")
            df["playtime"] = 0
            data["interactions"] = df
        else:
             data["interactions"] = pd.DataFrame(columns=["user_id", "game_id", "rating", "playtime"])

        # Accounts (for login)
        if os.path.exists("dataset/users_accounts.csv"):
            data["accounts"] = pd.read_csv("dataset/users_accounts.csv")
        else:
            data["accounts"] = pd.DataFrame(columns=["username", "password_hash"])

    except Exception as e:
        print(f"CRITICAL DATA LOAD ERROR: {e}")
        # Initialize empties to prevent crash
        data["games"] = pd.DataFrame(columns=["game_id", "title"])
        data["features"] = pd.DataFrame()
        data["text"] = pd.DataFrame()
        data["metadata"] = pd.DataFrame()
        data["interactions"] = pd.DataFrame(columns=["user_id", "game_id", "rating", "playtime"])
        data["accounts"] = pd.DataFrame(columns=["username", "password_hash"])
    
    return data

# Load Data Globally
DB = load_data()

# ---------------------------------------------------------
# 2. PRE-COMPUTE SIMILARITY MATRICES
# ---------------------------------------------------------
def compute_matrices(db):
    matrices = {}
    
    # A. Content Similarity (Numeric Features)
    if not db["features"].empty:
        feat_mat = db["features"].set_index("game_id").sort_index()
        matrices["feature_matrix"] = feat_mat
        matrices["content_sim"] = pd.DataFrame(
            cosine_similarity(feat_mat), 
            index=feat_mat.index, 
            columns=feat_mat.index
        )
    
    # B. Text Similarity (TF-IDF)
    if not db["text"].empty:
        tfidf = TfidfVectorizer(stop_words='english')
        # Ensure alignment with game_id
        text_sorted = db["text"].set_index("game_id").reindex(db["features"].set_index("game_id").index).fillna('')
        tfidf_matrix = tfidf.fit_transform(text_sorted['description'])
        matrices["text_sim"] = pd.DataFrame(
            cosine_similarity(tfidf_matrix), 
            index=text_sorted.index, 
            columns=text_sorted.index
        )
    
    return matrices

MATRICES = compute_matrices(DB)

# ---------------------------------------------------------
# 3. RECOMMENDATION LOGIC
# ---------------------------------------------------------

def get_hybrid_scores(prefs, alpha=0.4, beta=0.4, gamma=0.2):
    # 1. Content Score (User Preferences)
    if "feature_matrix" not in MATRICES: return pd.Series()
    
    feat_mat = MATRICES["feature_matrix"]
    user_profile = [prefs.get(col, 0) for col in feat_mat.columns]
    
    content_scores = cosine_similarity([user_profile], feat_mat)[0]
    content_series = pd.Series(content_scores, index=feat_mat.index)

    # 2. Collaborative Score (Popularity/History)
    # Simple logic: Use average rating as a baseline for "Quality"
    collab_series = pd.Series(0, index=feat_mat.index)
    if not DB["interactions"].empty:
        avg_ratings = DB["interactions"].groupby("game_id")["rating"].mean()
        # Normalize to 0-1
        if avg_ratings.max() > 0:
            avg_ratings = avg_ratings / 5.0
        collab_series = avg_ratings.reindex(feat_mat.index).fillna(0)

    # 3. Text Score (Contextual Similarity)
    # Find the game closest to the user's numeric preferences, then find text-similar games
    text_series = pd.Series(0, index=feat_mat.index)
    if "text_sim" in MATRICES:
        best_match_id = content_series.idxmax()
        if best_match_id in MATRICES["text_sim"].index:
            text_series = MATRICES["text_sim"][best_match_id]

    # Weighted Sum
    final_scores = (alpha * content_series) + (beta * collab_series) + (gamma * text_series)
    
    # Normalize
    if final_scores.max() != final_scores.min():
        final_scores = (final_scores - final_scores.min()) / (final_scores.max() - final_scores.min())
        
    return final_scores.sort_values(ascending=False).head(10)

# ---------------------------------------------------------
# 4. API ROUTES
# ---------------------------------------------------------

@app.route("/recommend", methods=["POST"])
def recommend():
    data = request.json
    user_id = data.get("user_id")
    prefs = data.get("preferences", {})

    scores = get_hybrid_scores(prefs)
    
    recommended_games = []
    feature_list = DB["features"].columns.tolist() if not DB["features"].empty else []

    for game_id in scores.index:
        # Get Core Info
        core = DB["games"][DB["games"]["game_id"] == game_id]
        if core.empty: continue
        
        # Get Metadata
        meta = DB["metadata"][DB["metadata"]["game_id"] == game_id]
        
        # Get Description
        txt = DB["text"][DB["text"]["game_id"] == game_id]

        # Explain
        game_feats = DB["features"][DB["features"]["game_id"] == game_id]
        explanations = []
        for feat in feature_list:
            if not game_feats.empty and prefs.get(feat, 0) >= 4 and game_feats[feat].values[0] >= 1:
                explanations.append(feat.replace("_", " "))
        
        expl_text = f"Matches your interest in {', '.join(explanations)}." if explanations else "Recommended based on popularity and analysis."

        recommended_games.append({
            "game_id": int(game_id),
            "title": core["title"].values[0],
            "score": float(scores[game_id]),
            "image": meta["image_url"].values[0] if not meta.empty else "",
            "description": txt["description"].values[0] if not txt.empty else "",
            "explanation": expl_text,
            "rating": None # Placeholder
        })

    # Attach User Ratings
    if user_id:
        user_ratings = DB["interactions"][DB["interactions"]["user_id"] == user_id]
        for rec in recommended_games:
            r = user_ratings[user_ratings["game_id"] == rec["game_id"]]
            if not r.empty:
                rec["rating"] = int(r["rating"].values[0])

    return jsonify({"user": user_id, "recommendations": recommended_games})

@app.route("/rate", methods=["POST"])
def rate_game():
    data = request.json
    user_id = data.get("user_id")
    game_id = data.get("game_id")
    rating = data.get("rating")
    playtime = data.get("playtime", 0)

    if not all([user_id, game_id, rating]):
        return jsonify({"error": "Missing data"}), 400

    # Load fresh to avoid overwriting concurrency (simplified)
    current_interactions = pd.read_csv("dataset/user_interactions.csv")
    
    mask = (current_interactions["user_id"] == user_id) & (current_interactions["game_id"] == game_id)
    if mask.any():
        current_interactions.loc[mask, "rating"] = rating
        if playtime > 0: current_interactions.loc[mask, "playtime"] = playtime
    else:
        new_row = pd.DataFrame([{"user_id": user_id, "game_id": game_id, "rating": rating, "playtime": playtime}])
        current_interactions = pd.concat([current_interactions, new_row], ignore_index=True)

    current_interactions.to_csv("dataset/user_interactions.csv", index=False)
    
    # Update global DB (Simplified for this project)
    DB["interactions"] = current_interactions
    
    return jsonify({"message": "Rating saved"})

@app.route("/games")
def get_games():
    # Merge games + metadata for the catalog view
    merged = DB["games"].merge(DB["metadata"], on="game_id", how="left")
    return jsonify(merged.to_dict('records'))

@app.route("/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Required fields missing"}), 400

    # Reload accounts to check duplicates
    try:
        users_df = pd.read_csv("dataset/users_accounts.csv")
    except:
        users_df = pd.DataFrame(columns=["username", "password_hash"])

    if username in users_df["username"].values:
        return jsonify({"error": "Username exists"}), 400

    # SECURE HASHING
    pw_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    
    new_user = pd.DataFrame([{"username": username, "password_hash": pw_hash}])
    users_df = pd.concat([users_df, new_user], ignore_index=True)
    users_df.to_csv("dataset/users_accounts.csv", index=False)
    
    DB["accounts"] = users_df # Update memory
    return jsonify({"message": "Registered successfully"})

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    # Reload accounts
    try:
        users_df = pd.read_csv("dataset/users_accounts.csv")
    except:
        return jsonify({"error": "No users found"}), 401

    user = users_df[users_df["username"] == username]
    if user.empty:
        return jsonify({"error": "Invalid credentials"}), 401

    # SECURE CHECK
    stored_hash = user["password_hash"].values[0]
    if not bcrypt.check_password_hash(stored_hash, password):
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify({"message": "Login successful", "username": username})

if __name__ == "__main__":
    app.run(debug=True)