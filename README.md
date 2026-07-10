# Home Loan Default Prediction & Risk Analysis Dashboard

An end-to-end Data Science and Machine Learning project designed to predict home loan defaults using the Home Credit dataset. This project integrates multiple relational tables, performs structured aggregations, trains various machine learning models, and serves a local interactive Flask dashboard for risk prediction and business analysis.

---

## Project Structure

```
Home-Loan-Default-Prediction/
│
├── Data/                             # Primary and historical CSV files (ignored in Git)
│
├── Home_Loan_Default_Prediction.ipynb # Jupyter Notebook containing EDA, preprocessing, and modeling
│
├── dashboard.py                       # Local Flask App server
├── model.pkl                         # Trained HistGradientBoosting model file
├── scaler.pkl                        # Fitted StandardScaler object
├── metadata.json                     # Feature column mapping metadata
├── processed_data.csv                # Sample aggregated dataset for fast plotting
│
├── assets/                           # Static assets for dashboard
│   ├── style.css                     # Custom styling sheet
│   └── script.js                     # Interactive Plotly plotting and prediction ajax
│
├── templates/                        # HTML templates
│   └── index.html                    # Dashboard dashboard layout
│
├── requirements.txt                  # Python dependencies
└── README.md                         # Project documentation
```

---

## Features & Implementation

### 1. Data Merging & Feature Engineering
Raw historical transaction tables are aggregated to avoid one-to-many relationship rows duplication:
- **`bureau.csv` & `bureau_balance.csv`**: Aggregated active/closed credit accounts, average months history, total loans, and current overdue indicators.
- **`previous_application.csv`**: Calculated historic application counts, approval/refusal rates, and requested vs approved limits.
- **`POS_CASH_balance.csv` & `credit_card_balance.csv`**: Tracked revolving credit lines limit, balance utilization ratios, and active POS cash counts.
- **`installments_payments.csv`**: Engineered repayment delay metrics, percentage of late/early installment payments, and average days paid ahead of due dates.

### 2. Preprocessing
- **Missing Values**: Handled using median imputation for numerical features and mode imputation for categorical features.
- **Anomalies**: Handled the `DAYS_EMPLOYED` anomaly (`365243` positive days) by replacing it with `NaN` before imputation.
- **Encoding**: Implemented One-Hot encoding for categorical variables.
- **Imbalance Mitigation**: Applied `class_weight='balanced'` inside classifier loss functions rather than utilizing SMOTE to prevent memory crashes on the large dataset.
- **Scaling**: Fit `StandardScaler` on the training subset only to avoid data leakage.

### 3. Model Training & Comparison
We train and compare four classifiers:
1. **Logistic Regression** (Baseline model)
2. **Decision Tree** (Non-linear baseline)
3. **Random Forest** (Bagging ensemble)
4. **HistGradient Boosting Classifier** (Optimized boosting ensemble, recommended for production)

#### Performance (ROC-AUC):
Adding historical credit tables yielded an average **+2.5% to +3.3% ROC-AUC improvement** across all classifiers:
- **Logistic Regression**: `0.709`
- **Decision Tree**: `0.718`
- **Random Forest**: `0.751`
- **HistGradient Boosting**: `0.781` (Recommended)

---

## Interactive Local Dashboard

The project includes a clean, native local Flask dashboard configured with:
- **Interactive Global Filters**: Dynamically filter distributions and charts by Gender, Income Type, Education, and Default state.
- **Credit History Summaries**: Visualizes payment delays, bureau reports, and credit card limit utilization.
- **Interactive Risk Predictor**: Input numerical credit metrics (income, requested loan, late history) to run predictions in real-time.
- **Business Insights**: Highlights key segments vulnerable to default risk.

### How to Run the Dashboard

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Start the local Flask server:
   ```bash
   python dashboard.py
   ```
The dashboard will open automatically in your browser at `http://127.0.0.1:5000/`.
