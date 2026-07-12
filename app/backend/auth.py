import jwt
import os
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, WebSocketException, status, WebSocket, Request
from pydantic import BaseModel
from typing import Optional

import time
import secrets

import hmac
import hashlib

MASTER_SECRET = secrets.token_urlsafe(32).encode()

def get_current_keys():
    epoch_day = int(time.time()) // 86400
    current_key = hmac.new(MASTER_SECRET, str(epoch_day).encode(), hashlib.sha256).hexdigest()
    prev_key = hmac.new(MASTER_SECRET, str(epoch_day - 1).encode(), hashlib.sha256).hexdigest()
    return current_key, prev_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60*24  # 1 day

# Users are now managed in MongoDB
# Removed hardcoded USERS dictionary

class LoginRequest(BaseModel):
    username: str
    password: str

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    is_police = data.get("role") == "admin"
    
    if is_police:
        expire = datetime.now(timezone.utc) + timedelta(days=365*100)
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, MASTER_SECRET, algorithm=ALGORITHM)

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    current_key, _ = get_current_keys()
    encoded_jwt = jwt.encode(to_encode, current_key, algorithm=ALGORITHM)
    return encoded_jwt


def authenticate_user(db_users, username: str, password: str):
    """
    db_users should be the motor cursor/collection e.g. db.db.users
    We expect the caller to do the async DB lookup and pass the user document.
    """
    pass # Will handle this directly in server.py since auth.py is synchronous and DB is async

def verify_token(token: str):
    # Try static MASTER_SECRET first for never-expiring police tokens
    try:
        payload = jwt.decode(token, MASTER_SECRET, algorithms=[ALGORITHM])
        if payload.get("role") == "admin":
            return payload
    except jwt.PyJWTError:
        pass

    current_key, prev_key = get_current_keys()
    payload = None
    try:
        payload = jwt.decode(token, current_key, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.PyJWTError:
        # current key failed (likely key rotation) — try prev
        try:
            payload = jwt.decode(token, prev_key, algorithms=[ALGORITHM])
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.PyJWTError:
            raise HTTPException(status_code=401, detail="Could not validate credentials")

    username = payload.get("sub")
    role = payload.get("role")
    scope = payload.get("scope")
    if not all([username, role, scope]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"username": username, "role": role, "scope": scope}

# Dependency for standard REST API endpoints (General Access)
async def verify_entry_token(request: Request):
    # Protocol-Strict Authentication
    is_https = request.headers.get("x-forwarded-proto") == "https" or request.url.scheme == "https"
    token = None

    if is_https:
        # Cloud Strict: ONLY trust the HttpOnly cookie
        token = request.cookies.get("entry_jwt")
        if not token:
            print("DEBUG AUTH: HTTPS detected but missing entry_jwt cookie.")
    else:
        # Local Strict: ONLY trust the Authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        if not token:
            print("DEBUG AUTH: HTTP detected but missing Authorization header.")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    user = verify_token(token)
    return user

async def verify_data_token(request: Request):
    user = await verify_entry_token(request)
    scopes = user.get("scope", "").split()
    if "read:data" not in scopes:
        raise HTTPException(status_code=403, detail="Insufficient scope for data access")
    return user

async def verify_terminal_scope(request: Request):
    """HTTP dependency requiring write:system scope (for terminal/scan REST endpoints)."""
    user = await verify_entry_token(request)
    scopes = user.get("scope", "").split()
    if "write:system" not in scopes:
        raise HTTPException(status_code=403, detail="Insufficient scope: write:system required")
    return user

# Dependency for websocket/terminal access (Elevated Access)
async def verify_terminal_token(websocket: WebSocket):
    # Protocol-Strict Authentication for WebSockets
    is_https = websocket.headers.get("x-forwarded-proto") == "https" or websocket.url.scheme == "https"
    token = None

    if is_https:
        # Cloud Strict: ONLY trust the HttpOnly cookie
        token = websocket.cookies.get("entry_jwt")
    else:
        # Local Strict: ONLY trust the query parameter
        token = websocket.query_params.get("token")

    if not token:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token for protocol")
    
    current_key, prev_key = get_current_keys()
    try:
        try:
            payload = jwt.decode(token, MASTER_SECRET, algorithms=[ALGORITHM])
            if payload.get("role") != "admin":
                raise jwt.PyJWTError("Not admin via MASTER_SECRET")
        except jwt.PyJWTError:
            try:
                payload = jwt.decode(token, current_key, algorithms=[ALGORITHM])
            except jwt.PyJWTError:
                payload = jwt.decode(token, prev_key, algorithms=[ALGORITHM])
            
        scopes = payload.get("scope", "").split()
        
        if "write:system" not in scopes:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Insufficient scope for terminal access")
            
        return payload
    except jwt.PyJWTError:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
