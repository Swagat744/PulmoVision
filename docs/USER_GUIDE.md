# PulmoVision AI — User Operation Guide

Welcome to **PulmoVision AI** (*Thoracic CT Segmentation & 3D Quantitative Research Platform*). This manual provides step-by-step instructions for medical imaging researchers, computer vision engineers, and clinicians operating the workstation.

---

## Table of Contents
1. [Platform Access & Account Setup](#step-1--platform-access--account-setup)
2. [Registering a Research Study](#step-2--registering-a-research-study)
3. [Uploading Chest CT Scans](#step-3--uploading-chest-ct-scans)
4. [Launching the Radiology Workstation](#step-4--launching-the-radiology-workstation)
5. [Multi-Planar Navigation & 2D Image Manipulation](#step-5--multi-planar-navigation--2d-image-manipulation)
6. [Executing AI Segmentation](#step-6--executing-ai-segmentation)
7. [Anatomical Contour & 3D Surface Inspection](#step-7--anatomical-contour--3d-surface-inspection)
8. [Quantitative Parenchymal Volumetrics & HU Attenuation](#step-8--quantitative-parenchymal-volumetrics--hu-attenuation)
9. [Reference Phantom Evaluation & Metrics](#step-9--reference-phantom-evaluation--metrics)
10. [Generating Clinical Research Reports & Exports](#step-10--generating-clinical-research-reports--exports)
11. [Managing Studies, Scans & Platform Settings](#step-11--managing-studies-scans--platform-settings)

---

## Step 1 — Platform Access & Account Setup

1. Open your web browser (Google Chrome, Mozilla Firefox, or Microsoft Edge recommended with WebGL 2.0 support enabled) and navigate to the application URL:
   ```text
   http://localhost:5173  (Local Development)
   ```
2. You will be greeted by the cinematic landing page with interactive 3D pulmonary models, technical capabilities, and verified empirical benchmarks.
3. Click **"Enter Research Workspace"** or **"Researcher Sign In"** in the top navigation bar.
4. **First-Time Users:**
   * Select the **"Register"** tab.
   * Provide your full name, academic/institutional email, and a secure password (minimum 8 characters).
   * PulmoVision AI hashes your credentials using the **Argon2id** cryptographic algorithm before persisting to the database.
   * Click **"Create Research Account"**. You will automatically receive a Bearer JWT session token and be directed to the Research Dashboard.
5. **Returning Users:**
   * Enter your registered email and password on the **"Sign In"** tab.

> [!NOTE]
> PulmoVision AI does not ship with hardcoded administrator credentials. Your newly registered account is granted full researcher rights on your isolated study database.

---

## Step 2 — Registering a Research Study

Studies act as organizational boundaries that group serial or single-timepoint CT scans, segmentation jobs, measurements, and clinical research notes for a specific de-identified subject.

1. Navigate to **"Studies"** from the top application navigation bar.
2. Click the **"+ New Study"** button in the upper right corner.
3. In the modal dialog, fill in the protocol metadata:
   * **Subject Anonymous Identifier:** e.g., `PV-SUBJ-104` or `COHORT-A-042`. *(Never enter real patient names or national identity numbers).*
   * **Protocol Title:** e.g., *Helical Low-Dose CT Follow-up for Parenchymal Evaluation*.
   * **Imaging Modality:** Defaults to `CT` (Computed Tomography).
   * **Acquisition Date:** Select the date the scan was acquired.
   * **Clinical Research Notes:** Optional notes describing scanner manufacturer (e.g., Siemens Somatom, GE Revolution), slice thickness, or experimental parameters.
4. Click **"Register Study"**. The study will appear in your study list with status `ACTIVE`.

---

## Step 3 — Uploading Chest CT Scans

PulmoVision AI supports two standard medical imaging data formats:
* **NIfTI Format:** `.nii` or compressed `.nii.gz` (single 3D volumetric file).
* **DICOM Series Archive:** A `.zip` archive containing a complete series of `.dcm` slice files.

### Upload Workflow:
1. On the **Studies** page, locate your study row and click **"Upload CT"** (or click into the study and select **"Upload New Scan"**).
2. Choose your input file:
   * Drag and drop your `.nii.gz` or `.zip` file into the upload zone, or click to browse.
3. The server immediately conducts real-time validation:
   * **Format Validation:** Asserts valid DICOM part-10 headers (`DICM` signature) or valid NIfTI-1 magic bytes.
   * **Spatial Orientation & Ordering:** For DICOM archives, parses `ImageOrientationPatient` ($[F_x, F_y, F_z, R_x, R_y, R_z]$) and `ImagePositionPatient` ($\mathbf{P}_i$) to compute slice projection $S_i = \mathbf{P}_i \cdot (\mathbf{F} \times \mathbf{R})$. Automatically detects and handles oblique gantry tilts without slice gaps.
   * **HU Rescale Calibration:** Verifies `RescaleSlope` ($m$) and `RescaleIntercept` ($b$) to ensure correct physical calibration: $\text{HU} = m \cdot \text{pixel} + b$.
   * **Canonical Standard:** Automatically standardizes the internal coordinate frame to **LPS+** (Left-Posterior-Superior) for consistent visualization.
4. Once processed, the modal will display:
   * Matrix dimensions (e.g., $512 \times 512 \times 48$).
   * Voxel spacing in physical mm (e.g., $1.25 \times 1.25 \times 2.50\text{ mm}$).
   * Detected orientation code and HU range.
5. Click **"Open Workstation"** to immediately begin image exploration.

---

## Step 4 — Launching the Radiology Workstation

Select any active scan and click **"Workstation"**. The workstation provides a high-density, low-glare dark radiology interface:

* **Header Toolbar:**
  * Displays active Study Code, Subject ID, Filename, Volume Matrix, and physical voxel spacing.
  * Layout Switcher: **4-Panel Synchronized MPR**, **3-Panel MPR (Axial / Coronal / Sagittal)**, **Split 2D/3D**, **Side-by-Side**, or **Maximized Single Axial**.
  * Fullscreen toggle and global **Reset View** button.
* **Workspace Viewports:**
  * **Axial Viewport:** Cross-sectional slice viewing from inferior to superior.
  * **Coronal Viewport:** Frontal plane reconstruction from anterior to posterior.
  * **Sagittal Viewport:** Lateral plane reconstruction from right to left.
  * **3D Surface Viewport:** Marching Cubes volumetric rendering in continuous physical space.

---

## Step 5 — Multi-Planar Navigation & 2D Image Manipulation

### 1. Slice Scrubbing & Scrolling
* **Mouse Wheel:** Place your cursor over any 2D viewport and roll the mouse wheel up or down to scrub through slices.
* **Slider Bar:** Use the precision scrubber bar at the bottom of each plane viewport (`IM 24/48`).

### 2. Window / Level (W/L) Presets & Manual Adjustments
PulmoVision AI maps 16-bit signed Hounsfield Units (-1024 to +3071 HU) to 8-bit monitor grayscale.
* **Right-Click Drag:** Hold right-click (or Shift + Left Click) and drag inside any viewport:
  * Horizontal drag adjusts **Window Width (WW)** (contrast).
  * Vertical drag adjusts **Window Center (WC)** (brightness).
* **Presets Bar:** Click any standard radiology preset in the workstation toolbar:
  * **Lung Parenchyma:** $\text{WW}: 1500, \text{WC}: -600$ (optimized for alveoli, bronchial walls, and ground-glass opacities).
  * **Mediastinum:** $\text{WW}: 350, \text{WC}: 40$ (optimized for heart, aorta, and lymph nodes).
  * **Thoracic Bone:** $\text{WW}: 2000, \text{WC}: 500$ (optimized for vertebrae, ribs, and sternum).
  * **Soft Tissue:** $\text{WW}: 400, \text{WC}: 50$.

### 3. Synchronized Tri-Planar Crosshairs
* When the **Crosshair tool** is selected, clicking on an anatomical structure (e.g., a nodule or fissure) in the Axial plane immediately updates the Coronal and Sagittal viewports to intersect that exact $(X, Y, Z)$ physical coordinate.

### 4. Quantitative 2D Measurement Calipers
Select any measurement tool from the left toolbar:
* **Distance Ruler:** Click point $A$ and point $B$. The viewport computes the exact Euclidean physical distance:
  $$D = \sqrt{(\Delta x \cdot s_x)^2 + (\Delta y \cdot s_y)^2}\text{ mm}$$
* **Angle Caliper:** Click points $A, B, C$ to compute the anatomical bifurcation angle in degrees.
* **ROI Statistics (Rectangle & Ellipse):** Drag a region of interest to instantly compute real-time mean HU attenuation, standard deviation, and physical area ($\text{mm}^2$).
* **Freehand Drawing & Text Annotations:** Annotate regions for team review.

---

## Step 6 — Executing AI Segmentation

1. In the right-hand **AI Segmentation Control Panel**, review the available neural network models:
   * **`lungmask_r231` (Primary Whole-Lung Engine):**
     * Deep 2D ResNet-34 U-Net (Hofmanninger et al., 2020).
     * Segments **Right Lung** (`#14B8A6`) and **Left Lung** (`#38BDF8`).
     * Robust across severe pulmonary consolidations, COVID-19 GGO, pleural effusions, and surgical resections.
   * **`lungmask_ltrclobes` (Five-Lobe Anatomical Engine):**
     * Fine-grained anatomical compartmentalization trained on NHLBI LTRC data.
     * Segments:
       * **Right Upper Lobe (RUL)** (`#38BDF8`)
       * **Right Middle Lobe (RML)** (`#F59E0B`)
       * **Right Lower Lobe (RLL)** (`#EC4899`)
       * **Left Upper Lobe (LUL)** (`#14B8A6`)
       * **Left Lower Lobe (LLL)** (`#8B5CF6`)
2. Select your desired model from the dropdown.
3. **Configure Batch Size:** Defaults to `4` (optimized for hosts with $\le 8\text{ GB}$ RAM to prevent OOM memory spikes).
4. Click **"Run Segmentation Job"**.
5. The interface will display a real-time progress indicator through the stages:
   * `Initializing Model` $\rightarrow$ `Reorienting to LPS` $\rightarrow$ `Forward Pass Inference` $\rightarrow$ `Morphological Postprocessing` $\rightarrow$ `Extracting 3D Marching Cubes Mesh` $\rightarrow$ `Computing Volumetrics` $\rightarrow$ `Complete`.

---

## Step 7 — Anatomical Contour & 3D Surface Inspection

Once inference finishes, the segmentation mask automatically overlays onto the 2D MPR viewports and renders in the 3D surface view.

### 2D Segmentation Mask Overlay:
* Toggle **AI Mask Overlay** on or off to inspect underlying lung parenchyma.
* Adjust the **Opacity Slider** (e.g., 50% opacity) for transparent contour verification.
* Individual anatomical structure checkboxes allow isolating specific lobes.

### Interactive 3D Surface Reconstruction:
* **Orbit / Turntable:** Left-click and drag to rotate the pulmonary model in 3D space.
* **Pan:** Right-click and drag (or Shift + Left Click) to pan the camera.
* **Zoom:** Scroll the mouse wheel to zoom in on the pulmonary hilum, apex, or costophrenic recesses.
* **Camera Orientation Presets:** Click **ANT** (Anterior), **POST** (Posterior), **R-LAT** (Right Lateral), **L-LAT** (Left Lateral), or **SUP** (Superior) for instant radiological projections.
* **Wireframe Toggle:** Switch to wireframe mode to inspect the triangulated Marching Cubes surface density.
* **Turntable Auto-Rotation:** Toggle continuous slow rotation for team presentation.

---

## Step 8 — Quantitative Parenchymal Volumetrics & HU Attenuation

Navigate to the **Quantitative Analysis** tab or view the summary in the workspace bottom drawer:

1. **Physical Volume Calculation:**
   * Calculated by multiplying the total segmented voxels $N$ by unit voxel volume:
     $$V_{\text{voxel}} = s_x \times s_y \times s_z\text{ mm}^3$$
     $$\text{Volume (mL)} = \frac{N \times V_{\text{voxel}}}{1000.0}$$
   * Outputs **Total Lung Volume**, **Right Lung Volume**, **Left Lung Volume**, and individual lobe percentages.
2. **Hounsfield Unit Attenuation Statistics:**
   * Masks out extrapulmonary tissue and computes voxel intensity distributions:
     * **Mean Attenuation ($\text{HU}$):** Healthy lung parenchyma typically ranges from $-700$ to $-850\text{ HU}$.
     * **Standard Deviation ($\pm\text{HU}$):** Measures tissue heterogeneity (elevated in fibrosis or patchy consolidation).
     * **Density Min / Max:** Highlights hyperdense lesions or emphysematous air trapping.
3. **Interactive Charts:**
   * Visualizes lobar volume distributions and volumetric proportions via color-coded bar charts.

---

## Step 9 — Reference Phantom Evaluation & Metrics

When testing the software against reference ground truth masks (e.g., synthetic phantoms or manual segmentations):

1. The platform automatically calculates peer-reviewed spatial overlap metrics:
   * **Dice Similarity Coefficient (DSC):**
     $$\text{DSC} = \frac{2 |A \cap B|}{|A| + |B|}$$
   * **Intersection over Union (IoU / Jaccard Index):**
     $$\text{IoU} = \frac{|A \cap B|}{|A \cup B|}$$
   * **95th Percentile Hausdorff Distance (HD95):** Measures surface boundary distance in physical millimeters, excluding extreme outlier points.
   * **Average Surface Distance (ASD):** Mean physical distance between segmented and reference boundaries.
   * **Relative Volume Difference (RVD %):** Percentage divergence between predicted and reference volume.

> [!WARNING]
> Synthetic phantom validation verifies mathematical pipeline correctness and geometric coordinate preservation. It does NOT establish clinical diagnostic accuracy on human pathology.

---

## Step 10 — Generating Clinical Research Reports & Exports

Navigate to the **Reports & Export** view:

1. **PDF Comprehensive Research Report:**
   * Click **"Generate PDF Report"**.
   * Produces a formatted document via ReportLab featuring:
     * Study and subject identifiers.
     * CT technical telemetry (dimensions, voxel spacing, slice count, HU range).
     * AI model architecture, package version, citation DOI, and licence.
     * Full quantitative volumetrics table (mL, %, Mean HU, Std HU).
     * Regulatory and scientific disclaimer statement.
2. **JSON Quantitative Metrics:**
   * Click **"Export JSON"** to download raw programmatic metrics for batch statistical analysis in Python, R, or SPSS.
3. **Raw NIfTI Segmentation Mask:**
   * Click **"Download Mask (.nii.gz)"** to export the full 3D UInt8 binary segmentation mask.
   * Preserves exact native matrix size, spacing, direction cosines, and origin for external loading into 3D Slicer, ITK-SNAP, or MONAI.

---

## Step 11 — Managing Studies, Scans & Platform Settings

1. **Study List Filter & Search:**
   * Filter studies by anonymous subject ID, title, or modality.
   * Delete outdated or test studies (cascades cleanly to all associated scans, masks, and generated reports).
2. **Platform Settings & Hardware Telemetry:**
   * Navigate to **Settings** to inspect:
     * Host CPU model, logical cores, and available physical RAM.
     * Peak memory consumption history.
     * Model cache status and verified SHA-256 integrity hashes.
     * Cryptographic audit log tracking all user logins, scan uploads, and report generations.

