from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import hashlib
import os

app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------
# 1. LOAD DATASETS
# ---------------------------------------------------------
try:
    # Core Identity
    games_df = pd.read_csv("dataset/games.csv")
    
    # Content Features (Numeric)
    features_df = pd.read_csv("dataset/game_features.csv")
    
    # Textual Content (Unstructured)
    text_df = pd.read_csv("dataset/game_text.csv")
    
    # Metadata (Display Info)
    metadata_df = pd.read_csv("dataset/game_metadata.csv")
    
    # User Interactions (Collaborative)
    interactions_df = pd.read_csv("dataset/user_interactions.csv")
    
    # Accounts (for login)
    try:
        users_accounts_df = pd.read_csv("dataset/users_accounts.csv")
    except FileNotFoundError:
        users_accounts_df = pd.DataFrame(columns=["username", "password_hash"])

except FileNotFoundError as e:
    print(f"CRITICAL ERROR: Missing CSV file: {e}")
    # Initialize empties to prevent crash on boot, but app won't function correctly
    games_df = pd.DataFrame(columns=["game_id", "title"])
    features_df = pd.DataFrame()
    text_df = pd.DataFrame()
    metadata_df = pd.DataFrame()
    interactions_df = pd.DataFrame(columns=["user_id", "game_id", "rating", "playtime"])
    users_accounts_df = pd.DataFrame(columns=["username", "password_hash"])

# ---------------------------------------------------------
# 2. PRE-COMPUTE SIMILARITY MATRICES
# ---------------------------------------------------------

# A. Content Similarity (Numeric Features)
# Ensure alignment by game_id
feature_matrix = features_df.set_index("game_id").sort_index()
content_sim = cosine_similarity(feature_matrix)
content_sim_df = pd.DataFrame(content_sim, index=feature_matrix.index, columns=feature_matrix.index)

# B. Text Similarity (TF-IDF on Descriptions)
tfidf = TfidfVectorizer(stop_words='english')
# Fill NaNs with empty string
text_df['description'] = text_df['description'].fillna('')
# Sort to match index alignment
text_sorted = text_df.set_index("game_id").reindex(feature_matrix.index).fillna('')
tfidf_matrix = tfidf.fit_transform(text_sorted['description'])
text_sim = cosine_similarity(tfidf_matrix)
text_sim_df = pd.DataFrame(text_sim, index=feature_matrix.index, columns=feature_matrix.index)

# C. Collaborative Similarity (User Ratings)
# Pivot table: rows=users, cols=games
if not interactions_df.empty:
    user_game_matrix = interactions_df.pivot_table(
        index="user_id", columns="game_id", values="rating"
    ).fillna(0)
    # Transpose to get game-game similarity
    collab_sim = cosine_similarity(user_game_matrix.T)
    collab_sim_df = pd.DataFrame(collab_sim, index=user_game_matrix.columns, columns=user_game_matrix.columns)
else:
    collab_sim_df = pd.DataFrame(index=feature_matrix.index, columns=feature_matrix.index).fillna(0)

# ---------------------------------------------------------
# 3. RECOMENDATION LOGIC
# ---------------------------------------------------------

def get_hybrid_scores(prefs, alpha=0.4, beta=0.4, gamma=0.2):
    """
    alpha: Weight for structured content (features)
    beta:  Weight for collaborative filtering (ratings)
    gamma: Weight for text similarity (description)
    """
    
    # 1. Content Score (User preferences vs Game Features)
    # Create a user profile vector from prefs
    # We need to match columns of feature_matrix
    feature_cols = feature_matrix.columns
    user_profile = [prefs.get(col, 0) for col in feature_cols]
    
    # Calculate similarity between User Profile and All Games
    content_scores = cosine_similarity([user_profile], feature_matrix)[0]
    content_scores_series = pd.Series(content_scores, index=feature_matrix.index)

    # 2. Collaborative Score (Item-Item similarity based on what they might like)
    # Since we don't have a history for the *current* session user in the simplified flow,
    # we usually just rely on Content + Text for Cold Start.
    # However, if we assume 'prefs' are derived from high-rated games, we could use that.
    # For this implementation, we will mock it: Collaborative score is weak for cold-start (0)
    # UNLESS we find games similar to high-rated features. 
    # To keep it simple and robust: Default to 0 if no specific game history is passed.
    collab_scores_series = pd.Series(0, index=feature_matrix.index)
    
    # If we wanted to use collab_sim_df, we would look at games the user ALREADY rated.
    # But here 'prefs' is just a dict of categories. 
    # So we stick to Content/Text mostly, but we can mix in global popularity from interactions?
    # Let's add a "Popularity Boost" into the collaborative slot for cold start.
    if not interactions_df.empty:
        avg_ratings = interactions_df.groupby("game_id")["rating"].mean()
        collab_scores_series = avg_ratings.reindex(feature_matrix.index).fillna(0)
        # Normalize
        if collab_scores_series.max() > 0:
            collab_scores_series = collab_scores_series / 5.0 # Assuming 5 star scale

    # 3. Text Score (Text description similarity)
    # Similar to content, but harder to match "preferences" to text without a query.
    # We will use the CONTENT profile to find the "Ideal Game" then find text similarity to THAT.
    # Find the game_id that matches the numeric content profile best
    best_match_id = content_scores_series.idxmax()
    # Get text similarity of all games to this "best match" game
    text_scores_series = text_sim_df[best_match_id]

    # Combine
    final_scores = (alpha * content_scores_series) + \
                   (beta * collab_scores_series) + \
                   (gamma * text_scores_series)

    # Normalize final
    if final_scores.max() != final_scores.min():
        final_scores = (final_scores - final_scores.min()) / (final_scores.max() - final_scores.min())
    
    return final_scores.sort_values(ascending=False).head(10)

@app.route("/recommend", methods=["POST"])
def recommend():
    data = request.json
    user_id = data.get("user_id")
    prefs = data.get("preferences", {})

    scores = get_hybrid_scores(prefs)
    
    # Features list for explanation
    feature_list = features_df.columns.tolist() # ["singleplayer", "multiplayer", ...]

    recommended_games = []
    for game_id in scores.index:
        # Get data from core table
        core_row = games_df[games_df["game_id"] == game_id]
        if core_row.empty: continue
        title = core_row["title"].values[0]
        score = float(scores[game_id])

        # Get metadata
        meta_row = metadata_df[metadata_df["game_id"] == game_id]
        image = meta_row["image_url"].values[0] if not meta_row.empty else ""
        
        # Get description
        txt_row = text_df[text_df["game_id"] == game_id]
        desc = txt_row["description"].values[0] if not txt_row.empty else ""

        # Explanation logic
        game_feat_row = features_df[features_df["game_id"] == game_id]
        explanations = []
        for feat in feature_list:
            # If user likes it (>=4) and game has it (>=4)
            val = game_feat_row[feat].values[0] if not game_feat_row.empty else 0
            if prefs.get(feat, 0) >= 4 and val >= 1: # Adjusted threshold for binary/numeric
                explanations.append(feat.replace("_", " "))
        
        expl_text = f"Matches your interest in {', '.join(explanations)}." if explanations else "Recommended based on popularity and text analysis."

        recommended_games.append({
            "game_id": int(game_id),
            "title": title,
            "score": score,
            "image": image,
            "description": desc,
            "explanation": expl_text
        })

    # Add existing user rating if available
    for rec in recommended_games:
        mask = (interactions_df["user_id"] == user_id) & (interactions_df["game_id"] == rec["game_id"])
        if mask.any():
            rec["rating"] = int(interactions_df.loc[mask, "rating"].values[0])
        else:
            rec["rating"] = None

    return jsonify({
        "user": user_id,
        "recommendations": recommended_games
    })

@app.route("/rate", methods=["POST"])
def rate_game():
    data = request.json
    user_id = data.get("user_id")
    game_id = data.get("game_id")
    rating = data.get("rating")
    
    # Default playtime to 0 for new ratings via web UI
    playtime = data.get("playtime", 0)

    if not user_id or not game_id or not rating:
        return jsonify({"error": "Missing data"}), 400

    interactions_path = "dataset/user_interactions.csv"
    
    # Reload to be safe
    try:
        current_interactions = pd.read_csv(interactions_path)
    except FileNotFoundError:
        current_interactions = pd.DataFrame(columns=["user_id", "game_id", "rating", "playtime"])

    # Check update or insert
    mask = (current_interactions["user_id"] == user_id) & (current_interactions["game_id"] == game_id)
    if mask.any():
        current_interactions.loc[mask, "rating"] = rating
        # Don't overwrite playtime if it exists, unless provided
        if playtime > 0:
             current_interactions.loc[mask, "playtime"] = playtime
    else:
        new_row = pd.DataFrame([{
            "user_id": user_id,
            "game_id": game_id,
            "rating": rating,
            "playtime": playtime
        }])
        current_interactions = pd.concat([current_interactions, new_row], ignore_index=True)

    current_interactions.to_csv(interactions_path, index=False)
    
    # Refresh global dataframe in memory (simple reload for this scale)
    global interactions_df
    interactions_df = current_interactions

    return jsonify({"message": "Rating saved successfully"})

@app.route("/games")
def get_games():
    # Merge for complete view
    merged = games_df.merge(metadata_df, on="game_id", how="left")
    games_list = merged.to_dict('records')
    return jsonify(games_list)

# Login/Register routes remain mostly the same, just checking user_accounts.csv
@app.route("/register", methods=["POST"])
def register():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    users_path = "dataset/users_accounts.csv"
    try:
        users_df = pd.read_csv(users_path)
    except FileNotFoundError:
        users_df = pd.DataFrame(columns=["username", "password_hash"])

    if username in users_df["username"].values:
        return jsonify({"error": "Username already exists"}), 400

    password_hash = hashlib.sha256(password.encode()).hexdigest()
    new_user = pd.DataFrame([{"username": username, "password_hash": password_hash}])
    users_df = pd.concat([users_df, new_user], ignore_index=True)
    users_df.to_csv(users_path, index=False)

    return jsonify({"message": "Registration successful"})

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    users_path = "dataset/users_accounts.csv"
    try:
        users_df = pd.read_csv(users_path)
    except FileNotFoundError:
        return jsonify({"error": "Invalid credentials"}), 401

    user_row = users_df[users_df["username"] == username]
    if user_row.empty:
        return jsonify({"error": "Invalid credentials"}), 401

    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if user_row["password_hash"].values[0] != password_hash:
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify({"message": "Login successful", "username": username})

if __name__ == "__main__":
    app.run(debug=True)