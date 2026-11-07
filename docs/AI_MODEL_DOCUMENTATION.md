# PulmoVision AI — AI Segmentation Model Documentation (`AI_MODEL_DOCUMENTATION.md`)

## 1. Scientific & Engineering Selection

PulmoVision AI integrates the peer-reviewed **`lungmask` (`v0.2.22`)** segmentation suite developed at the Computational Imaging Research Lab, Medical University of Vienna:
* **Citation:** Hofmanninger, J., Prayer, F., Pan, J. et al. *"Automatic lung segmentation in routine imaging is primarily a data diversity problem, not a methodology problem."* European Radiology Experimental 4, 50 (2020). DOI: [`10.1186/s41747-020-00173-2`](https://doi.org/10.1186/s41747-020-00173-2).
* **SPDX License:** `Apache-2.0`.
* **No Fake or Unverified Fallbacks:** Unverified standalone U-Net fallbacks are strictly prohibited. If verified model weights (`unet_r231-d5d2fc3d.pth` or `unet_ltrclobes-3a07043d.pth`) are not present and cannot be downloaded and verified by SHA-256 checksum, the job fails explicitly with `ModelWeightsUnavailableError`.

---

## 2. Registered Models & Label Semantics

### 2.1 Primary MVP Engine: `lungmask_r231` (Whole Lung + Bilateral Left/Right Separation)
* **Architecture:** 2D U-Net (`depth=5`, `batch_norm=True`, `up_mode="upsample"`, `padding=True`, 3 output classes).
* **Weights File:** `unet_r231-d5d2fc3d.pth` (`124,340,403` bytes, SHA-256 prefix `d5d2fc3d`).
* **Training Data:** 231 clinical routine chest CT volumes covering healthy parenchyma, pleural effusions, severe consolidations, ground-glass opacities, tumors, and diverse scanner protocols.
* **Output Label Mapping:**
  * `0` — Background / Extrapulmonary tissue & main trachea
  * `1` — **Right Lung** (`#38BDF8`)
  * `2` — **Left Lung** (`#14B8A6`)

### 2.2 Secondary Engine: `lungmask_ltrclobes` (Five Pulmonary Lobes)
* **Architecture:** 2D U-Net (`depth=5`, `batch_norm=True`, `up_mode="upsample"`, 6 output classes).
* **Weights File:** `unet_ltrclobes-3a07043d.pth` (`124,338,462` bytes, SHA-256 prefix `3a07043d`).
* **Training Data:** NHLBI Lung Tissue Research Consortium (LTRC) dataset.
* **Output Label Mapping:**
  * `0` — Background
  * `1` — **Left Upper Lobe (LUL)** (`#14B8A6`)
  * `2` — **Left Lower Lobe (LLL)** (`#A855F7`)
  * `3` — **Right Upper Lobe (RUL)** (`#38BDF8`)
  * `4` — **Right Middle Lobe (RML)** (`#F59E0B`)
  * `5` — **Right Lower Lobe (RLL)** (`#EC4899`)

---

## 3. Inference Pipeline & Windows SSL Mitigation

Implemented in `backend/app/ml/adapters/lungmask_adapter.py`:
1. **Verified Weight Caching:** On Windows Python 3.12, `torch.hub.load_state_dict_from_url` (`urllib.request`) fails SSL certificate verification when connecting to GitHub Releases unless `certifi` is injected. `LungMaskAdapter.ensure_weights_available()` downloads the `.pth` file using `requests` with `certifi.where()`, verifies the exact byte size and SHA-256 prefix, and passes `modelpath` directly to `lungmask.mask.get_model()`.
2. **Preprocessing:** Reorients input `SimpleITK.Image` to canonical `"LPS"`, extracts the body-wall bounding box per axial slice, resizes to $256 \times 256$, clamps HU $> 600$ to $600$, and normalizes via $(\text{HU} + 1024) / 1624$.
3. **Memory-Safe CPU Forward Pass:** Executes under `torch.inference_mode()` with `batch_size=4` and `torch.set_num_threads(6)`.
4. **3D Connected-Component Postprocessing:** Calls `lungmask.utils.postprocessing()` and `fill_voids` to eliminate spurious extrapulmonary components and fill internal vascular holes.
5. **Native Geometry Restoration:** Reshapes slices back to native matrix dimensions, reorients to the input acquisition orientation if non-LPS, applies `mask_sitk.CopyInformation(native_image)`, and asserts exact equivalence of `Origin`, `Spacing`, `Direction`, and `Size`.

---

## 4. Empirical Hardware Benchmark Telemetry (Verified on Development Host)

Recorded by `backend/scripts/benchmark_pipeline.py` on **HP-SWAGAT** (`12th Gen Intel Core i5-1235U`, 10 cores / 12 logical processors, **7.68 GB physical RAM**, Windows 11):

| Benchmark Tier | Volume Shape ($Z \times Y \times X$) | Batch Size | Total Inference Time | Per-Slice Latency | 3D Marching Cubes Time | Peak Process RSS | Geometry Verified | Dice vs. Phantom GT |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Tier 1** | $32 \times 256 \times 256$ | `4` | **32.68 s** | `1021.1 ms` | `0.202 s` | **1,066.64 MB** | `True` | **0.9764** |
| **Tier 2** | $64 \times 256 \times 256$ | `4` | **61.32 s** | `958.2 ms` | `0.379 s` | **1,105.12 MB** | `True` | **0.9769** |

---

## 5. Known Technical & Clinical Limitations
* **Slice-by-Slice 2D Context:** Because the U-Net processes 2D axial slices ($256 \times 256$) prior to 3D morphological postprocessing, extreme sagittal/coronaltruncation where the thoracic wall does not enclose the lung can degrade boundary accuracy.
* **Lobar Fissure Visibility (`LTRCLobes`):** When dense consolidation or massive effusion crosses an interlobar fissure, lobar boundary localization is less reliable than bilateral (`R231`) segmentation.
* **Scope Guardrail:** These models segment anatomical lung parenchyma and lobes; they do **not** classify pulmonary nodules, malignancy, or clinical diagnoses.

