package app

import "net/http"

func (s *Server) handleSwaggerUI(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/swagger/openapi.json" {
		s.handleOpenAPI(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>store-ops API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/swagger/openapi.json",
      dom_id: "#swagger-ui",
      persistAuthorization: true,
    });
  </script>
</body>
</html>`))
}

func (s *Server) handleOpenAPI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{
  "openapi": "3.0.3",
  "info": {
    "title": "Aegis Store Ops API",
    "version": "0.1.0",
    "description": "门店日常经营服务：销售、库存、调拨状态机。"
  },
  "servers": [
    { "url": "http://localhost:8082" }
  ],
  "components": {
    "securitySchemes": {
      "bearerAuth": { "type": "http", "scheme": "bearer", "bearerFormat": "JWT" }
    },
    "schemas": {
      "ApiEnvelope": {
        "type": "object",
        "properties": {
          "code": { "type": "integer", "example": 0 },
          "message": { "type": "string", "example": "ok" },
          "data": { "nullable": true }
        }
      },
      "SalesDetailReq": {
        "type": "object",
        "required": ["sku_id", "sku_amount", "sku_income", "sku_profit"],
        "properties": {
          "sku_id": { "type": "integer", "example": 101 },
          "sku_amount": { "type": "integer", "example": 1 },
          "sku_income": { "type": "number", "example": 5.0 },
          "sku_profit": { "type": "number", "example": 2.5 }
        }
      },
      "SalesDailyReq": {
        "type": "object",
        "required": ["store_id", "sales_date", "total_orders", "total_income", "total_profit", "details"],
        "properties": {
          "store_id": { "type": "integer", "example": 1 },
          "sales_date": { "type": "string", "example": "2026-05-06" },
          "total_orders": { "type": "integer", "example": 1 },
          "total_income": { "type": "number", "example": 5.0 },
          "total_profit": { "type": "number", "example": 2.5 },
          "force_overwrite": { "type": "boolean", "example": false },
          "details": {
            "type": "array",
            "items": { "$ref": "#/components/schemas/SalesDetailReq" }
          }
        }
      },
      "InventoryAdjustReq": {
        "type": "object",
        "required": ["store_id", "sku_id", "actual_quantity", "inventory_diagonsis_result_type", "inventory_root_cause"],
        "properties": {
          "store_id": { "type": "integer", "example": 1 },
          "sku_id": { "type": "integer", "example": 101 },
          "actual_quantity": { "type": "integer", "example": 20 },
          "inventory_diagonsis_result_type": { "type": "string", "enum": ["Normal", "Shortage", "Unsale"], "example": "Shortage" },
          "inventory_root_cause": { "type": "object", "example": { "reason": "盘点修正" } },
          "remark": { "type": "string", "example": "盘点确认" }
        }
      },
      "TransferDetailReq": {
        "type": "object",
        "required": ["sku_id", "suggested_qty", "actual_qty", "transfer_direction"],
        "properties": {
          "sku_id": { "type": "integer", "example": 101 },
          "suggested_qty": { "type": "integer", "example": 5 },
          "actual_qty": { "type": "integer", "example": 5 },
          "transfer_direction": { "type": "string", "enum": ["H2S", "S2H"], "example": "H2S" }
        }
      },
      "TransferCreateReq": {
        "type": "object",
        "required": ["store_id", "details"],
        "properties": {
          "store_id": { "type": "integer", "example": 1 },
          "details": {
            "type": "array",
            "items": { "$ref": "#/components/schemas/TransferDetailReq" }
          }
        }
      },
      "QtyUpdateReq": {
        "type": "object",
        "properties": {
          "details": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["detail_id", "actual_qty"],
              "properties": {
                "detail_id": { "type": "integer", "example": 501 },
                "actual_qty": { "type": "integer", "example": 5 }
              }
            }
          }
        }
      },
      "FeedbackReq": {
        "type": "object",
        "required": ["feedback"],
        "properties": {
          "feedback": { "type": "string", "example": "库容不足，建议调减数量" }
        }
      }
    }
  },
  "security": [{ "bearerAuth": [] }],
  "paths": {
    "/health": {
      "get": {
        "summary": "健康检查",
        "security": [],
        "responses": {
          "200": { "description": "ok" },
          "503": { "description": "database unavailable" }
        }
      }
    },
    "/api/sales/daily": {
      "get": {
        "summary": "查询销售流水列表",
        "parameters": [
          { "name": "store_id", "in": "query", "schema": { "type": "integer" } },
          { "name": "sales_date", "in": "query", "schema": { "type": "string", "example": "2026-05-06" } },
          { "name": "start_date", "in": "query", "schema": { "type": "string", "example": "2026-05-01" } },
          { "name": "end_date", "in": "query", "schema": { "type": "string", "example": "2026-05-06" } },
          { "name": "page", "in": "query", "schema": { "type": "integer", "default": 1 } },
          { "name": "limit", "in": "query", "schema": { "type": "integer", "default": 10 } }
        ],
        "responses": { "200": { "description": "ok" }, "401": { "description": "token invalid" }, "403": { "description": "forbidden" } }
      },
      "post": {
        "summary": "提交销售流水并扣减库存（Store）",
        "requestBody": {
          "required": true,
          "content": { "application/json": { "schema": { "$ref": "#/components/schemas/SalesDailyReq" } } }
        },
        "responses": { "200": { "description": "销售流水提交成功" }, "400": { "description": "参数错误 / 补录超限 / 库存不足" } }
      }
    },
    "/api/sales/daily/{sales_id}": {
      "get": {
        "summary": "获取销售流水详情",
        "parameters": [
          { "name": "sales_id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "responses": { "200": { "description": "ok" } }
      },
      "put": {
        "summary": "修改销售流水并重算库存（Store）",
        "parameters": [
          { "name": "sales_id", "in": "path", "required": true, "schema": { "type": "integer" } }
        ],
        "requestBody": {
          "required": true,
          "content": { "application/json": { "schema": { "$ref": "#/components/schemas/SalesDailyReq" } } }
        },
        "responses": { "200": { "description": "更新成功" } }
      }
    },
    "/api/inventory": {
      "get": {
        "summary": "查询库存列表",
        "parameters": [
          { "name": "store_id", "in": "query", "schema": { "type": "integer" } },
          { "name": "keyword", "in": "query", "schema": { "type": "string" } },
          { "name": "category_id", "in": "query", "schema": { "type": "integer" } },
          { "name": "low_stock", "in": "query", "schema": { "type": "boolean" } },
          { "name": "page", "in": "query", "schema": { "type": "integer", "default": 1 } },
          { "name": "limit", "in": "query", "schema": { "type": "integer", "default": 10 } }
        ],
        "responses": { "200": { "description": "ok" } }
      }
    },
    "/api/inventory/adjust": {
      "post": {
        "summary": "库存盘点修正（Store）",
        "requestBody": {
          "required": true,
          "content": { "application/json": { "schema": { "$ref": "#/components/schemas/InventoryAdjustReq" } } }
        },
        "responses": { "200": { "description": "库存修正成功" }, "400": { "description": "修正幅度过大或参数错误" }, "423": { "description": "SKU 被调拨锁定" } }
      }
    },
    "/api/transfers": {
      "get": {
        "summary": "查询调拨单列表",
        "parameters": [
          { "name": "store_id", "in": "query", "schema": { "type": "integer" } },
          { "name": "status", "in": "query", "schema": { "type": "string", "enum": ["ai_generated", "pending_approval", "issued_pending_confirmation", "in_negotiation", "confirmed_executed", "cancelled"] } },
          { "name": "start_date", "in": "query", "schema": { "type": "string" } },
          { "name": "end_date", "in": "query", "schema": { "type": "string" } },
          { "name": "page", "in": "query", "schema": { "type": "integer", "default": 1 } },
          { "name": "limit", "in": "query", "schema": { "type": "integer", "default": 10 } }
        ],
        "responses": { "200": { "description": "ok" } }
      },
      "post": {
        "summary": "总部创建调拨单（Head，初始 pending_approval）",
        "requestBody": {
          "required": true,
          "content": { "application/json": { "schema": { "$ref": "#/components/schemas/TransferCreateReq" } } }
        },
        "responses": { "200": { "description": "调拨单创建成功" } }
      }
    },
    "/api/transfers/{order_id}/issue": {
      "patch": {
        "summary": "总部下发调拨单：pending_approval -> issued_pending_confirmation",
        "parameters": [{ "name": "order_id", "in": "path", "required": true, "schema": { "type": "integer" } }],
        "responses": { "200": { "description": "调拨单已下发" }, "400": { "description": "状态流转非法" } }
      }
    },
    "/api/transfers/{order_id}/acknowledge": {
      "patch": {
        "summary": "门店确认调拨并执行库存回写：issued_pending_confirmation -> confirmed_executed",
        "parameters": [{ "name": "order_id", "in": "path", "required": true, "schema": { "type": "integer" } }],
        "requestBody": { "required": false, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/QtyUpdateReq" } } } },
        "responses": { "200": { "description": "调拨单已确认，库存已同步更新" } }
      }
    },
    "/api/transfers/{order_id}/feedback": {
      "patch": {
        "summary": "门店提交异议：issued_pending_confirmation -> in_negotiation",
        "parameters": [{ "name": "order_id", "in": "path", "required": true, "schema": { "type": "integer" } }],
        "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/FeedbackReq" } } } },
        "responses": { "200": { "description": "异议已提交" } }
      }
    },
    "/api/transfers/{order_id}/confirm": {
      "patch": {
        "summary": "总部协商后重新下发：in_negotiation -> issued_pending_confirmation",
        "parameters": [{ "name": "order_id", "in": "path", "required": true, "schema": { "type": "integer" } }],
        "requestBody": { "required": false, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/QtyUpdateReq" } } } },
        "responses": { "200": { "description": "已修改调拨数量并重新下发" } }
      }
    },
    "/api/transfers/{order_id}/cancel": {
      "patch": {
        "summary": "总部作废非终态调拨单",
        "parameters": [{ "name": "order_id", "in": "path", "required": true, "schema": { "type": "integer" } }],
        "responses": { "200": { "description": "调拨单已作废" } }
      }
    }
  }
}`))
}
