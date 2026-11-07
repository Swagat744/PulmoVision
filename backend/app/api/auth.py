"""Authentication API endpoints: registration, login, and profile retrieval."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, record_audit_event
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db
from app.models.entities import User
from app.schemas.dtos import (
    TokenResponseDTO,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponseDTO,
)


router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponseDTO, status_code=status.HTTP_201_CREATED)
def register_user(
    payload: UserRegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponseDTO:
    """Register a new researcher/clinician account and return an active JWT session."""
    normalized_email = payload.email.strip().lower()
    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    user = User(
        email=normalized_email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name.strip(),
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    record_audit_event(
        db=db,
        action="USER_REGISTERED",
        resource_type="user",
        resource_id=user.id,
        user_id=user.id,
        details={"email": user.email, "role": user.role},
        request=request,
    )

    token = create_access_token(subject=user.id, role=user.role)
    return TokenResponseDTO(
        access_token=token,
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        user=UserResponseDTO.model_validate(user),
    )


@router.post("/login", response_model=TokenResponseDTO)
def login_user(
    payload: UserLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponseDTO:
    """Authenticate user credentials and return a signed JWT Bearer token."""
    normalized_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        record_audit_event(
            db=db,
            action="USER_LOGIN_FAILED",
            resource_type="user",
            details={"email": normalized_email},
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled.",
        )

    record_audit_event(
        db=db,
        action="USER_LOGIN_SUCCESS",
        resource_type="user",
        resource_id=user.id,
        user_id=user.id,
        details={"email": user.email},
        request=request,
    )

    token = create_access_token(subject=user.id, role=user.role)
    return TokenResponseDTO(
        access_token=token,
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        user=UserResponseDTO.model_validate(user),
    )


@router.get("/me", response_model=UserResponseDTO)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponseDTO:
    """Return the currently authenticated user profile."""
    return UserResponseDTO.model_validate(current_user)

