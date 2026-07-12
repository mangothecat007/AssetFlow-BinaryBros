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
    authenticate_user,
    create_access_token,
    verify_entry_token,
    verify_data_token
)

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
@api_router.post("/auth/login")
async def login(login_data: LoginRequest, response: Response):
    user_info = authenticate_user(login_data.username, login_data.password)
    if not user_info:
        raise HTTPException(status_code=401, detail="Incorrect credentials")
    
    token = create_access_token(data={"sub": login_data.username, "role": user_info["role"]})
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

@api_router.post("/allocations/transfer")
async def request_transfer(allocation: Allocation):
    # Check if asset is already allocated and Active
    existing = await db.db.allocations.find_one({"asset_id": allocation.asset_id, "status": "Active"})
    if existing:
        raise HTTPException(status_code=409, detail=f"Asset already allocated to {existing.get('allocated_to')}")
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
    await db.db.maintenance.update_one({"id": req_id}, {"$set": {"status": new_status}})
    return {"status": "success"}

app.include_router(api_router)
