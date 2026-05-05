from pydantic import BaseModel, Field
from typing import Optional


class TrafficUpdate(BaseModel):
    event: str
    store_id: int
    data: dict


class CurrentPeopleCount(BaseModel):
    current_people_count: int


class TrafficSnapshotRequest(BaseModel):
    store_id: int = Field(..., description="门店ID，严格对应 STORE 表的主键")
    current_people_count: int = Field(..., ge=0, description="当前画面人数")
    timestamp: int = Field(..., description="本地毫秒级时间戳")


class TrafficBatchRequest(BaseModel):
    store_id: int = Field(..., description="门店ID")
    customer_start_time: str = Field(..., description="ISO8601格式开始时间")
    customer_end_time: str = Field(..., description="ISO8601格式结束时间")
    customer_enter_total: int = Field(..., ge=0, description="累计进店人数")
    customer_leave_total: int = Field(..., ge=0, description="累计出店人数")


class ApiResponse(BaseModel):
    code: int
    message: str
    data: Optional[dict] = None
