"""Typed request and response bodies. These are what the OpenAPI docs describe."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    state: str | None = Field(default=None, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str | None
    state: str | None


class SoilOut(BaseModel):
    city: str
    country: str | None = None
    latitude: float
    longitude: float
    nitrogen: float = Field(description="Total nitrogen, g/kg, 0-5 cm (ISRIC SoilGrids)")
    ph: float
    clay: float = Field(description="Clay content, %")
    organic_carbon: float = Field(description="Organic carbon, g/kg")
    phosphorus: float | None = Field(default=None, description="Only from a soil test")
    potassium: float | None = Field(default=None, description="Only from a soil test")
    source: str = "ISRIC SoilGrids v2.0, 0-5 cm"


class WeatherOut(BaseModel):
    city: str
    days: int
    temperature: float = Field(description="Mean air temperature over the window, °C")
    humidity: float = Field(description="Current relative humidity, %")
    rainfall: float = Field(description="Accumulated rainfall scaled to a 30-day basis, mm")
    source: str = "Open-Meteo"


class Reason(BaseModel):
    text: str
    good: bool


class CropOut(BaseModel):
    crop: str
    confidence: float
    reasons: list[Reason] = []


class PredictIn(BaseModel):
    nitrogen: float = Field(ge=0, le=50)
    ph: float = Field(ge=0, le=14)
    clay: float = Field(ge=0, le=100)
    organic_carbon: float = Field(ge=0, le=200)
    temperature: float = Field(ge=-30, le=60)
    humidity: float = Field(ge=0, le=100)
    rainfall: float = Field(ge=0, le=5000)
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    # Only present when a soil test supplied them; never inferred.
    lab_nitrogen: float | None = Field(default=None, ge=0, le=500)
    lab_phosphorus: float | None = Field(default=None, ge=0, le=500)
    lab_potassium: float | None = Field(default=None, ge=0, le=500)


class PredictOut(BaseModel):
    # "model_" is a reserved prefix in pydantic v2; this field name reads better than the alternatives.
    model_config = ConfigDict(protected_namespaces=())

    crops: list[CropOut]
    model_source: str = Field(description="field = city estimate, lab = your soil test")
    unusual_readings: bool
    prediction_id: int | None = None


class HistoryItem(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: int
    crop: str
    confidence: float
    city: str | None
    model_source: str
    created_at: str
