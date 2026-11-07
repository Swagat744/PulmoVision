# Contributing to PulmoVision AI

Thank you for your interest in contributing to PulmoVision AI! We welcome contributions from medical imaging researchers, computer vision engineers, software architects, and clinical UI designers.

## Development Workflow

### 1. Fork and Clone
```bash
git clone https://github.com/Swagat744/PulmoVision.git
cd PulmoVision
```

### 2. Set Up the Environment
Follow the installation instructions in [`README.md`](./README.md) or [`docs/USER_GUIDE.md`](./docs/USER_GUIDE.md):
- **Backend:** Python 3.10+ (Python 3.12 recommended), virtual environment `.venv`, `pip install -r requirements.txt`.
- **Frontend:** Node.js 18+ (Node.js 20+ recommended), `npm install`.

### 3. Branching Guidelines
- Create a dedicated feature branch from `main`:
  ```bash
  git checkout -b feature/your-feature-name
  # or
  git checkout -b fix/your-bugfix-name
  ```

### 4. Code Standards & Quality
- **Python / Backend:**
  - Follow PEP 8 guidelines.
  - Type hints are required for all function arguments and returns.
  - Run the test suite:
    ```powershell
    cd backend
    pytest tests/ -v
    ```
- **TypeScript / Frontend:**
  - Strict TypeScript compliance (`noImplicitAny`, proper DTO types).
  - Verify build integrity before committing:
    ```powershell
    cd frontend
    npm run build
    ```

### 5. Medical Geometry & Coordinate Integrity
- Whenever modifying the preprocessing, viewer, or postprocessing pipelines:
  - Preserve SimpleITK continuous patient coordinates ($X, Y, Z$) in physical millimeters.
  - Do NOT modify slice indices without considering voxel spacing and gantry tilt.
  - Ensure canonical LPS+ orientation conventions are respected.

### 6. Submitting a Pull Request
1. Commit your changes with clear, semantic commit messages (`feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`).
2. Push your branch to your fork.
3. Open a Pull Request against the `main` branch.
4. Describe the changes, motivation, and tests performed.
