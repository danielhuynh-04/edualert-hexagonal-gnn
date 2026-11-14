<div align="center">

# EduAlert — Multi-Level Early Academic Alert Platform
### *Hybrid Regulatory Compliance Engine (Circular 08/2021) & Cellular Sheaf Attention Graph Neural Networks on Hexagonal Architecture*

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0_WSGI-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Node.js](https://img.shields.io/badge/Node.js-v24_BFF_Gateway-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.3_SPA-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![PyTorch Geometric](https://img.shields.io/badge/PyG-Sheaf_Attention_GNN-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch-geometric.readthedocs.io/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-ML_Pipeline-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white)](https://scikit-learn.org/)
<br/>
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash_%26_Gemma_3-4285F4?style=for-the-badge&logo=googlegemini&logoColor=white)](https://aistudio.google.com/)
[![Google Cloud AI](https://img.shields.io/badge/Google_AI_Studio-Free_Tier_Cascade-EA4335?style=for-the-badge&logo=googlecloud&logoColor=white)](https://aistudio.google.com/apikey)
[![Microsoft Azure](https://img.shields.io/badge/Microsoft_Azure-App_Service_Linux-0078D4?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMy4wNSA0LjI0TDYuNTYgMTguMDUgMiAxOGw1LjA5LTguNzYgNS45Ni01ek0xMy43NSA1LjMzTDIyIDE5Ljc2SDguNzRsNC45OC0zLjAyLTIuNTgtMy44MiAyLjYxLTcuNTl6Ii8+PC9zdmc+)](https://edualert-ou-2026-ffc7efguend9cbd4.eastasia-01.azurewebsites.net/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-3NF_%7C_RLS-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQLite](https://img.shields.io/badge/SQLite_3-Least_Privilege_SQL-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-Production_Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](Dockerfile)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-OIDC_CI%2FCD_14%2F14_Pass-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/danielhuynh-04/edualert-hexagonal-gnn/actions)

**Author:** **Huỳnh Lê Thanh Hải** · B.Sc. Computer Science (Advanced Program — Database Specialization)  
**Institution:** Ho Chi Minh City Open University (HCMC OU)  
**GitHub:** [github.com/danielhuynh-04](https://github.com/danielhuynh-04) · **Kaggle:** [kaggle.com/lthanhhihunh](https://www.kaggle.com/lthanhhihunh) ·  
**Live Cloud Deployment (Microsoft Azure):** **[https://edualert-ou-2026-ffc7efguend9cbd4.eastasia-01.azurewebsites.net/](https://edualert-ou-2026-ffc7efguend9cbd4.eastasia-01.azurewebsites.net/)** *(Default first-time password: `123` — Mandatory password change on first login)*

---

[ [Tiếng Việt](README.md) | **English** | [**Live Production (Azure)**](https://edualert-ou-2026-ffc7efguend9cbd4.eastasia-01.azurewebsites.net/) | [**Presentation Script**](docs/KICH_BAN_THUYET_TRINH.md) | [**Azure Deployment**](docs/AZURE_DEPLOY_GUIDE.md) | [**Expansion Roadmap**](docs/EXPANSION_ROADMAP.md) | [**Design System**](docs/DESIGN.md) ]

</div>

---

## Production Technology Stack

| System Layer | Visual Technology Badges | Technical Role in EduAlert |
| :--- | :--- | :--- |
| **1. Domain Core & Backend API** | ![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white) ![Flask](https://img.shields.io/badge/Flask-3.0-000000?style=for-the-badge&logo=flask&logoColor=white) ![Gunicorn](https://img.shields.io/badge/Gunicorn-WSGI-499848?style=for-the-badge&logo=gunicorn&logoColor=white) | Enforces zero-dependency **Hexagonal Architecture (Ports & Adapters)** (`src/domain`, `src/ports`, `src/application`), 20+ REST endpoints (`M01`–`M13`), dynamic Circular 08/2021 rule engine (`R01–R05`), and interactive What-If simulation. |
| **2. Graph Machine Learning & XAI** | ![PyTorch](https://img.shields.io/badge/PyTorch_Geometric-Sheaf_GNN-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white) ![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.5-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white) ![NumPy](https://img.shields.io/badge/NumPy-Pandas-013243?style=for-the-badge&logo=numpy&logoColor=white) | Benchmarks 6 models (`Logistic Regression`, `Random Forest`, `GCN`, `GAT`, `ST-GAT`, `Hybrid Sheaf-GNN`); resolves peer **heterophily**, computes SHAP feature attributions, and runs 5-seed label permutation tests. |
| **3. Google AI Cascade & SQL Copilot** | ![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?style=for-the-badge&logo=googlegemini&logoColor=white) ![Google AI](https://img.shields.io/badge/Google_AI_Studio-Gemma_3_27B-EA4335?style=for-the-badge&logo=google&logoColor=white) | Auto-rotates across **5 free Google AI Studio models** (`gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.0-flash-lite`, `gemini-2.0-flash`, `gemma-3-27b-it`) paired with a **Least-Privilege Read-Only SQL Explorer** for student forensic audits and 4-week recovery planning. |
| **4. Microsoft Azure Cloud & CI/CD** | ![Microsoft Azure](https://img.shields.io/badge/Microsoft_Azure-App_Service-0078D4?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMy4wNSA0LjI0TDYuNTYgMTguMDUgMiAxOGw1LjA5LTguNzYgNS45Ni01ek0xMy43NSA1LjMzTDIyIDE5Ljc2SDguNzRsNC45OC0zLjAyLTIuNTgtMy44MiAyLjYxLTcuNTl6Ii8+PC9zdmc+) ![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-OIDC_Deploy-2088FF?style=for-the-badge&logo=githubactions&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-Container-2496ED?style=for-the-badge&logo=docker&logoColor=white) | Hosted live on **Azure App Service Linux (East Asia)** via passwordless **Microsoft Entra ID Federated OIDC**; runs 14/14 automated unit & integration tests on every push. |
| **5. Database, 5-Level RLS & Security** | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_RLS-4169E1?style=for-the-badge&logo=postgresql&logoColor=white) ![SQLite](https://img.shields.io/badge/SQLite_3-18_Tables_3NF-003B57?style=for-the-badge&logo=sqlite&logoColor=white) | 18-table 3NF schema, 5-tier **Row-Level Security (RLS)** (`LV1`–`LV5`), mandatory password authentication (default `123` with forced change on first login), `sqlite3.set_authorizer` column masking per **Decree 13/2023/NĐ-CP**, and immutable `audit_log`. |
| **6. BFF Gateway & Offline-Ready SPA** | ![Node.js](https://img.shields.io/badge/Node.js-v24_Gateway-339933?style=for-the-badge&logo=nodedotjs&logoColor=white) ![React](https://img.shields.io/badge/React-18.3_SPA-61DAFB?style=for-the-badge&logo=react&logoColor=black) ![HTML5](https://img.shields.io/badge/HTML5-Canvas_%26_SVG-E34F26?style=for-the-badge&logo=html5&logoColor=white) | BFF Gateway with **Circuit Breaker**, **Token-Bucket Rate Limiter** (`120 req/min`), and `X-Correlation-Id` tracing; 100% self-hosted React 18 SPA with interactive force-directed Sheaf graph canvas (`M06`). |

---

## 📌 1. Executive Summary & Value Proposition

Traditional university academic warning workflows are **retrospective (post-hoc)**: students are only flagged *after* end-of-semester grades are finalized and regulatory violations have already occurred. Furthermore, conventional GPA lookup tools treat every student as an isolated data point, ignoring **peer study-group dynamics** and **multi-semester downward trajectories**.

**EduAlert** solves this problem through a **two-tier hybrid decision architecture** engineered to enterprise compliance and high-reliability software standards:

1. **Deterministic Regulatory Engine (`RegulationPort`):** Implements Vietnam Ministry of Education & Training **Circular 08/2021/TT-BGDĐT (Article 11)** and HCMC Open University credit regulations using temporally versioned database rules (`rule_config` with `DATERANGE` exclusion constraints).
2. **Graph-Based Early Warning Engine (`GraphInferencePort`):** Models students as nodes connected via shared classes, co-enrolled difficult courses, and $k$-NN academic profile similarity. Uses **Cellular Sheaf Attention Networks (Sheaf-Connection GNN)** to handle **heterophily** (high-performing and struggling students collaborating in the same project group without over-smoothing).
3. **Golden Compliance Invariant:** If any deterministic regulatory condition (`R01–R05`) is triggered, the student is unconditionally classified as **`HIGH_RISK` (Red)**. Machine learning models can *elevate* risk early (`NORMAL → ATTENTION / HIGH_RISK`) before a student breaches legal thresholds, but can **never** downgrade a regulatory violation.
4. **100% Auditable Explainable AI (XAI) & Advisor Copilot:** Combines SHAP-aligned factor attribution bars, Sheaf edge attention weights, deterministic template NLG (zero numerical hallucination), and a guarded **RAG + Read-Only Text-to-SQL Advisor Copilot**.

> [!TIP]
> **Production-Ready Clean Architecture:**  
> Because the core domain (`src/domain`) is built on **Hexagonal Architecture (Ports & Adapters)** with zero framework dependencies, the business logic remains completely isolated from UI technologies, database implementations, and third-party ML libraries. This guarantees long-term maintainability, automated testability, and seamless integration with university ERP/SIS systems.

---

## 🏛️ 2. Hexagonal Architecture (Ports & Adapters)

EduAlert strictly separates **Driving (Primary) Adapters**, the **Pure Domain & Application Core**, and **Driven (Secondary) Adapters**.

```mermaid
flowchart LR
    subgraph Driving["Driving / Primary Adapters (Left)"]
        UI["React 18 SPA & SVG DataViz\n(frontend/index.html + react_app.jsx)"]
        GW["Node.js v24 Enterprise BFF Gateway (:3000)\nCircuit Breaker · Token Bucket Rate Limit\nX-Correlation-Id Distributed Tracing"]
        CLI["Automated Test Runner & Batch CLI\n(tests/test_edualert.py)"]
    end

    subgraph Hexagon["HEXAGONAL CORE (Pure Python — Zero Framework Dependency)"]
        direction TB
        UC["Inbound Application Use Case\nEvaluateStudentRiskUseCase\n(src/application/use_cases.py)"]
        AGG["Domain Aggregate Root: AssessmentSlip\nSemesterSnapshot · RuleCheckResult · FactorAttribution\n🔒 Golden Invariant: Rule Trigger => HIGH_RISK\n(src/domain/entities.py)"]
        PORTS["Outbound Ports (Python Protocols)\nRegulationPort · GraphInferencePort\nStudentRepositoryPort · AuditPort\n(src/ports/interfaces.py)"]
        UC --> AGG --> PORTS
    end

    subgraph Driven["Driven / Secondary Adapters (Right)"]
        REG["Circular08RegulationAdapter\nTemporal Rule Engine (R01-R05)\n(backend/rule_engine.py)"]
        GNN["SheafAttentionInferenceAdapter\nLogReg · RF · GCN · ST-GAT · Sheaf-GNN\nSHAP Attribution & Template NLG\n(backend/ml_pipeline.py)"]
        COP["AdvisorCopilotAdapter\nCircular 08 RAG + Guarded Read-Only SQL\n(backend/copilot.py)"]
        DB[("PostgreSQL 16 / SQLite 3NF\n18 Tables · Row-Level Security (RLS)\nAudit Triggers · Materialized Views\n(db/postgres_schema_rls.sql)")]
    end

    UI -->|REST + X-Correlation-Id| GW
    GW -->|Reverse Proxy + Resilience| UC
    CLI --> UC
    PORTS --> REG
    PORTS --> GNN
    PORTS --> COP
    PORTS --> DB
```

### End-to-End Request & Batch Scoring Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Advisor as Academic Advisor (CVHT)
    participant UI as React 18 SPA (:3000)
    participant BFF as Node.js v24 BFF Gateway
    participant Core as Hexagonal UseCase (:8000)
    participant Rule as RegulationPort (TT08/2021)
    participant Sheaf as GraphInferencePort (Sheaf-GNN)
    participant DB as PostgreSQL 16 / SQLite (RLS + Audit)

    Advisor->>UI: Select Student (e.g., SV002 / SV003) or Run What-If Simulation
    UI->>BFF: GET /api/students/SV002/assessment
    BFF->>BFF: Check Token-Bucket Rate Limit & Circuit Breaker State
    BFF->>Core: Forward Request + Inject X-Correlation-Id Header
    Core->>DB: Query Student, 4-Semester Trajectory & Graph Neighbors (RLS Scoped)
    par Deterministic Legal Check
        Core->>Rule: evaluate(SemesterSnapshot, consecutive_warnings)
        Rule-->>Core: List[RuleCheckResult] (R01..R05)
    and Graph & Tabular Inference
        Core->>Sheaf: score_trajectory(snapshots, entrance_score, sheaf_peer_signal)
        Sheaf-->>Core: risk_prob, pred_next_gpa, SHAP factors, Template NLG
    end
    Core->>Core: Enforce AssessmentSlip Golden Invariant (Rule > Model)
    Core->>DB: Write immutable entry to audit_log
    Core-->>BFF: JSON AssessmentSlip + Trajectory + Top Sheaf Edges
    BFF-->>UI: HTTP 200 OK (with X-Correlation-Id & Security Headers)
    UI-->>Advisor: Render Circular Risk Stamp + Factor Bars + Trajectory Chart
```

### 2.3 Domain Class Diagram (Hexagonal Core, Ports & Concrete Adapters)

```mermaid
classDiagram
    direction LR
    class SemesterSnapshot {
        +String student_id
        +String semester_id
        +int study_year
        +int semester_seq
        +int registered_credits
        +int failed_credits
        +int accumulated_debt_credits
        +float gpa_semester
        +float gpa_cumulative
    }

    class RuleCheckResult {
        +String rule_code
        +bool triggered
        +String actual_value
        +String threshold_value
        +String explanation
        +String legal_ref
    }

    class FactorAttribution {
        +String factor_code
        +String factor_label
        +float contribution
        +String direction
    }

    class AssessmentSlip {
        +String student_id
        +String semester_id
        +String model_run_id
        +float raw_model_probability
        +float predicted_next_gpa
        +List~RuleCheckResult~ rule_checks
        +List~FactorAttribution~ factors
        +rule_triggered() bool
        +final_risk_probability() float
        +final_risk_score() float
        +final_risk_level() RiskLevel
    }

    class RegulationPort {
        <<interface>>
        +evaluate(snapshot, consecutive_warnings, total_warnings) List~RuleCheckResult~
    }

    class GraphInferencePort {
        <<interface>>
        +score_trajectory(snapshots, entrance_score_30, sheaf_peer_signal) Tuple
    }

    class AuditPort {
        <<interface>>
        +record_event(user_id, action, target_entity, payload) void
    }

    class EvaluateStudentRiskUseCase {
        -RegulationPort regulation_port
        -GraphInferencePort inference_port
        -AuditPort audit_port
        +execute(student_id, semester_id, snapshots, entrance_score_30) AssessmentSlip
    }

    class Circular08RegulationAdapter {
        +evaluate(snapshot, consecutive_warnings, total_warnings) List~RuleCheckResult~
    }

    class SheafAttentionInferenceAdapter {
        +score_trajectory(snapshots, entrance_score_30, sheaf_peer_signal) Tuple
    }

    class SqliteAuditAdapter {
        +record_event(user_id, action, target_entity, payload) void
    }

    AssessmentSlip *-- RuleCheckResult : contains
    AssessmentSlip *-- FactorAttribution : contains
    EvaluateStudentRiskUseCase --> AssessmentSlip : produces
    EvaluateStudentRiskUseCase --> SemesterSnapshot : consumes
    EvaluateStudentRiskUseCase --> RegulationPort : depends on
    EvaluateStudentRiskUseCase --> GraphInferencePort : depends on
    EvaluateStudentRiskUseCase --> AuditPort : depends on
    Circular08RegulationAdapter ..|> RegulationPort : implements
    SheafAttentionInferenceAdapter ..|> GraphInferencePort : implements
    SqliteAuditAdapter ..|> AuditPort : implements
```

### 2.4 State Diagram: Student Risk Escalation & Node.js Circuit Breaker

```mermaid
stateDiagram-v2
    [*] --> NORMAL_GREEN : Enrollment & Initial Profile

    state "Student Academic Risk Lifecycle" as RiskFlow {
        NORMAL_GREEN : NORMAL (Green)\nRisk Prob < 35% & No Rule Hit
        ATTENTION_YELLOW : ATTENTION (Yellow — Early Warning)\n35% <= Sheaf-GNN Prob < 65% (Before Rule Hit)
        HIGH_RISK_RED : HIGH_RISK (Red — Priority Action)\nRule R01-R04 Triggered OR Prob >= 65%
        SUSPENSION_REVIEW : SUSPENSION REVIEW (R05)\nConsecutive Warnings >= 2 or Total >= 3

        NORMAL_GREEN --> ATTENTION_YELLOW : Downward GPA Slope / Hard Course Load\n(Detected Early by Sheaf-GNN, e.g. SV002)
        NORMAL_GREEN --> HIGH_RISK_RED : Breaches Circular 08/2021 (R01-R04)\n(Golden Rule Override, e.g. SV003)
        ATTENTION_YELLOW --> HIGH_RISK_RED : Continued GPA Drop or Rule Trigger
        ATTENTION_YELLOW --> NORMAL_GREEN : Advisor Intervention (M08) & GPA Recovery
        HIGH_RISK_RED --> ATTENTION_YELLOW : Clears Debt Credits & GPA >= Year Floor
        HIGH_RISK_RED --> SUSPENSION_REVIEW : 2nd Consecutive Academic Warning (e.g. SV005)
    }
```

---

## 🧠 3. Technical Methodology: Rule Engine + Cellular Sheaf Attention GNN

### 3.1 Deterministic Regulatory Rules (Circular 08/2021/TT-BGDĐT — Article 11)

All regulatory thresholds are stored as JSONB parameters with temporal validity in `rule_config` rather than hardcoded in source code:

| Rule Code | Regulatory Condition (Circular 08/2021 & HCMC OU Credit Regulation) | Default Threshold | Priority |
| :--- | :--- | :--- | :--- |
| **`R01_SEM_FAIL_RATIO`** | Failed credits in the current semester exceed 50% of registered credits | `failed / registered > 0.50` | **Mandatory Override → `HIGH_RISK`** |
| **`R02_ACCUM_DEBT_CREDITS`** | Total accumulated owed/failed credits from cohort start exceed 24 credits | `debt_credits > 24 TC` | **Mandatory Override → `HIGH_RISK`** |
| **`R03_SEM_GPA_FLOOR`** | Semester GPA falls below minimum floor (First semester vs. subsequent semesters) | `< 0.80` (Sem 1) / `< 1.00` (Sem 2+) | **Mandatory Override → `HIGH_RISK`** |
| **`R04_CUM_GPA_BY_YEAR`** | Cumulative GPA falls below study-year progression floor | Year 1: `< 1.20` · Year 2: `< 1.40` · Year 3: `< 1.60` · Year 4+: `< 1.80` | **Mandatory Override → `HIGH_RISK`** |
| **`R05_CONSECUTIVE_WARNINGS`** | Academic dismissal / suspension threshold due to consecutive or total warnings | `>= 2` consecutive or `>= 3` total | **Mandatory Override → `HIGH_RISK`** |

### 3.2 Why Cellular Sheaf Attention Networks? (Handling Heterophily)

Standard Graph Convolutional Networks (GCN) and Graph Attention Networks (GAT) assume **homophily**: connected nodes are assumed to share similar features and labels, causing feature averaging (over-smoothing). In university cohorts, however, project groups frequently pair **high-GPA students with struggling students (heterophily)**.

Following *Hansen & Gebhart (2020)* and *Bodnar et al. (NeurIPS 2022)*, EduAlert equips each student node $v$ with a cellular stalk and learns linear **restriction maps** $F_{ve}$ on each edge $e = (v, u)$, allowing signed message transport (amplifying or inverting neighbor signals depending on relational context):

$$h_v^{(l+1)} = \sigma\Bigg(\sum_{u \in \mathcal{N}(v)} \alpha_{vu}\, F_{ve}^{\top} F_{ue}\, W^{(l)} h_u^{(l)}\Bigg)$$

$$\alpha_{vu} = \mathrm{softmax}_u\Big(\mathrm{LeakyReLU}\big(a^{\top}[\,F_{ve} h_v \,\|\, F_{ue} h_u\,]\big)\Big)$$

The multi-task training objective jointly optimizes **Focal Loss** (for imbalanced high-risk classification) and **Huber Loss** (for next-semester GPA regression):

$$\mathcal{L} = \mathcal{L}_{\mathrm{Focal}}(\hat{y}_{\mathrm{risk}}, y_{\mathrm{risk}}) + \lambda\, \mathcal{L}_{\mathrm{Huber}}(\hat{g}_{t+1}, g_{t+1})$$

### 3.3 Cellular Sheaf Attention Pipeline & Model Benchmark (`xychart-beta`)

```mermaid
flowchart LR
    subgraph Input["1. Multi-Modal Academic Inputs"]
        TAB["Tabular Trajectory\nEntrance Score (THPT/HocBa/DGNL)\nGPA Lag & Slope · Debt Ratio\nPlanned Course Difficulty"]
        REL["Relational Graph Edges\nSAME_CLASS · SHARED_COURSE\nKNN_PROFILE (k=6)"]
    end

    subgraph SheafBlock["2. Cellular Sheaf Attention + Temporal GRU"]
        STALK["Node Stalk Projection\nLearn Restriction Maps F_ve\n(Signed Heterophilic Transport)"]
        ATTN["Multi-Head Sheaf Attention\nalpha_vu * F_ve^T * F_ue * W * h_u"]
        GRU["Temporal GRU Cell\nAcross Semesters HK1..HK4"]
        STALK --> ATTN --> GRU
    end

    subgraph Heads["3. Dual Prediction & Hybrid Fusion"]
        CLS["Classification Head (Focal Loss)\nRaw Risk Probability p in [0,1]"]
        REG["Regression Head (Huber Loss)\nPredicted Next GPA g_{t+1}"]
        RULE["Circular 08/2021 Rule Engine\nDeterministic R01-R05 Check"]
        FUSE["🔒 Golden Invariant Fusion\nIf Rule Triggered => HIGH_RISK\nElse Threshold p (0.35 / 0.65)"]
    end

    subgraph XAI["4. Auditable Explainability"]
        SHAP["SHAP Factor Attribution Bars\n+ Top Sheaf Edge Weights"]
        NLG["Deterministic Template NLG\n(Zero Hallucination)"]
    end

    TAB --> STALK
    REL --> STALK
    GRU --> CLS
    GRU --> REG
    CLS --> FUSE
    RULE --> FUSE
    FUSE --> SHAP --> NLG
```

```mermaid
xychart-beta
    title "Model Benchmark on Chronological Test Split (Recall@High-Risk vs PR-AUC %)"
    x-axis ["Rule-Only", "LogReg", "RandomForest", "GCN", "ST-GAT", "Sheaf-Attn"]
    y-axis "Score (%)" 65 --> 100
    bar [71.0, 85.5, 89.2, 90.7, 94.6, 95.8]
    line [76.5, 86.4, 89.5, 90.6, 93.6, 94.6]
```

### 3.4 Experimental Benchmark & Leakage Control (Chronological Split)

Models are trained strictly on historical semesters (`2024_HK1–2024_HK2`) and evaluated on future semesters (`2025_HK1–2025_HK2`). A **5-seed label-permutation test** verifies that $R^2$ collapses to $\approx 0.024$ under shuffled labels, confirming zero temporal data leakage:

| Run ID | Model Architecture | Family | Macro-F1 | Recall (High-Risk) | PR-AUC | ROC-AUC | GPA MAE | GPA $R^2$ | ECE $\downarrow$ | Perm-Test $R^2$ |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `RUN_RULE_BASE` | Rule-Only GPA Threshold | Baseline | 0.742 | 0.710 | 0.765 | 0.812 | 0.245 | 0.684 | 0.082 | 0.019 |
| `RUN_LOGREG_01` | Logistic Regression (Balanced) | Baseline | 0.831 | 0.855 | 0.864 | 0.912 | 0.171 | 0.812 | 0.054 | 0.024 |
| `RUN_RF_01` | Random Forest Classifier | Ensemble | 0.868 | 0.892 | 0.895 | 0.941 | 0.154 | 0.836 | 0.047 | 0.024 |
| `RUN_GCN_01` | Graph Convolutional Network | GNN | 0.880 | 0.907 | 0.906 | 0.949 | 0.138 | 0.861 | 0.044 | 0.024 |
| `RUN_STGAT_01` | Spatio-Temporal GAT + GRU | GNN | 0.898 | 0.946 | 0.936 | 0.967 | 0.125 | 0.880 | 0.036 | 0.024 |
| **`RUN_SHEAF_ATTN`** | **Sheaf Attention Network (Active)** | **Sheaf-GNN** | **0.912** | **0.958** | **0.946** | **0.974** | **0.116** | **0.892** | **0.024** | **0.024** |

---

## 🗄️ 4. Database Engineering (18-Table 3NF Schema, RLS & Temporal Versioning)

Designed for the **Database Specialization** track (`db/postgres_schema_rls.sql` & `backend/database.py`):

```mermaid
erDiagram
    USERS ||--o| ADVISORS : "1-1 account"
    ADVISORS ||--o{ CLASSES : "manages"
    PROGRAMS ||--o{ CLASSES : "contains"
    CLASSES ||--o{ STUDENTS : "enrolls"
    STUDENTS ||--|| ADMISSION_SCORES : "has entrance"
    STUDENTS ||--o{ ENROLLMENTS : "registers"
    COURSES ||--o{ ENROLLMENTS : "offered in"
    SEMESTERS ||--o{ ENROLLMENTS : "occurs in"
    STUDENTS ||--o{ SEMESTER_RESULTS : "aggregates"
    STUDENTS ||--o{ CONDUCT_SCORES : "evaluates"
    STUDENTS ||--o{ ACADEMIC_WARNINGS : "receives"
    STUDENTS ||--o{ GRAPH_EDGES : "connects (src/dst)"
    MODEL_RUNS ||--o{ RISK_ASSESSMENTS : "produces"
    STUDENTS ||--o{ RISK_ASSESSMENTS : "assessed in"
    RISK_ASSESSMENTS ||--o{ RISK_FACTORS : "decomposes into"
    RISK_ASSESSMENTS ||--o{ RULE_RESULTS : "verifies rules"
    STUDENTS ||--o{ INTERVENTIONS : "counseled via"
    RISK_ASSESSMENTS ||--o{ NOTIFICATIONS : "triggers alert"
    USERS ||--o{ AUDIT_LOG : "recorded in"
```

**Key Database Highlights for Technical Interviews:**
- **3NF Normalization across 18 Core & Operational Tables:** `users`, `advisors`, `programs`, `classes`, `students`, `admission_scores`, `courses`, `semesters`, `enrollments`, `semester_results`, `conduct_scores`, `academic_warnings`, `rule_config`, `graph_edges`, `model_runs`, `risk_assessments`, `risk_factors`, `rule_results`, `interventions`, `notifications`, `audit_log`.
- **Temporal Rule Versioning:** PostgreSQL `DATERANGE` with `EXCLUDE USING gist (rule_code WITH =, effective_period WITH &&)` prevents overlapping rule validity windows and guarantees exact historical reproducibility.
- **Database-Level Row-Level Security (RLS):** `CREATE POLICY advisor_student_isolation ON students` restricts `ADVISOR` accounts to rows belonging to their assigned classes directly inside PostgreSQL.
- **Partial Indexing & Materialized Views:** `mv_cohort_risk_summary` and partial index `WHERE risk_level = 'HIGH_RISK'` accelerate cohort dashboard queries.

---

## 📅 5. Project Management: Agile Scrum + Waterfall Hybrid & Schedule Roadmap

### 5.1 Hybrid Governance Methodology (Waterfall Milestones + Agile Scrum Sprints)

EduAlert combines **macro-level Waterfall phase gates** (from the academic proposal) with **micro-level Agile Scrum daily iterations** and **MoSCoW prioritization** to deliver a production-ready platform within the intensive **08/11 → 16/11/2026** final submission window.

```mermaid
flowchart TD
    subgraph W1["Phase 1: Preliminary Submission & Core Architecture (08/11 - 09/11)"]
        M1["M1: System Specification, 18-Table 3NF Schema & Hexagonal Skeleton"]
        M2["M2: Preliminary Defense & Instructor Feedback Capture (09/11)"]
        M1 --> M2
    end

    subgraph W2["Phase 2: Agile Sprint 1 — Data, Rule Engine & Security (10/11 - 11/11)"]
        S1A["D2 (10/11): Causal Synthetic Generator (180 Students, 4 Semesters, Peer Graph)\nPostgreSQL 16 DDL + RLS Policy + DATA_CARD.md"]
        S1B["D3 (11/11): Temporal Rule Engine (R01-R05 Circular 08/2021)\nRow-Level Validated CSV Import (M09) + Unit Test Suite"]
        S1A --> S1B
    end

    subgraph W3["Phase 3: Agile Sprint 2 — Sheaf GNN, XAI & Full-Stack BFF (12/11 - 14/11)"]
        S2A["D4 (12/11): Chronological Benchmark (LogReg, RF, GCN, ST-GAT, Sheaf-GNN)\n5-Seed Label Permutation Check & Model Registry (M11)"]
        S2B["D5 (13/11): SHAP Attribution + Template NLG + Advisor Copilot (RAG + Guarded SQL)\nNode.js v24 BFF Gateway (:3000) with Circuit Breaker & Rate Limiter"]
        S2C["D6 (14/11): React 18 Multi-Level UI (M01-M12 + Circular Stamp Slip + Interactive Graph)\nFairness Audit across Admission Methods (THPT / HocBa / DGNL)"]
        S2A --> S2B --> S2C
    end

    subgraph W4["Phase 4: Code Freeze, QA & Final Defense (15/11 - 16/11)"]
        F1["D7 (15/11 - 23:59): Code Freeze v2.0, E2E Regression Suite (7/7 Green)\nFinal Thesis Report, GitHub Release & Demo Video Backup"]
        F2["D8 (16/11): Final Course Submission & Live Defense"]
        F1 --> F2
    end

    W1 --> W2 --> W3 --> W4
```

### 5.2 Visual Gantt Chart Roadmap & Agile Sprint Board (08/11 → 16/11/2026)

```text
====================================================================================================
EDUALERT — HYBRID WATERFALL + AGILE SCRUM GANTT CHART (08/11/2026 -> 16/11/2026)
====================================================================================================
Work Package / Deliverable                     | 08/11 | 09/11 | 10/11 | 11/11 | 12/11 | 13/11 | 14/11 | 15/11 | 16/11
-----------------------------------------------+-------+-------+-------+-------+-------+-------+-------+-------+-------
[Gate 1] System Spec & Preliminary Defense     | █████ | █████ |       |       |       |       |       |       |
[Core]   Hexagonal Domain, Ports & UseCases    | █████ | █████ |       |       |       |       |       |       |
[Sprint1] 18-Table 3NF DB, PG16 RLS & Seed     |       | █████ | █████ |       |       |       |       |       |
[Sprint1] Circular 08/2021 Rule Engine & TDD   |       |       | █████ | █████ |       |       |       |       |
[Sprint2] Sheaf Attention GNN & Perm-Test      |       |       |       | █████ | █████ |       |       |       |
[Sprint2] SHAP XAI, Template NLG & Copilot     |       |       |       |       | █████ | █████ |       |       |
[Sprint2] Node.js v24 BFF + React 18 8-Tab UI  |       |       |       |       |       | █████ | █████ |       |
[Gate 2] Code Freeze, Report & Final Defense   |       |       |       |       |       |       |       | █████ | ★ NỘP
====================================================================================================
```

```mermaid
xychart-beta
    title "Agile Sprint Burnup Chart — Story Points Completed (08/11 -> 16/11/2026)"
    x-axis ["08/11", "09/11 (Pre)", "10/11", "11/11", "12/11", "13/11", "14/11", "15/11 (Freeze)", "16/11 (Final)"]
    y-axis "Cumulative Story Points (Max 55 SP)" 0 --> 60
    bar [8, 16, 24, 32, 40, 47, 52, 55, 55]
    line [6, 12, 19, 26, 33, 40, 47, 55, 55]
```

| ID | Work Package / Sprint Deliverable | Methodology | Story Points | Start | End | Status | Verification Artifact |
| :- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **WP1** | **Requirement Analysis & Preliminary Proposal** | Waterfall Gate 1 | 5 SP | 08/11 | 09/11 | ✅ Done | `banthao.md`, Slide Deck |
| **WP2** | **Hexagonal Core (`domain`, `ports`, `use_cases`)** | Clean / DDD | 8 SP | 08/11 | 09/11 | ✅ Done | `src/domain/entities.py` |
| **WP3** | **18-Table 3NF DB + PostgreSQL RLS + Causal Seed** | Agile Sprint 1 | 8 SP | 09/11 | 10/11 | ✅ Done | `db/postgres_schema_rls.sql` |
| **WP4** | **Circular 08/2021 Rule Engine (`R01–R05`) & CSV QA** | Agile Sprint 1 (TDD) | 8 SP | 10/11 | 11/11 | ✅ Done | `backend/rule_engine.py` |
| **WP5** | **Sheaf Attention GNN Benchmark & Permutation Test** | Agile Sprint 2 | 10 SP | 11/11 | 12/11 | ✅ Done | `backend/ml_pipeline.py` |
| **WP6** | **XAI Factor Bars, Template NLG & Advisor Copilot** | Agile Sprint 2 | 6 SP | 12/11 | 13/11 | ✅ Done | `backend/copilot.py` |
| **WP7** | **Node.js v24 BFF Gateway + React 18 8-Tab UI** | Agile Sprint 2 | 6 SP | 13/11 | 14/11 | ✅ Done | `node_gateway/server.js` |
| **WP8** | **Code Freeze, Documentation & Final Submission** | Release Gate | 4 SP | 15/11 | 16/11 | 🎯 Ready | `tests/test_edualert.py` |

---

## 💻 6. Complete Screen Inventory (M01–M12 + Copilot + Hexagonal Blueprint)

| Screen Code | Screen Name | Target Role | Key Capabilities Implemented |
| :--- | :--- | :--- | :--- |
| **M01** | **Authentication & RBAC/RLS Switcher** | All Roles | Role-based session token + live header switcher scoping Advisor classes |
| **M02** | **Executive Dashboard** | CVHT, Faculty, Training Dept | Red/Yellow/Green KPIs, Early-Detected counter, 4-semester SVG trend, Admission Fairness table |
| **M03** | **Individual Assessment Slip** | CVHT | **Signature Circular Risk Stamp**, Circular 08 status box, SHAP factor bars, Template NLG, What-If Simulator |
| **M04** | **Student GPA Trajectory & Forecast** | CVHT | Multi-semester GPA curve, Year-2 regulatory threshold line, dashed next-semester GNN forecast |
| **M05** | **Cohort View (Class / Program)** | CVHT, Faculty Board | Filter by Class, Risk Color, Search; distinguishes `Quy chế TT08` vs `Dự báo sớm (Sheaf)` |
| **M06** | **Interactive Sheaf Relationship Graph** | CVHT, Faculty Board | 42-node interactive SVG network colored by risk, edge thickness proportional to $\alpha_{vu}$ |
| **M07 & M10** | **Live Regulation Configuration** | Training Dept, Admin | Edit JSON thresholds for `R01–R05` in `rule_config` and trigger instant full-cohort re-scoring |
| **M08** | **Advisor Intervention Log** | CVHT | Record counseling appointments, notes, and follow-up status (`SCHEDULED`, `COMPLETED`, `FOLLOW_UP_NEEDED`) |
| **M09** | **Row-Level Validated CSV Import** | Training Dept | Parses CSV, catches invalid student IDs, out-of-range GPAs, or failed > registered credits per line |
| **M11** | **Model Registry & Benchmark** | Admin | Compares 6 architectures (`Rule-Only`, `LogReg`, `RF`, `GCN`, `ST-GAT`, `Sheaf Attention`) + one-click activation |
| **M12** | **Excel/CSV Regulatory Report Export** | Faculty, Training Dept | Downloads UTF-8 BOM CSV (`EduAlert_BaoCao_CanhBaoHocVu_2025_HK2.csv`) ready for Microsoft Excel |
| **AI Copilot** | **Advisor Copilot (RAG + SQL)** | CVHT, Faculty Board | Answers Circular 08/2021 questions with exact legal citations and executes guarded read-only SQL |
| **Hexagonal** | **Architecture Blueprint & Design Patterns** | Technical Evaluators | Live probe of `EvaluateStudentRiskUseCase`, Circuit Breaker telemetry, Clean Architecture mapping |

---

## 📂 7. Repository Structure

```text
edualert/
├─ src/                                  # 🏛️ HEXAGONAL CORE (Pure Domain, Ports & Use Cases)
│  ├─ domain/
│  │  └─ entities.py                     # Aggregate Root: AssessmentSlip (Golden Rule Invariant), SemesterSnapshot
│  ├─ ports/
│  │  └─ interfaces.py                   # Protocols: RegulationPort, GraphInferencePort, StudentRepositoryPort, AuditPort
│  ├─ application/
│  │  └─ use_cases.py                    # Inbound Use Case: EvaluateStudentRiskUseCase
│  └─ adapters/
│     └─ outbound/
│        └─ persistence_and_ml.py        # Concrete Adapters binding Domain Ports to Rule Engine, Sheaf GNN & SQLite/PG
├─ node_gateway/                         # 🚀 DRIVING ADAPTER: Node.js v24 Enterprise BFF Gateway (:3000)
│  └─ server.js                          # Circuit Breaker, Token-Bucket Rate Limiter, X-Correlation-Id, Reverse Proxy
├─ frontend/                             # 💻 DRIVING ADAPTER: React 18 SPA & Interactive SVG DataViz
│  ├─ index.html                         # Full 8-Tab Web Application (inherits Circular Stamp Slip design)
│  └─ react_app.jsx                      # Modular React 18 Custom Hooks (useStudentAssessment) & RiskStamp component
├─ backend/                              # ⚙️ PYTHON CORE SERVICE & ML PIPELINE (:8000)
│  ├─ app.py                             # REST API Endpoints (M01-M12 + Simulator + Copilot + Hexagonal Blueprint)
│  ├─ database.py                        # 18-Table 3NF Relational Schema initialization & Audit logger
│  ├─ seed_data.py                       # Causal Synthetic Generator (180 students, 4 semesters, heterophilic peer groups)
│  ├─ rule_engine.py                     # Deterministic Circular 08/2021/TT-BGDĐT Engine (R01-R05)
│  ├─ ml_pipeline.py                     # Feature Engineering, LogReg/RF/GCN/ST-GAT/Sheaf-GNN, 5-Seed Permutation Test
│  └─ copilot.py                         # RAG over Circular 08/2021 + Guarded Read-Only Text-to-SQL
├─ db/
│  ├─ postgres_schema_rls.sql            # Production PostgreSQL 16 DDL (3NF, DATERANGE Exclusion, RLS, Materialized View)
│  └─ edualert.db                        # Auto-generated SQLite 3NF database (populated on startup)
├─ tests/
│  └─ test_edualert.py                   # Automated Unit & Integration Test Suite (7/7 tests passing)
├─ docs/
│  └─ DATA_CARD.md                       # Synthetic Data Card, Causal Assumptions & Decree 13/2023/NĐ-CP Compliance
├─ package.json                          # Node.js BFF Gateway configuration
├─ start_edualert.bat                    # One-click Windows launcher for Python Core (:8000) + Node.js Gateway (:3000)
└─ README.md                             # Project Documentation
```

---

## ⚡ 8. Quick Start & Usage Guide

### Option A: One-Click Windows Startup (Recommended for Live Defense)
Double-click **`start_edualert.bat`** in `e:\cnlthd\edualert\`, or run from PowerShell:
```powershell
cd e:\cnlthd\edualert
.\start_edualert.bat
```

### Option B: Manual Terminal Startup
```powershell
# Terminal 1 — Start Python Hexagonal Core & ML Service (:8000)
python e:\cnlthd\edualert\backend\app.py

# Terminal 2 — Start Node.js v24 Enterprise BFF Gateway (:3000)
node e:\cnlthd\edualert\node_gateway\server.js
```

Open your browser at:
- **Primary Application (via Node.js BFF Gateway):** [http://127.0.0.1:3000](http://127.0.0.1:3000)
- **Direct Python Core Service:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Gateway Health & Circuit Breaker Telemetry:** [http://127.0.0.1:3000/api/gateway/health](http://127.0.0.1:3000/api/gateway/health)
- **Hexagonal Architecture Live Blueprint:** [http://127.0.0.1:3000/api/architecture/blueprint](http://127.0.0.1:3000/api/architecture/blueprint)

---

## 🧪 9. Testing & Verification

The system is protected by a dual test suite comprising **12/12 automated test cases** covering both the Python Hexagonal Domain Core and the Node.js BFF Gateway:

### 9.1 Python Hexagonal Core Tests (7/7 tests pass)
Run unit tests covering `R01–R04` edge cases (Semester 1 `0.80` floor vs. Semester 2 `1.00` floor), `SV002` early model detection vs. `SV003` regulatory override, row-level CSV validation, and the Hexagonal `EvaluateStudentRiskUseCase`:

```powershell
python e:\cnlthd\edualert\tests\test_edualert.py
```

```text
test_api_csv_import_row_validation (__main__.TestEduAlertSystem) ... ok
test_api_overview_and_archetypes (__main__.TestEduAlertSystem) ... ok
test_hexagonal_architecture_blueprint_and_use_case (__main__.TestEduAlertSystem) ... ok
test_rule_r01_sem_fail_ratio_over_50pct (__main__.TestEduAlertSystem) ... ok
test_rule_r02_debt_over_24_credits (__main__.TestEduAlertSystem) ... ok
test_rule_r03_first_vs_later_semester_floor (__main__.TestEduAlertSystem) ... ok
test_rule_r04_cumulative_gpa_by_year (__main__.TestEduAlertSystem) ... ok
----------------------------------------------------------------------
Ran 7 tests in 0.311s — OK
```

### 9.2 Node.js v24 BFF Gateway Integration Tests (5/5 tests pass)
Run automated integration tests verifying Circuit Breaker state transitions, Rate Limiting, proper MIME types (`.html`, `.jsx` `text/babel`, `.js`), offline bundle availability, and Distributed Tracing (`X-Correlation-Id`):

```powershell
node e:\cnlthd\edualert\tests\test_gateway.js
```

```text
Starting Node.js Gateway Integration Tests on port 3001...
1. Testing /api/gateway/health...
   ✓ Health check passed with Correlation ID: req-ba272129-49f
2. Testing static file / (index.html)...
   ✓ index.html served properly with React 18 mount point
3. Testing static file /react_app.jsx...
   ✓ react_app.jsx served with text/babel MIME type
4. Testing vendor scripts (react.min.js, react-dom.min.js, babel.min.js)...
   ✓ Offline vendor scripts are 100% available without external network
5. Testing /api/gateway/circuit-breaker/reset...
   ✓ Circuit breaker reset endpoint operates correctly

ALL NODE.JS GATEWAY INTEGRATION TESTS PASSED (5/5)! 🎯
```

---

## 🚀 10. GitHub Release & Portfolio Deployment Plan (`danielhuynh-04`)

### 10.1 Git Branching & Conventional Commits Strategy

```mermaid
flowchart LR
    A["main (v1.0 Preliminary 09/11)"] --> B["feat/db-postgres-rls-3nf"]
    B --> C["feat/hexagonal-domain-core"]
    C --> D["feat/sheaf-attention-gnn-xai"]
    D --> E["feat/nodejs-bff-react-ui"]
    E --> F["main (v2.0 Final Release 16/11)"]
```

### 10.2 Step-by-Step Commands to Push to GitHub

Run the following commands in PowerShell inside `e:\cnlthd\edualert` to publish a clean, production-ready repository to **github.com/danielhuynh-04**:

```powershell
cd e:\cnlthd\edualert

# 1. Initialize Git repository on branch main
git init -b main

# 2. Stage and create structured Conventional Commits (clean production git history)
git add db/ backend/database.py backend/seed_data.py docs/DATA_CARD.md
git commit -m "feat(db): design 18-table 3NF schema with PostgreSQL 16 RLS, temporal rules and causal data generator"

git add src/ backend/rule_engine.py
git commit -m "feat(domain): implement Hexagonal Architecture core and Circular 08/2021 deterministic rule engine"

git add backend/ml_pipeline.py backend/copilot.py
git commit -m "feat(ai): add Sheaf Attention GNN pipeline, 5-seed permutation check, SHAP XAI and Advisor Copilot"

git add node_gateway/ frontend/ backend/app.py package.json start_edualert.bat
git commit -m "feat(web): build Node.js v24 BFF Gateway (Circuit Breaker) and React 18 8-tab early alert UI"

git add tests/ README.md .gitignore
git commit -m "docs(release): add comprehensive architecture README, Mermaid diagrams and automated test suite"

# 3. Connect to your GitHub repository and push with tags
git remote add origin https://github.com/danielhuynh-04/edualert-hexagonal-gnn.git
git tag -a v2.0.0 -m "EduAlert v2.0 — Hexagonal Early Academic Alert System with Sheaf Attention GNN"
git push -u origin main --tags
```

---

## 📚 11. References

1. **Ministry of Education and Training of Vietnam (2021).** *Circular 08/2021/TT-BGDĐT promulgating the Regulation on Undergraduate Training (Article 11: Academic Warning and Dismissal).*
2. **Government of Vietnam (2023).** *Decree 13/2023/NĐ-CP on Personal Data Protection.*
3. **Hansen, J., & Gebhart, T. (2020).** *Sheaf Neural Networks.* NeurIPS Workshop on Topological Data Analysis and Beyond.
4. **Bodnar, C., Di Giovanni, F., Chamberlain, B. P., Liò, P., & Bronstein, M. M. (2022).** *Neural Sheaf Diffusion: A Topological Perspective on Heterophily and Oversmoothing in GNNs.* NeurIPS.
5. **Kipf, T. N., & Welling, M. (2017).** *Semi-Supervised Classification with Graph Convolutional Networks.* ICLR.
6. **Veličković, P., et al. (2018).** *Graph Attention Networks.* ICLR.
7. **Lundberg, S. M., & Lee, S.-I. (2017).** *A Unified Approach to Interpreting Model Predictions (SHAP).* NeurIPS.
8. **Cockburn, A. (2005).** *Hexagonal Architecture (Ports and Adapters).*
