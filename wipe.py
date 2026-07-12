import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv("app/backend/.env")

async def wipe():
    print("Connecting to MongoDB...")
    client = AsyncIOMotorClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
    db = client.assetflow
    
    print("Wiping assets...")
    await db.assets.delete_many({})
    print("Wiping allocations...")
    await db.allocations.delete_many({})
    print("Wiping maintenance...")
    await db.maintenance.delete_many({})
    print("Wiping audits...")
    await db.audits.delete_many({})
    print("Wiping bookings...")
    await db.bookings.delete_many({})
    print("Wiping lifecycle events...")
    await db.lifecycle_events.delete_many({})
    
    print("All non-user collections have been wiped clean.")

if __name__ == "__main__":
    asyncio.run(wipe())
