from datetime import datetime, timedelta
import json
import random


class MockBusinessData:
    """Mock业务数据服务，模拟其他微服务接口"""
    
    @staticmethod
    def get_sales_data(store_id: int, date: str = None) -> dict:
        """获取销售数据"""
        if date is None:
            date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        mock_sales = {
            1: {
                "store_id": 1,
                "sales_date": date,
                "total_orders": 45,
                "total_income": 12450.50,
                "total_profit": 3200.00,
                "details": [
                    {"sku_id": 101, "sku_name": "可口可乐 330ml", "sku_amount": 120, "sku_income": 600.00, "sku_profit": 300.00},
                    {"sku_id": 102, "sku_name": "薯片原味 75g", "sku_amount": 80, "sku_income": 680.00, "sku_profit": 360.00},
                    {"sku_id": 103, "sku_name": "矿泉水 500ml", "sku_amount": 150, "sku_income": 300.00, "sku_profit": 180.00}
                ]
            },
            2: {
                "store_id": 2,
                "sales_date": date,
                "total_orders": 38,
                "total_income": 9800.00,
                "total_profit": 2600.00,
                "details": [
                    {"sku_id": 101, "sku_name": "可口可乐 330ml", "sku_amount": 90, "sku_income": 450.00, "sku_profit": 225.00},
                    {"sku_id": 103, "sku_name": "矿泉水 500ml", "sku_amount": 200, "sku_income": 400.00, "sku_profit": 240.00}
                ]
            }
        }
        
        return mock_sales.get(store_id, {"store_id": store_id, "sales_date": date, "total_orders": 0, "total_income": 0.0, "total_profit": 0.0, "details": []})
    
    @staticmethod
    def get_traffic_data(store_id: int, date: str = None) -> dict:
        """获取客流数据"""
        if date is None:
            date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        mock_traffic = {
            1: {
                "store_id": 1,
                "date": date,
                "total_enter": 320,
                "total_leave": 315,
                "peak_hour": "14:00-15:00",
                "peak_count": 45,
                "avg_stay_duration": 18.5,
                "hourly_data": [
                    {"hour": "09:00", "enter": 15, "leave": 12},
                    {"hour": "10:00", "enter": 25, "leave": 22},
                    {"hour": "11:00", "enter": 35, "leave": 30},
                    {"hour": "12:00", "enter": 42, "leave": 38},
                    {"hour": "13:00", "enter": 38, "leave": 35},
                    {"hour": "14:00", "enter": 45, "leave": 42},
                    {"hour": "15:00", "enter": 32, "leave": 30},
                    {"hour": "16:00", "enter": 28, "leave": 26},
                    {"hour": "17:00", "enter": 30, "leave": 28},
                    {"hour": "18:00", "enter": 20, "leave": 18},
                    {"hour": "19:00", "enter": 10, "leave": 9}
                ]
            },
            2: {
                "store_id": 2,
                "date": date,
                "total_enter": 250,
                "total_leave": 245,
                "peak_hour": "12:00-13:00",
                "peak_count": 38,
                "avg_stay_duration": 15.2,
                "hourly_data": []
            }
        }
        
        return mock_traffic.get(store_id, {"store_id": store_id, "date": date, "total_enter": 0, "total_leave": 0, "peak_hour": "", "peak_count": 0, "avg_stay_duration": 0.0, "hourly_data": []})
    
    @staticmethod
    def get_inventory_data(store_id: int) -> dict:
        """获取库存数据"""
        mock_inventory = {
            1: {
                "store_id": 1,
                "items": [
                    {"sku_id": 101, "sku_name": "可口可乐 330ml", "actual_quantity": 23, "std_cost": 2.50, "sug_price": 5.00},
                    {"sku_id": 102, "sku_name": "薯片原味 75g", "actual_quantity": 156, "std_cost": 4.00, "sug_price": 8.50},
                    {"sku_id": 103, "sku_name": "矿泉水 500ml", "actual_quantity": 48, "std_cost": 0.80, "sug_price": 2.00}
                ]
            },
            2: {
                "store_id": 2,
                "items": [
                    {"sku_id": 101, "sku_name": "可口可乐 330ml", "actual_quantity": 15, "std_cost": 2.50, "sug_price": 5.00},
                    {"sku_id": 103, "sku_name": "矿泉水 500ml", "actual_quantity": 30, "std_cost": 0.80, "sug_price": 2.00}
                ]
            }
        }
        
        return mock_inventory.get(store_id, {"store_id": store_id, "items": []})
    
    @staticmethod
    def get_store_info(store_id: int) -> dict:
        """获取门店信息"""
        mock_stores = {
            1: {"store_id": 1, "store_code": "S001", "store_name": "葵涌旗舰店", "store_location": "香港新界葵涌葵涌道123号", "store_area": 150.0},
            2: {"store_id": 2, "store_code": "S002", "store_name": "旺角分店", "store_location": "香港九龙旺角西洋菜南街88号", "store_area": 98.5}
        }
        return mock_stores.get(store_id, {"store_id": store_id, "store_code": "", "store_name": "", "store_location": "", "store_area": 0.0})

    @staticmethod
    def get_business_context(store_id: int) -> str:
        """获取业务上下文数据（用于提示词拼接）"""
        sales = MockBusinessData.get_sales_data(store_id)
        traffic = MockBusinessData.get_traffic_data(store_id)
        inventory = MockBusinessData.get_inventory_data(store_id)
        store = MockBusinessData.get_store_info(store_id)
        
        context = f"""门店信息：
- 门店ID：{store['store_id']}
- 门店名称：{store['store_name']}
- 门店面积：{store['store_area']}平方米

销售数据：
- 订单总数：{sales['total_orders']}单
- 总收入：{sales['total_income']}元
- 总利润：{sales['total_profit']}元
- 销售明细：{json.dumps(sales['details'], ensure_ascii=False)}

客流数据：
- 进店人数：{traffic['total_enter']}人
- 离店人数：{traffic['total_leave']}人
- 峰值时段：{traffic['peak_hour']}
- 峰值人数：{traffic['peak_count']}人
- 平均停留时长：{traffic['avg_stay_duration']}分钟

库存数据：
{json.dumps(inventory['items'], ensure_ascii=False)}
"""
        return context

    @staticmethod
    def get_historical_sales(store_id: int, sku_id: int, days: int = 30) -> list:
        """获取某个门店某个SKU的历史每日销售量时序数据"""
        base_sales = {
            (1, 101): {"base": 120, "trend": 1.5, "noise": 10},
            (1, 102): {"base": 80, "trend": -0.5, "noise": 8},
            (1, 103): {"base": 150, "trend": 2.0, "noise": 15},
            (2, 101): {"base": 90, "trend": 0.8, "noise": 7},
            (2, 103): {"base": 200, "trend": 1.2, "noise": 12},
        }

        config = base_sales.get((store_id, sku_id), {"base": 50, "trend": 0, "noise": 5})

        random.seed(store_id * 1000 + sku_id)

        result = []
        today = datetime.now()
        for i in range(days, 0, -1):
            date = today - timedelta(days=i)
            weekday = date.weekday()
            weekend_factor = 1.3 if weekday >= 5 else 1.0
            value = (config["base"] + config["trend"] * (days - i)) * weekend_factor
            value += random.uniform(-config["noise"], config["noise"])
            value = max(0, round(value, 1))

            result.append({
                "date": date.strftime("%Y-%m-%d"),
                "value": value,
            })

        random.seed()
        return result

    @staticmethod
    def get_all_sku_ids(store_id: int) -> list:
        """获取某个门店的所有SKU列表（含名称和当前库存）"""
        inventory = MockBusinessData.get_inventory_data(store_id)
        sales = MockBusinessData.get_sales_data(store_id)

        sku_map = {}
        for item in inventory.get("items", []):
            sku_map[item["sku_id"]] = {
                "sku_id": item["sku_id"],
                "sku_name": item.get("sku_name", ""),
                "current_stock": item.get("actual_quantity", 0),
            }
        for item in sales.get("details", []):
            if item["sku_id"] not in sku_map:
                sku_map[item["sku_id"]] = {
                    "sku_id": item["sku_id"],
                    "sku_name": item.get("sku_name", ""),
                    "current_stock": 0,
                }

        return list(sku_map.values())
