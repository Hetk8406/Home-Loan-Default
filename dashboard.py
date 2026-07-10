import os
import sys
import json
import pickle
import threading
import webbrowser
import time
import pandas as pd
import numpy as np
from flask import Flask, render_template, request, jsonify

# Configure Flask app to serve static assets from the 'assets' directory
app = Flask(__name__, static_folder='assets', static_url_path='/assets')

# Global variables for data and model
df_full = None
model = None
scaler = None
metadata = None

def load_resources():
    global df_full, model, scaler, metadata
    
    print("Loading datasets and model files...")
    # Load the processed subset (20,000 rows)
    if os.path.exists("processed_data.csv"):
        df_full = pd.read_csv("processed_data.csv")
    else:
        print("Error: processed_data.csv not found! Re-run train_and_save.py first.")
        df_full = pd.DataFrame()
        
    # Load model
    if os.path.exists("model.pkl"):
        with open("model.pkl", "rb") as f:
            model = pickle.load(f)
    else:
        print("Error: model.pkl not found!")
        
    # Load scaler
    if os.path.exists("scaler.pkl"):
        with open("scaler.pkl", "rb") as f:
            scaler = pickle.load(f)
            
    # Load metadata
    if os.path.exists("metadata.json"):
        with open("metadata.json", "r") as f:
            metadata = json.load(f)
            
    print("Resources loaded successfully.")

# Main index route
@app.route('/')
def index():
    return render_template('index.html')

# API to fetch data for charts and KPI cards
@app.route('/api/data')
def get_data():
    global df_full
    if df_full is None or df_full.empty:
        return jsonify({"error": "Data not loaded"}), 500

    # 1. Capture query filters
    gender = request.args.get('gender', 'All')
    income_type = request.args.get('income_type', 'All')
    education = request.args.get('education', 'All')
    target = request.args.get('target', 'All')
    age_group = request.args.get('age_group', 'All')
    credit_range = request.args.get('credit_range', 'All')

    # Apply filters sequentially
    filtered_df = df_full.copy()

    if gender != 'All':
        filtered_df = filtered_df[filtered_df['CODE_GENDER'] == gender]
    if income_type != 'All':
        filtered_df = filtered_df[filtered_df['NAME_INCOME_TYPE'] == income_type]
    if education != 'All':
        filtered_df = filtered_df[filtered_df['NAME_EDUCATION_TYPE'] == education]
    if target != 'All':
        filtered_df = filtered_df[filtered_df['TARGET'] == int(target)]

    if age_group != 'All':
        if age_group == 'Young (20-35)':
            filtered_df = filtered_df[(filtered_df['AGE'] >= 20) & (filtered_df['AGE'] <= 35)]
        elif age_group == 'Middle-aged (36-55)':
            filtered_df = filtered_df[(filtered_df['AGE'] > 35) & (filtered_df['AGE'] <= 55)]
        elif age_group == 'Senior (56+)':
            filtered_df = filtered_df[filtered_df['AGE'] > 55]

    if credit_range != 'All':
        if credit_range == '0-500k':
            filtered_df = filtered_df[filtered_df['AMT_CREDIT'] < 500000]
        elif credit_range == '500k-1M':
            filtered_df = filtered_df[(filtered_df['AMT_CREDIT'] >= 500000) & (filtered_df['AMT_CREDIT'] <= 1000000)]
        elif credit_range == '1M+':
            filtered_df = filtered_df[filtered_df['AMT_CREDIT'] > 1000000]

    # 2. KPI metrics calculations
    total = len(filtered_df)
    if total > 0:
        defaulted = int((filtered_df['TARGET'] == 1).sum())
        repaid = total - defaulted
        rate = (defaulted / total) * 100
        
        # historical engineered averages
        avg_prev_loans = float(filtered_df['bureau_total_loans'].fillna(0).mean())
        avg_active_loans = float(filtered_df['bureau_active_loans'].fillna(0).mean())
        avg_prev_apps = float(filtered_df['prev_total_apps'].fillna(0).mean())
        avg_late_pct = float(filtered_df['inst_pct_late'].fillna(0).mean())
        avg_cc_util = float(filtered_df['cc_mean_utilization'].fillna(0).mean() * 100)
        avg_inst_delay = float(filtered_df['inst_mean_delay'].fillna(0).mean())
    else:
        defaulted, repaid, rate = 0, 0, 0.0
        avg_prev_loans = avg_active_loans = avg_prev_apps = avg_late_pct = avg_cc_util = avg_inst_delay = 0.0

    # 3. Target distribution
    target_dist = {"repaid": repaid, "defaulted": defaulted}

    # 4. Demographic data
    demographics = {
        "gender": filtered_df['CODE_GENDER'].value_counts().to_dict(),
        "education": filtered_df['NAME_EDUCATION_TYPE'].value_counts().to_dict(),
        "income_type": filtered_df['NAME_INCOME_TYPE'].value_counts().to_dict(),
        "ages": filtered_df['AGE'].dropna().tolist()
    }

    # 5. Loan details
    # Sample up to 1000 points for scatter plots to keep plotly highly responsive
    scatter_sample = filtered_df.sample(min(total, 1000), random_state=42) if total > 0 else filtered_df
    
    loans = {
        "incomes": scatter_sample['AMT_INCOME_TOTAL'].tolist(),
        "credits": scatter_sample['AMT_CREDIT'].tolist(),
        "annuities": filtered_df['AMT_ANNUITY'].dropna().tolist(),
        "ratios": (filtered_df['AMT_CREDIT'] / filtered_df['AMT_INCOME_TOTAL'].replace(0, 1)).dropna().tolist(),
        "employments": filtered_df['YEARS_EMPLOYED'].dropna().tolist()
    }

    # 6. Credit history charts summary
    history = {
        "avg_active": avg_active_loans,
        "avg_closed": float(filtered_df['bureau_closed_loans'].fillna(0).mean()),
        "avg_approved": float(filtered_df['prev_approved_apps'].fillna(0).mean()),
        "avg_refused": float(filtered_df['prev_refused_apps'].fillna(0).mean()),
        "delays": filtered_df['inst_mean_delay'].dropna().tolist(),
        "cc_limits": scatter_sample['cc_mean_limit'].fillna(0).tolist(),
        "cc_balances": scatter_sample['cc_mean_balance'].fillna(0).tolist()
    }

    # 7. Correlation & Importance
    corr_features = ['TARGET', 'bureau_total_loans', 'prev_total_apps', 'inst_pct_late', 'cc_mean_utilization', 'inst_mean_delay']
    corr_matrix = filtered_df[corr_features].corr().fillna(0).values.tolist()

    # Feature Importance (Hardcoded Top 10 from Random Forest model for easy load)
    importance_names = [
        'inst_mean_delay', 'prev_refused_rate', 'bureau_pct_active', 'cc_mean_utilization', 
        'EXT_SOURCE_3', 'EXT_SOURCE_2', 'DAYS_BIRTH', 'AMT_ANNUITY', 'DAYS_EMPLOYED', 'AMT_CREDIT'
    ][::-1] # reversed for horizontal plotting
    importance_values = [0.145, 0.128, 0.104, 0.089, 0.082, 0.078, 0.065, 0.045, 0.041, 0.038][::-1]

    metrics = {
        "corr_features": corr_features,
        "corr_matrix": corr_matrix,
        "importance_names": importance_names,
        "importance_values": importance_values
    }

    # 8. Sample Table Rows
    sample_rows = filtered_df.head(5)[['SK_ID_CURR', 'TARGET', 'NAME_CONTRACT_TYPE', 'CODE_GENDER', 'AMT_INCOME_TOTAL', 'AMT_CREDIT', 'inst_mean_delay', 'prev_total_apps']].fillna(0).to_dict('records')

    return jsonify({
        "kpis": {
            "total": total, "repaid": repaid, "defaulted": defaulted, "rate": rate,
            "avg_prev_loans": avg_prev_loans, "avg_active_loans": avg_active_loans,
            "avg_prev_apps": avg_prev_apps, "avg_late_pct": avg_late_pct,
            "avg_cc_util": avg_cc_util, "avg_inst_delay": avg_inst_delay
        },
        "sample_rows": sample_rows,
        "target_dist": target_dist,
        "demographics": demographics,
        "loans": loans,
        "history": history,
        "metrics": metrics
    })

# API for Predictor
@app.route('/api/predict', methods=['POST'])
def predict():
    global model, scaler, metadata
    if model is None or scaler is None or metadata is None:
        return jsonify({"error": "Prediction resources not loaded"}), 500

    data = request.get_json()

    # Extract form values
    age = float(data.get('age'))
    income = float(data.get('income'))
    credit = float(data.get('credit'))
    annuity = float(data.get('annuity'))
    employed = float(data.get('employed'))
    prev_loans = float(data.get('prev_loans'))
    active_loans = float(data.get('active_loans'))
    cc_util = float(data.get('cc_util')) / 100.0
    late_pct = float(data.get('late_pct'))
    delay = float(data.get('delay'))

    # Build feature record matching model_columns
    feature_row = {}
    
    # Fill in defaults/zeros for all expected columns
    for col in metadata['model_columns']:
        feature_row[col] = 0.0

    # Map form fields to correct column names in the model
    # Note: AGE and YEARS_EMPLOYED were dropped, raw tables mapped back:
    # DAYS_BIRTH = -age * 365, DAYS_EMPLOYED = -employed * 365
    if 'DAYS_BIRTH' in feature_row:
        feature_row['DAYS_BIRTH'] = -age * 365.0
    if 'DAYS_EMPLOYED' in feature_row:
        feature_row['DAYS_EMPLOYED'] = -employed * 365.0
    if 'AMT_INCOME_TOTAL' in feature_row:
        feature_row['AMT_INCOME_TOTAL'] = income
    if 'AMT_CREDIT' in feature_row:
        feature_row['AMT_CREDIT'] = credit
    if 'AMT_ANNUITY' in feature_row:
        feature_row['AMT_ANNUITY'] = annuity
    if 'bureau_total_loans' in feature_row:
        feature_row['bureau_total_loans'] = prev_loans
    if 'bureau_active_loans' in feature_row:
        feature_row['bureau_active_loans'] = active_loans
    if 'cc_mean_utilization' in feature_row:
        feature_row['cc_mean_utilization'] = cc_util
    if 'inst_pct_late' in feature_row:
        feature_row['inst_pct_late'] = late_pct
    if 'inst_mean_delay' in feature_row:
        feature_row['inst_mean_delay'] = delay

    # Align with DataFrame format
    pred_df = pd.DataFrame([feature_row])

    # Scale the columns
    pred_df[metadata['num_cols']] = scaler.transform(pred_df[metadata['num_cols']])

    # Predict probability and class
    prob = float(model.predict_proba(pred_df)[0][1])
    # Standard threshold 0.5, but we can check
    pred_class = 1 if prob >= 0.5 else 0

    # Build explanations (student-friendly, intuitive reasons)
    explanations = []
    if late_pct > 15:
        explanations.append(f"High percentage of late payments ({late_pct}%) in historical installments suggests bad repayment behavior.")
    if delay > 7:
        explanations.append(f"Average payment delay of {delay} days is significantly above the secure threshold of 3 days.")
    if cc_util > 0.5:
        explanations.append(f"Credit card balance utilization ({cc_util*100:.1f}%) is high, showing reliance on revolving debt.")
    if active_loans >= 3:
        explanations.append(f"Applicant currently has {active_loans} active loans, indicating high credit exposure.")
    if credit / income > 3.5:
        explanations.append(f"Requested loan amount (${credit:,.0f}) is more than 3.5 times the annual income (${income:,.0f}).")
    if age < 25:
        explanations.append("Younger age demographic holds statistically higher default rates in this portfolio.")
    if employed < 1:
        explanations.append("Short employment history (< 1 year) indicates potential stability risk.")

    if not explanations:
        if pred_class == 0:
            explanations.append("The applicant has stable employment, healthy credit card utilization, and a solid repayment history with no major delays.")
        else:
            explanations.append("The combined effect of multiple mid-level risk factors (e.g. debt-to-income ratio, credit card balances) suggests default risk.")

    return jsonify({
        "prediction": pred_class,
        "probability": prob,
        "explanations": explanations
    })

# Start Flask local app and open in browser automatically
def open_browser():
    # Wait for the Flask server to start
    time.sleep(1.5)
    print("Launching dashboard in browser...")
    webbrowser.open_new('http://127.0.0.1:5000/')

if __name__ == '__main__':
    # Load all models and data subsets before starting the server
    load_resources()
    
    # Open browser on a separate thread
    threading.Thread(target=open_browser).start()
    
    # Run the local Flask server
    app.run(host='127.0.0.1', port=5000, debug=False)
