# 🚀 AssetFlow – Enterprise Asset & Resource Management System

## 🎥 Project Demo

      > **📹 Demo Video**
     
 https://docs.google.com/videos/d/1g9tr3-Avs6OUeNkHgiik581IE_zU7hJ_2jTX2OzQ348/edit?usp=sharing
---

## 📖 Overview

AssetFlow is a modern Enterprise Asset & Resource Management System designed to help organizations efficiently manage physical assets, employees, departments, shared resources, maintenance requests, and audit workflows from a single centralized platform.

The system eliminates manual asset tracking through spreadsheets and paper records by providing real-time visibility, role-based access control, and automated workflows for asset allocation, resource booking, maintenance, and audits.

---

# ✨ Features

- 🔐 Secure Authentication
- 👥 Employee Directory Management
- 🏢 Department Management
- 📦 Asset Registration & Tracking
- 🔄 Asset Allocation & Transfer
- 📅 Shared Resource Booking
- 🛠 Maintenance Approval Workflow
- 📊 Dashboard with KPIs
- 📋 Asset Audit Management
- 📈 Reports & Analytics
- 🔔 Notifications
- 📝 Activity Logs
- 🔒 Role-Based Access Control

---

# 📋 Prerequisites

Before running the project, install:

- Python 3.11+
- Git
- MongoDB Community Server 8.x
- pip

---

# ⚙️ Installation & Configuration

## 1️⃣ Clone Repository

```bash
git clone <repository-url>

cd AssetFlow
```

---

## 2️⃣ Create Virtual Environment

```bash
python -m venv venv
```

---

## 3️⃣ Activate Virtual Environment

### Windows

```bash
venv\Scripts\activate
```

### Linux / macOS

```bash
source venv/bin/activate
```

---

## 4️⃣ Upgrade pip

```bash
python -m pip install --upgrade pip
```

---

## 5️⃣ Install Dependencies

```bash
pip install -r app\backend\requirements.txt
```

---

## 6️⃣ Install MongoDB Driver

```bash
pip install motor
```

---

## 7️⃣ Start MongoDB Server

```bash
"C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --config "C:\Program Files\MongoDB\Server\8.3\bin\mongod.cfg"
```

Keep this terminal running.

---

## 8️⃣ Populate Dummy Data

Populate the database with sample departments, employees, assets, bookings, maintenance requests, and audit data.

```bash
python seed_data.py
```

---

## 9️⃣ Run Backend Server

```bash
python -m uvicorn app.backend.server:app --host 0.0.0.0 --port 8082 --reload
```

Backend URL

```
http://localhost:8082
```

---

# 📂 Project Structure

```
AssetFlow/
│
├── Database/                     # Database-related files
│
├── app/
│   ├── backend/                  # FastAPI Backend
│   │   ├── server.py
│   │   ├── requirements.txt
│   │   └── ...
│   │
│   ├── frontend/                 # Frontend Application
│   │
│   └── design_guidelines.json    # UI Design Configuration
│
├── seed_data.py                  # Generate Dummy Data
├── start.py                      # Startup Script
├── wipe.py                       # Reset Database
├── AssetFlow-Architecture.md     # Architecture Documentation
├── AssetFlow problem statement.pdf
├── problem_statement.txt
├── vercel.json
├── .gitignore
└── README.md
```

---

# ❗ Problem Statement

Organizations often rely on spreadsheets, paper records, or disconnected software systems to manage physical assets and shared resources. These traditional methods make it difficult to monitor asset availability, allocate equipment, schedule shared resources, manage maintenance activities, and perform regular audits.

As organizations grow, manual processes become increasingly inefficient, resulting in duplicate asset allocations, maintenance delays, scheduling conflicts, poor visibility, and operational inefficiencies.

AssetFlow addresses these challenges by providing a centralized ERP solution capable of managing the complete lifecycle of organizational assets through secure, role-based workflows and real-time monitoring. :contentReference[oaicite:0]{index=0}

---

# 💡 Solution

AssetFlow digitizes the complete asset management process through an intuitive web application.

The platform enables organizations to:

- Manage departments and employees
- Register and categorize assets
- Track complete asset lifecycle
- Allocate assets without duplication
- Book shared resources with overlap prevention
- Approve and monitor maintenance requests
- Conduct structured audit cycles
- Track overdue asset returns
- Receive real-time notifications
- Generate reports and analytics for operational insights

The result is a scalable, centralized, and efficient Enterprise Resource Planning (ERP) solution that improves productivity while reducing manual effort and human error. :contentReference[oaicite:1]{index=1}

---

# 📊 ERP Modules

- Authentication
- Dashboard
- Organization Setup
- Employee Directory
- Department Management
- Asset Categories
- Asset Registration
- Asset Allocation
- Resource Booking
- Maintenance Management
- Asset Audit
- Reports & Analytics
- Notifications
- Activity Logs

---

# 👤 User Roles

## 👑 Admin

- Manage Departments
- Manage Asset Categories
- Manage Employees
- Assign Roles
- View Organization Analytics

---

## 📦 Asset Manager

- Register Assets
- Allocate Assets
- Approve Transfers
- Approve Maintenance Requests
- Approve Asset Returns

---

## 🏢 Department Head

- View Department Assets
- Approve Transfers
- Book Shared Resources

---

## 👨‍💼 Employee

- View Assigned Assets
- Book Shared Resources
- Raise Maintenance Requests
- Request Transfers
- Request Returns

---

# 🔄 Asset Lifecycle

```
Available
      │
      ▼
Allocated
      │
      ▼
Reserved
      │
      ▼
Under Maintenance
      │
      ▼
Available
      │
      ▼
Retired
      │
      ▼
Disposed
```

---

# 🛠 Technology Stack

## Backend

- Python
- FastAPI
- Motor
- MongoDB
- Uvicorn

## Frontend

- React.js
- HTML
- CSS
- JavaScript

## Database

- MongoDB

## Version Control

- Git
- GitHub

---

# 🚀 Future Scope

- QR Code Asset Tracking
- Barcode Scanner Integration
- Mobile Application
- Email Notifications
- Cloud Deployment
- AI-based Predictive Maintenance
- IoT Integration
- Advanced Analytics Dashboard

---

# 👨‍💻 Team

| Name | Role |
|------|------|
| **Kunal Makhija** | Developer |
| **Vyas Het** | Developer |

---

# 📜 License

This project was developed for a Hackathon and is intended for educational and demonstration purposes.

---

# 🙏 Acknowledgements

This project was developed based on the Enterprise Asset & Resource Management System problem statement provided for the hackathon. The problem focuses on building a scalable ERP platform that simplifies asset tracking, resource booking, maintenance workflows, audits, and role-based organizational management. :contentReference[oaicite:2]{index=2}

---

⭐ **If you found this project useful, consider giving it a star on GitHub!**
