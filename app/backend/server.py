import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List, Dict, Optional
import time
import json
import uuid

# Load .env from backend directory
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from fastapi import (
    APIRouter,
    Depends,
    FastAPI,
    HTTPException,
    Request,
    Response,
    status
)
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from app.backend.auth import (
    LoginRequest,
    create_access_token,
    verify_entry_token,
    verify_data_token
)
import hashlib

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

MONGO_URI = "mongodb://127.0.0.1:27017"

class DatabaseManager:
    def __init__(self, uri):
        self.mongo_uri = uri
        self.client = None
        self.db = None
    
    async def connect(self):
        try:
            self.client = AsyncIOMotorClient(self.mongo_uri, serverSelectionTimeoutMS=2000)
            await self.client.admin.command('ping')
            self.db = self.client.assetflow
            print("[\033[92mOK\033[0m] Connected to MongoDB AssetFlow!")
        except Exception as e:
            print(f"[\033[91mFAIL\033[0m] MongoDB unavailable: {e}")

db = DatabaseManager(MONGO_URI)

from contextlib import asynccontextmanager
@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    yield

app = FastAPI(title="AssetFlow ERP API", lifespan=lifespan)

origins = ["http://localhost:5173", "http://127.0.0.1:5173", "capacitor://localhost"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

# --- AUTH ---
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

@api_router.post("/auth/signup")
async def signup(login_data: LoginRequest):
    existing = await db.db.users.find_one({"username": login_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Auto-assign 'admin' role if it's the very first user, otherwise 'Employee'
    user_count = await db.db.users.count_documents({})
    role = "admin" if user_count == 0 else "Employee"
    
    new_user = {
        "id": f"u_{uuid.uuid4().hex[:8]}",
        "username": login_data.username,
        "password_hash": hash_password(login_data.password),
        "role": role,
        "scope": "view:dashboard read:data" if role == "Employee" else "view:dashboard read:data write:system",
        "status": "Active"
    }
    await db.db.users.insert_one(new_user)
    return {"status": "success", "role": role}

@api_router.post("/auth/login")
async def login(login_data: LoginRequest, response: Response):
    user_info = await db.db.users.find_one({
        "username": login_data.username, 
        "password_hash": hash_password(login_data.password)
    })
    
    if not user_info:
        raise HTTPException(status_code=401, detail="Incorrect credentials")
    
    token = create_access_token(data={"sub": login_data.username, "role": user_info["role"], "scope": user_info["scope"]})
    return {"access_token": token, "role": user_info["role"]}

@api_router.get("/auth/me")
async def get_current_user(user: dict = Depends(verify_entry_token)):
    return {"role": user["role"], "username": user.get("sub")}

# --- ASSETFLOW MODELS ---
class UserInfo(BaseModel):
    user_id: str
    email: str
    name: str
    department_id: Optional[str] = None
    role: str = "Employee"
    status: str = "Active"

class Department(BaseModel):
    id: str
    name: str
    head_id: Optional[str] = None
    parent_id: Optional[str] = None
    status: str = "Active"

class AssetCategory(BaseModel):
    id: str
    name: str

class Asset(BaseModel):
    id: str # Asset Tag (e.g. AF-0001)
    name: str
    category_id: str
    serial_number: Optional[str] = None
    acquisition_date: Optional[str] = None
    condition: str = "Good"
    location: str = "Warehouse"
    is_bookable: bool = False
    status: str = "Available" # Available, Allocated, Reserved, Under Maintenance, Lost, Retired, Disposed

class Allocation(BaseModel):
    id: str
    asset_id: str
    allocated_to: str
    allocated_by: str
    allocation_date: str
    expected_return_date: Optional[str] = None
    status: str = "Active" 

class Booking(BaseModel):
    id: str
    asset_id: str
    booked_by: str
    start_time: str
    end_time: str
    status: str = "Upcoming"

class MaintenanceRequest(BaseModel):
    id: str
    asset_id: str
    requested_by: str
    issue_description: str
    priority: str = "Medium"
    status: str = "Pending"
    technician_assigned: Optional[str] = None

# --- USERS / EMPLOYEES ---
@api_router.get("/users")
async def get_users():
    cursor = db.db.users.find({}, {"_id": 0, "password_hash": 0})
    return await cursor.to_list(length=None)

@api_router.patch("/users/{username}/role")
async def update_user_role(username: str, payload: dict):
    new_role = payload.get("role")
    if not new_role:
        raise HTTPException(status_code=400, detail="Missing role")
    
    scope = "view:dashboard read:data write:system" if new_role == "admin" else "view:dashboard read:data"
    await db.db.users.update_one(
        {"username": username}, 
        {"$set": {"role": new_role, "scope": scope}}
    )
    return {"status": "success"}

# --- CRUD ENDPOINTS ---
@api_router.get("/assets")
async def get_assets():
    cursor = db.db.assets.find({}, {"_id": 0})
    return await cursor.to_list(length=None)

@api_router.post("/assets")
async def create_asset(asset: Asset):
    await db.db.assets.insert_one(asset.model_dump())
    return {"status": "success", "id": asset.id}

# --- DEPARTMENTS & CATEGORIES ---
@api_router.get("/departments")
async def get_departments():
    cursor = db.db.departments.find({}, {"_id": 0})
    return await cursor.to_list(length=None)

@api_router.post("/departments")
async def create_department(dept: Department):
    await db.db.departments.insert_one(dept.model_dump())
    return {"status": "success", "id": dept.id}

@api_router.get("/categories")
async def get_categories():
    cursor = db.db.categories.find({}, {"_id": 0})
    return await cursor.to_list(length=None)

@api_router.post("/categories")
async def create_category(cat: AssetCategory):
    await db.db.categories.insert_one(cat.model_dump())
    return {"status": "success", "id": cat.id}

# --- ALLOCATIONS ---
@api_router.get("/allocations")
async def get_allocations():
    cursor = db.db.allocations.find({}, {"_id": 0})
    return await cursor.to_list(length=None)

@api_router.patch("/allocations/{alloc_id}")
async def update_allocation_status(alloc_id: str, payload: dict):
    # Payload can include "status" (e.g. "Approved", "Returned", "Rejected")
    # If returned, also revert asset to Available
    new_status = payload.get("status")
    alloc = await db.db.allocations.find_one({"id": alloc_id})
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
        
    update_data = {"status": new_status}
    await db.db.allocations.update_one({"id": alloc_id}, {"$set": update_data})
    
    if new_status == "Returned":
        await db.db.assets.update_one({"id": alloc["asset_id"]}, {"$set": {"status": "Available"}})
    elif new_status == "Approved":
        # First, mark any other active allocation for this asset as returned/transferred
        await db.db.allocations.update_many(
            {"asset_id": alloc["asset_id"], "status": "Active", "id": {"$ne": alloc_id}}, 
            {"$set": {"status": "Transferred"}}
        )
        await db.db.allocations.update_one({"id": alloc_id}, {"$set": {"status": "Active"}})
        await db.db.assets.update_one({"id": alloc["asset_id"]}, {"$set": {"status": "Allocated"}})
        
    return {"status": "success"}

@api_router.post("/allocations/transfer")
async def request_transfer(allocation: Allocation):
    # Check if asset is already allocated and Active
    existing = await db.db.allocations.find_one({"asset_id": allocation.asset_id, "status": "Active"})
    
    if existing:
        # If it's already active, this is a transfer request that needs approval
        allocation.status = "Pending Transfer"
        await db.db.allocations.insert_one(allocation.model_dump())
        return {"status": "success", "id": allocation.id, "message": "Transfer requested"}
    else:
        # Direct allocation
        allocation.status = "Active"
        await db.db.allocations.insert_one(allocation.model_dump())
        await db.db.assets.update_one({"id": allocation.asset_id}, {"$set": {"status": "Allocated"}})
        return {"status": "success", "id": allocation.id}

# --- BOOKINGS ---
@api_router.get("/bookings")
async def get_bookings():
    cursor = db.db.bookings.find({}, {"_id": 0})
    return await cursor.to_list(length=None)

@api_router.post("/bookings")
async def create_booking(booking: Booking):
    # Overlap validation
    existing = await db.db.bookings.find_one({
        "asset_id": booking.asset_id,
        "status": {"$ne": "Cancelled"},
        "$or": [
            {"$and": [{"start_time": {"$lt": booking.end_time}}, {"end_time": {"$gt": booking.start_time}}]}
        ]
    })
    if existing:
        raise HTTPException(status_code=409, detail="Booking overlap detected")
    await db.db.bookings.insert_one(booking.model_dump())
    return {"status": "success", "id": booking.id}

# --- MAINTENANCE ---
@api_router.get("/maintenance")
async def get_maintenance():
    cursor = db.db.maintenance.find({}, {"_id": 0})
    return await cursor.to_list(length=None)

@api_router.post("/maintenance")
async def create_maintenance(req: MaintenanceRequest):
    await db.db.maintenance.insert_one(req.model_dump())
    return {"status": "success", "id": req.id}

@api_router.patch("/maintenance/{req_id}/status")
async def update_maintenance_status(req_id: str, payload: dict):
    new_status = payload.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Missing status")
        
    req = await db.db.maintenance.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    await db.db.maintenance.update_one({"id": req_id}, {"$set": {"status": new_status}})
    
    if new_status == "Approved":
        await db.db.assets.update_one({"id": req["asset_id"]}, {"$set": {"status": "Under Maintenance"}})
    elif new_status == "Resolved":
        await db.db.assets.update_one({"id": req["asset_id"]}, {"$set": {"status": "Available"}})
        
    return {"status": "success"}

# --- ANALYTICS & AUDIT ---
@api_router.get("/analytics/dashboard")
async def get_dashboard_metrics():
    total_assets = await db.db.assets.count_documents({})
    allocated = await db.db.assets.count_documents({"status": "Allocated"})
    maintenance = await db.db.assets.count_documents({"status": "Under Maintenance"})
    
    # Calculate overdue returns
    today_str = datetime.now().strftime("%Y-%m-%d")
    overdue_count = await db.db.allocations.count_documents({
        "status": "Active",
        "expected_return_date": {"$lt": today_str, "$ne": None}
    })
    
    metrics = {
        "total_assets": total_assets,
        "allocated_assets": allocated,
        "maintenance_active": maintenance,
        "overdue_returns": overdue_count
    }
    
    allocs = await db.db.allocations.find({}, {"_id": 0}).sort("allocation_date", -1).limit(3).to_list(length=3)
    maints = await db.db.maintenance.find({}, {"_id": 0}).sort("reported_at", -1).limit(2).to_list(length=2)
    
    activity = []
    for a in allocs:
        activity.append({
            "id": a["id"], 
            "type": "allocation",
            "message": f"Asset {a['asset_id']} allocated to {a['allocated_to']}",
            "timestamp": a.get("allocation_date", datetime.now().isoformat())
        })
    for m in maints:
         activity.append({
            "id": m["id"], 
            "type": "maintenance",
            "message": f"Maintenance requested for {m['asset_id']} ({m['issue_description']})",
            "timestamp": m.get("reported_at", datetime.now().isoformat())
        })
    
    activity.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return {
        "metrics": metrics,
        "recent_activity": activity[:5]
    }

@api_router.get("/activity_logs")
async def get_activity_logs():
    allocs = await db.db.allocations.find({}, {"_id": 0}).to_list(length=None)
    maints = await db.db.maintenance.find({}, {"_id": 0}).to_list(length=None)
    audits = await db.db.audits.find({}, {"_id": 0}).to_list(length=None)
    
    logs = []
    
    for a in allocs:
        logs.append({
            "id": f"log_{a['id']}",
            "type": "allocation",
            "message": f"Asset {a['asset_id']} {a['status'].lower()} ({a['allocated_to']})",
            "timestamp": a.get("allocation_date", datetime.now().isoformat())
        })
        
    for m in maints:
        logs.append({
            "id": f"log_{m['id']}",
            "type": "maintenance",
            "message": f"Maintenance ticket {m['status'].lower()} for Asset {m['asset_id']}",
            "timestamp": m.get("reported_at", datetime.now().isoformat())
        })
        
    for au in audits:
        logs.append({
            "id": f"log_{au['id']}",
            "type": "audit",
            "message": f"Audit Cycle '{au['name']}' is {au['status']}",
            "timestamp": au.get("start_date", datetime.now().isoformat())
        })
        
    logs = sorted(logs, key=lambda x: x["timestamp"], reverse=True)
    return logs

@api_router.get("/analytics/reports")
async def get_reports():
    # Group assets by category for a breakdown
    pipeline = [
        {"$group": {"_id": "$category_id", "count": {"$sum": 1}}}
    ]
    cursor = db.db.assets.aggregate(pipeline)
    category_breakdown = await cursor.to_list(length=None)
    
    # Calculate Maintenance Frequency (number of tickets per asset category or just total)
    maintenance_cursor = db.db.maintenance.aggregate([
        {"$group": {"_id": "$asset_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ])
    maintenance_freq = await maintenance_cursor.to_list(length=None)

    # Mock department usage based on allocation data
    # (Since departments are loose strings in this system right now)
    dept_usage = [
        {"dept": "IT Dept", "percentage": 75},
        {"dept": "Operations", "percentage": 45},
        {"dept": "HR", "percentage": 20},
        {"dept": "Warehouse", "percentage": 85},
    ]
    
    return {
        "category_breakdown": category_breakdown,
        "department_usage": dept_usage,
        "maintenance_frequency": maintenance_freq
    }

@api_router.get("/audits")
async def get_audits():
    cursor = db.db.audits.find({}, {"_id": 0})
    return await cursor.to_list(length=None)

@api_router.post("/audits")
async def create_audit(payload: dict):
    # payload: { name, department_id, start_date, end_date, auditors: [] }
    audit = {
        "id": f"audit_{uuid.uuid4().hex[:8]}",
        "name": payload.get("name"),
        "department_id": payload.get("department_id"),
        "start_date": payload.get("start_date"),
        "end_date": payload.get("end_date"),
        "auditors": payload.get("auditors", []),
        "status": "Active",
        "verifications": [] # [{asset_id, status (Verified/Missing/Damaged)}]
    }
    
    # Pre-populate with assets that belong to this department (or all if no dept)
    query = {} if not payload.get("department_id") else {"location": payload.get("department_id")} # simplified grouping
    assets = await db.db.assets.find(query).to_list(length=None)
    for a in assets:
        audit["verifications"].append({"asset_id": a["id"], "asset_name": a["name"], "status": "Pending"})
        
    await db.db.audits.insert_one(audit)
    return {"status": "success", "id": audit["id"]}

@api_router.patch("/audits/{audit_id}")
async def update_audit(audit_id: str, payload: dict):
    # Action can be 'verify_asset' or 'close_cycle'
    action = payload.get("action")
    audit = await db.db.audits.find_one({"id": audit_id})
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
        
    if action == "verify_asset":
        asset_id = payload.get("asset_id")
        status = payload.get("status") # Verified, Missing, Damaged
        
        # update the specific verification item inside the array
        await db.db.audits.update_one(
            {"id": audit_id, "verifications.asset_id": asset_id},
            {"$set": {"verifications.$.status": status}}
        )
    elif action == "close_cycle":
        # Any missing/damaged assets get their master status updated
        for v in audit["verifications"]:
            if v["status"] == "Missing":
                await db.db.assets.update_one({"id": v["asset_id"]}, {"$set": {"status": "Lost"}})
            elif v["status"] == "Damaged":
                await db.db.assets.update_one({"id": v["asset_id"]}, {"$set": {"status": "Under Maintenance"}})
                
        await db.db.audits.update_one({"id": audit_id}, {"$set": {"status": "Closed"}})
        
    return {"status": "success"}

app.include_router(api_router)
