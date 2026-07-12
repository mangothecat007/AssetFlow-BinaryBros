import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import random

# MongoDB Connection String (Update if using Atlas)
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "assetflow"

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]

async def clear_database():
    print("Clearing existing data...")
    await db.assets.delete_many({})
    await db.departments.delete_many({})
    await db.categories.delete_many({})
    await db.allocations.delete_many({})
    await db.bookings.delete_many({})
    await db.maintenance.delete_many({})

async def seed_data():
    await clear_database()
    
    print("Seeding Asset Categories...")
    categories = [
        {"id": "cat_electronics", "name": "Electronics", "description": "Laptops, Tablets, etc."},
        {"id": "cat_furniture", "name": "Furniture", "description": "Desks, Chairs, etc."},
        {"id": "cat_vehicles", "name": "Vehicles", "description": "Cars, Vans, etc."}
    ]
    await db.categories.insert_many(categories)

    print("Seeding Departments...")
    departments = [
        {"id": "dept_eng", "name": "Engineering", "head_id": "Aditi Rao", "status": "Active"},
        {"id": "dept_hr", "name": "Human Resources", "head_id": "Vikram Singh", "status": "Active"},
        {"id": "dept_it", "name": "IT Support", "head_id": "Sana Iqbal", "status": "Active"},
        {"id": "dept_fac", "name": "Facilities", "head_id": "Rohan Mehta", "status": "Active"}
    ]
    await db.departments.insert_many(departments)

    print("Seeding Assets...")
    assets = []
    # Generate 50 Laptops
    for i in range(1, 51):
        assets.append({
            "id": f"AF-L{i:03d}",
            "name": f"Dell XPS 15 - {i}",
            "category_id": "cat_electronics",
            "status": random.choice(["Available", "Allocated", "Maintenance"]),
            "condition": random.choice(["New", "Good", "Fair"]),
            "location": "IT Store Room" if random.random() > 0.5 else "Engineering Floor"
        })
    # Generate 20 Chairs
    for i in range(1, 21):
        assets.append({
            "id": f"AF-C{i:03d}",
            "name": f"Herman Miller Chair - {i}",
            "category_id": "cat_furniture",
            "status": "Available",
            "condition": "Good",
            "location": "Warehouse Section A"
        })
    await db.assets.insert_many(assets)

    print("Seeding Mock Allocations...")
    allocated_assets = [a for a in assets if a["status"] == "Allocated"]
    allocations = []
    employees = ["Priya Shah", "Raj Kumar", "Amit Patel", "Neha Gupta", "Arjun Nair"]
    for asset in allocated_assets:
        allocations.append({
            "id": f"alloc_{random.randint(1000, 9999)}",
            "asset_id": asset["id"],
            "allocated_to": random.choice(employees),
            "allocated_date": (datetime.now() - timedelta(days=random.randint(1, 60))).isoformat(),
            "status": "Active",
            "notes": "Standard issue"
        })
    if allocations:
        await db.allocations.insert_many(allocations)

    print("Seeding Mock Maintenance...")
    maintenance_assets = [a for a in assets if a["status"] == "Maintenance"]
    maintenance_requests = []
    for asset in maintenance_assets:
        maintenance_requests.append({
            "id": f"maint_{random.randint(1000, 9999)}",
            "asset_id": asset["id"],
            "reported_by": random.choice(employees),
            "issue_description": random.choice(["Screen flickering", "Keyboard not working", "Battery draining fast"]),
            "priority": random.choice(["High", "Medium", "Low"]),
            "status": random.choice(["Pending Approval", "Approved", "In Progress", "Resolved"]),
            "reported_at": (datetime.now() - timedelta(days=random.randint(1, 10))).isoformat()
        })
    # Add a few extra just for the board
    maintenance_requests.append({
        "id": "maint_demo1", "asset_id": "AF-C005", "reported_by": "Rohan Mehta", 
        "issue_description": "Broken armrest", "priority": "Low", 
        "status": "Pending Approval", "reported_at": datetime.now().isoformat()
    })
    await db.maintenance.insert_many(maintenance_requests)

    print("✅ Database successfully seeded with dummy data!")

if __name__ == "__main__":
    asyncio.run(seed_data())
