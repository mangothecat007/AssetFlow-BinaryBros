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
    status,
    Header,
    Body
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
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.connect()
    
    # Create enterprise indexes
    try:
        await db.db.allocations.create_index(
            [("asset_id", 1)],
            unique=True,
            partialFilterExpression={"status": "Active"},
            name="unique_active_allocation_idx"
        )
        await db.db.assets.create_index("id", unique=True)
        await db.db.assets.create_index("status")
        await db.db.lifecycle_events.create_index([("asset_id", 1), ("occurred_at", -1)])
        print("MongoDB Indexes Ensured")
    except Exception as e:
        print(f"Warning on index creation: {e}")
        
    # Start background task
    task = asyncio.create_task(cache_dashboard_metrics())
        
    yield
    task.cancel()

app = FastAPI(title="AssetFlow ERP API", lifespan=lifespan)

origins = ["http://localhost:5173", "http://127.0.0.1:5173", "capacitor://localhost"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def record_lifecycle_event(asset_id: str, from_status: str, to_status: str, source_type: str, source_id: str, acted_by: str, notes: str = ""):
    await db.db.lifecycle_events.insert_one({
        "id": f"life_{int(datetime.now().timestamp() * 1000)}",
        "asset_id": asset_id,
        "from_status": from_status,
        "to_status": to_status,
        "source_type": source_type,
        "source_id": source_id,
        "acted_by": acted_by,
        "notes": notes,
        "occurred_at": datetime.now().isoformat()
    })

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
async def update_allocation(alloc_id: str, payload: dict = Body(...)):
    alloc = await db.db.allocations.find_one({"id": alloc_id})
    if not alloc: raise HTTPException(404)
    
    await db.db.allocations.update_one({"id": alloc_id}, {"$set": payload})
    
    asset = await db.db.assets.find_one({"id": alloc["asset_id"]})
    old_status = asset.get("status", "Allocated") if asset else "Allocated"
    
    if payload.get("status") == "Returned":
        await db.db.assets.update_one({"id": alloc["asset_id"]}, {"$set": {"status": "Available"}})
        await record_lifecycle_event(alloc["asset_id"], old_status, "Available", "return", alloc_id, "system", payload.get("return_notes", ""))
        
    return {"message": "Updated"}

@api_router.post("/allocations/transfer")
async def request_transfer(allocation: Allocation):
    try:
        await db.db.allocations.insert_one(allocation.model_dump())
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Asset is already allocated")

    # Change asset status
    asset = await db.db.assets.find_one({"id": allocation.asset_id})
    old_status = asset.get("status", "Available") if asset else "Available"
    
    await db.db.assets.update_one(
        {"id": allocation.asset_id},
        {"$set": {"status": "Allocated"}}
    )
    
    await record_lifecycle_event(
        allocation.asset_id, old_status, "Allocated", "allocation", allocation.id, allocation.allocated_to, "Initial allocation"
    )
    
    return {"message": "Allocated"}

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
        
    old_status = (await db.db.assets.find_one({"id": req["asset_id"]})).get("status", "Unknown")
    await db.db.maintenance.update_one({"id": req_id}, {"$set": {"status": new_status}})
    
    if new_status == "Approved":
        await db.db.assets.update_one({"id": req["asset_id"]}, {"$set": {"status": "Under Maintenance"}})
        await record_lifecycle_event(req["asset_id"], old_status, "Under Maintenance", "maintenance", req_id, "system", "Maintenance started")
    elif new_status == "Resolved":
        await db.db.assets.update_one({"id": req["asset_id"]}, {"$set": {"status": "Available"}})
        await record_lifecycle_event(req["asset_id"], old_status, "Available", "maintenance", req_id, "system", "Maintenance resolved")
        
    return {"status": "success"}

# --- ANALYTICS & AUDIT ---
async def cache_dashboard_metrics():
    while True:
        try:
            total_assets = await db.db.assets.count_documents({})
            allocated = await db.db.assets.count_documents({"status": "Allocated"})
            maintenance = await db.db.assets.count_documents({"status": "Under Maintenance"})
            
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
            
            await db.db.dashboard_metrics.update_one(
                {"id": "global_metrics"},
                {"$set": {"metrics": metrics, "computed_at": datetime.now().isoformat()}},
                upsert=True
            )
            print("Dashboard metrics cached.")
        except Exception as e:
            print(f"Error caching metrics: {e}")
        
        await asyncio.sleep(300) # Run every 5 mins

@api_router.get("/analytics/dashboard")
async def get_dashboard_metrics():
    cached = await db.db.dashboard_metrics.find_one({"id": "global_metrics"})
    if cached:
        metrics = cached["metrics"]
    else:
        # Fallback if not cached yet
        metrics = {
            "total_assets": await db.db.assets.count_documents({}),
            "allocated_assets": await db.db.assets.count_documents({"status": "Allocated"}),
            "maintenance_active": await db.db.assets.count_documents({"status": "Under Maintenance"}),
            "overdue_returns": 0
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

    # Department usage based on asset location and status
    dept_cursor = db.db.assets.aggregate([
        {
            "$group": {
                "_id": "$location",
                "total": {"$sum": 1},
                "allocated": {
                    "$sum": {"$cond": [{"$eq": ["$status", "Allocated"]}, 1, 0]}
                }
            }
        },
        {
            "$project": {
                "dept": {"$ifNull": ["$_id", "Unassigned"]},
                "percentage": {
                    "$cond": [
                        {"$eq": ["$total", 0]}, 
                        0, 
                        {"$round": [{"$multiply": [{"$divide": ["$allocated", "$total"]}, 100]}, 0]}
                    ]
                }
            }
        },
        {"$sort": {"percentage": -1}}
    ])
    dept_usage = await dept_cursor.to_list(length=None)
    
    # Real Retirement List (Assets missing or in maintenance)
    ret_cursor = db.db.assets.find(
        {"status": {"$in": ["Lost", "Under Maintenance"]}},
        {"_id": 0, "id": 1, "name": 1, "status": 1}
    ).limit(5)
    ret_assets = await ret_cursor.to_list(length=None)
    retirement_list = []
    for a in ret_assets:
        retirement_list.append({
            "id": a["id"],
            "name": a.get("name", "Unknown"),
            "condition": a.get("status", "Unknown")
        })
    
    # Booking Heatmap using real DB bookings
    heatmap_cursor = db.db.bookings.aggregate([
        {
            "$addFields": {
                "parsed_date": {"$dateFromString": {"dateString": "$start_time"}}
            }
        },
        {
            "$group": {
                "_id": {
                    "day": {"$dayOfWeek": "$parsed_date"},
                    "hour": {"$hour": "$parsed_date"}
                },
                "count": {"$sum": 1}
            }
        }
    ])
    raw_heatmap = await heatmap_cursor.to_list(length=None)
    
    days_map = {1: "Sun", 2: "Mon", 3: "Tue", 4: "Wed", 5: "Thu", 6: "Fri", 7: "Sat"}
    heatmap_dict = {d: [0]*24 for d in days_map.values()}
    for entry in raw_heatmap:
        day_str = days_map.get(entry["_id"]["day"])
        hour = entry["_id"]["hour"]
        if day_str and 0 <= hour < 24:
            heatmap_dict[day_str][hour] = entry["count"]
            
    booking_heatmap = [{"day": d, "hours": heatmap_dict[d]} for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]]
    
    return {
        "category_breakdown": category_breakdown,
        "department_usage": dept_usage,
        "maintenance_frequency": maintenance_freq,
        "retirement_list": retirement_list,
        "booking_heatmap": booking_heatmap
    }

@api_router.get("/audits")
async def get_audits():
    cursor = db.db.audits.find({}, {"_id": 0})
    return await cursor.to_list(length=None)

@api_router.post("/audits")
async def create_audit(payload: dict):
    audit = {
        "id": f"audit_{uuid.uuid4().hex[:8]}",
        "name": payload.get("name"),
        "department_id": payload.get("department_id"),
        "start_date": payload.get("start_date"),
        "end_date": payload.get("end_date"),
        "auditors": payload.get("auditors", []),
        "status": "Active",
        "verifications": [] 
    }
    
    query = {} if not payload.get("department_id") else {"location": payload.get("department_id")}
    assets = await db.db.assets.find(query).to_list(length=None)
    for a in assets:
        audit["verifications"].append({"asset_id": a["id"], "asset_name": a["name"], "status": "Pending"})
        
    await db.db.audits.insert_one(audit)
    return {"status": "success", "id": audit["id"]}

@api_router.patch("/audits/{cycle_id}")
async def update_audit(cycle_id: str, payload: dict = Body(...)):
    if payload.get("status") == "Closed":
        cycle = await db.db.audits.find_one({"id": cycle_id})
        items = cycle.get("items", [])
        for item in items:
            asset = await db.db.assets.find_one({"id": item["asset_id"]})
            old_status = asset.get("status", "Available") if asset else "Unknown"
            
            if item["status"] == "Missing":
                await db.db.assets.update_one({"id": item["asset_id"]}, {"$set": {"status": "Lost"}})
                await record_lifecycle_event(item["asset_id"], old_status, "Lost", "audit", cycle_id, "system", "Marked missing in audit")
            elif item["status"] == "Damaged":
                await db.db.assets.update_one({"id": item["asset_id"]}, {"$set": {"status": "Under Maintenance"}})
                await record_lifecycle_event(item["asset_id"], old_status, "Under Maintenance", "audit", cycle_id, "system", "Marked damaged in audit")
                await db.db.maintenance.insert_one({
                    "id": f"mt_{int(datetime.now().timestamp()*1000)}",
                    "asset_id": item["asset_id"],
                    "reported_by": "Audit System",
                    "issue": "Damaged during audit",
                    "priority": "High",
                    "status": "Pending Approval",
                    "reported_at": datetime.now().isoformat()
                })
                
    await db.db.audits.update_one({"id": cycle_id}, {"$set": {"status": payload["status"]}})
    return {"message": "Audit updated"}

app.include_router(api_router)
