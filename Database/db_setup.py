"""
AssetFlow Database Setup Script
Run this script to create the entire database schema, indexes, and seed data.

# 1. Create and activate a Python virtual environment
python -m venv venv
source venv/bin/activate        # On Windows: venv\Scripts\activate

# 2. Install dependencies and run the database setup script
pip install -r requirements.txt
python db_setup.py

or 

pip install pymongo && python db_setup.py

"""

import os
from pymongo import MongoClient, ASCENDING, DESCENDING, TEXT
from pymongo.errors import CollectionInvalid, OperationFailure
from bson.objectid import ObjectId
from datetime import datetime, timezone

# --------------------------------------------------------------------------
# 1. CONNECTION
# --------------------------------------------------------------------------

# Replace with your Atlas connection string or set MONGO_URI env var.
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = "assetflow"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

print(f"Connected to MongoDB: {MONGO_URI}")
print(f"Using database: {DB_NAME}")

# --------------------------------------------------------------------------
# 2. HELPER FUNCTIONS
# --------------------------------------------------------------------------

def create_collection_with_validator(name, validator):
    """Create a collection with a JSON Schema validator if it doesn't exist."""
    try:
        db.create_collection(name, validator=validator)
        print(f"✓ Collection '{name}' created with validator.")
    except CollectionInvalid:
        print(f"⚠ Collection '{name}' already exists. Skipping creation.")
    except OperationFailure as e:
        print(f"✗ Failed to create collection '{name}': {e}")

def ensure_indexes(collection_name, indexes):
    """
    Ensure all indexes exist on the given collection.
    indexes: list of tuples (index_list, index_options)
    """
    coll = db[collection_name]
    for index_spec, options in indexes:
        try:
            coll.create_index(index_spec, **options)
            print(f"  ✓ Index {index_spec} on {collection_name} ensured.")
        except Exception as e:
            print(f"  ✗ Failed to create index {index_spec} on {collection_name}: {e}")

def upsert_document(collection_name, filter_criteria, document):
    """Upsert a document into a collection."""
    result = db[collection_name].update_one(
        filter_criteria,
        {"$setOnInsert": document},
        upsert=True
    )
    if result.upserted_id:
        print(f"  ✓ Inserted new document into {collection_name}")
    else:
        print(f"  ℹ Document already exists in {collection_name} (no changes)")

# --------------------------------------------------------------------------
# 3. JSON SCHEMA VALIDATORS (updated to match backend)
# --------------------------------------------------------------------------

# 3.1 users
users_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["id", "email", "password_hash", "role", "scope", "status"],
        "properties": {
            "id": {"bsonType": "string"},
            "email": {"bsonType": "string", "pattern": "^\\S+@\\S+\\.\\S+$"},
            "password_hash": {"bsonType": "string"},
            "role": {"bsonType": "string"},
            "scope": {"bsonType": "string"},
            "status": {"enum": ["active", "inactive", "suspended"]},
            "name": {"bsonType": "string"},
            "department_id": {"bsonType": "string"},
            "created_at": {"bsonType": "string"},
            "updated_at": {"bsonType": "string"}
        }
    }
}

# 3.2 departments
departments_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["name"],
        "properties": {
            "name": {"bsonType": "string"},
            "head_id": {"bsonType": "string"},
            "parent_id": {"bsonType": "string"},
            "status": {"bsonType": "string"}
        }
    }
}

# 3.3 categories (formerly assetCategories)
categories_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["name"],
        "properties": {
            "name": {"bsonType": "string"},
            "description": {"bsonType": "string"}
        }
    }
}

# 3.4 assets
assets_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["name", "category_id", "department_id", "status"],
        "properties": {
            "name": {"bsonType": "string"},
            "category_id": {"bsonType": "string"},
            "department_id": {"bsonType": "string"},
            "serial_number": {"bsonType": "string"},
            "purchase_date": {"bsonType": "string"},
            "purchase_cost": {"bsonType": "number", "minimum": 0},
            "location": {
                "bsonType": "object",
                "properties": {
                    "building": {"bsonType": "string"},
                    "floor": {"bsonType": "string"},
                    "room": {"bsonType": "string"}
                }
            },
            "status": {"enum": ["available", "allocated", "reserved", "under_maintenance", "lost", "retired", "disposed"]},
            "photo_url": {"bsonType": "string"},
            "created_at": {"bsonType": "string"},
            "updated_at": {"bsonType": "string"}
        }
    }
}

# 3.5 allocations (formerly assetAllocations)
allocations_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["asset_id", "allocated_to", "allocated_by", "status"],
        "properties": {
            "asset_id": {"bsonType": "string"},
            "allocated_to": {"bsonType": "string"},
            "allocated_by": {"bsonType": "string"},
            "allocation_date": {"bsonType": "string"},
            "expected_return_date": {"bsonType": "string"},
            "return_date": {"bsonType": "string"},
            "status": {"enum": ["active", "closed", "cancelled"]}
        }
    }
}

# 3.6 transfers (formerly transferRequests)
transfers_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["asset_id", "requested_by", "status"],
        "properties": {
            "asset_id": {"bsonType": "string"},
            "requested_by": {"bsonType": "string"},
            "status": {"enum": ["requested", "approved", "rejected", "reallocated"]},
            "timestamp": {"bsonType": "string"}
        }
    }
}

# 3.7 bookings (formerly resourceBookings)
bookings_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["asset_id", "booked_by", "start_time", "end_time", "status"],
        "properties": {
            "asset_id": {"bsonType": "string"},
            "booked_by": {"bsonType": "string"},
            "start_time": {"bsonType": "string"},
            "end_time": {"bsonType": "string"},
            "status": {"enum": ["confirmed", "cancelled", "completed"]}
        }
    }
}

# 3.8 maintenance (formerly maintenanceRequests)
maintenance_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["asset_id", "reported_by", "issue_description", "priority", "status"],
        "properties": {
            "asset_id": {"bsonType": "string"},
            "reported_by": {"bsonType": "string"},
            "issue_description": {"bsonType": "string"},
            "priority": {"enum": ["low", "medium", "high", "critical"]},
            "status": {"enum": ["pending", "approved", "rejected", "technician_assigned", "in_progress", "resolved"]},
            "technician_assigned": {"bsonType": "string"},
            "reported_at": {"bsonType": "string"},
            "resolved_at": {"bsonType": "string"}
        }
    }
}

# 3.9 audits (formerly auditCycles)
audits_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["name", "status"],
        "properties": {
            "name": {"bsonType": "string"},
            "department_id": {"bsonType": "string"},
            "start_date": {"bsonType": "string"},
            "end_date": {"bsonType": "string"},
            "auditors": {"bsonType": "array", "items": {"bsonType": "string"}},
            "status": {"enum": ["planned", "assigned", "verification", "report_generated", "closed"]},
            "items": {
                "bsonType": "array",
                "items": {
                    "bsonType": "object",
                    "properties": {
                        "asset_id": {"bsonType": "string"},
                        "verification_result": {"enum": ["verified", "missing", "damaged"]},
                        "discrepancy_notes": {"bsonType": "string"},
                        "verified_by": {"bsonType": "string"},
                        "verified_at": {"bsonType": "string"}
                    }
                }
            },
            "closed_at": {"bsonType": "string"}
        }
    }
}

# 3.10 notifications
notifications_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["recipient", "title", "message", "type", "is_read"],
        "properties": {
            "recipient": {"bsonType": "string"},
            "title": {"bsonType": "string"},
            "message": {"bsonType": "string"},
            "type": {"bsonType": "string"},
            "is_read": {"bsonType": "bool"},
            "created_at": {"bsonType": "string"}
        }
    }
}

# 3.11 lifecycle_events (formerly assetLifecycleEvents)
lifecycle_events_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["asset_id", "from_status", "to_status", "acted_by", "occurred_at"],
        "properties": {
            "asset_id": {"bsonType": "string"},
            "from_status": {"bsonType": "string"},
            "to_status": {"bsonType": "string"},
            "source_type": {"bsonType": "string"},
            "source_id": {"bsonType": "string"},
            "acted_by": {"bsonType": "string"},
            "notes": {"bsonType": "string"},
            "occurred_at": {"bsonType": "string"}
        }
    }
}

# 3.12 dashboard_metrics (formerly dashboardMetrics)
dashboard_metrics_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["metrics", "computed_at"],
        "properties": {
            "metrics": {
                "bsonType": "object",
                "properties": {
                    "availableAssets": {"bsonType": "int"},
                    "allocatedAssets": {"bsonType": "int"},
                    "activeBookings": {"bsonType": "int"},
                    "pendingTransfers": {"bsonType": "int"},
                    "upcomingReturns": {"bsonType": "int"},
                    "overdueReturns": {"bsonType": "int"},
                    "maintenanceToday": {"bsonType": "int"},
                    "assetUtilizationPct": {"bsonType": "double"},
                    "idleAssets": {"bsonType": "int"}
                }
            },
            "computed_at": {"bsonType": "string"}
        }
    }
}

# 3.13 activity_logs (formerly activityLogs)
activity_logs_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["user_id", "action", "entity_type", "entity_id", "timestamp"],
        "properties": {
            "user_id": {"bsonType": "string"},
            "action": {"bsonType": "string"},
            "entity_type": {"bsonType": "string"},
            "entity_id": {"bsonType": "string"},
            "old_data": {"bsonType": "object"},
            "new_data": {"bsonType": "object"},
            "ip_address": {"bsonType": "string"},
            "device": {"bsonType": "string"},
            "browser": {"bsonType": "string"},
            "timestamp": {"bsonType": "string"}
        }
    }
}

# --------------------------------------------------------------------------
# 4. CREATE COLLECTIONS WITH VALIDATORS
# --------------------------------------------------------------------------

collections = [
    ("users", users_validator),
    ("departments", departments_validator),
    ("categories", categories_validator),
    ("assets", assets_validator),
    ("allocations", allocations_validator),
    ("transfers", transfers_validator),
    ("bookings", bookings_validator),
    ("maintenance", maintenance_validator),
    ("audits", audits_validator),
    ("notifications", notifications_validator),
    ("lifecycle_events", lifecycle_events_validator),
    ("dashboard_metrics", dashboard_metrics_validator),
    ("activity_logs", activity_logs_validator),
]

print("\nCreating collections with validators...")
for name, validator in collections:
    create_collection_with_validator(name, validator)

# --------------------------------------------------------------------------
# 5. CREATE INDEXES
# --------------------------------------------------------------------------

print("\nCreating indexes...")

# users
ensure_indexes("users", [
    ([("email", ASCENDING)], {"unique": True}),
    ([("id", ASCENDING)], {"unique": True}),
    ([("department_id", ASCENDING)], {}),
    ([("role", ASCENDING)], {}),
    ([("status", ASCENDING)], {})
])

# departments
ensure_indexes("departments", [
    ([("name", ASCENDING)], {"unique": True}),
    ([("head_id", ASCENDING)], {}),
    ([("parent_id", ASCENDING)], {}),
    ([("status", ASCENDING)], {})
])

# categories
ensure_indexes("categories", [
    ([("name", ASCENDING)], {"unique": True})
])

# assets
ensure_indexes("assets", [
    ([("serial_number", ASCENDING)], {"unique": True, "sparse": True}),
    ([("category_id", ASCENDING)], {}),
    ([("department_id", ASCENDING)], {}),
    ([("status", ASCENDING)], {})
])

# allocations
ensure_indexes("allocations", [
    ([("asset_id", ASCENDING)], {"unique": True, "partialFilterExpression": {"status": "active"}}),
    ([("allocated_to", ASCENDING)], {}),
    ([("status", ASCENDING)], {})
])

# transfers
ensure_indexes("transfers", [
    ([("asset_id", ASCENDING)], {}),
    ([("status", ASCENDING)], {})
])

# bookings
ensure_indexes("bookings", [
    ([("asset_id", ASCENDING), ("start_time", ASCENDING), ("end_time", ASCENDING)], {}),
    ([("booked_by", ASCENDING)], {}),
    ([("status", ASCENDING)], {})
])

# maintenance
ensure_indexes("maintenance", [
    ([("asset_id", ASCENDING)], {}),
    ([("status", ASCENDING)], {}),
    ([("priority", ASCENDING)], {})
])

# audits
ensure_indexes("audits", [
    ([("status", ASCENDING)], {}),
    ([("department_id", ASCENDING)], {})
])

# notifications
ensure_indexes("notifications", [
    ([("recipient", ASCENDING), ("is_read", ASCENDING), ("created_at", DESCENDING)], {})
])

# lifecycle_events
ensure_indexes("lifecycle_events", [
    ([("asset_id", ASCENDING), ("occurred_at", DESCENDING)], {}),
    ([("source_type", ASCENDING), ("source_id", ASCENDING)], {})
])

# dashboard_metrics
ensure_indexes("dashboard_metrics", [
    ([("computed_at", DESCENDING)], {})
])

# activity_logs
ensure_indexes("activity_logs", [
    ([("user_id", ASCENDING), ("timestamp", DESCENDING)], {}),
    ([("entity_type", ASCENDING), ("entity_id", ASCENDING), ("timestamp", DESCENDING)], {})
])

# --------------------------------------------------------------------------
# 6. SEED DATA
# --------------------------------------------------------------------------

print("\nSeeding reference data...")

# 6.1 Default departments
dept_it = {
    "name": "Information Technology",
    "status": "Active"
}
upsert_document("departments", {"name": "Information Technology"}, dept_it)

dept_hr = {
    "name": "Human Resources",
    "status": "Active"
}
upsert_document("departments", {"name": "Human Resources"}, dept_hr)

dept_finance = {
    "name": "Finance",
    "status": "Active"
}
upsert_document("departments", {"name": "Finance"}, dept_finance)

# 6.2 Default asset categories
categories_data = [
    {"name": "Laptop"},
    {"name": "Desktop"},
    {"name": "Printer"},
    {"name": "Monitor"},
    {"name": "Furniture"}
]
for cat in categories_data:
    upsert_document("categories", {"name": cat["name"]}, cat)

print("\n✅ AssetFlow database setup completed successfully!")
print(f"   Database: {DB_NAME}")
print(f"   Collections created: {len(collections)}")
print("   Seed data: departments and categories.")
