import pandas as pd
import numpy as np
from app import DB, MATRICES, get_hybrid_scores

def evaluate_system(k=10):
    """
    Evaluates the hybrid recommender using historical user interactions.
    Metrics calculated @ K (Top K recommendations).
    """
    print("Starting System Evaluation...")
    
    # 1. Get necessary data
    interactions = DB["interactions"]
    features = DB["features"]
    
    if interactions.empty:
        print("Error: No user interactions found. Cannot evaluate.")
        return

    # Filter for "Relevant" items (Games the user actually liked, e.g., Rating >= 4)
    # We treat these as the 'Ground Truth' positives
    relevant_interactions = interactions[interactions["rating"] >= 4]
    
    # Group by user
    user_groups = relevant_interactions.groupby("user_id")
    
    precisions = []
    recalls = []
    accuracies = [] # Interpreted as "Hit Rate" (Did we find at least one?)
    
    print(f"Evaluating across {len(user_groups)} users with history...")

    for user_id, group in user_groups:
        liked_game_ids = group["game_id"].tolist()
        
        # We need at least one game to build a profile and one to test
        if len(liked_game_ids) < 2:
            continue
            
        # --- SIMULATION STEP ---
        # 1. Split Data: Use 50% of liked games to build "Preferences" (Training)
        #    and try to predict the other 50% (Testing)
        cutoff = int(len(liked_game_ids) * 0.5)
        train_ids = liked_game_ids[:cutoff]
        test_ids = liked_game_ids[cutoff:]
        
        if not train_ids or not test_ids:
            continue

        # 2. Build Synthetic User Profile (Preferences) based on 'Train' games
        #    (Average the features of games they liked)
        train_features = features[features["game_id"].isin(train_ids)]
        if train_features.empty:
            continue
            
        # Calculate mean vector and convert to dict for our API function
        avg_profile = train_features.drop(columns=["game_id"]).mean().to_dict()
        
        # 3. Get Recommendations using the Hybrid System
        #    Pass the synthetic profile as 'prefs'
        try:
            # Get Top K recommendations
            recs_series = get_hybrid_scores(avg_profile)
            recommended_ids = recs_series.index.tolist()[:k]
        except Exception as e:
            # Skip if any math error occurs
            continue
            
        # --- METRICS CALCULATION ---
        
        # Intersection: How many 'Test' games did we recommend?
        hits = set(recommended_ids).intersection(set(test_ids))
        num_hits = len(hits)
        
        # Precision@K: (Relevant Items Found) / (Total Items Recommended)
        # "Out of the 10 games we showed, how many did they actually like?"
        p_score = num_hits / k
        precisions.append(p_score)
        
        # Recall@K: (Relevant Items Found) / (Total Relevant Items in Test Set)
        # "Out of all the games they like, how many did we manage to find?"
        r_score = num_hits / len(test_ids)
        recalls.append(r_score)
        
        # Accuracy (Hit Rate): Did we find at least ONE relevant game?
        accuracies.append(1 if num_hits > 0 else 0)

    # --- AGGREGATE RESULTS ---
    avg_precision = np.mean(precisions) if precisions else 0
    avg_recall = np.mean(recalls) if recalls else 0
    avg_accuracy = np.mean(accuracies) if accuracies else 0
    
    # Calculate F1 Score
    # Formula: 2 * (Precision * Recall) / (Precision + Recall)
    if (avg_precision + avg_recall) > 0:
        f1_score = 2 * (avg_precision * avg_recall) / (avg_precision + avg_recall)
    else:
        f1_score = 0

    print("\n" + "="*30)
    print(" FINAL EVALUATION RESULTS ")
    print("="*30)
    print(f"Accuracy (Hit Rate): {avg_accuracy:.2f}  ({avg_accuracy*100:.1f}%)")
    print(f"Precision@{k}:        {avg_precision:.2f}  ({avg_precision*100:.1f}%)")
    print(f"Recall@{k}:           {avg_recall:.2f}  ({avg_recall*100:.1f}%)")
    print(f"F1 Score:            {f1_score:.2f}")
    print("="*30)

if __name__ == "__main__":
    evaluate_system(k=10)