from app.services.lstm_predictor import lstm_predictor
from app.services.weather_service import weather_service
from app.services.news_service import news_service
from app.services.gemini_service import gemini_service
from app.config import settings
import uuid

class RiskEngine:
    def __init__(self):
        self.threshold = settings.RISK_THRESHOLD_REROUTE
        
    async def evaluate_shipment_risk(self, shipment: dict) -> dict:
        """
        Evaluates a single shipment on the fly.
        Formula: R = (Weather_Severity * 40) + (News_Severity * 30) + (Delay_Penalty * 30)
        LSTM Multiplier: R_final = R * (1 + S)
        Where S is the predicted danger severity from LSTM (0.0 to 1.0)
        """
        # Current status payload
        pos = shipment.get("currentPosition")
        if not pos:
            return {"riskScore": 10.0, "status": "safe", "alert": None}
            
        lat, lng = pos.get("lat"), pos.get("lng")
        curr_stage = shipment.get("currentStage", "transit")
        
        # 1. Fetch real-time environmental context
        weather_data = await weather_service.get_weather(lat, lng)
        w_severity = weather_data.get("severity_index", 0.1)
        w_desc = weather_data.get("condition", "clear")
        
        news_data = await news_service.get_regional_news("Supply Chain India")
        n_severity = 0.5 if len(news_data) > 0 else 0.1
        
        # Pseudo delay logic for prototype
        delay_hrs = 2.0
        d_severity = min(delay_hrs / 10.0, 1.0)
        
        # Calculate Base Rule-Engine Score (out of 100)
        rule_score = (w_severity * 40) + (n_severity * 30) + (d_severity * 30)
        
        # 2. Feed sequence to LSTM brain for future cascade factor
        # Format: last 7 days of [weather, delay, congestion]
        # In a full prod system, we would fetch historical sequence from timeseries DB.
        # For prototype, we generate a synthetic trailing sequence representing current conditions
        trailing_sequence = [
            [max(0.0, w_severity - 0.1), max(0.0, delay_hrs - 1.0), 0.4],
            [max(0.0, w_severity - 0.05), max(0.0, delay_hrs - 0.5), 0.5],
            [w_severity, delay_hrs, 0.6],
            [min(1.0, w_severity + 0.1), min(24.0, delay_hrs + 1.0), 0.7],
            [min(1.0, w_severity + 0.15), min(24.0, delay_hrs + 1.5), 0.8],
            [min(1.0, w_severity + 0.2), min(24.0, delay_hrs + 2.0), 0.85],
            [min(1.0, w_severity + 0.2), min(24.0, delay_hrs + 2.5), 0.9] # Trending poorly
        ] if w_severity > 0.5 else [
            [0.1, 0.5, 0.2], [0.1, 0.5, 0.2], [w_severity, delay_hrs, 0.3],
            [0.2, 0.5, 0.3], [0.1, 0.5, 0.2], [0.1, 0.5, 0.2], [0.1, 0.5, 0.2]
        ]
        
        lstm_factor = lstm_predictor.predict(trailing_sequence)
        
        # Apply ML cascade multiplier (If LSTM says high risk, multiply score up to ~1.5x)
        final_score = min(rule_score * (1.0 + (lstm_factor * 0.5)), 100.0)
        
        alert_payload = None
        # 3. If Risk breaches critical threshold, generate AI Narrative Response
        if final_score >= self.threshold:
            narrative = await gemini_service.generate_alert_narrative(
                shipment_id=shipment.get("id"),
                current_node=curr_stage,
                next_node=shipment.get("endCustomer", "Destination"),
                weather_desc=f"{w_desc} at {weather_data.get('temp_c')}C",
                news_desc=news_data,
                risk_score=round(final_score, 1),
                lstm_multiplier=round(lstm_factor, 2)
            )
            
            alert_payload = {
                "id": f"ALT-{uuid.uuid4().hex[:6].upper()}",
                "shipmentId": shipment.get("id"),
                "severity": "critical",
                "message": narrative,
                "timestamp": None # injected later
            }
            
        return {
            "riskScore": round(final_score, 1),
            "baseScore": round(rule_score, 1),
            "lstmMultiplier": round(lstm_factor, 2),
            "isCritical": final_score >= self.threshold,
            "alert": alert_payload
        }

risk_engine = RiskEngine()
