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
    Body,
    UploadFile,
    File,
    Form
)
from fastapi.staticfiles import StaticFiles
import shutil
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
        
        # Seed default admin user if none exists
        user_count = await db.db.users.count_documents({})
        if user_count == 0:
            default_admin = {
                "id": "u_admin",
                "email": "admin@assetflow.com",
                "password_hash": hashlib.sha256("Admin123!".encode()).hexdigest(),
                "role": "admin",
                "scope": "view:dashboard read:data write:system",
                "status": "Active"
            }
            await db.db.users.insert_one(default_admin)
            print("Default admin user seeded: admin@assetflow.com / Admin123!")
    except Exception as e:
        print(f"Warning on index/seed creation: {e}")
        
    # Start background task
    task = asyncio.create_task(cache_dashboard_metrics())
        
    yield
    task.cancel()

app = FastAPI(title="AssetFlow ERP API", lifespan=lifespan)

UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

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
    existing = await db.db.users.find_one({"email": login_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    # Signup creates an Employee account only (no role selection)
    role = "Employee"
    
    new_user = {
        "id": f"u_{uuid.uuid4().hex[:8]}",
        "email": login_data.email,
        "password_hash": hash_password(login_data.password),
        "name": login_data.email.split("@")[0].capitalize(),
        "department_id": None,
        "role": role,
        "scope": "view:dashboard read:data" if role == "Employee" else "view:dashboard read:data write:system",
        "status": "Active"
    }
    await db.db.users.insert_one(new_user)
    return {"status": "success", "role": role}

@api_router.post("/auth/login")
async def login(login_data: LoginRequest, response: Response):
    user = await db.db.users.find_one({
        "email": login_data.email,
        "password_hash": hash_password(login_data.password)
    })
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": user["email"], "role": user["role"], "scope": user.get("scope", "")})
    return {"access_token": token, "role": user["role"]}

@api_router.get("/auth/me")
async def get_current_user(user: dict = Depends(verify_entry_token)):
    # Fetch from db to get full user data (including department_id)
    db_user = await db.db.users.find_one({"email": user.get("email")})
    return {
        "role": user["role"], 
        "username": user.get("email"),
        "department_id": db_user.get("department_id") if db_user else None
    }

def role_required(*allowed_roles: str):
    """Dependency factory — raises 403 if caller's role is not in allowed_roles."""
    async def _check(user: dict = Depends(verify_entry_token)):
        caller_role = user.get("role", "")
        if caller_role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required roles: {list(allowed_roles)}. Your role: {caller_role}"
            )
        return user
    return _check

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
    custom_fields: Optional[List[str]] = []

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

@api_router.patch("/users/{email}/role")
async def update_user_role(email: str, payload: dict):
    new_role = payload.get("role")
    if not new_role:
        raise HTTPException(status_code=400, detail="Missing role")
    
    # Assign write:system scope to any manager/admin role
    elevated_roles = ["admin", "Asset Manager", "Department Head"]
    scope = "view:dashboard read:data write:system" if new_role in elevated_roles else "view:dashboard read:data"
    
    await db.db.users.update_one(
        {"email": email}, 
        {"$set": {"role": new_role, "scope": scope}}
    )
    return {"status": "success"}

@api_router.patch("/users/{email}")
async def update_user(email: str, payload: dict):
    update_data = {}
    if "name" in payload:
        update_data["name"] = payload["name"]
    if "department_id" in payload:
        update_data["department_id"] = payload["department_id"]
    if "status" in payload:
        update_data["status"] = payload["status"]
    if "role" in payload:
        update_data["role"] = payload["role"]
        elevated_roles = ["admin", "Asset Manager", "Department Head"]
        update_data["scope"] = "view:dashboard read:data write:system" if payload["role"] in elevated_roles else "view:dashboard read:data"
        
    await db.db.users.update_one({"email": email}, {"$set": update_data})
    return {"status": "success"}

# --- CRUD ENDPOINTS ---
@api_router.get("/assets")
async def get_assets():
    cursor = db.db.assets.find({}, {"_id": 0})
    return await cursor.to_list(length=None)

@api_router.post("/assets")
async def create_asset(
    name: str = Form(...),
    category_id: str = Form(...),
    department_id: str = Form(...),
    location: str = Form(""),
    status: str = Form("Available"),
    purchase_date: str = Form(""),
    purchase_cost: float = Form(0),
    serial_number: Optional[str] = Form(None),
    condition: str = Form("Good"),
    is_bookable: bool = Form(False),
    photo: Optional[UploadFile] = File(None),
    # Only Asset Manager and Admin can register assets
    _caller: dict = Depends(role_required("admin", "Asset Manager"))
):
    asset_count = await db.db.assets.count_documents({})
    asset_id = f"AF-{asset_count + 1:04d}"
    
    photo_url = None
    if photo:
        ext = photo.filename.split(".")[-1]
        filename = f"{asset_id}.{ext}"
        filepath = UPLOAD_DIR / filename
        with filepath.open("wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)
        photo_url = f"/uploads/{filename}"
        
    await db.db.assets.insert_one({
        "id": asset_id,
        "name": name,
        "category_id": category_id,
        "department_id": department_id,
        "location": location,
        "status": status,
        "purchase_date": purchase_date,
        "purchase_cost": purchase_cost,
        "serial_number": serial_number,
        "condition": condition,
        "is_bookable": is_bookable,
        "photo_url": photo_url,
        "created_at": datetime.now().isoformat()
    })
    return {"status": "success", "id": asset_id}

# --- DEPARTMENTS & CATEGORIES ---
@api_router.get("/departments")
async def get_departments():
    cursor = db.db.departments.find({}, {"_id": 0})
    return await cursor.to_list(length=None)

@api_router.post("/departments")
async def create_department(dept: Department):
    await db.db.departments.insert_one(dept.model_dump())
    return {"status": "success", "id": dept.id}

@api_router.patch("/departments/{dept_id}")
async def update_department(dept_id: str, payload: dict):
    update_data = {}
    if "name" in payload:
        update_data["name"] = payload["name"]
    if "head_id" in payload:
        update_data["head_id"] = payload["head_id"]
    if "parent_id" in payload:
        update_data["parent_id"] = payload["parent_id"]
    if "status" in payload:
        update_data["status"] = payload["status"]
    
    await db.db.departments.update_one({"id": dept_id}, {"$set": update_data})
    return {"status": "success"}

@api_router.get("/categories")
async def get_categories():
    cursor = db.db.categories.find({}, {"_id": 0})
    return await cursor.to_list(length=None)

@api_router.post("/categories")
async def create_category(cat: AssetCategory):
    await db.db.categories.insert_one(cat.model_dump())
    return {"status": "success", "id": cat.id}

@api_router.patch("/categories/{cat_id}")
async def update_category(cat_id: str, payload: dict):
    update_data = {}
    if "name" in payload:
        update_data["name"] = payload["name"]
    if "custom_fields" in payload:
        update_data["custom_fields"] = payload["custom_fields"]
        
    await db.db.categories.update_one({"id": cat_id}, {"$set": update_data})
    return {"status": "success"}

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

@api_router.post("/allocations")
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

# --- TRANSFERS ---
@api_router.get("/transfers")
async def get_transfers():
    cursor = db.db.transfers.find({}, {"_id": 0})
    return await cursor.to_list(length=None)

@api_router.post("/transfers")
async def request_transfer(payload: dict):
    transfer = {
        "id": f"tx_{uuid.uuid4().hex[:8]}",
        "asset_id": payload["asset_id"],
        "requested_by": payload["requested_by"],
        "status": "Requested",
        "timestamp": datetime.now().isoformat()
    }
    await db.db.transfers.insert_one(transfer)
    
    # Notify admins/managers
    await create_notification("admin", "Transfer Requested", f"User {payload['requested_by']} requested a transfer for {payload['asset_id']}", "transfer_requested")
    return {"status": "success", "id": transfer["id"]}

@api_router.patch("/transfers/{tx_id}/approve")
async def approve_transfer(
    tx_id: str,
    payload: dict = Body(...),
    # Only managers can approve/reject transfers
    _caller: dict = Depends(role_required("admin", "Asset Manager", "Department Head"))
):
    tx = await db.db.transfers.find_one({"id": tx_id})
    if not tx:
         raise HTTPException(status_code=404)
         
    new_status = payload.get("status")
    await db.db.transfers.update_one({"id": tx_id}, {"$set": {"status": new_status}})
    
    if new_status == "Approved":
         # Actually perform the allocation transfer
         await db.db.allocations.update_many(
             {"asset_id": tx["asset_id"], "status": "Active"}, 
             {"$set": {"status": "Returned", "return_date": datetime.now().isoformat()}}
         )
         new_alloc_id = f"alloc_{uuid.uuid4().hex[:8]}"
         await db.db.allocations.insert_one({
             "id": new_alloc_id,
             "asset_id": tx["asset_id"],
             "allocated_to": tx["requested_by"],
             "status": "Active",
             "allocation_date": datetime.now().isoformat()
         })
         await record_lifecycle_event(tx["asset_id"], "Allocated", "Allocated", "transfer", new_alloc_id, "system", f"Transferred to {tx['requested_by']}")
         await create_notification(tx["requested_by"], "Transfer Approved", f"Your transfer for {tx['asset_id']} was approved.", "transfer_approved")
         
    elif new_status == "Rejected":
         await create_notification(tx["requested_by"], "Transfer Rejected", f"Your transfer request for {tx['asset_id']} was denied.", "transfer_rejected")

    return {"status": "success"}

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

@api_router.patch("/bookings/{booking_id}")
async def update_booking(booking_id: str, payload: dict = Body(...)):
    """Cancel or reschedule a booking."""
    update_data = {}
    if "status" in payload:
        update_data["status"] = payload["status"]
    if "start_time" in payload:
        update_data["start_time"] = payload["start_time"]
    if "end_time" in payload:
        update_data["end_time"] = payload["end_time"]
    
    await db.db.bookings.update_one({"id": booking_id}, {"$set": update_data})
    return {"status": "success"}

# --- NOTIFICATIONS ---
async def create_notification(recipient: str, title: str, message: str, notif_type: str):
    await db.db.notifications.insert_one({
        "id": f"notif_{uuid.uuid4().hex[:8]}",
        "recipient": recipient,
        "title": title,
        "message": message,
        "type": notif_type,
        "is_read": False,
        "created_at": datetime.now().isoformat()
    })

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
async def update_maintenance_status(
    req_id: str,
    payload: dict = Body(...),
    # Only Asset Manager and Admin can approve/reject/advance maintenance tickets
    _caller: dict = Depends(role_required("admin", "Asset Manager"))
):
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
        await create_notification(req["reported_by"], "Maintenance Approved", f"Your request for {req['asset_id']} has been approved.", "maintenance_approved")
    elif new_status == "Resolved":
        await db.db.assets.update_one({"id": req["asset_id"]}, {"$set": {"status": "Available"}})
        await record_lifecycle_event(req["asset_id"], old_status, "Available", "maintenance", req_id, "system", "Maintenance resolved")
        await create_notification(req["reported_by"], "Maintenance Resolved", f"Maintenance for {req['asset_id']} is complete.", "maintenance_resolved")
        
    return {"status": "success"}

# --- ANALYTICS & AUDIT ---
async def cache_dashboard_metrics():
    while True:
        try:
            total_assets = await db.db.assets.count_documents({})
            allocated = await db.db.assets.count_documents({"status": "Allocated"})
            maintenance = await db.db.assets.count_documents({"status": "Under Maintenance"})
            
            today_str = datetime.now().strftime("%Y-%m-%d")
            from datetime import timedelta
            next_week_str = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
            
            overdue_count = await db.db.allocations.count_documents({
                "status": "Active",
                "expected_return_date": {"$lt": today_str, "$ne": None}
            })
            
            upcoming_returns = await db.db.allocations.count_documents({
                "status": "Active",
                "expected_return_date": {"$gte": today_str, "$lte": next_week_str}
            })
            
            active_bookings = await db.db.bookings.count_documents({
                "status": {"$in": ["Confirmed", "Ongoing", "Upcoming"]}
            })
            
            pending_transfers = await db.db.transfers.count_documents({"status": "Requested"})
            
            metrics = {
                "total_assets": total_assets,
                "allocated_assets": allocated,
                "maintenance_active": maintenance,
                "overdue_returns": overdue_count,
                "active_bookings": active_bookings,
                "upcoming_returns": upcoming_returns,
                "pending_transfers": pending_transfers
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
            "overdue_returns": 0,
            "active_bookings": 0,
            "upcoming_returns": 0
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
async def create_audit(
    payload: dict = Body(...),
    # Only Admin can create audit cycles
    _caller: dict = Depends(role_required("admin"))
):
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

@api_router.patch("/audits/{audit_id}/close")
async def close_audit(audit_id: str):
    await db.db.audits.update_one({"id": audit_id}, {"$set": {"status": "Closed", "closed_at": datetime.now().isoformat()}})
    return {"status": "success"}

@api_router.get("/notifications/{username}")
async def get_notifications(username: str):
    cursor = db.db.notifications.find({"recipient": username}, {"_id": 0}).sort("created_at", -1).limit(50)
    return await cursor.to_list(length=None)

@api_router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str):
    await db.db.notifications.update_one({"id": notif_id}, {"$set": {"is_read": True}})
    return {"status": "success"}

app.include_router(api_router)
