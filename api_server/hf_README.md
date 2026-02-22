---
title: DuneNet Model API
emoji: 🚀
colorFrom: yellow
colorTo: orange
sdk: docker
app_port: 7860
pinned: false
---

# DuneNet Model API

FastAPI backend for DuneNet - Autonomous UGV Perception Platform.

Runs a fine-tuned Segformer (nvidia/mit-b4) model for semantic segmentation of desert terrain, providing:
- Semantic segmentation masks
- Traversability maps for autonomous navigation
- Live simulation inference with costmap grids

## Endpoints

- `GET /` — Health check
- `POST /predict` — Full segmentation prediction
- `POST /predict/sim` — Simulation-optimized prediction with traversability grid
- `GET /model/info` — Model metadata
