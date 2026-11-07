"""Physical-space (mm) 3D anatomical surface mesh generation via Marching Cubes."""
from typing import Any, Dict, List

import numpy as np
from scipy.ndimage import gaussian_filter
import SimpleITK as sitk
from skimage.measure import marching_cubes


def extract_anatomical_3d_meshes(
    lps_mask_image: sitk.Image,
    label_map: Dict[str, Any],
    step_size: int = 2,
) -> Dict[str, Any]:
    """
    Extract 3D surface triangle meshes in physical millimetre (mm) coordinates
    from the canonical LPS+ segmentation mask using Lewiner Marching Cubes.

    Coordinates are centered at the volume physical center so orbital camera
    rotation in Three.js pivots around the anatomical thoracic center.
    """
    mask_zyx = sitk.GetArrayFromImage(lps_mask_image).astype(np.uint8)
    nz, ny, nx = mask_zyx.shape
    sx, sy, sz = lps_mask_image.GetSpacing()
    spacing_zyx = (float(sz), float(sy), float(sx))

    # Physical center of the volume in mm
    center_z_mm = 0.5 * (nz - 1) * float(sz)
    center_y_mm = 0.5 * (ny - 1) * float(sy)
    center_x_mm = 0.5 * (nx - 1) * float(sx)

    # Adapt step_size for small vs large volumes
    effective_step = 1 if max(nz, ny, nx) <= 128 else step_size

    structures_out: List[Dict[str, Any]] = []

    for lbl_str, meta in sorted(label_map.items(), key=lambda kv: int(kv[0])):
        lbl_id = int(lbl_str)
        binary = (mask_zyx == lbl_id).astype(np.float32)
        voxel_count = int(np.count_nonzero(binary))
        if voxel_count < 12:
            continue

        # Light Gaussian smoothing (sigma=0.85) eliminates staircase voxel artifacts
        smoothed = gaussian_filter(binary, sigma=0.85)
        if float(np.max(smoothed)) <= 0.42:
            smoothed = binary

        try:
            verts_zyx, faces, normals_zyx, _ = marching_cubes(
                smoothed,
                level=0.42,
                spacing=spacing_zyx,
                step_size=effective_step,
                allow_degenerate=False,
            )
        except Exception:
            continue

        # Convert from (Z_mm, Y_mm, X_mm) in LPS+ to Three.js scene coordinates:
        # Three.js X = Patient Right->Left (X_mm - center_x_mm)
        # Three.js Y = Inferior->Superior (Z_mm - center_z_mm, so Superior head is UP +Y!)
        # Three.js Z = Posterior->Anterior (-(Y_mm - center_y_mm), so Anterior chest faces camera +Z!)
        vx = verts_zyx[:, 2] - center_x_mm
        vy = verts_zyx[:, 0] - center_z_mm
        vz = -(verts_zyx[:, 1] - center_y_mm)
        verts_xyz = np.column_stack((vx, vy, vz)).astype(np.float32)

        nx_vec = normals_zyx[:, 2]
        ny_vec = normals_zyx[:, 0]
        nz_vec = -normals_zyx[:, 1]
        normals_xyz = np.column_stack((nx_vec, ny_vec, nz_vec)).astype(np.float32)

        structures_out.append(
            {
                "label_id": lbl_id,
                "structure_key": str(meta["key"]),
                "display_name": str(meta["name"]),
                "color_hex": str(meta["color"]),
                "vertex_count": int(verts_xyz.shape[0]),
                "face_count": int(faces.shape[0]),
                "vertices_flat": np.round(verts_xyz.flatten(), 2).tolist(),
                "normals_flat": np.round(normals_xyz.flatten(), 3).tolist(),
                "faces_flat": faces.astype(np.int32).flatten().tolist(),
            }
        )

    return {
        "coordinate_system": "LPS_MM_CENTERED_THREEJS_Y_UP",
        "volume_dimensions_xyz": [int(nx), int(ny), int(nz)],
        "spacing_xyz_mm": [round(float(sx), 4), round(float(sy), 4), round(float(sz), 4)],
        "structures": structures_out,
    }

