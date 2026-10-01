from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field as PField

Severity = Literal["red", "amber", "info"]
DocType = Literal["sale_deed", "parent_deed", "ec", "patta", "tslr", "fmb", "a_register", "approval", "tax", "other"]


class CaseIn(BaseModel):
    title: str = PField(min_length=3, max_length=120)
    district: str = PField(min_length=2, max_length=60)
    village: str = PField(min_length=2, max_length=60)
    survey_no: str = PField(min_length=1, max_length=30)

    def model_post_init(self, _):  # trim whitespace
        for k in ("title", "district", "village", "survey_no"):
            setattr(self, k, getattr(self, k).strip())


class FieldModel(BaseModel):
    key: str = PField(max_length=30)
    label: str = PField(max_length=60)
    value: str = PField(max_length=120)
    confidence: float | None = None
    snippet: str | None = PField(default=None, max_length=300)
    sqft: float | None = None
    confirmed: bool = False


class FieldsIn(BaseModel):
    fields: list[FieldModel] = PField(max_length=30)


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    case_id: str
    type: str
    original_name: str
    mime: str
    size: int
    status: Literal["processing", "extracted", "needs_ocr", "failed"]
    error: str | None
    ocr_confidence: float | None
    fields: list[FieldModel]


class EvidenceItem(BaseModel):
    document: str
    value: str
    snippet: str | None = None


class FindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    code: str
    category: str
    severity: Severity
    title: str
    detail: str
    evidence: list[EvidenceItem]
    action: str | None
    status: Literal["open", "reviewed", "dismissed"]
    note: str | None


class FindingPatch(BaseModel):
    status: Literal["open", "reviewed", "dismissed"]
    note: str | None = PField(default=None, max_length=500)


class CategoryScore(BaseModel):
    id: str
    name: str
    weight: int
    score: int | None
    assessed: bool


class ScoreOut(BaseModel):
    overall: int | None
    coverage: int
    categories: list[CategoryScore]


class GeoItem(BaseModel):
    kind: Literal["water", "health", "education", "transport"]
    name: str | None = None
    lat: float
    lng: float
    distance: int


class GeoOut(BaseModel):
    fetched_at: str
    source: str
    items: list[GeoItem]


class CaseOut(BaseModel):
    id: str
    title: str
    district: str
    village: str
    survey_no: str
    lat: float | None
    lng: float | None
    geo: GeoOut | None
    created_at: datetime
    updated_at: datetime
    documents: list[DocumentOut]
    findings: list[FindingOut]
    score: ScoreOut


class CaseRow(BaseModel):
    id: str
    title: str
    district: str
    village: str
    survey_no: str
    updated_at: datetime
    score: int | None
    coverage: int
    docs: int
    open_findings: int


class LocationIn(BaseModel):
    lat: float = PField(ge=6, le=14)  # Tamil Nadu + margin
    lng: float = PField(ge=76, le=81)


class PlaceOut(BaseModel):
    name: str
    lat: float
    lng: float


class ChatIn(BaseModel):
    message: str = PField(min_length=1, max_length=2000)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    role: str
    content: str


class SourceOut(BaseModel):
    name: str
    status: Literal["live", "not_configured", "not_connected"]
    note: str
