#!/usr/bin/env python3
"""
Example client for the Video API Server
Usage: python api_client.py
"""
import requests
import json
from typing import Dict, Any, Optional

class VideoAPIClient:
    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
    
    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """Make HTTP request and return JSON response"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data)
            elif method.upper() == "DELETE":
                response = self.session.delete(url)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            response.raise_for_status()
            return response.json()
            
        except requests.RequestException as e:
            return {"error": str(e), "status": "request_failed"}
    
    # Health and Status
    def health_check(self) -> Dict[str, Any]:
        """Check API health"""
        return self._request("GET", "/health")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        return self._request("GET", "/stats")
    
    def get_recent(self, limit: int = 10) -> Dict[str, Any]:
        """Get recently indexed files"""
        return self._request("GET", f"/recent?limit={limit}")
    
    # Batch Operations
    def list_batches(self) -> Dict[str, Any]:
        """List all batches"""
        return self._request("GET", "/batches")
    
    def get_batch(self, batch_name: str) -> Dict[str, Any]:
        """Get batch details"""
        return self._request("GET", f"/batches/{batch_name}")
    
    def create_batch(self, name: str, paths: list) -> Dict[str, Any]:
        """Create new batch"""
        return self._request("POST", "/batches", {
            "name": name,
            "paths": paths
        })
    
    def delete_batch(self, batch_name: str) -> Dict[str, Any]:
        """Delete batch"""
        return self._request("DELETE", f"/batches/{batch_name}")
    
    # Directory Operations
    def scan_directory(self, directory: str, recursive: bool = True) -> Dict[str, Any]:
        """Scan directory for media files"""
        return self._request("POST", "/scan", {
            "directory": directory,
            "recursive": recursive
        })
    
    def search(self, query: str, limit: int = 10) -> Dict[str, Any]:
        """Full-text search"""
        return self._request("POST", "/search", {
            "query": query,
            "limit": limit
        })
    
    # Network Paths
    def list_paths(self) -> Dict[str, Any]:
        """List network paths"""
        return self._request("GET", "/paths")
    
    def add_path(self, name: str, path: str) -> Dict[str, Any]:
        """Add network path"""
        return self._request("POST", "/paths", {
            "name": name,
            "path": path
        })
    
    def remove_path(self, name: str) -> Dict[str, Any]:
        """Remove network path"""
        return self._request("DELETE", f"/paths/{name}")
    
    # iOS Integration
    def sync_album(self, album: str) -> Dict[str, Any]:
        """Sync iOS Photos album"""
        return self._request("POST", "/sync_album", {
            "album": album
        })
    
    # Backup Operations
    def backup(self, source: str, destination: Optional[str] = None) -> Dict[str, Any]:
        """Backup operation"""
        data = {"source": source}
        if destination:
            data["destination"] = destination
        return self._request("POST", "/backup", data)


def demo_usage():
    """Demonstrate API usage"""
    client = VideoAPIClient()
    
    print("🔍 Testing Video API Client...")
    
    # Health check
    print("\n📊 Health Check:")
    health = client.health_check()
    print(json.dumps(health, indent=2))
    
    # Get stats
    print("\n📈 Database Stats:")
    stats = client.get_stats()
    print(json.dumps(stats, indent=2))
    
    # List batches
    print("\n📦 List Batches:")
    batches = client.list_batches()
    print(json.dumps(batches, indent=2))
    
    # Get recent files
    print("\n🕐 Recent Files:")
    recent = client.get_recent(limit=5)
    print(json.dumps(recent, indent=2))
    
    # Example search
    print("\n🔍 Search Example:")
    search_result = client.search("mp4", limit=3)
    print(json.dumps(search_result, indent=2))
    
    # List network paths
    print("\n🌐 Network Paths:")
    paths = client.list_paths()
    print(json.dumps(paths, indent=2))


def interactive_demo():
    """Interactive CLI demo"""
    client = VideoAPIClient()
    
    while True:
        print("\n🎬 Video API Demo")
        print("1. Health Check")
        print("2. Database Stats")
        print("3. List Batches")
        print("4. Get Recent Files")
        print("5. Search")
        print("6. Scan Directory")
        print("7. Create Batch")
        print("8. List Network Paths")
        print("0. Exit")
        
        choice = input("\nEnter choice: ").strip()
        
        if choice == "0":
            break
        elif choice == "1":
            result = client.health_check()
            print(json.dumps(result, indent=2))
        elif choice == "2":
            result = client.get_stats()
            print(json.dumps(result, indent=2))
        elif choice == "3":
            result = client.list_batches()
            print(json.dumps(result, indent=2))
        elif choice == "4":
            limit = input("Limit (default 10): ").strip() or "10"
            result = client.get_recent(int(limit))
            print(json.dumps(result, indent=2))
        elif choice == "5":
            query = input("Search query: ").strip()
            if query:
                result = client.search(query)
                print(json.dumps(result, indent=2))
        elif choice == "6":
            directory = input("Directory path: ").strip()
            if directory:
                result = client.scan_directory(directory)
                print(json.dumps(result, indent=2))
        elif choice == "7":
            name = input("Batch name: ").strip()
            paths = input("Paths (comma-separated): ").strip()
            if name and paths:
                path_list = [p.strip() for p in paths.split(",")]
                result = client.create_batch(name, path_list)
                print(json.dumps(result, indent=2))
        elif choice == "8":
            result = client.list_paths()
            print(json.dumps(result, indent=2))
        else:
            print("Invalid choice")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "interactive":
        interactive_demo()
    else:
        demo_usage()