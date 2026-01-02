from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
import os
import hashlib

app = Flask(__name__)
CORS(app)

# Load datasets
try:
    games = pd.read_csv("dataset/games.csv")
    users = pd.read_csv("dataset/users.csv")
    ratings = pd.read_csv("dataset/ratings.csv")
except FileNotFoundError as e:
    print("CSV file not found: ", e)
    games = pd.DataFrame()
    users = pd.DataFrame()
    ratings = pd.DataFrame()

# Prepare content-based features
game_features = games.drop(columns=["game_id", "title", "image_url"])
user_features = users.drop(columns=["user_id"])
content_sim = cosine_similarity(user_features, game_features)

# Prepare collaborative features
user_game_matrix = ratings.pivot_table(
    index="user_id", columns="game_id", values="rating"
).fillna(0)

game_sim = cosine_similarity(user_game_matrix.T)
game_sim_df = pd.DataFrame(game_sim, index=user_game_matrix.columns, columns=user_game_matrix.columns)

def hybrid_scores(prefs, alpha=0.6):
    # Content-based score
    content_scores = pd.Series(
        cosine_similarity([list(prefs.values())], game_features)[0],
        index=games["game_id"]
    )

    # Collaborative score (mock 0 for new users without ratings)
    collab_scores = pd.Series(0, index=games["game_id"])
    if not user_game_matrix.empty:
        for game_id in games["game_id"]:
            if game_id in game_sim_df.columns:
                collab_scores[game_id] = game_sim_df[game_id].mean()

    final_scores = alpha * content_scores + (1 - alpha) * collab_scores
    final_scores = (final_scores - final_scores.min()) / (final_scores.max() - final_scores.min())
    return final_scores.sort_values(ascending=False).head(5)

@app.route("/recommend", methods=["POST"])
def recommend():
    data = request.json
    user_id = data.get("user_id")
    prefs = data.get("preferences", {})

    scores = hybrid_scores(prefs)

    features = ["singleplayer","multiplayer","story","competitive","rpg","shooter","open_world","casual","survival"]

    recommended_games = []
    for game_id in scores.index:
        game_row = games[games["game_id"] == game_id]
        title = game_row["title"].values[0]
        image = game_row["image_url"].values[0]
        score = float(scores[game_id])

        # Generate explanation
        explanations = []
        for feat in features:
            if prefs.get(feat, 0) >= 4 and game_row[feat].values[0] >= 4:
                explanations.append(feat.replace("_", " "))
        explanation = f"You like {', '.join(explanations)} and this game has them." if explanations else "Based on overall similarity to your preferences."

        recommended_games.append({
            "game_id": int(game_id),
            "title": title,
            "score": score,
            "image": image,
            "explanation": explanation
        })

    # Add existing ratings
    try:
        ratings_df = pd.read_csv("dataset/ratings.csv")
    except FileNotFoundError:
        ratings_df = pd.DataFrame(columns=["user_id", "game_id", "rating"])

    for rec in recommended_games:
        mask = (ratings_df["user_id"] == user_id) & (ratings_df["game_id"] == rec["game_id"])
        if mask.any():
            rec["rating"] = int(ratings_df.loc[mask, "rating"].values[0])
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

    if not user_id or not game_id or not rating:
        return jsonify({"error": "Missing data"}), 400

    ratings_path = "dataset/ratings.csv"

    try:
        ratings_df = pd.read_csv(ratings_path)
    except FileNotFoundError:
        ratings_df = pd.DataFrame(columns=["user_id", "game_id", "rating"])

    # Check if rating already exists
    mask = (ratings_df["user_id"] == user_id) & (ratings_df["game_id"] == game_id)
    if mask.any():
        # Update existing rating
        ratings_df.loc[mask, "rating"] = rating
    else:
        # Add new rating
        new_row = pd.DataFrame([{
            "user_id": user_id,
            "game_id": game_id,
            "rating": rating
        }])
        ratings_df = pd.concat([ratings_df, new_row], ignore_index=True)

    # Save back to CSV
    ratings_df.to_csv(ratings_path, index=False)

    return jsonify({"message": "Rating saved successfully"})

@app.route("/games")
def get_games():
    games_list = games.to_dict('records')
    return jsonify(games_list)

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
