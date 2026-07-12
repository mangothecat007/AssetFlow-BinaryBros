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
from datetime import datetime
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
# 3. JSON SCHEMA VALIDATORS (per Architecture Document §6)
# --------------------------------------------------------------------------

# 3.1 users
users_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["employeeCode", "email", "passwordHash", "departmentId", "roleId", "status", "accountStatus"],
        "properties": {
            "employeeCode": {"bsonType": "string"},
            "email": {"bsonType": "string", "pattern": "^\\S+@\\S+\\.\\S+$"},
            "passwordHash": {"bsonType": "string"},
            "phone": {"bsonType": "string"},
            "departmentId": {"bsonType": "objectId"},
            "roleId": {"bsonType": "objectId"},
            "designation": {"bsonType": "string"},
            "status": {"enum": ["active", "inactive", "suspended"]},
            "profilePhotoAttachmentId": {"bsonType": "objectId"},
            "joinDate": {"bsonType": "date"},
            "managerId": {"bsonType": "objectId"},
            "emergencyContact": {
                "bsonType": "object",
                "properties": {
                    "name": {"bsonType": "string"},
                    "relation": {"bsonType": "string"},
                    "phone": {"bsonType": "string"}
                }
            },
            "documentAttachmentIds": {"bsonType": "array", "items": {"bsonType": "objectId"}},
            "accountStatus": {"enum": ["pending_verification", "verified", "locked"]},
            "lastLoginAt": {"bsonType": "date"},
            "isDeleted": {"bsonType": "bool"},
            "createdBy": {"bsonType": "objectId"},
            "updatedBy": {"bsonType": "objectId"},
            "createdAt": {"bsonType": "date"},
            "updatedAt": {"bsonType": "date"}
        }
    }
}

# 3.2 roles
roles_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["name", "code"],
        "properties": {
            "name": {"bsonType": "string"},
            "code": {"bsonType": "string"},
            "description": {"bsonType": "string"},
            "permissionCodes": {"bsonType": "array", "items": {"bsonType": "string"}},
            "isSystemRole": {"bsonType": "bool"},
            "isDeleted": {"bsonType": "bool"},
            "createdAt": {"bsonType": "date"},
            "updatedAt": {"bsonType": "date"}
        }
    }
}

# 3.3 permissions
permissions_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["code", "module", "description"],
        "properties": {
            "code": {"bsonType": "string"},
            "module": {"bsonType": "string"},
            "description": {"bsonType": "string"},
            "isDeleted": {"bsonType": "bool"}
        }
    }
}

# 3.4 departments
departments_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["name", "code"],
        "properties": {
            "name": {"bsonType": "string"},
            "code": {"bsonType": "string"},
            "parentDepartmentId": {"bsonType": "objectId"},
            "departmentHeadId": {"bsonType": "objectId"},
            "path": {"bsonType": "array", "items": {"bsonType": "objectId"}},
            "level": {"bsonType": "int"},
            "isDeleted": {"bsonType": "bool"},
            "createdBy": {"bsonType": "objectId"},
            "createdAt": {"bsonType": "date"}
        }
    }
}

# 3.5 assetCategories
asset_categories_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["name", "code"],
        "properties": {
            "name": {"bsonType": "string"},
            "code": {"bsonType": "string"},
            "parentCategoryId": {"bsonType": "objectId"},
            "dynamicFieldSchema": {
                "bsonType": "array",
                "items": {
                    "bsonType": "object",
                    "required": ["fieldKey", "label", "type"],
                    "properties": {
                        "fieldKey": {"bsonType": "string"},
                        "label": {"bsonType": "string"},
                        "type": {"enum": ["string", "number", "boolean", "date", "object"]},
                        "required": {"bsonType": "bool"}
                    }
                }
            },
            "defaultBookable": {"bsonType": "bool"},
            "isDeleted": {"bsonType": "bool"}
        }
    }
}

# 3.6 assets
assets_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["assetTag", "categoryId", "departmentOwnerId", "currentStatus"],
        "properties": {
            "assetTag": {"bsonType": "string"},
            "qrCode": {"bsonType": "string"},
            "serialNumber": {"bsonType": "string"},
            "categoryId": {"bsonType": "objectId"},
            "dynamicFields": {"bsonType": "object"},
            "brand": {"bsonType": "string"},
            "model": {"bsonType": "string"},
            "purchaseDate": {"bsonType": "date"},
            "purchaseCost": {"bsonType": "number", "minimum": 0},
            "warrantyExpiryDate": {"bsonType": "date"},
            "condition": {"enum": ["new", "good", "fair", "poor", "damaged"]},
            "location": {
                "bsonType": "object",
                "properties": {
                    "building": {"bsonType": "string"},
                    "floor": {"bsonType": "string"},
                    "room": {"bsonType": "string"}
                }
            },
            "imageAttachmentIds": {"bsonType": "array", "items": {"bsonType": "objectId"}},
            "documentAttachmentIds": {"bsonType": "array", "items": {"bsonType": "objectId"}},
            "isSharedResource": {"bsonType": "bool"},
            "isBookable": {"bsonType": "bool"},
            "departmentOwnerId": {"bsonType": "objectId"},
            "currentHolderId": {"bsonType": "objectId"},
            "currentHolderType": {"enum": ["User", "Department"]},
            "currentStatus": {"enum": ["available", "allocated", "reserved", "under_maintenance", "lost", "retired", "disposed"]},
            "isDeleted": {"bsonType": "bool"},
            "createdBy": {"bsonType": "objectId"},
            "updatedBy": {"bsonType": "objectId"},
            "createdAt": {"bsonType": "date"},
            "updatedAt": {"bsonType": "date"}
        }
    }
}

# 3.7 assetLifecycleEvents
asset_lifecycle_events_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["assetId", "fromStatus", "toStatus", "actedBy", "occurredAt"],
        "properties": {
            "assetId": {"bsonType": "objectId"},
            "fromStatus": {"bsonType": "string"},
            "toStatus": {"bsonType": "string"},
            "sourceType": {"bsonType": "string"},
            "sourceId": {"bsonType": "objectId"},
            "actedBy": {"bsonType": "objectId"},
            "notes": {"bsonType": "string"},
            "occurredAt": {"bsonType": "date"}
        }
    }
}

# 3.8 assetAllocations
asset_allocations_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["assetId", "allocationType", "requestedBy", "approvalStatus", "status"],
        "properties": {
            "assetId": {"bsonType": "objectId"},
            "allocationType": {"enum": ["employee", "department"]},
            "allocatedToUserId": {"bsonType": "objectId"},
            "allocatedToDepartmentId": {"bsonType": "objectId"},
            "requestedBy": {"bsonType": "objectId"},
            "approvedBy": {"bsonType": "objectId"},
            "approvalStatus": {"enum": ["pending", "approved", "rejected"]},
            "expectedReturnDate": {"bsonType": "date"},
            "actualReturnDate": {"bsonType": "date"},
            "status": {"enum": ["active", "closed", "cancelled"]},
            "createdAt": {"bsonType": "date"},
            "updatedAt": {"bsonType": "date"}
        }
    }
}

# 3.9 assetReturns
asset_returns_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["allocationId", "assetId", "returnedBy", "receivedBy", "returnDate", "returnCondition"],
        "properties": {
            "allocationId": {"bsonType": "objectId"},
            "assetId": {"bsonType": "objectId"},
            "returnedBy": {"bsonType": "objectId"},
            "receivedBy": {"bsonType": "objectId"},
            "returnDate": {"bsonType": "date"},
            "returnCondition": {"enum": ["new", "good", "fair", "poor", "damaged"]},
            "returnNotes": {"bsonType": "string"},
            "createdAt": {"bsonType": "date"}
        }
    }
}

# 3.10 transferRequests
transfer_requests_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["assetId", "fromHolderId", "toHolderId", "requestedBy", "reason", "status"],
        "properties": {
            "assetId": {"bsonType": "objectId"},
            "fromHolderId": {"bsonType": "objectId"},
            "toHolderId": {"bsonType": "objectId"},
            "requestedBy": {"bsonType": "objectId"},
            "reason": {"bsonType": "string"},
            "status": {"enum": ["requested", "approved", "rejected", "reallocated"]},
            "approvalChain": {
                "bsonType": "array",
                "items": {
                    "bsonType": "object",
                    "properties": {
                        "approverId": {"bsonType": "objectId"},
                        "decision": {"enum": ["approved", "rejected"]},
                        "decidedAt": {"bsonType": "date"},
                        "comment": {"bsonType": "string"}
                    }
                }
            },
            "reallocatedAllocationId": {"bsonType": "objectId"},
            "createdAt": {"bsonType": "date"},
            "updatedAt": {"bsonType": "date"}
        }
    }
}

# 3.11 resourceBookings
resource_bookings_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["assetId", "bookedBy", "purpose", "startTime", "endTime", "status"],
        "properties": {
            "assetId": {"bsonType": "objectId"},
            "bookedBy": {"bsonType": "objectId"},
            "purpose": {"bsonType": "string"},
            "startTime": {"bsonType": "date"},
            "endTime": {"bsonType": "date"},
            "status": {"enum": ["confirmed", "cancelled", "completed"]},
            "reminderMinutesBefore": {"bsonType": "int"},
            "cancelledAt": {"bsonType": "date"},
            "cancelledBy": {"bsonType": "objectId"},
            "rescheduledFromBookingId": {"bsonType": "objectId"},
            "createdAt": {"bsonType": "date"},
            "updatedAt": {"bsonType": "date"}
        }
    }
}

# 3.12 maintenanceRequests
maintenance_requests_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["assetId", "reportedBy", "priority", "status"],
        "properties": {
            "assetId": {"bsonType": "objectId"},
            "reportedBy": {"bsonType": "objectId"},
            "priority": {"enum": ["low", "medium", "high", "critical"]},
            "status": {"enum": ["pending", "approved", "rejected", "technician_assigned", "in_progress", "resolved"]},
            "approvedBy": {"bsonType": "objectId"},
            "technicianId": {"bsonType": "objectId"},
            "vendor": {"bsonType": "string"},
            "cost": {"bsonType": "number", "minimum": 0},
            "resolution": {"bsonType": "string"},
            "photoAttachmentIds": {"bsonType": "array", "items": {"bsonType": "objectId"}},
            "createdAt": {"bsonType": "date"},
            "updatedAt": {"bsonType": "date"},
            "resolvedAt": {"bsonType": "date"}
        }
    }
}

# 3.13 maintenanceComments
maintenance_comments_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["maintenanceRequestId", "authorId", "comment"],
        "properties": {
            "maintenanceRequestId": {"bsonType": "objectId"},
            "authorId": {"bsonType": "objectId"},
            "comment": {"bsonType": "string"},
            "createdAt": {"bsonType": "date"}
        }
    }
}

# 3.14 auditCycles
audit_cycles_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["name", "status"],
        "properties": {
            "name": {"bsonType": "string"},
            "departmentScope": {"bsonType": "array", "items": {"bsonType": "objectId"}},
            "assignedAuditorIds": {"bsonType": "array", "items": {"bsonType": "objectId"}},
            "startDate": {"bsonType": "date"},
            "endDate": {"bsonType": "date"},
            "status": {"enum": ["planned", "assigned", "verification", "report_generated", "closed"]},
            "reportAttachmentId": {"bsonType": "objectId"},
            "createdBy": {"bsonType": "objectId"},
            "createdAt": {"bsonType": "date"},
            "closedAt": {"bsonType": "date"}
        }
    }
}

# 3.15 auditItems
audit_items_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["auditCycleId", "assetId", "verifiedBy", "verifiedAt", "verificationResult"],
        "properties": {
            "auditCycleId": {"bsonType": "objectId"},
            "assetId": {"bsonType": "objectId"},
            "expectedLocation": {
                "bsonType": "object",
                "properties": {
                    "building": {"bsonType": "string"},
                    "floor": {"bsonType": "string"},
                    "room": {"bsonType": "string"}
                }
            },
            "verificationResult": {"enum": ["verified", "missing", "damaged"]},
            "discrepancyNotes": {"bsonType": "string"},
            "verifiedBy": {"bsonType": "objectId"},
            "verifiedAt": {"bsonType": "date"},
            "photoAttachmentIds": {"bsonType": "array", "items": {"bsonType": "objectId"}}
        }
    }
}

# 3.16 notifications
notifications_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["recipientId", "type", "title", "message", "isRead"],
        "properties": {
            "recipientId": {"bsonType": "objectId"},
            "type": {"enum": [
                "asset_assigned", "asset_returned", "transfer_approved", "booking_reminder",
                "booking_cancelled", "maintenance_approved", "maintenance_rejected",
                "audit_assigned", "audit_discrepancy", "overdue_return"
            ]},
            "title": {"bsonType": "string"},
            "message": {"bsonType": "string"},
            "relatedEntityType": {"bsonType": "string"},
            "relatedEntityId": {"bsonType": "objectId"},
            "isRead": {"bsonType": "bool"},
            "readAt": {"bsonType": "date"},
            "createdAt": {"bsonType": "date"}
        }
    }
}

# 3.17 activityLogs
activity_logs_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["userId", "action", "entityType", "entityId", "timestamp"],
        "properties": {
            "userId": {"bsonType": "objectId"},
            "action": {"bsonType": "string"},
            "entityType": {"bsonType": "string"},
            "entityId": {"bsonType": "objectId"},
            "oldData": {"bsonType": "object"},
            "newData": {"bsonType": "object"},
            "ipAddress": {"bsonType": "string"},
            "device": {"bsonType": "string"},
            "browser": {"bsonType": "string"},
            "timestamp": {"bsonType": "date"}
        }
    }
}

# 3.18 attachments
attachments_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["ownerType", "ownerId", "fileName", "fileType", "fileSizeBytes", "storageKey", "uploadedBy"],
        "properties": {
            "ownerType": {"bsonType": "string"},
            "ownerId": {"bsonType": "objectId"},
            "fileName": {"bsonType": "string"},
            "fileType": {"bsonType": "string"},
            "fileSizeBytes": {"bsonType": "number", "minimum": 0},
            "storageKey": {"bsonType": "string"},
            "category": {"bsonType": "string"},
            "uploadedBy": {"bsonType": "objectId"},
            "isDeleted": {"bsonType": "bool"},
            "createdAt": {"bsonType": "date"}
        }
    }
}

# 3.19 dashboardMetrics
dashboard_metrics_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["scope", "metricDate", "metrics", "computedAt"],
        "properties": {
            "scope": {"bsonType": "string"},
            "scopeId": {"bsonType": "objectId"},
            "metricDate": {"bsonType": "string"},
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
            "computedAt": {"bsonType": "date"}
        }
    }
}

# 3.20 settings
settings_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["key", "value"],
        "properties": {
            "key": {"bsonType": "string"},
            "value": {"bsonType": "object"},
            "updatedBy": {"bsonType": "objectId"},
            "updatedAt": {"bsonType": "date"}
        }
    }
}

# 3.21 sessions
sessions_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["userId", "refreshTokenHash", "issuedAt", "expiresAt"],
        "properties": {
            "userId": {"bsonType": "objectId"},
            "refreshTokenHash": {"bsonType": "string"},
            "device": {"bsonType": "string"},
            "ipAddress": {"bsonType": "string"},
            "issuedAt": {"bsonType": "date"},
            "expiresAt": {"bsonType": "date"},
            "revokedAt": {"bsonType": "date"}
        }
    }
}

# 3.22 counters
counters_validator = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["_id", "seq"],
        "properties": {
            "_id": {"bsonType": "string"},
            "seq": {"bsonType": "int"}
        }
    }
}

# --------------------------------------------------------------------------
# 4. CREATE COLLECTIONS WITH VALIDATORS
# --------------------------------------------------------------------------

collections = [
    ("users", users_validator),
    ("roles", roles_validator),
    ("permissions", permissions_validator),
    ("departments", departments_validator),
    ("assetCategories", asset_categories_validator),
    ("assets", assets_validator),
    ("assetLifecycleEvents", asset_lifecycle_events_validator),
    ("assetAllocations", asset_allocations_validator),
    ("assetReturns", asset_returns_validator),
    ("transferRequests", transfer_requests_validator),
    ("resourceBookings", resource_bookings_validator),
    ("maintenanceRequests", maintenance_requests_validator),
    ("maintenanceComments", maintenance_comments_validator),
    ("auditCycles", audit_cycles_validator),
    ("auditItems", audit_items_validator),
    ("notifications", notifications_validator),
    ("activityLogs", activity_logs_validator),
    ("attachments", attachments_validator),
    ("dashboardMetrics", dashboard_metrics_validator),
    ("settings", settings_validator),
    ("sessions", sessions_validator),
    ("counters", counters_validator),
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
    ([("employeeCode", ASCENDING)], {"unique": True}),
    ([("departmentId", ASCENDING)], {}),
    ([("roleId", ASCENDING)], {}),
    ([("managerId", ASCENDING)], {}),
    ([("status", ASCENDING), ("isDeleted", ASCENDING)], {}),
    ([("name", TEXT), ("email", TEXT)], {"name": "users_text_search"})
])

# roles
ensure_indexes("roles", [
    ([("code", ASCENDING)], {"unique": True})
])

# permissions
ensure_indexes("permissions", [
    ([("code", ASCENDING)], {"unique": True}),
    ([("module", ASCENDING)], {})
])

# departments
ensure_indexes("departments", [
    ([("code", ASCENDING)], {"unique": True}),
    ([("parentDepartmentId", ASCENDING)], {}),
    ([("path", ASCENDING)], {}),
    ([("departmentHeadId", ASCENDING)], {})
])

# assetCategories
ensure_indexes("assetCategories", [
    ([("code", ASCENDING)], {"unique": True}),
    ([("parentCategoryId", ASCENDING)], {})
])

# assets
ensure_indexes("assets", [
    ([("assetTag", ASCENDING)], {"unique": True}),
    ([("serialNumber", ASCENDING)], {"unique": True, "sparse": True}),
    ([("categoryId", ASCENDING)], {}),
    ([("departmentOwnerId", ASCENDING)], {}),
    ([("currentHolderId", ASCENDING)], {}),
    ([("currentStatus", ASCENDING)], {}),
    ([("isBookable", ASCENDING), ("currentStatus", ASCENDING)], {}),
    ([("isDeleted", ASCENDING)], {}),
    ([("brand", TEXT), ("model", TEXT), ("assetTag", TEXT)], {"name": "assets_text_search"})
])

# assetLifecycleEvents
ensure_indexes("assetLifecycleEvents", [
    ([("assetId", ASCENDING), ("occurredAt", DESCENDING)], {}),
    ([("sourceType", ASCENDING), ("sourceId", ASCENDING)], {})
])

# assetAllocations
ensure_indexes("assetAllocations", [
    ([("assetId", ASCENDING)], {"unique": True, "partialFilterExpression": {"status": "active"}}),
    ([("allocatedToUserId", ASCENDING), ("status", ASCENDING)], {}),
    ([("expectedReturnDate", ASCENDING), ("status", ASCENDING)], {})
])

# assetReturns
ensure_indexes("assetReturns", [
    ([("allocationId", ASCENDING)], {"unique": True}),
    ([("assetId", ASCENDING)], {})
])

# transferRequests
ensure_indexes("transferRequests", [
    ([("assetId", ASCENDING), ("status", ASCENDING)], {}),
    ([("toHolderId", ASCENDING)], {}),
    ([("status", ASCENDING)], {})
])

# resourceBookings
ensure_indexes("resourceBookings", [
    ([("assetId", ASCENDING), ("startTime", ASCENDING), ("endTime", ASCENDING)], {}),
    ([("bookedBy", ASCENDING)], {}),
    ([("status", ASCENDING), ("startTime", ASCENDING)], {})
])

# maintenanceRequests
ensure_indexes("maintenanceRequests", [
    ([("assetId", ASCENDING), ("status", ASCENDING)], {}),
    ([("status", ASCENDING), ("priority", ASCENDING)], {}),
    ([("technicianId", ASCENDING), ("status", ASCENDING)], {})
])

# maintenanceComments
ensure_indexes("maintenanceComments", [
    ([("maintenanceRequestId", ASCENDING), ("createdAt", ASCENDING)], {})
])

# auditCycles
ensure_indexes("auditCycles", [
    ([("status", ASCENDING)], {}),
    ([("assignedAuditorIds", ASCENDING)], {})
])

# auditItems
ensure_indexes("auditItems", [
    ([("auditCycleId", ASCENDING), ("verificationResult", ASCENDING)], {}),
    ([("assetId", ASCENDING)], {})
])

# notifications
ensure_indexes("notifications", [
    ([("recipientId", ASCENDING), ("isRead", ASCENDING), ("createdAt", DESCENDING)], {}),
    ([("createdAt", ASCENDING)], {"expireAfterSeconds": 7776000})  # 90 days TTL (optional)
])

# activityLogs
ensure_indexes("activityLogs", [
    ([("userId", ASCENDING), ("timestamp", DESCENDING)], {}),
    ([("entityType", ASCENDING), ("entityId", ASCENDING), ("timestamp", DESCENDING)], {})
])

# attachments
ensure_indexes("attachments", [
    ([("ownerType", ASCENDING), ("ownerId", ASCENDING)], {})
])

# dashboardMetrics
ensure_indexes("dashboardMetrics", [
    ([("scope", ASCENDING), ("scopeId", ASCENDING), ("metricDate", DESCENDING)], {})
])

# settings
ensure_indexes("settings", [
    ([("key", ASCENDING)], {"unique": True})
])

# sessions
ensure_indexes("sessions", [
    ([("userId", ASCENDING), ("revokedAt", ASCENDING)], {}),
    ([("expiresAt", ASCENDING)], {"expireAfterSeconds": 0})
])

# counters
ensure_indexes("counters", [
    ([("_id", ASCENDING)], {"unique": True})
])


# --------------------------------------------------------------------------
# 6. SEED DATA
# --------------------------------------------------------------------------

print("\nSeeding reference data...")

# 6.1 Permissions
permissions_data = [
    {"code": "ASSET_CREATE", "module": "Asset", "description": "Create new asset records"},
    {"code": "ASSET_UPDATE", "module": "Asset", "description": "Update asset records"},
    {"code": "ASSET_DELETE", "module": "Asset", "description": "Delete asset records"},
    {"code": "ASSET_VIEW", "module": "Asset", "description": "View asset details"},
    {"code": "ALLOCATION_APPROVE", "module": "Allocation", "description": "Approve asset allocations"},
    {"code": "ALLOCATION_CREATE", "module": "Allocation", "description": "Create asset allocations"},
    {"code": "ALLOCATION_RETURN", "module": "Allocation", "description": "Process asset returns"},
    {"code": "TRANSFER_APPROVE", "module": "Transfer", "description": "Approve transfer requests"},
    {"code": "TRANSFER_CREATE", "module": "Transfer", "description": "Create transfer requests"},
    {"code": "BOOKING_CREATE", "module": "Booking", "description": "Create resource bookings"},
    {"code": "BOOKING_CANCEL", "module": "Booking", "description": "Cancel resource bookings"},
    {"code": "MAINTENANCE_APPROVE", "module": "Maintenance", "description": "Approve maintenance requests"},
    {"code": "MAINTENANCE_RESOLVE", "module": "Maintenance", "description": "Resolve maintenance requests"},
    {"code": "AUDIT_CREATE", "module": "Audit", "description": "Create audit cycles"},
    {"code": "AUDIT_CLOSE", "module": "Audit", "description": "Close audit cycles"},
    {"code": "AUDIT_VERIFY", "module": "Audit", "description": "Verify audit items"},
    {"code": "REPORT_VIEW", "module": "Report", "description": "View reports and dashboards"},
    {"code": "USER_MANAGE", "module": "User", "description": "Manage user accounts and roles"},
    {"code": "DEPARTMENT_MANAGE", "module": "Department", "description": "Manage departments"},
    {"code": "SETTINGS_VIEW", "module": "Settings", "description": "View system settings"},
    {"code": "SETTINGS_UPDATE", "module": "Settings", "description": "Update system settings"},
    {"code": "ACTIVITY_LOG_VIEW", "module": "Audit", "description": "View activity logs"},
]

for perm in permissions_data:
    upsert_document("permissions", {"code": perm["code"]}, perm)

# 6.2 Roles
roles_data = [
    {
        "name": "Admin",
        "code": "ADMIN",
        "description": "Full system access",
        "permissionCodes": [p["code"] for p in permissions_data],
        "isSystemRole": True
    },
    {
        "name": "Asset Manager",
        "code": "ASSET_MANAGER",
        "description": "Manages asset lifecycle, allocation, and transfers",
        "permissionCodes": [
            "ASSET_CREATE", "ASSET_UPDATE", "ASSET_VIEW", "ALLOCATION_APPROVE",
            "ALLOCATION_CREATE", "ALLOCATION_RETURN", "TRANSFER_APPROVE",
            "TRANSFER_CREATE", "BOOKING_CREATE", "BOOKING_CANCEL",
            "MAINTENANCE_APPROVE", "MAINTENANCE_RESOLVE",
            "REPORT_VIEW", "SETTINGS_VIEW"
        ],
        "isSystemRole": True
    },
    {
        "name": "Department Head",
        "code": "DEPARTMENT_HEAD",
        "description": "Manage assets and allocations within their department",
        "permissionCodes": [
            "ASSET_VIEW", "ALLOCATION_CREATE", "ALLOCATION_APPROVE",
            "ALLOCATION_RETURN", "TRANSFER_CREATE", "TRANSFER_APPROVE",
            "BOOKING_CREATE", "BOOKING_CANCEL", "MAINTENANCE_APPROVE",
            "REPORT_VIEW"
        ],
        "isSystemRole": True
    },
    {
        "name": "Employee",
        "code": "EMPLOYEE",
        "description": "Standard employee with view and basic booking rights",
        "permissionCodes": [
            "ASSET_VIEW", "ALLOCATION_CREATE", "BOOKING_CREATE",
            "BOOKING_CANCEL", "MAINTENANCE_CREATE", "REPORT_VIEW"
        ],
        "isSystemRole": True
    },
    {
        "name": "Auditor",
        "code": "AUDITOR",
        "description": "Conduct audits and verify assets",
        "permissionCodes": [
            "ASSET_VIEW", "AUDIT_CREATE", "AUDIT_CLOSE", "AUDIT_VERIFY",
            "REPORT_VIEW", "ACTIVITY_LOG_VIEW"
        ],
        "isSystemRole": True
    }
]

for role in roles_data:
    upsert_document("roles", {"code": role["code"]}, role)

# 6.3 Counters initial seeds
counters_data = [
    {"_id": "assetTag_2026", "seq": 0},
    {"_id": "employeeCode_2026", "seq": 0}
]
for counter in counters_data:
    upsert_document("counters", {"_id": counter["_id"]}, counter)

# 6.4 Default departments – optional fields omitted
dept_it = {
    "name": "Information Technology",
    "code": "IT",
    "path": [],
    "level": 0,
    "isDeleted": False,
    "createdAt": datetime.now(timezone.utc)
}
upsert_document("departments", {"code": "IT"}, dept_it)

dept_hr = {
    "name": "Human Resources",
    "code": "HR",
    "path": [],
    "level": 0,
    "isDeleted": False,
    "createdAt": datetime.now(timezone.utc)
}
upsert_document("departments", {"code": "HR"}, dept_hr)

dept_finance = {
    "name": "Finance",
    "code": "FIN",
    "path": [],
    "level": 0,
    "isDeleted": False,
    "createdAt": datetime.now(timezone.utc)
}
upsert_document("departments", {"code": "FIN"}, dept_finance)

# 6.5 Default settings – optional fields omitted
settings_data = {
    "key": "notification_preferences",
    "value": {
        "overdueReturnReminderDays": 3,
        "bookingReminderMinutes": 15
    },
    "updatedAt": datetime.now(timezone.utc)
}
upsert_document("settings", {"key": "notification_preferences"}, settings_data)

print("\n✅ AssetFlow database setup completed successfully!")
print(f"   Database: {DB_NAME}")
print(f"   Collections created: {len(collections)}")
print("   Seed data: permissions, roles, counters, default departments, settings.")
