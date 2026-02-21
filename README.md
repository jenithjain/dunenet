# 🚀 DuneNet Model API

Complete FastAPI server with Next.js dashboard integration featuring an interactive visual workflow system for your PyTorch perception model.

## ⚡ Quick Start

```bash
# 1. Install dependencies
pip install -r api_server/requirements.txt

# 2. Start API server
start_api.bat  # Windows
# or
./start_api.sh  # Linux/Mac

# 3. Start dashboard (in new terminal)
cd DuneNet
npm run dev

# 4. Open browser
# http://localhost:3000/dashboard
# Try the "Visual Pipeline" tab!
```

## 🎯 What You Get

- ✅ **Visual Workflow System** - n8n-style interactive pipeline (NEW!)
- ✅ **Dynamic Parameter Editing** - Modify algorithm on the fly
- ✅ **What-If Analysis** - Predict impact before changes
- ✅ **Real-time Status Tracking** - Green/red/yellow node states
- ✅ **FastAPI Backend** - REST API for model inference
- ✅ **Next.js Dashboard** - Beautiful UI with multiple views
- ✅ **Image Upload** - Drag & drop interface
- ✅ **GPU Support** - Automatic GPU/CPU detection
- ✅ **Complete Documentation** - Guides for every level

## 📊 Features

### Visual Workflow System (NEW!)
- Interactive n8n-style pipeline visualization
- Real-time status tracking (green/red/yellow nodes)
- Dynamic parameter editing with live preview
- What-if analysis - predict impact before applying
- Visual debugging - identify failures instantly
- 7-stage perception pipeline visualization

### Backend (FastAPI)
- Health check endpoint
- Image upload and inference
- Model information endpoint
- CORS enabled
- Interactive API docs (Swagger)
- Error handling

### Frontend (Next.js)
- Visual Pipeline tab - Interactive workflow
- Model Inference tab - Simple predictions
- Training metrics visualization
- Per-class IoU analysis
- Model quality radar
- Experiment tracking
- Drag & drop image upload
- Real-time results

## 📁 Project Structure

```
c:\spit\
├── api_server/              # FastAPI backend
│   ├── main.py             # API server
│   ├── requirements.txt    # Dependencies
│   └── test_api.py        # Test script
├── DuneNet/                # Next.js frontend
│   ├── app/dashboard/
│   │   └── page.js        # Dashboard with inference
│   └── components/
│       └── ModelInference.jsx  # Inference UI
├── best_model.pth         # Your trained model
├── inference.py           # Standalone script
└── start_api.bat         # Startup script
```

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/predict` | POST | Run inference |
| `/model/info` | GET | Model details |
| `/docs` | GET | API documentation |

## 📚 Documentation

- **[INDEX.md](INDEX.md)** - Complete documentation index
- **[VISUAL_WORKFLOW_GUIDE.md](VISUAL_WORKFLOW_GUIDE.md)** - Visual pipeline guide (NEW!)
- **[QUICK_START.md](QUICK_START.md)** - Get started in 3 steps
- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Detailed setup instructions
- **[VISUAL_GUIDE.md](VISUAL_GUIDE.md)** - Step-by-step walkthrough
- **[README_API.md](README_API.md)** - API documentation
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Project overview

## 🧪 Testing

```bash
# Test API
cd api_server
python test_api.py

# Test with image
python test_api.py path/to/image.jpg
```

## 🎨 Dashboard Preview

The dashboard now features:

### Visual Pipeline Tab (NEW!)
- Interactive workflow visualization
- 7 processing stages with real-time status
- Click nodes to modify parameters
- What-if analysis before applying changes
- Green (success) / Red (error) / Yellow (processing) states
- Animated data flow between nodes

### Model Inference Tab
- Image upload (drag & drop)
- Image preview
- One-click inference
- Results display (prediction + confidence)
- Device information (GPU/CPU)
- Error handling

## 🔧 Configuration

### Change Image Size
Edit `api_server/main.py`:
```python
image = image.resize((224, 224))  # Change size
```

### Change API Port
Edit `api_server/main.py`:
```python
uvicorn.run(app, host="0.0.0.0", port=8000)  # Change port
```

## 🐛 Troubleshooting

**API won't start?**
```bash
pip install -r api_server/requirements.txt
```

**Model not loading?**
- Verify `best_model.pth` exists in root directory

**Connection refused?**
- Ensure API is running on port 8000
- Check: `http://localhost:8000/`

**CORS errors?**
- Verify API server is running
- Check CORS settings in `api_server/main.py`

## 📈 Performance

- **Model Loading**: Once at startup
- **Inference Time**: < 1 second (GPU) / 1-3 seconds (CPU)
- **Image Processing**: Automatic resize to 224x224
- **GPU Support**: Automatic detection

## 🚀 Deployment

Ready for production? Check [ARCHITECTURE.md](ARCHITECTURE.md) for:
- Docker deployment
- Cloud platforms (AWS, GCP, Azure)
- Serverless options
- Security best practices

## 💡 Tips

- Keep both terminals open (API + Dashboard)
- Check console logs for errors
- Use `/docs` endpoint for API testing
- Start with small images for testing
- Monitor GPU usage if available

## ✅ Verification Checklist

- [ ] Python dependencies installed
- [ ] API server starts without errors
- [ ] Model loads successfully
- [ ] Dashboard runs on port 3000
- [ ] Model Inference tab visible
- [ ] Can upload and process images
- [ ] Results display correctly

## 🎯 Next Steps

1. Test with your images
2. Customize preprocessing
3. Add more features
4. Optimize performance
5. Deploy to production

## 📞 Need Help?

1. Check the [documentation](INDEX.md)
2. Run the test script
3. Check console logs
4. Review error messages

## 🎉 Success!

If you can:
- ✓ Start both servers
- ✓ Access the dashboard
- ✓ Upload images
- ✓ Get predictions

**You're all set! Happy inferencing! 🎊**

---

**Documentation**: [INDEX.md](INDEX.md) | **Quick Start**: [QUICK_START.md](QUICK_START.md) | **API Docs**: [README_API.md](README_API.md)
