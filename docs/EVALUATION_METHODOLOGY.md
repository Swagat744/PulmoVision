# PulmoVision AI — Quantitative Morphometry & Evaluation Methodology (`EVALUATION_METHODOLOGY.md`)

Implemented in `backend/app/ml/metrics.py`.

---

## 1. Geometry-Aware Physical Volumetric Calculations

PulmoVision AI computes physical lung volumes strictly from the verified voxel spacing $(\Delta x, \Delta y, \Delta z)$ in millimetres ($\text{mm}$):

1. **Single Voxel Physical Volume ($\text{mm}^3$):**
   $$V_{\text{voxel}} = \Delta x \times \Delta y \times \Delta z \quad (\text{mm}^3)$$
2. **Anatomical Structure Physical Volume ($\text{mm}^3$ and $\text{mL}$):**
   For any anatomical label $k \in \{1, \dots, K\}$ with segmented voxel count $N_k = \sum_{z,y,x} \mathbb{I}(M(z,y,x) = k)$:
   $$V_k(\text{mm}^3) = N_k \times V_{\text{voxel}}$$
   $$V_k(\text{mL}) = \frac{N_k \times V_{\text{voxel}}}{1000.0}$$
3. **Total Bilateral Lung Volume ($\text{mL}$):**
   $$N_{\text{total}} = \sum_{z,y,x} \mathbb{I}(M(z,y,x) > 0), \qquad V_{\text{total}}(\text{mL}) = \frac{N_{\text{total}} \times V_{\text{voxel}}}{1000.0}$$
4. **Relative Structure Fraction ($\text{\%}$):**
   $$F_k(\%) = \frac{N_k}{N_{\text{total}}} \times 100\%$$

---

## 2. Parenchymal Radiodensity Statistics (Hounsfield Units)

For each segmented region $\Omega_k = \{(z,y,x) \mid M(z,y,x) = k\}$, PulmoVision AI computes calibrated Hounsfield Unit statistics:
$$\mu_{\text{HU}, k} = \frac{1}{|\Omega_k|} \sum_{v \in \Omega_k} \text{HU}(v), \qquad \sigma_{\text{HU}, k} = \sqrt{\frac{1}{|\Omega_k|} \sum_{v \in \Omega_k} \left(\text{HU}(v) - \mu_{\text{HU}, k}\right)^2}$$

---

## 3. Reference Annotation Evaluation Metrics (`evaluate_against_reference_mask`)

When a ground-truth reference mask $G$ is available alongside predicted mask $P$, `evaluate_against_reference_mask()` computes:

1. **Dice Similarity Coefficient (DSC):**
   $$\text{DSC}(P, G) = \frac{2 |P \cap G|}{|P| + |G|}$$
2. **Jaccard Intersection-over-Union (IoU):**
   $$\text{IoU}(P, G) = \frac{|P \cap G|}{|P \cup G|}$$
3. **Relative Volume Difference ($\text{RVD}$):**
   $$\text{RVD}(\%) = \frac{|P| - |G|}{|G|} \times 100\%$$
4. **95th-Percentile Hausdorff Distance ($\text{HD}_{95}$ in $\text{mm}$):**
   Computed via anisotropic Euclidean Distance Transform (`scipy.ndimage.distance_transform_edt` with `sampling=(sz, sy, sx)`):
   $$\text{HD}_{95}(P, G) = \text{P}_{95}\left(\{d(p, G) \mid p \in \partial P\} \cup \{d(g, P) \mid g \in \partial G\}\right)$$

