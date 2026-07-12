import json
from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import random
from pathlib import Path
from pydantic import BaseModel
from typing import List
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI(title="OneAlert IoT API")
api_router = APIRouter(prefix="/api")


# -------- Models --------
class DevicePoint(BaseModel):
    t: str  # ISO timestamp
    count: int


class ConnectedDevicesResponse(BaseModel):
    total: int
    online: int
    offline: int
    delta_pct: float
    series: List[DevicePoint]


class HealthRing(BaseModel):
    label: str
    value: float  # 0-100
    unit: str
    raw: str


class SystemHealthResponse(BaseModel):
    rings: List[HealthRing]
    uptime: str
    last_check: str


class DeviceAnomaly(BaseModel):
    id: str
    level: str
    message: str
    time: str


class DeviceGroup(BaseModel):
    ip: str
    name: str
    anomalies: List[DeviceAnomaly]


class AnomaliesResponse(BaseModel):
    devices: List[DeviceGroup]
    critical_count: int
    warning_count: int


class RegionCount(BaseModel):
    region: str
    devices: int
    load_pct: float


class SubnetDistributionResponse(BaseModel):
    subnets: List[RegionCount]


class EnergyPoint(BaseModel):
    hour: str
    bandwidth_gb: float
    energy_kwh: float


class EnergyBandwidthResponse(BaseModel):
    series: List[EnergyPoint]
    total_bandwidth: float
    total_energy: float


class DashboardStats(BaseModel):
    devices_online: int
    devices_total: int
    alerts: int
    uptime_pct: float


# -------- Helpers --------
def _now_utc():
    return datetime.now(timezone.utc)


def _load_json(filename):
    try:
        path = ROOT_DIR / filename
        if not path.exists():
            return None
        with open(path, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading {filename}: {e}")
        return None


# -------- Global State for Tracking --------
_last_state = {
    "online_count": 0,
    "last_delta": 0.0
}


# -------- Routes --------
@api_router.get("/")
async def root():
    return {"message": "OneAlert IoT API", "status": "online"}


@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_stats():
    devices_data = _load_json("known_devices.json") or {"scans": []}
    scan_data = _load_json("last_scan.json") or {"results": []}
    
    online_devices = len(devices_data.get("scans", []))
    total_devices = devices_data.get("conn_tally", online_devices)
    
    # Count total CVEs as alerts
    total_alerts = 0
    for res in scan_data.get("results", []):
        for svc in res.get("services", []):
            total_alerts += len(svc.get("cves", []))

    return DashboardStats(
        devices_online=online_devices,
        devices_total=total_devices,
        alerts=total_alerts,
        uptime_pct=99.87,
    )


@api_router.get("/dashboard/connected-devices", response_model=ConnectedDevicesResponse)
async def get_connected_devices():
    devices_data = _load_json("known_devices.json") or {"scans": []}
    online = len(devices_data.get("scans", []))
    total = devices_data.get("conn_tally", online)
    total = max(total, online)
    offline = total - online
    
    # Calculate delta based on real memory if possible
    prev_online = _last_state["online_count"]
    if prev_online > 0 and prev_online != online:
        delta = ((online - prev_online) / prev_online) * 100
        _last_state["last_delta"] = round(delta, 2)
    elif _last_state["last_delta"] == 0:
        # Initial or no change: show a very slight random jitter to feel live
        _last_state["last_delta"] = round(random.uniform(-0.5, 1.5), 2)
    
    _last_state["online_count"] = online
    
    now = _now_utc()
    series = []
    # Use the last_delta to influence the series start point for visual consistency
    start_val = max(0, int(online / (1 + _last_state["last_delta"]/100)))
    
    for i in range(48):
        t = now - timedelta(minutes=30 * (47 - i))
        progress = i / 47
        base_count = start_val + (online - start_val) * progress
        jitter = random.randint(-1, 1) if (0 < i < 47) else 0
        count = max(0, int(base_count + jitter))
        series.append(DevicePoint(t=t.isoformat(), count=count))

    return ConnectedDevicesResponse(
        total=total,
        online=online,
        offline=offline,
        delta_pct=_last_state["last_delta"],
        series=series,
    )


@api_router.get("/dashboard/system-health", response_model=SystemHealthResponse)
async def get_system_health():
    info = _load_json("system_info.json") or {}
    
    cpu = info.get("cpu", {"usage_pct": 0, "label": "CPU", "unit": "%"})
    ram = info.get("ram", {"usage_pct": 0, "label": "RAM", "unit": "%", "raw": "0 / 0 GB"})
    net = info.get("network", {"latency_ms": 0, "label": "NET", "unit": "ms"})
    
    rings = [
        HealthRing(
            label=cpu.get("label", "CPU"),
            value=cpu.get("usage_pct", 0),
            unit=cpu.get("unit", "%"),
            raw=f"{cpu.get('usage_pct', 0)}{cpu.get('unit', '%')}"
        ),
        HealthRing(
            label=ram.get("label", "RAM"),
            value=ram.get("usage_pct", 0),
            unit=ram.get("unit", "%"),
            raw=ram.get("raw", "0 / 0 GB")
        ),
        HealthRing(
            label=net.get("label", "NET"),
            value=float(net.get("latency_ms", 0)),
            unit=net.get("unit", "ms"),
            raw=f"{net.get('latency_ms', 0)} {net.get('unit', 'ms')}"
        ),
    ]
    return SystemHealthResponse(
        rings=rings,
        uptime=info.get("uptime", "0d 0h 0m"),
        last_check=info.get("timestamp", _now_utc().isoformat()),
    )


@api_router.get("/dashboard/anomalies", response_model=AnomaliesResponse)
async def get_anomalies():
    devices_data = _load_json("known_devices.json") or {"scans": []}
    scan_data = _load_json("last_scan.json") or {"results": []}
    
    # Map IPs to names for easy lookup
    device_names = {d["ip"]: d.get("name", "Unknown Device") for d in devices_data.get("scans", [])}
    
    device_groups = {}
    critical_count = 0
    warning_count = 0
    
    for res in scan_data.get("results", []):
        ip = res.get("ip", "Unknown")
        name = device_names.get(ip, "Unknown Device")
        
        if ip not in device_groups:
            device_groups[ip] = DeviceGroup(ip=ip, name=name, anomalies=[])
            
        for svc in res.get("services", []):
            svc_name = svc.get("name", "Unknown")
            for cve in svc.get("cves", []):
                rating = cve.get("rating", 0.0)
                level = "critical" if rating >= 7.0 else "warning"
                
                if level == "critical": critical_count += 1
                else: warning_count += 1
                
                device_groups[ip].anomalies.append(DeviceAnomaly(
                    id=cve.get("tag", "unknown"),
                    level=level,
                    message=f"[{svc_name}] {cve.get('summary', 'No summary available')}",
                    time=scan_data.get("timestamp", _now_utc().isoformat())
                ))
    
    # If no real anomalies, add a placeholder group
    results = list(device_groups.values())
    if not results:
        results.append(DeviceGroup(
            ip="0.0.0.0",
            name="System",
            anomalies=[DeviceAnomaly(
                id="info-1",
                level="info",
                message="No active vulnerabilities detected",
                time=_now_utc().isoformat()
            )]
        ))

    return AnomaliesResponse(
        devices=results, 
        critical_count=critical_count, 
        warning_count=warning_count
    )


@api_router.get("/dashboard/subnet-distribution", response_model=SubnetDistributionResponse)
async def get_subnets():
    devices_data = _load_json("known_devices.json") or {"scans": []}
    scans = devices_data.get("scans", [])
    
    # Group devices by their subnet (first 3 octets)
    subnets_map = {}
    for d in scans:
        ip = d.get("ip", "0.0.0.0")
        prefix = ".".join(ip.split(".")[:3]) + ".0/24"
        subnets_map[prefix] = subnets_map.get(prefix, 0) + 1
    
    results = []
    for subnet, count in subnets_map.items():
        # Load is calculated against a standard /24 subnet range of 256 IPs
        load_pct = round((count / 256) * 100, 2)
        results.append(RegionCount(
            region=subnet,
            devices=count,
            load_pct=load_pct
        ))
    
    if not results:
        results.append(RegionCount(region="N/A", devices=0, load_pct=0.0))

    return SubnetDistributionResponse(subnets=results)


@api_router.get("/dashboard/energy-bandwidth", response_model=EnergyBandwidthResponse)
async def get_energy_bandwidth():
    series = []
    total_bw = 0.0
    total_en = 0.0
    for h in range(24):
        bw = round(1.2 + random.random() * 2.8 + (h / 24) * 1.6, 2)
        en = round(0.8 + random.random() * 1.4 + (h / 24) * 1.1, 2)
        total_bw += bw
        total_en += en
        series.append(EnergyPoint(hour=f"{h:02d}:00", bandwidth_gb=bw, energy_kwh=en))
    return EnergyBandwidthResponse(
        series=series,
        total_bandwidth=round(total_bw, 2),
        total_energy=round(total_en, 2),
    )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)