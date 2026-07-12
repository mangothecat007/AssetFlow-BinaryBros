import os
import sys

if __name__ == "__main__":
    print("[\033[96mINFO\033[0m] Forcing execution on Port 20134...")
    
    # Ensure we are in the correct directory
    root_dir = "/home/container"
    if not os.path.exists(root_dir):
        root_dir = os.path.dirname(os.path.abspath(__file__))
        
    os.chdir(root_dir)
    sys.path.insert(0, root_dir)
    
    # Use execv to completely replace the current process and force the 20134 port via command line args
    os.execv(sys.executable, ["python", "-m", "uvicorn", "app.backend.server:app", "--host", "0.0.0.0", "--port", "20134"])
