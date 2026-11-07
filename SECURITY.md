# Security & Data Privacy Policy

## Reporting a Security Vulnerability

The PulmoVision AI maintainers take security and patient data privacy seriously. If you discover a security vulnerability, flaw in access controls, or potential data leak risk, please do not file a public GitHub issue.

Instead, please submit a vulnerability report directly via **GitHub Private Vulnerability Reporting** on the repository page:
[https://github.com/Swagat744/PulmoVision/security/advisories](https://github.com/Swagat744/PulmoVision/security/advisories)

Include:
- A description of the issue and potential impact.
- Step-by-step reproduction instructions or a minimal proof of concept.
- Affected components (backend endpoints, frontend UI, authentication, or Docker infrastructure).

You will receive an initial response within 48 business hours with an assessment and estimated timeline for a patch.

---

## Medical Data Privacy & Protected Health Information (PHI)

PulmoVision AI is built from the ground up with research privacy principles:

1. **Client-Side & Server-Side De-Identification:**
   - Real patient names, addresses, social security numbers, and hospital IDs must **never** be committed to Git or uploaded without strict de-identification.
   - When creating research studies, use synthetic or hashed subject codes (e.g., `PV-SUBJ-104`).
2. **DICOM Anonymization:**
   - The DICOM ingestion pipeline verifies standard metadata. In clinical deployments, ensure PACS or DICOM nodes run an anonymization pass (removing DICOM tags: `PatientName` [0010,0010], `PatientID` [0010,0020], `PatientBirthDate` [0010,0030], `InstitutionName` [0008,0080]) prior to upload.
3. **Storage Isolation:**
   - Scans and segmentation masks are saved to isolated directory keys (`storage/studies/{study_id}/...`) using non-sequential UUIDs.

---

## Authentication & Cryptographic Keys

- **JWT Secret Key:** The default `JWT_SECRET_KEY` in `.env.example` is strictly a development fallback. In any production or networked deployment, you **must** supply a high-entropy secret (min 32 bytes):
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
- **Password Hashing:** Passwords are never stored in plaintext. PulmoVision AI employs **Argon2id** (`argon2-cffi`) with strict memory and time costs ($t=2, m=102400\text{ KiB}, p=8$).
- **Role-Based Access Control (RBAC):** API endpoints enforce user authentication via Bearer tokens (`Authorization: Bearer <token>`). Studies, scans, and results are isolated by user ownership.
