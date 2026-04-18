import warnings
with warnings.catch_warnings():
    warnings.simplefilter("ignore", FutureWarning)
    import google.generativeai as genai
from app.config import settings

class GeminiService:
    def __init__(self):
        self.api_key = settings.GOOGLE_API_KEY
        self.model_name = settings.GEMINI_MODEL
        self.model = None
        self.initialized = False
        if self.api_key and self.api_key != "":
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel(self.model_name)
                self.initialized = True
            except Exception as e:
                print(f"[GeminiService] Initialization failed: {e}")
                self.initialized = False
            
    async def generate_alert_narrative(self, shipment_id: str, current_node: str, next_node: str,
                                       weather_desc: str, news_desc: list, risk_score: float, 
                                       lstm_multiplier: float) -> str:
        """Translates numerical and categorical risk factors into a natural language push-alert."""
        if not self.initialized:
            return f"High hazard detected for # {shipment_id} near {current_node}. Risk Score is {risk_score}/100. Action required."
            
        news_text = " ".join([n['title'] for n in news_desc]) if news_desc else "None"
        
        prompt = f"""
        You are an elite, highly professional AI supply chain monitor for the 'Smart Supply Chain' platform.
        You need to write a VERY short, urgent (but professional) 2-sentence alert notification for a logistics manager.
        
        Context for Shipment {shipment_id}:
        - Currently near: {current_node}
        - Heading to: {next_node}
        - Weather Conditions: {weather_desc}
        - Relevant Regional News: {news_text}
        - Calculated System Risk Score: {risk_score} out of 100 (where >70 is critical)
        - LSTM AI Prediction Factor: {lstm_multiplier} (0.0 to 1.0 confidence of a cascade failure)
        
        Draft a 2-sentence push notification. Sentence 1: Identify the main threat based on the context. Sentence 2: Recommend an immediate action (e.g. reroute, prepare for delay).
        Do not use hashtags. Keep it concise.
        """
        
        try:
            if not self.model:
                raise RuntimeError("Gemini model is not initialized.")
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"[GeminiService] Fallback invoked. Generation Error: {e}")
            return f"Alert: Shipment {shipment_id} facing elevated risks near {current_node} due to combined local factors. Monitor closely."

    async def generate_whatif_narrative(self, disrupted_node: str, event_type: str, severity: str,
                                        affected_shipments: int, delay_hours: float) -> str:
        """Generate a concise executive summary for what-if simulation results."""
        if not self.initialized or not self.model:
            if affected_shipments <= 0:
                return "No major impact detected. Network operations remain stable and no reroute is required."
            return (
                f"A {severity} {event_type} at {disrupted_node} impacts {affected_shipments} shipments "
                f"with an estimated {delay_hours:.1f} hours of cumulative delay. "
                "Reroute plans are ready and should be executed immediately to contain downstream impact."
            )

        prompt = f"""
        You are a supply-chain control tower assistant.
        Write exactly 2 concise sentences for an executive update.
        Event: {severity} {event_type} at node {disrupted_node}.
        Impact: {affected_shipments} affected shipments, {delay_hours:.1f} cumulative delay hours.
        Tone: urgent but in control. Include one immediate action recommendation.
        """
        try:
            response = self.model.generate_content(prompt)
            text = (response.text or "").strip()
            if text:
                return text
            raise RuntimeError("Empty Gemini response.")
        except Exception as e:
            print(f"[GeminiService] What-if fallback invoked. Generation Error: {e}")
            if affected_shipments <= 0:
                return "No major impact detected. Network operations remain stable and no reroute is required."
            return (
                f"A {severity} {event_type} at {disrupted_node} impacts {affected_shipments} shipments "
                f"with an estimated {delay_hours:.1f} hours of cumulative delay. "
                "Reroute plans are ready and should be executed immediately to contain downstream impact."
            )

gemini_service = GeminiService()
