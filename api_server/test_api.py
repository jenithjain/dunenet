"""
Test script for the FastAPI model server
"""
import requests
import sys
from pathlib import Path

API_URL = "http://localhost:8000"

def test_health_check():
    """Test the health check endpoint"""
    print("Testing health check endpoint...")
    try:
        response = requests.get(f"{API_URL}/")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Health check passed")
            print(f"  Status: {data['status']}")
            print(f"  Model loaded: {data['model_loaded']}")
            print(f"  Device: {data['device']}")
            return True
        else:
            print(f"✗ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect to API server. Make sure it's running on port 8000")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_model_info():
    """Test the model info endpoint"""
    print("\nTesting model info endpoint...")
    try:
        response = requests.get(f"{API_URL}/model/info")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Model info retrieved")
            print(f"  Model type: {data['model_type']}")
            print(f"  Device: {data['device']}")
            print(f"  Parameters: {data.get('parameters', 'N/A')}")
            return True
        else:
            print(f"✗ Model info failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def test_prediction(image_path=None):
    """Test the prediction endpoint"""
    print("\nTesting prediction endpoint...")
    
    if image_path and Path(image_path).exists():
        try:
            with open(image_path, 'rb') as f:
                files = {'file': f}
                response = requests.post(f"{API_URL}/predict", files=files)
                
            if response.status_code == 200:
                data = response.json()
                print(f"✓ Prediction successful")
                print(f"  Prediction: {data['prediction']}")
                print(f"  Confidence: {data['confidence']:.2%}")
                print(f"  Device: {data['device_used']}")
                return True
            else:
                print(f"✗ Prediction failed: {response.status_code}")
                print(f"  {response.text}")
                return False
        except Exception as e:
            print(f"✗ Error: {e}")
            return False
    else:
        print("⚠ Skipping prediction test (no image provided)")
        print("  To test prediction, run: python test_api.py path/to/image.jpg")
        return None

def main():
    print("=" * 50)
    print("DuneNet API Server Test Suite")
    print("=" * 50)
    
    image_path = sys.argv[1] if len(sys.argv) > 1 else None
    
    results = []
    results.append(test_health_check())
    results.append(test_model_info())
    pred_result = test_prediction(image_path)
    if pred_result is not None:
        results.append(pred_result)
    
    print("\n" + "=" * 50)
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"Tests passed: {passed}/{total}")
    print("=" * 50)
    
    if passed == total:
        print("✓ All tests passed!")
        return 0
    else:
        print("✗ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
